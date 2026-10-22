const A=require('./analysis.cjs'),{profile}=require('./preferences.cjs');
class Judge{
 constructor(local,keyFor){this.local=local;this.keyFor=keyFor;}
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
