const {imageUrl}=require('./media.cjs');
const MAX_IMAGES=4;
function imageData(value){
 if(typeof value!=='string'||value.length>2000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Invalid inference image');
 const data=Buffer.from(value.slice(value.indexOf(',')+1),'base64');if(data[0]!==255||data[1]!==216)throw Error('Invalid inference image');return value;
}
function references(input){
 if(!Array.isArray(input))return [];
 const seen=new Set();return input.slice(0,12).filter(x=>x&&typeof x.url==='string'&&x.url.length<=2048&&['target','background'].includes(x.role)&&imageUrl(x.url)).map(x=>({url:imageUrl(x.url),role:x.role,kind:'photo'})).sort((a,b)=>(a.role==='target'?0:1)-(b.role==='target'?0:1)).filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;});
}
async function prepareScreenMedia(input,{download,resize,captureVideo,assertCurrent=()=>{}}){
 const refs=references(input.mediaRefs),slots=refs.slice(0,MAX_IMAGES),images=[],manifest=[];let failed=0;
 // Sequential, bounded downloads keep background memory and request bursts small.
 for(const ref of slots){assertCurrent();try{const photo=await download(ref.url);assertCurrent();images.push(imageData(await resize(photo)));manifest.push({role:ref.role,kind:'photo'});}catch(error){assertCurrent();failed++;}}
 if(input.hasVideo&&captureVideo&&images.length<MAX_IMAGES){assertCurrent();try{const frame=await captureVideo();assertCurrent();images.push(imageData(frame.dataUrl));manifest.push({role:'target',kind:frame.preview?'video-preview':'video-frame',timestamp:Number.isFinite(frame.timestamp)?frame.timestamp:null});}catch(error){assertCurrent();failed++;}}
 return {...input,images,mediaManifest:manifest,mediaOmitted:refs.length>slots.length||failed>0||Boolean(input.hasMedia&&!images.length),hasVideo:input.hasVideo===true};
}
module.exports={MAX_IMAGES,imageData,references,prepareScreenMedia};
