const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const P=require('../src/preferences.cjs'),A=require('../src/analysis.cjs'),model=require('../src/model.cjs'),reqoto=require('../src/reqoto.cjs');
const {Judge}=require('../src/judge.cjs'),page=require('../src/analysis-page.cjs');
test('existing bilingual prompts retain custom mode; new accounts use guided fields',()=>{
 const old=model.identity({prompts:{en:'MY EXISTING PROMPT',zh:'原有提示词'}});assert.equal(old.profile.promptMode,'custom');assert.equal(reqoto.promptFor(old,'en').prompt,'MY EXISTING PROMPT');
 const fresh=model.identity({profile:{persona:'Independent designer',tone:'friendly',replyLanguage:'zh'}});const prompt=reqoto.promptFor(fresh,'en').prompt;assert.ok(prompt.includes('Independent designer'));assert.ok(prompt.includes('friendly'));assert.ok(prompt.includes('实际回复请使用中文'));assert.equal(fresh.profile.enabled,false);
});
test('templates cannot copy screening consent, API keys or feedback between identities',()=>{
 const saved=P.template({name:'My tone',profile:{persona:'Brand A',engine:'jev',enabled:true,feedback:[{id:'1',text:'example',label:'reply'}],apiKey:'DO NOT COPY'}});
 for(const key of ['engine','enabled','feedback','apiKey'])assert.equal(saved.profile[key],undefined);
 assert.equal(saved.profile.persona,'Brand A');const other=model.identity({profile:saved.profile});assert.equal(other.profile.enabled,false);assert.deepEqual(other.profile.feedback,[]);
});
test('missing context and bait take precedence over a high reply relevance score',()=>{
 const response=(overrides={})=>({answers:Object.fromEntries(Object.entries({relevance:.95,contribution:.9,noise:.1,missing:.1,...overrides}).map(([k,noul])=>[k,{noul}]))});
 assert.equal(A.decisionResult(response()).label,'reply');assert.equal(A.decisionResult(response({noise:.9})).label,'skip');assert.equal(A.decisionResult(response({missing:.8})).label,'unsure');assert.throws(()=>A.decisionResult(response({noise:NaN})));
});
test('retired embedding profiles migrate to d1 without silently enabling inference',()=>{
 for(const engine of ['embedding-local','hybrid']){const p=P.profile({engine,enabled:true,persona:'Keep my persona',feedback:[{id:'1',text:'keep',label:'reply'}]});assert.equal(p.engine,'d1-local');assert.equal(p.enabled,false);assert.equal(p.persona,'Keep my persona');assert.equal(p.feedback.length,1);}
 assert.deepEqual(P.engines,['d1-local','liquid-d1','jev']);
});
test('d1 receives balanced recent feedback, excluding the current post without embedding',async()=>{
 let sent;const judge=new Judge({request:async(_k,_e,body)=>{sent=JSON.parse(body.state);return {answers:Object.fromEntries(Object.entries({relevance:.9,contribution:.9,noise:.1,missing:.1}).map(([k,noul])=>[k,{noul}]))};}},()=>null);
 const feedback=[{id:'self',text:'same',label:'reply'},...Array.from({length:7},(_,n)=>({id:String(n),text:'example '+n,label:n===0?'skip':'reply'}))];
 await judge.evaluate({id:'self',text:'new post'},{feedback,screenGoal:'find-needs',skipTopics:'crypto'});assert.deepEqual(sent.examples.map(x=>x.label),['reply','reply','skip']);assert.ok(sent.account.participation_goal.includes('explicit problems'));assert.equal(sent.account.skip_topics,'crypto');assert.ok(!JSON.stringify(sent.examples).includes('same'));
});
test('strict screening requires both relevance and useful contribution; missing media stays review',()=>{
 const response=(r,c)=>({answers:{relevance:{noul:r},contribution:{noul:c},noise:{noul:.1},missing:{noul:.1}}});
 assert.equal(A.decisionResult(response(.4,.99)).label,'unsure');
 assert.equal(A.decisionResult(response(.7,.7)).label,'reply');assert.equal(A.decisionResult(response(.7,.7),{screening:'strict'}).label,'unsure');
 const result=A.decisionResult(response(.9,.9));assert.equal(A.applyContextGuard(result,{hasMedia:true,images:[]}).label,'unsure');assert.equal(A.applyContextGuard(result,{hasMedia:true,images:['image']}).label,'reply');
 assert.equal(A.applyContextGuard(result,{hasQuotedPost:true,backgroundText:''}).reason,'missing');assert.ok(A.resultSummary(result,'zh').includes('非准确率'));
});
test('cloud adapter uses a fixed provider endpoint and never embeds credentials in body',async()=>{
 let request;const fetchImpl=async(url,options)=>{request={url,options};return new Response(JSON.stringify({answers:Object.fromEntries(['relevance','contribution','noise','missing'].map(k=>[k,{noul:.5}]))}),{status:200});};
 await A.cloudDecision('jev','test-secret',A.decisionBody({text:'quoted'},{}),fetchImpl);assert.equal(request.url,'https://api.typesafe.ai/v1/systemone');assert.equal(request.options.headers.Authorization,'Bearer test-secret');assert.ok(!request.options.body.includes('test-secret'));await assert.rejects(A.cloudDecision('unknown','key',{},fetchImpl));
});
test('browser adapters and browser-safe prompt compiler compile independently',()=>{
 new vm.Script('('+page.installAnalysis.toString()+')');new vm.Script('('+page.applyResult.toString()+')');
 const context={};vm.runInNewContext(require('node:fs').readFileSync(require.resolve('../src/preferences.cjs'),'utf8'),context);assert.equal(typeof context.ReqotoPreferences.compile,'function');
});
const {prepareScreenMedia,imageData}=require('../src/screen-media.cjs');
const fakeJpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,217]).toString('base64');
test('inference images stay outside quoted state and retain bounded media roles',()=>{
 const p=A.candidate({id:'image',text:'',hasMedia:true,images:[fakeJpeg],mediaManifest:[{role:'target',kind:'video-frame',timestamp:2.4}]});
 const body=A.decisionBody(p,{}),state=JSON.parse(body.state);assert.equal(body.images.length,1);assert.ok(!body.state.includes('base64'));assert.equal(state.supplied_images[0].kind,'video-frame');assert.equal(state.supplied_images[0].timestamp,2.4);assert.throws(()=>imageData('data:image/svg+xml;base64,ABC'));assert.throws(()=>imageData('data:image/jpeg;base64,AAAA'));assert.throws(()=>A.candidate({text:''}));assert.equal(A.candidate({text:'',hasQuotedPost:true}).hasQuotedPost,true);
});
test('screening never fetches arbitrary URLs and caps attachments with target precedence',async()=>{
 const seen=[],input={text:'test',hasMedia:true,mediaRefs:[{url:'https://example.com/private',role:'target'},...Array.from({length:6},(_,n)=>({url:'https://pbs.twimg.com/media/'+n+'.jpg',role:n===0?'background':'target'}))]};
 const r=await prepareScreenMedia(input,{download:async url=>{seen.push(url);return {};},resize:()=>fakeJpeg});assert.equal(seen.length,4);assert.equal(r.images.length,4);assert.equal(r.mediaManifest[0].role,'target');assert.ok(!seen.some(url=>url.includes('example.com')));assert.equal(r.mediaOmitted,true);
});
test('failed images remain explicit and account changes cancel media processing',async()=>{
 const input={hasMedia:true,mediaRefs:[{url:'https://pbs.twimg.com/media/a.jpg',role:'target'}]};
 const result=await prepareScreenMedia(input,{download:async()=>{throw Error('offline');},resize:()=>fakeJpeg});assert.equal(result.mediaOmitted,true);assert.equal(result.images.length,0);
 let changed=false;await assert.rejects(prepareScreenMedia(input,{assertCurrent:()=>{if(changed)throw Error('switched');},download:async()=>{changed=true;return {};},resize:()=>fakeJpeg}),/switched/);
});
test('text-only Jev adapter never receives image bytes; supplied-image decision still reaches local d1',async()=>{
 let localBody;const judge=new Judge({request:async(_k,_e,body)=>{localBody=body;return {answers:Object.fromEntries(['relevance','contribution','noise','missing'].map(k=>[k,{noul:.5}]))};}},()=>null);
 await judge.evaluate({text:'Image attached',hasMedia:true,images:[fakeJpeg]},{engine:'d1-local'});assert.equal(localBody.images.length,1);
 const original=global.fetch;let cloudBody;try{global.fetch=async(_url,opts)=>{cloudBody=JSON.parse(opts.body);return new Response(JSON.stringify({answers:Object.fromEntries(['relevance','contribution','noise','missing'].map(k=>[k,{noul:.5}]))}));};await new Judge({},()=> 'synthetic-key').evaluate({text:'Look',hasMedia:true,images:[fakeJpeg]},{engine:'jev'});assert.equal(cloudBody.images,undefined);assert.equal(JSON.parse(cloudBody.state).quoted_post.mediaOmitted,true);}finally{global.fetch=original;}
});
test('image-only cards enter screening with role-aware references and navigation clears stale queue',()=>{
 const target={getBoundingClientRect:()=>({bottom:100,top:20,width:300})},signals=[];
 const context={location:{href:'https://x.com/home'},innerHeight:700,document:{querySelectorAll:s=>s.startsWith('article')?[target]:[]},ReqotoTriageCore:{cardPost:()=>({id:'1',text:'',hasMedia:true})},ReqotoAnalysisContext:()=>({packet:{targetPost:{images:['https://pbs.twimg.com/media/one.jpg'],video:{}},backgroundPosts:[{text:'Parent context',images:['https://pbs.twimg.com/media/two.jpg']} ]}}),ReqotoPostToolbar:{configure(){},clearSignals(){},onFeedback(){},setSignal(_t,s){signals.push(s);}}};
 vm.runInNewContext(`(${page.installAnalysis.toString()})({enabled:true,language:'en',revision:'1'});ReqotoAnalysisScan();`,context);
 assert.equal(context.ReqotoAnalysisQueue.length,1);const entry=context.ReqotoAnalysisQueue[0];assert.equal(entry.post.text,'');assert.equal(entry.post.mediaRefs[1].role,'background');assert.equal(entry.post.hasVideo,true);assert.equal(entry.sourceUrl,'https://x.com/home');assert.ok(entry.post.backgroundText.includes('ancestry not verified'));
 context.location.href='https://x.com/test/status/1';vm.runInNewContext('ReqotoAnalysisScan()',context);assert.equal(context.ReqotoAnalysisQueue.length,1);assert.equal(context.ReqotoAnalysisQueue[0].sourceUrl,context.location.href);
});
test('Liquid cloud transport accepts images without placing bytes in model state',async()=>{
 let body;const response={answers:Object.fromEntries(['relevance','contribution','noise','missing'].map(k=>[k,{noul:.5}]))};
 await A.cloudDecision('liquid-d1','test-key',A.decisionBody(A.candidate({text:'Image',hasMedia:true,images:[fakeJpeg]}),{}),async(url,opts)=>{assert.equal(url,'https://api.liquid.ai/decisions/v1/systemone');body=JSON.parse(opts.body);return new Response(JSON.stringify(response));});
 assert.equal(body.model,'d1');assert.equal(body.images[0],fakeJpeg);assert.ok(!body.state.includes('base64'));
});

test('paused screening keeps a visible status badge and does not enqueue model work',()=>{
 const style={textContent:''};let enabled;
 const context={location:{href:'https://x.com/home'},document:{querySelectorAll:selector=>selector==='reqoto-post-tools'?[{shadowRoot:{querySelector:()=>style}}]:[]},ReqotoPostToolbar:{configure:x=>enabled=x.enabled,clearSignals(){},onFeedback(){}}};
 vm.runInNewContext(`(${page.installAnalysis.toString()})({enabled:false,language:'zh',revision:'off'});ReqotoAnalysisScan();`,context);
 assert.equal(enabled,false);assert.ok(style.textContent.includes('.corrections'));assert.ok(!style.textContent.includes('.signal'));assert.equal(context.ReqotoAnalysisQueue.length,0);
});
test('all decision labels are applied to the matching post toolbar',()=>{
 const one={},two={},signals=[];const context={document:{querySelectorAll:()=>[one,two]},ReqotoTriageCore:{cardPost:t=>({id:t===one?'one':'two'})},ReqotoPostToolbar:{setSignal:(target,signal)=>signals.push({target,signal})}};
 for(const label of ['reply','skip','unsure'])vm.runInNewContext(`(${page.applyResult.toString()})('two',{label:'${label}'},'test reason')`,context);
 assert.deepEqual(signals.map(x=>x.signal.state),['reply','skip','unsure']);assert.ok(signals.every(x=>x.target===two&&x.signal.title==='test reason'));
});

test('cancelled inference can retry on return but cannot clear a newer page or revision',()=>{
 const cleared=[],seen=new Map([['post','signature']]),target={};const context={ReqotoAnalysisRevision:'r1',location:{href:'https://x.com/home'},ReqotoAnalysisSeen:seen,document:{querySelectorAll:()=>[target]},ReqotoTriageCore:{cardPost:()=>({id:'post'})},ReqotoPostToolbar:{clearSignals:t=>cleared.push(t)}};
 const run=(revision,url)=>vm.runInNewContext(`(${page.releasePending.toString()})('post','${revision}','${url}')`,context);
 run('old','https://x.com/home');assert.equal(seen.size,1);run('r1','https://x.com/elsewhere');assert.equal(seen.size,1);run('r1','https://x.com/home');assert.equal(seen.size,0);assert.deepEqual(cleared,[target]);
});

 test('balanced screening accepts moderate relevant openings while strict mode stays selective',()=>{
 const {decisionResult}=require('../src/analysis.cjs');
 const result={answers:Object.fromEntries(Object.entries({relevance:.62,contribution:.4,noise:.2,missing:.1}).map(([k,noul])=>[k,{noul}]))};
 assert.equal(decisionResult(result,{screening:'balanced'}).label,'reply');
 assert.equal(decisionResult(result,{screening:'strict'}).label,'unsure');
 for(const key of ['noise','missing']){const blocked=structuredClone(result);blocked.answers[key].noul=.9;assert.notEqual(decisionResult(blocked).label,'reply');}
 });
test('scanning runs independently of inference and recycled toolbars can recover cached results',()=>{
 let tick,state='';const host={dataset:{get reqotoState(){return state;}}};
 const target={getBoundingClientRect:()=>({bottom:100,top:20,width:300}),querySelector:()=>host};
 const context={setInterval:fn=>{tick=fn;return 1;},location:{href:'https://x.com/home'},innerHeight:700,document:{querySelectorAll:s=>s.startsWith('article')?[target]:[]},ReqotoTriageCore:{cardPost:()=>({id:'one',text:'Relevant post'})},ReqotoPostToolbar:{configure(){},clearSignals(){},onFeedback(){},setSignal(_t,s){state=s.state;}}};
 vm.runInNewContext(`(${page.installAnalysis.toString()})({enabled:true,language:'en',revision:'1'});`,context);
 assert.equal(typeof tick,'function');tick();assert.equal(context.ReqotoAnalysisQueue.length,1);
 context.ReqotoAnalysisQueue.shift();tick();assert.equal(context.ReqotoAnalysisQueue.length,0);
 state='reply';tick();assert.equal(context.ReqotoAnalysisQueue.length,0);
 state='';tick();assert.equal(context.ReqotoAnalysisQueue.length,1);assert.equal(state,'checking');
});
test('fast path asks one question and skips media for self-contained text',async()=>{
 let calls=0,media=0;
 const judge=new Judge({request:async(_k,_e,body)=>{calls++;assert.deepEqual(Object.keys(body.questions),['worth_reply']);assert.equal(body.images,undefined);return {answers:{worth_reply:{noul:.8}}};}},()=>null);
 const r=await judge.evaluateFast({text:'I have been testing account switching workflows for a multi-brand browser workspace. Would displaying the active brand beside the reply composer prevent accidental posts?',hasMedia:true},{},{prepareMedia:()=>{media++;}});
 assert.equal(r.label,'reply');assert.equal(calls,1);assert.equal(media,0);assert.equal(r.timings.visual,false);
});
test('fast path requests visual context only when needed and retains missing-media review',async()=>{
 let calls=0;const judge=new Judge({request:async()=>{calls++;return {answers:{worth_reply:{noul:.8}}};}},()=>null);
 const r=await judge.evaluateFast({text:'What do you think?',hasMedia:true},{},{prepareMedia:async()=>({text:'What do you think?',hasMedia:true,images:[fakeJpeg],mediaManifest:[{role:'target',kind:'photo'}]})});
 assert.equal(calls,2);assert.equal(r.label,'reply');assert.equal(r.timings.visual,true);
 const missing=await judge.evaluateFast({text:'',hasMedia:true},{},{prepareMedia:async()=>({text:'',hasMedia:true,mediaOmitted:true})});assert.equal(missing.label,'unsure');assert.equal(missing.reason,'missing');
});
test('fast decision rejects invalid scores and keeps borderline as review',()=>{
 assert.throws(()=>A.fastResult({answers:{worth_reply:{noul:NaN}}}));
 assert.equal(A.fastResult({answers:{worth_reply:{noul:.4}}}).label,'unsure');
 assert.equal(A.fastResult({answers:{worth_reply:{noul:.2}}}).label,'skip');
});
test('queue drops offscreen work and makes it retryable when visible again',()=>{
 const off={post:{id:'off'}},on={post:{id:'on'}};
 const target={getBoundingClientRect:()=>({top:10,bottom:200})};
 const context={innerHeight:700,document:{querySelectorAll:()=>[target]},ReqotoTriageCore:{cardPost:()=>({id:'on'})},ReqotoAnalysisQueue:[off,on],ReqotoAnalysisSeen:new Map([['off','signature']])};
 assert.equal(vm.runInNewContext(`(${page.nextEntry.toString()})()`,context),on);assert.equal(context.ReqotoAnalysisSeen.has('off'),false);
});
test('text-only browsing does not run a visual second pass and keeps media-dependent content review',async()=>{
 let calls=0;const judge=new Judge({request:async()=>{calls++;return {answers:{worth_reply:{noul:.8}}};}},()=>null);
 const result=await judge.evaluateFast({text:'Look at this image',hasMedia:true},{});
 assert.equal(calls,1);assert.equal(result.label,'unsure');assert.equal(result.media.imageCount,0);
});
test('cancelled screening cannot initiate another model request',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const judge=new Judge({request:async()=>{calls++;}},()=>null);
 await assert.rejects(judge.evaluateFast({text:'Synthetic post'},{},{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,0);
});
