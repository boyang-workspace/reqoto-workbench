const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {enableWebPopups}=require('../src/popups.cjs');
function contents(){const wc=new EventEmitter();wc.session={name:'isolated session'};wc.setWindowOpenHandler=handler=>wc.open=handler;return wc;}
const environment={owner:()=>({isDestroyed:()=>false,getBounds:()=>({x:0,y:0,width:1400,height:900})}),screen:{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1440,height:900}}),getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1440,height:900}})}};
test('popup options override hidden and offscreen webpage features while retaining the opener session',()=>{
 const wc=contents();enableWebPopups(wc,environment);const result=wc.open({url:'https://example.com',features:'show=no,left=-10000,top=-10000'}),o=result.overrideBrowserWindowOptions;
 assert.equal(o.show,true);assert.equal(o.focusable,true);assert.equal(o.opacity,1);assert.ok(o.x>=0&&o.y>=0&&o.x+o.width<=1440&&o.y+o.height<=900);assert.equal(o.webPreferences.session,wc.session);assert.equal(o.webPreferences.nodeIntegration,false);assert.equal(o.webPreferences.sandbox,true);assert.equal(o.webPreferences.contextIsolation,true);
});
test('new and nested popup windows become visible and focused without waiting for remote page loading',()=>{
 const wc=contents();enableWebPopups(wc,environment);let shown=0,focused=0,restored=0;
 const child=new EventEmitter();child.webContents=contents();Object.assign(child,{isDestroyed:()=>false,isMinimized:()=>true,restore(){restored++;},show(){shown++;},focus(){focused++;},setMenuBarVisibility(){},getBounds:()=>({x:0,y:0,width:520,height:720})});wc.emit('did-create-window',child);
 assert.ok(shown>0&&focused>0&&restored>0);assert.equal(typeof child.webContents.open,'function');
});
test('popups still reject executable URLs and preserve about:blank OAuth openers',()=>{
 const wc=contents();enableWebPopups(wc,environment);for(const url of ['file:///tmp/private','javascript:alert(1)','https://user:pass@example.com'])assert.equal(wc.open({url}).action,'deny');assert.equal(wc.open({url:'about:blank'}).action,'allow');
 let blocked=false;wc.emit('will-redirect',{preventDefault(){blocked=true;}},'file:///tmp/private');assert.equal(blocked,true);
});
