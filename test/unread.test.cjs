const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {detectXUnread,updateUnread}=require('../src/unread.cjs');
const node=(text='',attributes={})=>({textContent:text,getAttribute:key=>attributes[key]??null});
const link=(label='',children=[])=>({...node('',{'aria-label':label}),querySelectorAll:()=>children});
const read=(links,host='x.com')=>vm.runInNewContext(`(${detectXUnread.toString()})()`,{location:{hostname:host},document:{querySelectorAll:selector=>{assert.ok(selector.includes('AppTabBar_Notifications_Link'));assert.ok(!selector.includes('article'));return links;}}});
test('X unread dot follows positive English/Chinese navigation badges and message badges',()=>{
 assert.equal(read([link('Notifications (3 unread notifications)')]).hasUnread,true);
 assert.equal(read([link('通知',[node('1',{'aria-label':'1 条未读通知'})])]).hasUnread,true);
 assert.equal(read([link('Messages',[node('2')])]).hasUnread,true);
 assert.equal(read([link('Notifications',[node('',{'data-testid':'notificationIndicator'})])]).hasUnread,true);
});
test('zero/read badges clear the dot; unrelated pages and missing navigation are unknown',()=>{
 for(const links of [[link('Notifications')],[link('Notifications (0 unread notifications)')],[link('通知',[node('0')])],[link('Notifications',[node('9',{'aria-hidden':'true'})])]])assert.equal(read(links).hasUnread,false);
 assert.equal(read([]),null);assert.equal(read([link('9 unread')],'example.com'),null);
});
test('unread state is owned by a detected handle and never transferred to another account',()=>{
 const a={platform:'X',status:'signed-in',handle:'@a'},b={...a,handle:'@b'},previous={handle:'@a',hasUnread:true};
 assert.deepEqual(updateUnread(previous,a,null),previous);assert.equal(updateUnread(previous,b,null),null);
 assert.deepEqual(updateUnread(previous,a,{hasUnread:false}),{handle:'@a',hasUnread:false});
 assert.equal(updateUnread(previous,{platform:'X',status:'signed-out'},null),null);
 assert.equal(updateUnread(previous,{...a,platform:'小红书'},{hasUnread:true}),null);
});
