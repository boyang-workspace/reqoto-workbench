const A=require('./analysis.cjs'),{profile}=require('./preferences.cjs');
class Judge{
 constructor(local,keyFor){this.local=local;this.keyFor=keyFor;}
 async evaluateFast(input,settings,{prepareMedia}={}){
  const started=performance.now(),p=profile(settings),post=A.candidate({...input,images:[],mediaManifest:[]});
  const history=p.feedback.filter(x=>x.id!==post.id&&x.text.trim());
  const examples=['reply','skip'].flatMap(label=>history.filter(x=>x.label===label).slice(-2));
  let inferenceMs=0,mediaMs=0,visual=false;
  const run=async candidate=>{
   const body=A.fastBody(candidate,p,examples),t=performance.now();let raw;
   if(['jev','liquid-d1'].includes(p.engine)){
    const config=A.cloud[p.engine],key=this.keyFor(p.engine);if(!key)throw Error('API key required');
    const r=await fetch(config.endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({...body,model:config.model}),signal:AbortSignal.timeout(45000)});
    if(!r.ok)throw Error(`Model HTTP ${r.status}`);raw=await r.json();
   }else raw=await this.local.request('d1','/v1/systemone',body);
   inferenceMs+=performance.now()-t;return A.fastResult(raw,p);
  };
  let result=await run(post),judged=post;
  const requiresMedia=A.visualNeeded(post,result);
  if(requiresMedia&&prepareMedia&&p.engine!=='jev'){
   const t=performance.now();judged=A.candidate(await prepareMedia());mediaMs=performance.now()-t;
   if(judged.images.length){visual=true;result=await run(judged);}
  }
  // Media-dependent candidates stay review when usable context was unavailable.
  if(requiresMedia)result=A.applyContextGuard(result,{...judged,mediaOmitted:judged.mediaOmitted||!judged.images.length});
  if(post.hasQuotedPost&&!post.backgroundText.trim())result=A.applyContextGuard(result,post);
  return {...result,engine:p.engine,retrievedExampleIds:examples.map(x=>x.id),media:{imageCount:judged.images.length,videoSamples:judged.mediaManifest.filter(x=>x.kind.startsWith('video-')).length,omitted:judged.mediaOmitted},timings:{totalMs:Math.round(performance.now()-started),inferenceMs:Math.round(inferenceMs),mediaMs:Math.round(mediaMs),visual}};
 }
 async evaluate(input,settings){
  const post=A.candidate(input),p=profile(settings);const history=p.feedback.filter(x=>x.id!==post.id&&x.text.trim());
  const examples=['reply','skip'].flatMap(label=>history.filter(x=>x.label===label).slice(-2));
  // Jev is text-only: explicitly mark unavailable visuals instead of sending image bytes.
  const judged=p.engine==='jev'?{...post,images:[],mediaManifest:[],mediaOmitted:post.hasMedia||post.mediaOmitted}:post;
  const body=A.decisionBody(judged,p,examples.map(({text,label})=>({text,label})));
  const result=['jev','liquid-d1'].includes(p.engine)?await A.cloudDecision(p.engine,this.keyFor(p.engine),body,fetch,p):A.decisionResult(await this.local.request('d1','/v1/systemone',body),p);
  return {...A.applyContextGuard(result,judged),retrievedExampleIds:examples.map(x=>x.id),media:{imageCount:judged.images.length,videoSamples:judged.mediaManifest.filter(x=>x.kind.startsWith('video-')).length,omitted:judged.mediaOmitted},engine:p.engine};
 }
}
module.exports={Judge};
