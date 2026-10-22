const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../src/layout.cjs');
test('opening settings never changes social or AI viewport bounds',()=>{
 const a=L.geometry(1440,900,184,.52),b=L.geometry(1440,900,184,.52,true);assert.deepEqual(a.social,b.social);assert.deepEqual(a.ai,b.ai);assert.ok(b.drawerWidth<=b.social.width-24);
});
test('maximum social width reserves only 220px for AI and survives persisted ratios',()=>{
 const g=L.geometry(1440,900,184,1);assert.equal(g.ai.width,220);assert.equal(g.social.width,1035);assert.ok(g.ratio>.75);assert.equal(L.geometry(1440,900,184,g.ratio).social.width,g.social.width);
});
test('desktop X zoom keeps a readable floor and produces a desktop viewport when space allows',()=>{
 assert.equal(L.socialZoom(650,'https://x.com/home'),1);assert.equal(L.socialZoom(1100,'https://example.com'),1);const z=L.socialZoom(1030,'https://x.com/home');assert.ok(z>=.8&&z<=1);assert.ok(1030/z>=1279);
});
test('video crops convert zoomed CSS coordinates into native view coordinates',()=>{
 assert.deepEqual(L.captureRect({x:100,y:50,width:600,height:300},{width:800,height:700},.8),{x:80,y:40,width:480,height:240});assert.throws(()=>L.captureRect({x:900,y:0,width:100,height:100},{width:800,height:700},1));
});
test('collapsed account rail preserves room for both native panes',()=>{
 const g=L.geometry(1440,900,64,.52);assert.equal(g.left,64);assert.equal(g.social.x,64);assert.ok(g.ai.width>=220);assert.ok(g.middle> L.geometry(1440,900,184,.52).middle);
});

test('both browser panes start directly below the single 38px toolbar',()=>{for(const left of [64,184,300]){const g=L.geometry(1440,900,left,.52);assert.equal(g.social.y,38);assert.equal(g.ai.y,38);assert.equal(g.social.height,862);}});

test('social and AI views leave exactly a single physical layout pixel for the divider',()=>{for(const width of [1080,1440,1920])for(const sidebar of [64,140,300])for(const ratio of [.2,.5,.9]){const g=L.geometry(width,800,sidebar,ratio);assert.equal(g.ai.x-g.social.x-g.social.width,1);assert.equal(g.ai.x+g.ai.width,width);}});
