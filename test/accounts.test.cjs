const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const {detectAccount,label}=require('../src/accounts.cjs');
function detect(nodes,href='https://x.com/home'){return vm.runInNewContext('('+detectAccount.toString()+')()',{location:new URL(href),URL,document:{querySelector:s=>nodes[s]||null}});}
test('label follows signed-in account controls, not a configured name',()=>{
 const result=detect({'[data-testid="SideNav_AccountSwitcher_Button"]':{innerText:'The YUPs\n@theyups'},'a[data-testid="AppTabBar_Profile_Link"]':{href:'https://x.com/theyups'}});
 assert.equal(result.handle,'@theyups');assert.equal(result.name,'The YUPs');assert.equal(label({name:'Wrong preset',account:result}).name,'The YUPs');
});
test('timeline authors and stale presets cannot establish a signed-in identity',()=>{
 const result=detect({});assert.equal(result.status,'unknown');assert.notEqual(label({name:'Wrong preset',socialUrl:'https://x.com/home',account:result}).name,'Wrong preset');
});
test('avatar is read only from the signed-in control and restricted to profile images',()=>{
 const nodes={'[data-testid="SideNav_AccountSwitcher_Button"]':{innerText:'Brand\n@brand',querySelector:s=>s==='img[src]'?{src:'https://pbs.twimg.com/profile_images/brand/avatar.jpg'}:null},'a[data-testid="AppTabBar_Profile_Link"]':{href:'https://x.com/brand'}};
 assert.equal(detect(nodes).avatarUrl,'https://pbs.twimg.com/profile_images/brand/avatar.jpg');
 nodes['[data-testid="SideNav_AccountSwitcher_Button"]'].querySelector=()=>({src:'https://evil.test/avatar.jpg'});
 assert.equal(detect(nodes).avatarUrl,'');
});
test('login route is signed out; localization applies to account status',()=>{
 const result=detect({},'https://x.com/i/flow/login');assert.equal(result.status,'signed-out');assert.equal(label({socialUrl:'https://x.com',account:result},'en').detail,'Sign in');
});
