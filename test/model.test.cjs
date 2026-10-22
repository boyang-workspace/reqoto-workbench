const { test } = require('node:test');
const assert = require('node:assert/strict');
const { identity, partitions, captureText, url } = require('../src/model.cjs');
test('social identities isolate sessions; AI login shared per provider', () => {
 const a = identity({ name:'A' }), b = identity({ name:'B' }), c = identity({ name:'C',provider:'grok' });
 assert.notEqual(partitions(a).social, partitions(b).social);
 assert.equal(partitions(a).ai, partitions(b).ai);
 assert.notEqual(partitions(a).ai, partitions(c).ai);
});
test('AI workspace is independent from account selection and rejects wrong destinations',()=>{
 const {aiState,aiTarget}=require('../src/model.cjs');
 const ai=aiState({provider:'chatgpt',urls:{chatgpt:'https://chatgpt.com/c/task'}});
 const next=aiTarget(ai,'grok');
 assert.equal(next.provider,'grok');assert.equal(next.urls.chatgpt,'https://chatgpt.com/c/task');assert.equal(ai.provider,'chatgpt');
 assert.throws(()=>aiTarget(ai,'grok','https://chatgpt.com/c/task'));
 assert.equal(aiState({urls:{chatgpt:'https://evil.test'}}).urls.chatgpt,'https://chatgpt.com/');
});
test('account reordering preserves identities and rejects duplicates or unknown IDs',()=>{
 const {reorder}=require('../src/model.cjs'),a=identity({}),b=identity({});
 assert.deepEqual(reorder([a,b],[b.id,a.id]),[b,a]);
 for(const ids of [[a.id,a.id],[a.id],[a.id,'missing']])assert.throws(()=>reorder([a,b],ids));
});
test('reject executable addresses, credentials and cross-provider bindings', () => {
 for (const value of ['javascript:alert(1)','file:///etc/passwd','http://x.com','https://user:pass@x.com']) assert.throws(() => url(value));
 assert.throws(() => identity({name:'A',aiUrl:'https://evil.test'}));
 assert.throws(() => identity({name:'A',provider:'unknown'}));
});
test('capture carries correct identity, source and prompt; empty capture fails', () => {
 const a = {...identity({prompt:'Use our brand voice'}),account:{status:'signed-in',name:'The YUPs',handle:'@theyups'}};
 const text = captureText(a,'https://x.com/example/status/1','Example post');
 for (const part of ['The YUPs','Use our brand voice','https://x.com/example/status/1','Example post']) assert.ok(text.includes(part));
 assert.throws(() => captureText(a,'https://x.com','  '));
});
test('removing the current account selects a neighbour and leaves AI and other settings intact',()=>{
 const {removeIdentity}=require('../src/model.cjs'),a=identity({}),b=identity({profile:{persona:'Keep this'}}),c=identity({});
 const items=[a,b,c],next=removeIdentity(items,b.id,b.id);assert.deepEqual(next.identities,[a,c]);assert.equal(next.active,c.id);assert.equal(items[1].profile.persona,'Keep this');
 assert.equal(removeIdentity(items,c.id,c.id).active,b.id);assert.equal(removeIdentity(items,a.id,b.id).active,b.id);assert.deepEqual(removeIdentity([a],a.id,a.id),{identities:[],active:null});assert.throws(()=>removeIdentity(items,'missing',a.id));
});
