const {imageUrl}=require('./media.cjs');
function validFrame(frame){
 return frame?.mimeType==='image/jpeg'&&typeof frame.data==='string'&&frame.data.length>0&&frame.data.length<=2000000&&/^[A-Za-z0-9+/]+={0,2}$/.test(frame.data)&&Buffer.from(frame.data,'base64').subarray(0,2).equals(Buffer.from([255,216]));
}
async function preparePacket(input,{download,captureVideo,language='en'}){
 const packet=structuredClone(input),zh=language==='zh';packet.warnings||=[];packet.backgroundPosts||=[];
 const target=packet.targetPost;
 for(const background of packet.backgroundPosts)if(background.video&&!background.video.frames?.length)packet.warnings.push(zh?'对话背景中的视频未采样。':'Video frames from the conversation background are not included.');
 if(target.video){
  target.video.frames=(target.video.frames||[]).filter(validFrame).slice(0,3);
  if(!target.video.frames.length&&packet.videoRect&&captureVideo){try{const sample=await captureVideo(packet.videoRect);if(validFrame(sample))target.video.frames=[sample];}catch{}}
  if(!target.video.frames.length)packet.warnings.push(zh?'视频未能采样，不能根据视频链接推断画面或声音。':'Video sampling unavailable; do not infer its visuals or audio from its link.');
 }
 const slots=[],seen=new Set();
 function add(post,role){
  for(const frame of post.video?.frames||[]){if(slots.length<4)slots.push({postId:post.id,role,frame});}
  for(const address of post.images||[]){if(seen.has(address))continue;seen.add(address);if(!imageUrl(address)){packet.warnings.push(zh?'部分图片地址不受支持，未随附。':'An unsupported image URL was not attached.');continue;}if(slots.length<4)slots.push({postId:post.id,role,address});else packet.warnings.push(zh?'媒体超过 4 个，部分未随附。':'More than four media items; some are omitted.');}
 }
 add(target,'target');for(const background of packet.backgroundPosts)add(background,'background');
 const results=await Promise.all(slots.map(async(slot,index)=>{
  try{const image=slot.frame||await download(slot.address);const ext={'image/jpeg':'jpg','image/png':'png','image/gif':'gif'}[image.mimeType];if(!ext)throw Error('Unsupported image');return {...slot,image:{...image,name:`x-post-${slot.frame?'video-frame':'image'}-${index+1}.${ext}`}};}catch{return {...slot,error:true};}
 }));
 const attachments=results.filter(r=>r.image).map(r=>r.image);
 if(results.some(r=>r.error))packet.warnings.push(zh?'部分图片下载失败，未随附；请检查附件预览。':'Some images failed to download and were not attached; check the previews.');
 packet.mediaSummary=results.filter(r=>r.image).map((r,index)=>`${zh?'附件':'Attachment'} ${index+1}: ${r.role==='target'?(zh?'目标帖子':'target post'):(zh?'对话背景':'conversation background')} ${r.postId}; ${r.frame?(zh?'视频画面采样（非完整视频、无音频）':'video frame sample (not the full video; no audio)'):(zh?'原帖图片':'post image')}${Number.isFinite(r.frame?.timestamp)?`; ${r.frame.timestamp.toFixed(1)}s`:''}`).join('\n');
 if(target.video?.frames?.length&&packet.videoRect?.preview)packet.warnings.push(zh?'视频尚未载入播放，随附的是当前预览画面。':'The video is not loaded for playback; the attached image is its current preview.');
 packet.warnings=[...new Set(packet.warnings)];
 return {packet,attachments};
}
module.exports={preparePacket,validFrame};
