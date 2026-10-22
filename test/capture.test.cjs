const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');
const {imageUrl,downloadImage}=require('../src/media.cjs');
const {preparePacket}=require('../src/capture-delivery.cjs');
const {collectContext}=require('../src/capture-context.cjs');
const reqoto=require('../src/reqoto.cjs'),model=require('../src/model.cjs');
test('media downloader only accepts platform CDN image paths',()=>{
 assert.ok(imageUrl('https://pbs.twimg.com/media/photo.jpg'));
 for(const url of ['https://evil.test/photo.jpg','https://pbs.twimg.com.evil.test/media/x','https://user:pw@pbs.twimg.com/media/x','https://pbs.twimg.com:8080/media/x','file:///etc/passwd','https://pbs.twimg.com/not-media'])assert.equal(imageUrl(url),'');
 assert.ok(imageUrl('https://pbs.twimg.com/profile_images/user.jpg','avatar'));
 assert.equal(imageUrl('https://pbs.twimg.com/media/feed.jpg','avatar'),'');
});
test('oversize or mismatched image content is rejected before attachment',async()=>{
 const ses={fetch:async()=>new Response('not a PNG',{headers:{'content-type':'image/png'}})};
 await assert.rejects(downloadImage(ses,'https://pbs.twimg.com/media/x'));
});
test('capture media is bounded, deduplicated and assigned to target/background',async()=>{
 const image={mimeType:'image/png',data:'iVBORw0KGgo='},addresses=[];
 const input={targetPost:{id:'2',images:['https://pbs.twimg.com/media/a','https://pbs.twimg.com/media/b']},backgroundPosts:[{id:'1',images:['https://pbs.twimg.com/media/a','https://pbs.twimg.com/media/c','https://pbs.twimg.com/media/d','https://pbs.twimg.com/media/e']}],warnings:[]};
 const {packet,attachments}=await preparePacket(input,{download:async address=>{addresses.push(address);return image;}});
 assert.equal(attachments.length,4);assert.equal(new Set(addresses).size,4);assert.ok(packet.mediaSummary.includes('background'));assert.ok(packet.warnings.some(s=>s.includes('omitted')));assert.equal(input.warnings.length,0);
});
test('failed media and unavailable video are explicit, never silently complete',async()=>{
 const {packet,attachments}=await preparePacket({targetPost:{id:'2',images:['https://pbs.twimg.com/media/a'],video:{}},backgroundPosts:[],warnings:[]},{download:async()=>{throw Error('offline');}});
 assert.equal(attachments.length,0);assert.ok(packet.warnings.some(s=>s.includes('Video sampling')));assert.ok(packet.warnings.some(s=>s.includes('failed')));
});
test('video screenshot fallback produces an explicitly labelled sample',async()=>{
 const {packet,attachments}=await preparePacket({targetPost:{id:'2',video:{}},backgroundPosts:[],warnings:[],videoRect:{time:12.5}},{download:async()=>{},captureVideo:async()=>({mimeType:'image/jpeg',data:Buffer.from([255,216,255,217]).toString('base64'),timestamp:12.5})});
 assert.equal(attachments.length,1);assert.ok(packet.mediaSummary.includes('12.5s'));assert.ok(packet.mediaSummary.includes('not the full video'));
});
function context(conversation){
 const post={id:'2',url:'https://x.com/target/status/2',text:'target'},root={id:'1',url:'https://x.com/root/status/1',text:'background'};
 const target={closest:()=>conversation?{}:null,querySelector:()=>null,querySelectorAll:()=>[]};
 return vm.runInNewContext('('+collectContext.toString()+')(target)',{target,location:{href:root.url},document:{},globalThis:{XCaptureExtract:{extractTimelinePost:()=>({ok:true,post}),statusIdFromUrl:()=>root.id,extractMainPost:()=>({ok:true,post:root})}}});
}
test('reply context uses the explicit conversation region; unrelated cards get no invented parent',()=>{
 assert.equal(context(false).packet.backgroundPosts.length,0);
 const result=context(true).packet;assert.equal(result.backgroundPosts[0].id,'1');assert.equal(result.targetPost.id,'2');assert.ok(result.warnings.some(s=>s.includes('not verified')));
});
test('account prompt languages stay independent, including legacy migration',()=>{
 const i=model.identity({prompt:'English legacy prompt'});
 assert.equal(reqoto.promptFor(i,'en').prompt,'English legacy prompt');assert.notEqual(reqoto.promptFor(i,'zh').prompt,'English legacy prompt');
 i.prompts.zh='中文自定义';i.promptLanguage='zh';assert.equal(reqoto.promptFor(i,'en').prompt,'中文自定义');
});
test('reused composer adapter and new source injection compile',()=>{
 new vm.Script(reqoto.aiSource());new vm.Script(reqoto.installSource('zh','grok'));
});
test('context formatter explicitly targets the reply and quotes root as background',()=>{
 const text=reqoto.packetText({prompts:{en:'CUSTOM'},account:{name:'Brand',handle:'@brand'}},{targetPost:{id:'2',author:'Reply author',text:'TARGET REPLY',url:'https://x.com/reply/status/2',images:[]},backgroundPosts:[{id:'1',text:'BACKGROUND',url:'https://x.com/root/status/1'}],warnings:[]},'en');
 for(const value of ['@brand','CUSTOM','TARGET REPLY','BACKGROUND','Respond to the selected reply'])assert.ok(text.includes(value));
});
