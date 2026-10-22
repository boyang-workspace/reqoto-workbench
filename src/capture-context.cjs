// Runs inside the isolated social renderer. Never infer a parent from adjacency.
function collectContext(target) {
 const extract=globalThis.XCaptureExtract;
 const result=extract.extractTimelinePost(target);
 if(!result.ok)return result;
 const post=result.post,backgroundPosts=[],warnings=[];
 const focalId=extract.statusIdFromUrl(location.href);
 let conversation=target.closest('[aria-label="Timeline: Conversation"],[aria-label="时间线：对话"],[aria-label="时间线: 对话"]');
 if(conversation&&[...(conversation.querySelectorAll?.('h2,[role="heading"]')||[])].some(heading=>/discover more|发现更多|探索更多/i.test(heading.textContent||'')&&(heading.compareDocumentPosition(target)&4)))conversation=null;
 if(focalId&&focalId!==post.id&&conversation){
  const focal=extract.extractMainPost(document,location.href);
  if(focal.ok){backgroundPosts.push({...focal.post,role:'thread-focus'});warnings.push('Thread focus included; the original root and intermediate ancestry are not verified.');}
  else warnings.push('The conversation background could not be read.');
 }else if(target.querySelector('[data-testid="replyingTo"],[data-testid="reply-to"]'))warnings.push('Reply ancestry is not loaded; only the selected reply is included.');
 const video=[...target.querySelectorAll('video')].find(el=>!extract.isQuoteMedia(el,target));
 let videoRect=null;
 if(video){const r=video.getBoundingClientRect(),x=Math.max(0,Math.ceil(r.x)),y=Math.max(0,Math.ceil(r.y)),right=Math.min(innerWidth,Math.floor(r.right)),bottom=Math.min(innerHeight,Math.floor(r.bottom));if(right-x>80&&bottom-y>60)videoRect={x,y,width:right-x,height:bottom-y,time:Number.isFinite(video.currentTime)?video.currentTime:null,preview:video.readyState<2};}
 return {ok:true,packet:{version:1,targetPost:post,backgroundPosts,contextStatus:backgroundPosts.length?'thread-focus':'selected-post',warnings,videoRect,sourceUrl:location.href,capturedAt:Date.now()}};
}
module.exports={collectContext};
