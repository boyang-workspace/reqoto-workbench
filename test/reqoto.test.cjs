const test=require('node:test');
const assert=require('node:assert/strict');
const {postText,installSource,composerExpression}=require('../src/reqoto.cjs');
test('post context preserves quoted material and warns about incomplete media',()=>{
 const text=postText({author:'Author',text:'Visible post',quotedPost:{text:'Quote'},images:['https://example.com/a.jpg'],video:{url:'https://example.com/v'},incomplete:true});
 for(const value of ['Author','Visible post','Quote','not uploaded','video content not imported','Partial visible post'])assert.ok(text.includes(value));
});
test('Reqoto composer finder excludes editable message blocks',()=>{
 const vm=require('node:vm'),code=composerExpression();
 assert.ok(code.includes('findComposer'));
 function editor(inMessage){return {disabled:false,readOnly:false,isConnected:true,isContentEditable:true,getAttribute:()=>null,getClientRects:()=>[{width:100,height:40}],closest:()=>inMessage?{}:null,getRootNode:()=>({})};}
 const writingBlock=editor(true),composer=editor(false);
 const context={location:{hostname:'chatgpt.com'},document:{querySelectorAll:()=>[writingBlock,composer]},getComputedStyle:()=>({visibility:'visible'}),HTMLTextAreaElement:class{}};
 assert.equal(vm.runInNewContext(code,context),composer);
 context.document.querySelectorAll=()=>[writingBlock];
 assert.equal(vm.runInNewContext(code,context),null);
});
test('public distribution contains working capture and AI adapters',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const reqoto=require('../src/reqoto.cjs');
 for(const name of ['capture-core.js','chatgpt-fill.js','composer-find.js','locale.js','personal-profile.js','post-toolbar.js','triage-core.js','x-extract.js'])assert.ok(fs.statSync(path.join(__dirname,'../src/reqoto-adapter',name)).size>0);
 for(const language of ['en','zh'])for(const provider of ['chatgpt','grok']){
  const code=installSource(language,provider);assert.ok(code.length>1000);new vm.Script(code);
 }
 assert.ok(reqoto.aiSource().length>1000);new vm.Script(reqoto.aiSource());
 for(const language of ['en','zh'])assert.ok(reqoto.defaultPrompts()[language].length>20);
});
