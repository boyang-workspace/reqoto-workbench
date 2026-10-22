// Runs only in an isolated temporary Electron profile; never touches user logins.
const { app, session } = require('electron');
const assert = require('node:assert/strict');
const { partitions, identity } = require('../src/model.cjs');
if (!process.env.REQOTO_TEST_DATA) { console.error('REQOTO_TEST_DATA temporary directory is required'); app.exit(1); }
else app.setPath('userData', process.env.REQOTO_TEST_DATA);
app.whenReady().then(async () => {
 try {
  const a = {...identity({name:'A'}),id:'test-a'}, b = {...identity({name:'B'}),id:'test-b'};
  const sa=session.fromPartition(partitions(a).social), sb=session.fromPartition(partitions(b).social);
  assert.equal(session.fromPartition(partitions(a).ai),session.fromPartition(partitions(b).ai));
  if (process.argv.includes('--write')) {
   await sa.cookies.set({url:'https://reqoto.test',name:'identity',value:'A',expirationDate:Math.floor(Date.now()/1000)+3600});
   await sb.cookies.set({url:'https://reqoto.test',name:'identity',value:'B',expirationDate:Math.floor(Date.now()/1000)+3600});
   await sa.cookies.flushStore();await sb.cookies.flushStore();
  }
  assert.equal((await sa.cookies.get({name:'identity'}))[0].value,'A');
  assert.equal((await sb.cookies.get({name:'identity'}))[0].value,'B');
  console.log('PASS: real Electron social cookie isolation and shared AI session'+(process.argv.includes('--write')?'':' after restart'));
  app.exit(0);
 } catch (e) { console.error(e);app.exit(1); }
});
