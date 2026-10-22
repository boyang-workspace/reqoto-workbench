// Only public platform CDN images may be downloaded; never arbitrary post URLs.
function imageUrl(value,kind='photo'){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
  if(kind==='avatar')return ((u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/profile_images/'))||/(^|\.)xhscdn\.com$/.test(u.hostname))?u.href:'';
  return u.hostname==='pbs.twimg.com'&&/^\/(media|ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\//.test(u.pathname)?u.href:'';
 }catch{return '';}
}
async function downloadImage(ses,address,kind='photo'){
 const target=imageUrl(address,kind);if(!target)throw Error('Unsupported media URL');
 const response=await ses.fetch(target,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Media download failed');
 const type=response.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/gif'].includes(type))throw Error('Unsupported media type');
 const limit=kind==='avatar'?1024*1024:8*1024*1024;
 if(Number(response.headers.get('content-length'))>limit)throw Error('Image too large');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Image too large');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}
 const data=Buffer.concat(chunks.map(c=>Buffer.from(c)));
 const valid=type==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?data[0]===255&&data[1]===216:data.subarray(0,3).toString()==='GIF';
 if(!valid)throw Error('Invalid image');return {mimeType:type,data:data.toString('base64')};
}
module.exports={imageUrl,downloadImage};
