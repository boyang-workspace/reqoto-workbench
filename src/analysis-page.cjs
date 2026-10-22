// Runs in the same isolated world as the post toolbar; does not navigate or scroll.
function installAnalysis(options){
 globalThis.ReqotoAnalysisOptions=options;
 globalThis.ReqotoAnalysisQueue||=[];globalThis.ReqotoFeedbackQueue||=[];
 if(!globalThis.ReqotoAnalysisSeen)globalThis.ReqotoAnalysisSeen=new Map();
 if(globalThis.ReqotoAnalysisRevision!==options.revision){globalThis.ReqotoAnalysisSeen.clear();globalThis.ReqotoAnalysisQueue.length=0;globalThis.ReqotoPostToolbar?.clearSignals();globalThis.ReqotoAnalysisRevision=options.revision;}
 globalThis.ReqotoPostToolbar?.configure({language:options.language,enabled:options.enabled});
 document.querySelectorAll('reqoto-post-tools').forEach(host=>{const style=host.shadowRoot?.querySelector('[data-desktop-style]');if(style)style.textContent=options.enabled?'':'.corrections{display:none!important}';});
 if(globalThis.ReqotoAnalysisInstalled)return;
 globalThis.ReqotoAnalysisInstalled=true;
 globalThis.ReqotoPostToolbar?.onFeedback((target,label)=>{const post=globalThis.ReqotoTriageCore?.cardPost(target);if(post&&['reply','skip'].includes(label))globalThis.ReqotoFeedbackQueue.push({post,label,revision:globalThis.ReqotoAnalysisOptions.revision});});
 globalThis.ReqotoAnalysisScan=()=>{
  if(globalThis.ReqotoAnalysisUrl!==location.href){globalThis.ReqotoAnalysisUrl=location.href;globalThis.ReqotoAnalysisQueue.length=0;globalThis.ReqotoAnalysisSeen.clear();globalThis.ReqotoPostToolbar?.clearSignals();}
  const options=globalThis.ReqotoAnalysisOptions;if(!options?.enabled||globalThis.ReqotoAnalysisQueue.length>=8)return;
  for(const target of document.querySelectorAll('article[data-testid="tweet"]')){
   const rect=target.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight||rect.width<20)continue;
   const post=globalThis.ReqotoTriageCore?.cardPost(target);if(!post||!post.text&&!post.hasMedia&&!post.hasQuotedPost)continue;
   globalThis.ReqotoAnalysisQuick||=new Map();
   const fingerprint=JSON.stringify([post.text,post.hasMedia,post.hasQuotedPost,[...(target.querySelectorAll?.('img')||[])].map(el=>el.currentSrc||el.src)]);
   if(globalThis.ReqotoAnalysisSeen.has(post.id)&&globalThis.ReqotoAnalysisQuick.get(post.id)===fingerprint&&target.querySelector?.('reqoto-post-tools')?.dataset.reqotoState)continue;
   globalThis.ReqotoAnalysisQuick.set(post.id,fingerprint);if(globalThis.ReqotoAnalysisQuick.size>500)globalThis.ReqotoAnalysisQuick.delete(globalThis.ReqotoAnalysisQuick.keys().next().value);
   const context=globalThis.ReqotoAnalysisContext?.(target)?.packet;
   const own=context?.targetPost;if(typeof own?.text==='string')post.text=own.text.slice(0,6000);post.mediaRefs=[...(own?.images||[]).map(url=>({url,role:'target'})),...(context?.backgroundPosts||[]).flatMap(p=>(p.images||[]).map(url=>({url,role:'background'})))].slice(0,12);post.hasVideo=Boolean(own?.video);post.backgroundText=(context?.backgroundPosts||[]).map(p=>'Conversation focus (ancestry not verified): '+p.text).join('\n').slice(0,2000);
   const signature=JSON.stringify([post.text,post.hasMedia,post.hasQuotedPost,post.mediaRefs,post.hasVideo,post.backgroundText]);if(globalThis.ReqotoAnalysisSeen.get(post.id)===signature){
    // X recycles post DOM nodes; restore results through the main-process cache.
    const host=target.querySelector?.('reqoto-post-tools');
    if(host?.dataset.reqotoState)continue;
   }
   globalThis.ReqotoAnalysisSeen.set(post.id,signature);if(globalThis.ReqotoAnalysisSeen.size>500)globalThis.ReqotoAnalysisSeen.delete(globalThis.ReqotoAnalysisSeen.keys().next().value);
   globalThis.ReqotoAnalysisQueue.push({post,revision:options.revision,sourceUrl:location.href,enqueuedAt:Date.now()});globalThis.ReqotoPostToolbar?.setSignal(target,{state:'checking',title:options.language==='zh'?'正在本地筛选…':'Analyzing…'});if(globalThis.ReqotoAnalysisQueue.length>=8)break;
  }
 };
 // Scan independently of slow model requests so newly visible posts get queued.
 globalThis.ReqotoAnalysisTimer=globalThis.setInterval?.(()=>globalThis.ReqotoAnalysisScan?.(),600);
}
function postVisible(id){
 for(const target of document.querySelectorAll('article[data-testid="tweet"]'))if(globalThis.XCaptureExtract?.cardIdentity(target)?.id===id){const r=target.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}
 return false;
}
function nextEntry(){
 const queue=globalThis.ReqotoAnalysisQueue||[];
 const visible=new Set([...document.querySelectorAll('article[data-testid="tweet"]')].filter(target=>{const r=target.getBoundingClientRect();return r.bottom>=0&&r.top<=innerHeight;}).map(target=>globalThis.ReqotoTriageCore?.cardPost(target)?.id));
 for(let n=queue.length-1;n>=0;n--)if(!visible.has(queue[n].post.id)){
  const [entry]=queue.splice(n,1);globalThis.ReqotoAnalysisSeen?.delete(entry.post.id);
  for(const target of document.querySelectorAll('article[data-testid="tweet"]'))if(globalThis.ReqotoTriageCore?.cardPost(target)?.id===entry.post.id)globalThis.ReqotoPostToolbar?.clearSignals(target);
 }
 return queue.shift();
}
function applyResult(id,result,title){
 for(const target of document.querySelectorAll('article[data-testid="tweet"]'))if(globalThis.ReqotoTriageCore?.cardPost(target)?.id===id)globalThis.ReqotoPostToolbar?.setSignal(target,{state:result.label,title,manual:result.manual});
}
// An interrupted inference must be eligible for retry after switching back.
function releasePending(id,revision,url){
 if(globalThis.ReqotoAnalysisRevision!==revision||location.href!==url)return;
 globalThis.ReqotoAnalysisSeen?.delete(id);
 for(const target of document.querySelectorAll('article[data-testid="tweet"]'))if(globalThis.ReqotoTriageCore?.cardPost(target)?.id===id)globalThis.ReqotoPostToolbar?.clearSignals(target);
}
module.exports={postVisible,nextEntry,installAnalysis,applyResult,releasePending};
