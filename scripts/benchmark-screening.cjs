// Run explicitly with Node outside the sandbox if loopback access is restricted.
// Uses existing d1 weights only. No social accounts, telemetry or cloud calls.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {LocalModels,discovery}=require('../src/local-models.cjs'),{Judge}=require('../src/judge.cjs');
const corpus=require('../test/fixtures/screening-corpus.cjs');
const output=path.resolve(process.argv[2]||path.join(__dirname,'../docs/research/screening-benchmark.json'));
const local=new LocalModels({paths:discovery('/private/tmp/reqoto-benchmark')}),judge=new Judge(local,()=>{throw Error('Cloud calls disabled in benchmark');});
const variants=['text_d1','visual_d1','visual_d1_no_examples'];
const report={createdAt:new Date().toISOString(),dataset:'32 author-labelled synthetic cases: 24 text/missing-context, 8 visual',limitations:'Fixtures are authored, not user labels. No accuracy claim for real feeds. Fixed prompts/thresholds; no tuning on these cases. All timings include sequential model requests; cold start is separate.',machine:{arch:os.arch(),cpus:os.cpus().length,memoryGB:Math.round(os.totalmem()/1024**3)},model:'d1-3B-Q8_0 + mmproj Q8_0',variants,results:[]};
const quantile=(v,p)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor((v.length-1)*p))];
function summarize(rows){const total=rows.length,correct=rows.filter(x=>x.actual===x.expected).length,recommended=rows.filter(x=>x.actual==='reply'),positives=rows.filter(x=>x.expected==='reply'),tp=recommended.filter(x=>x.expected==='reply').length;return {n:total,correct,accuracy:correct/total,replyPrecision:recommended.length?tp/recommended.length:null,replyRecall:positives.length?tp/positives.length:null,replyCount:recommended.length,reviewCount:rows.filter(x=>x.actual==='unsure').length,falsePositiveIds:recommended.filter(x=>x.expected!=='reply').map(x=>x.id),missedReplyIds:positives.filter(x=>x.actual!=='reply').map(x=>x.id),p50Ms:quantile(rows.map(x=>x.elapsedMs),.5),p95Ms:quantile(rows.map(x=>x.elapsedMs),.95)};}
(async()=>{try{
 let started=Date.now();await local.start('d1');report.coldStartMs=Date.now()-started;
 for(const row of corpus.rows){
  const history=corpus.histories[row.persona].map(([label,text],n)=>({id:'history-'+row.persona+'-'+n,label,text}));
  for(const variant of variants){
   const image=row.image&&variant!=='text_d1'?'data:image/jpeg;base64,'+fs.readFileSync(path.join(__dirname,'../test/fixtures/vision',row.image+'.jpg')).toString('base64'):null;
   const post={id:row.id,text:row.text,hasMedia:Boolean(row.image||['missing','video'].includes(row.missing)),hasVideo:row.missing==='video',hasQuotedPost:row.missing==='quote',images:image?[image]:[],mediaManifest:image?[{role:'target',kind:row.missing==='video'?'video-frame':'photo'}]:[],mediaOmitted:Boolean((row.image&&!image)||row.missing==='missing')};
   const settings={...corpus.profiles[row.persona],engine:'d1-local',feedback:variant==='visual_d1_no_examples'?[]:history};
   started=Date.now();const result=await judge.evaluate(post,settings);const entry={id:row.id,persona:row.persona,visual:Boolean(row.image),variant,expected:row.expected,actual:result.label,scores:result.scores,elapsedMs:Date.now()-started,reason:result.reason};
   report.results.push(entry);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({progress:report.results.length+'/'+(corpus.rows.length*variants.length),...entry}));
  }
 }
 report.summary=Object.fromEntries(variants.map(v=>{const rows=report.results.filter(x=>x.variant===v);return [v,{all:summarize(rows),text:summarize(rows.filter(x=>!x.visual)),visual:summarize(rows.filter(x=>x.visual))}];}));
 fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({summary:report.summary}));
 }finally{local.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
