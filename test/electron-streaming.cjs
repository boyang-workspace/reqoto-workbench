// Synthetic timer/paint probe; no ChatGPT requests, account data or remote network.
const {app,BrowserWindow,WebContentsView}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'reqoto-stream-probe-')));
app.whenReady().then(async()=>{let win,server;try{
 server=require('node:http').createServer((req,res)=>{
  if(req.url!=='/stream'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<pre id="output"></pre>');return;}
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.flushHeaders();let n=0;
  const timer=setInterval(()=>{res.write('data: word\n\n');if(++n===80){clearInterval(timer);res.end();}},25);res.on('close',()=>clearInterval(timer));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;

 win=new BrowserWindow({width:1000,height:600,show:false,webPreferences:{sandbox:true,contextIsolation:true}});
 await win.loadURL('data:text/html,<h1>Stream probe</h1>');
 const ai=new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});win.contentView.addChildView(ai);ai.setBounds({x:500,y:0,width:500,height:600});
 const social=new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true}});win.contentView.addChildView(social);social.setBounds({x:0,y:0,width:500,height:600});
 await ai.webContents.loadURL(base);await social.webContents.loadURL('data:text/html,<h1>Social focus</h1>');win.show();social.webContents.focus();
 for(const throttle of [true,false]){
  ai.webContents.setBackgroundThrottling(throttle);
  const result=await ai.webContents.executeJavaScript(`(async()=>{const start=performance.now();const response=await fetch('/stream');const reader=response.body.getReader();let chunks=0,firstByteMs;for(;;){const {done,value}=await reader.read();if(done)break;if(firstByteMs===undefined)firstByteMs=Math.round(performance.now()-start);chunks++;document.getElementById('output').textContent+=new TextDecoder().decode(value);}const receiveDoneMs=Math.round(performance.now()-start);const paint=await Promise.race([new Promise(resolve=>requestAnimationFrame(()=>resolve(Math.round(performance.now()-start)))),new Promise(resolve=>setTimeout(()=>resolve(null),1000))]);return {hidden:document.hidden,chunks,firstByteMs,receiveDoneMs,paintMs:paint,paintLagMs:paint===null?null:paint-receiveDoneMs};})()`);

  console.log(JSON.stringify({socialFocused:true,backgroundThrottling:throttle,...result}));
  if(!throttle&&(result.paintLagMs===null||result.paintLagMs>250))throw Error('Visible AI streaming paint stalled');
 }
 win.destroy();server.close();app.exit(0);
 }catch(e){console.error(e.message);win?.destroy();server?.close();app.exit(1);}});
