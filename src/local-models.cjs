const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
function discovery(data,resources=process.resourcesPath||''){
 const first=paths=>paths.find(p=>p&&fs.existsSync(p))||paths.find(Boolean);
 return {runtime:first([process.env.REQOTO_LLAMA_SERVER,path.join(resources,'reqoto-runtime/bin/llama-server'),path.join(data,'runtime/bin/llama-server')]),
  d1:first([process.env.REQOTO_D1_MODEL,path.join(data,'models/d1-3B-Q8_0.gguf')])};
}
async function freePort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
class LocalModels{
 constructor({paths,onChange=()=>{}}){this.paths=Object.fromEntries(Object.entries(paths).filter(([key])=>['runtime','d1','mmproj'].includes(key)));this.onChange=onChange;this.slots={};this.closed=false;}
 projector(){const selected=this.paths.mmproj;return selected||(this.paths.d1?path.join(path.dirname(this.paths.d1),'mmproj-d1-3B-Q8_0.gguf'):'');}
 status(){return {vision:fs.existsSync(this.projector()),projector:this.projector(),paths:{...this.paths},runtime:fs.existsSync(this.paths.runtime),d1:{available:fs.existsSync(this.paths.d1),phase:this.slots.d1?.phase||'stopped',error:this.slots.d1?.error||''}};}
 notify(){if(!this.closed)this.onChange(this.status());}
 setPath(key,value){if(!['runtime','d1','mmproj'].includes(key)||!path.isAbsolute(value)||!fs.statSync(value).isFile())throw Error('Invalid model path');if(key!=='runtime'&&!value.endsWith('.gguf'))throw Error('Choose a GGUF model');this.stop(key==='runtime'?null:key==='mmproj'?'d1':key);this.paths[key]=value;this.notify();}
 async start(key){
  if(this.closed)throw Error('Local runtime closed');
  if(key!=='d1')throw Error('Invalid model');
  const existing=this.slots[key];if(existing?.phase==='ready')return existing;if(existing?.promise)return existing.promise;
  if(!fs.existsSync(this.paths.runtime)||!fs.existsSync(this.paths[key]))throw Error('Local model or runtime not found');
  const slot={phase:'starting',token:randomBytes(32).toString('hex')};this.slots[key]=slot;this.notify();
  slot.promise=(async()=>{
   slot.port=await freePort();if(this.closed||this.slots[key]!==slot)throw Error('Model start cancelled');
   const args=['-m',this.paths[key],'--host','127.0.0.1','--port',String(slot.port),'-c','8192','-np','1','-ngl','99','--threads','4','--cors-origins','localhost','--no-cors-credentials'];
   if(key==='d1'&&fs.existsSync(this.projector()))args.push('--mmproj',this.projector());
   const env={...process.env,LLAMA_API_KEY:slot.token};for(const name of Object.keys(env))if(name.startsWith('DYLD_'))delete env[name];
   slot.child=spawn(this.paths.runtime,args,{env,stdio:['ignore','ignore','pipe']});
   // Do not retain inference inputs, bearer tokens or raw model logs.
   slot.child.stderr.on('data',()=>{});
   slot.child.once('error',()=>{slot.phase='error';slot.error='Local runtime could not start';this.notify();});
   slot.child.once('exit',code=>{if(this.slots[key]===slot){slot.phase=code===0?'stopped':'error';slot.error=code===0?'':'Local runtime stopped; check model compatibility';this.notify();}});
   for(let n=0;n<180;n++){
    if(this.closed||this.slots[key]!==slot||slot.phase==='error')throw Error(slot.error||'Model start cancelled');
    try{const r=await fetch(`http://127.0.0.1:${slot.port}/health`,{headers:{Authorization:'Bearer '+slot.token},signal:AbortSignal.timeout(800)});if(r.ok){slot.phase='ready';this.notify();return slot;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   throw Error('Local model startup timed out');
  })().catch(error=>{slot.child?.kill('SIGTERM');slot.phase='error';slot.error=error.message;this.notify();throw error;}).finally(()=>{delete slot.promise;});
  return slot.promise;
 }
 async request(key,endpoint,body){if(key==='d1'&&body.images?.length&&!fs.existsSync(this.projector()))throw Error('Choose the d1 vision projector (mmproj GGUF) to analyze images');const slot=await this.start(key);const r=await fetch(`http://127.0.0.1:${slot.port}${endpoint}`,{method:'POST',headers:{Authorization:'Bearer '+slot.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(`Local model HTTP ${r.status}`);return r.json();}
 stop(key){for(const name of key?[key]:Object.keys(this.slots)){const slot=this.slots[name];delete this.slots[name];slot?.child?.kill('SIGTERM');}this.notify();}
 close(){this.closed=true;this.stop();}
}
module.exports={LocalModels,discovery};
