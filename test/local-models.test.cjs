const {test}=require('node:test'),assert=require('node:assert/strict');
const {LocalModels}=require('../src/local-models.cjs');
test('retired model paths are ignored and embedding cannot be started',async()=>{
 const local=new LocalModels({paths:{runtime:'/private/tmp/no-runtime',d1:'/private/tmp/no-d1',embedding:'/private/tmp/keep-model.gguf',embeddingBackend:'ollama'}});
 assert.deepEqual(Object.keys(local.paths),['runtime','d1']);assert.equal(local.status().embedding,undefined);await assert.rejects(local.start('embedding'),/Invalid model/);assert.equal(local.embed,undefined);assert.equal(local.downloadEmbedding,undefined);local.close();
});

test('closing local runtime terminates owned children without publishing state to a destroyed UI',()=>{let updates=0,killed=0;const local=new LocalModels({paths:{runtime:'/none',d1:'/none'},onChange:()=>updates++});local.slots.d1={child:{kill:()=>killed++}};local.close();assert.equal(killed,1);assert.equal(updates,0);local.notify();assert.equal(updates,0);});


test('public model discovery uses application data without a sibling private checkout',()=>{
 const {discovery}=require('../src/local-models.cjs');
 const result=discovery('/private/tmp/reqoto-test-empty-data','/private/tmp/reqoto-test-empty-resources');
 if(!process.env.REQOTO_LLAMA_SERVER)assert.equal(result.runtime,'/private/tmp/reqoto-test-empty-resources/reqoto-runtime/bin/llama-server');
 if(!process.env.REQOTO_D1_MODEL)assert.equal(result.d1,'/private/tmp/reqoto-test-empty-data/models/d1-3B-Q8_0.gguf');
});
test('aborted local inference never launches the model',async()=>{
 const controller=new AbortController();controller.abort();const local=new LocalModels({paths:{}});let starts=0;
 local.start=async()=>{starts++;};await assert.rejects(local.request('d1','/v1/systemone',{}, {signal:controller.signal}),{name:'AbortError'});assert.equal(starts,0);local.close();
});
