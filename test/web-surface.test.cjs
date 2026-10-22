const {test}=require('node:test');const assert=require('node:assert/strict');
const {clipboardWriteAllowed,REMOTE_CSS}=require('../src/web-surface.cjs');
const wc={isDestroyed:()=>false,getURL:()=> 'https://chatgpt.com/c/fixture'};
test('allow normal HTTPS page copy without granting clipboard read or other permissions',()=>{
 assert.equal(clipboardWriteAllowed(wc,'clipboard-sanitized-write','https://chatgpt.com'),true);
 for(const permission of ['clipboard-read','deprecated-sync-clipboard-read','media','unknown'])assert.equal(clipboardWriteAllowed(wc,permission,'https://chatgpt.com'),false);
 for(const origin of ['https://evil.test','file:///tmp/test','invalid'])assert.equal(clipboardWriteAllowed(wc,'clipboard-sanitized-write',origin),false);
 assert.equal(clipboardWriteAllowed(null,'clipboard-sanitized-write','https://chatgpt.com'),false);
});
test('remote page drag regions are disabled including pseudo elements',()=>{assert.match(REMOTE_CSS,/\*::before,\*::after,\*/);assert.match(REMOTE_CSS,/-webkit-app-region:no-drag!important/);});

// The frequent state path must not synchronously consult macOS Keychain.
test('render state updates never probe keychain when running local models',()=>{
 const source=require('node:fs').readFileSync(require.resolve('../src/main.cjs'),'utf8');
 const send=source.slice(source.indexOf("function send(message='')"),source.indexOf('function layout()'));
 assert.ok(!send.includes('safeStorage.'));assert.ok(send.includes('keyStorage'));
});
