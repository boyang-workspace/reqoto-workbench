const {configureWebSession,REMOTE_CSS}=require('./web-surface.cjs');
const { app, BrowserWindow, WebContentsView, ipcMain, clipboard, dialog, session, screen, Menu, nativeImage, nativeTheme, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const model = require('./model.cjs');
const accounts = require('./accounts.cjs');
const {detectXUnread,updateUnread}=require('./unread.cjs');
const reqoto = require('./reqoto.cjs');
const media = require('./media.cjs');
const geometry=require('./layout.cjs');
const {enableWebPopups}=require('./popups.cjs');
const {preparePacket}=require('./capture-delivery.cjs');
const {collectContext}=require('./capture-context.cjs');
const {prepareScreenMedia}=require('./screen-media.cjs');
const translate = require('./messages.cjs');
const preferences=require('./preferences.cjs'),analysis=require('./analysis.cjs'),analysisPage=require('./analysis-page.cjs');
const {LocalModels,discovery}=require('./local-models.cjs'),{Judge}=require('./judge.cjs');
app.setName('Reqoto Workbench');
if (process.env.REQOTO_TEST_DATA) app.setPath('userData', path.resolve(process.env.REQOTO_TEST_DATA));
if(!app.requestSingleInstanceLock()){app.exit(0);}
app.on('second-instance',()=>{if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}});
Menu.setApplicationMenu(Menu.buildFromTemplate([{ label:'Reqoto', submenu:[{role:'about'},{type:'separator'},{role:'quit'}] },{role:'editMenu'},{role:'viewMenu'},{role:'windowMenu'}]));
let win, settingsView, storageError=false, overlay=false, settingsOpen=false, resizeKind=null, railDrag=null, railScroll=0, suppressSelectUntil=0,localModels,judge;
let keyStorage='session';
const keys={},analysisCache=new Map();let analysisBusy=false;let aiActivity={at:0,busy:false};
let state={identities:[],active:null,ratio:.52,sidebar:184,sidebarCollapsed:false,lang:'zh',ai:model.aiState(),theme:'system',templates:[]};
const panes=new Map(), aiPanes=new Map();
const file=()=>path.join(app.getPath('userData'),'workspace.json');
const item=()=>state.identities.find(i=>i.id===state.active);
const aiPane=()=>aiPanes.get(state.ai.provider);
function save(){
 if(storageError)throw Error('设置文件损坏，已停止写入；请先备份修复并重启');
 fs.mkdirSync(path.dirname(file()),{recursive:true});
 fs.writeFileSync(file()+'.tmp',JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(file()+'.tmp',file());
}
function send(message=''){
 if(!win||win.isDestroyed())return;
 for(const wc of [win?.webContents,settingsView?.webContents])if(wc&&!wc.isDestroyed())wc.send('state',{...state,identities:state.identities.map(i=>({...i,hasUnread:unreadByIdentity.get(i.id)?.handle===i.account?.handle&&unreadByIdentity.get(i.id)?.hasUnread===true})),testMode:!!process.env.REQOTO_TEST_DATA,settingsOpen,effectiveTheme:nativeTheme.shouldUseDarkColors?'dark':'light',models:localModels?.status(),cloudKeys:Object.fromEntries(['jev','liquid-d1'].map(key=>[key,Boolean(keys[key])])),keyStorage,drag:railDrag?.moved?{id:railDrag.id,y:railDrag.y,offset:railDrag.offset}:null,defaults:reqoto.defaultPrompts(),promptTemplates:reqoto.promptTemplates(),message:translate(message,state.lang),aiPage:aiPane()?.status,pages:Object.fromEntries([...panes].map(([id,p])=>[id,{social:p.status}]))});
}
function layout(){
 if(!win||win.isDestroyed())return;
 const [width,height]=win.getContentSize(),g=geometry.geometry(width,height,state.sidebarCollapsed?64:state.sidebar,state.ratio);state.ratio=g.ratio;
 for(const [id,p]of panes){p.view.setVisible(id===state.active&&!overlay&&p.status?.phase!=='error');p.view.setBounds(g.social);const wc=p.view.webContents;if(!wc.isDestroyed()){const zoom=geometry.socialZoom(g.middle,wc.getURL());if(Math.abs(wc.getZoomFactor()-zoom)>.005)wc.setZoomFactor(zoom);}}
 for(const [provider,p]of aiPanes){p.view.setVisible(provider===state.ai.provider&&!overlay&&p.status?.phase!=='error');p.view.setBounds(g.ai);}
 if(settingsView){
  settingsView.setBounds(settingsOpen?g.social:{x:g.social.x,y:height-12,width:12,height:12});
  settingsView.setVisible(!overlay);
  if(!overlay&&win.contentView.children.at(-1)!==settingsView)win.contentView.addChildView(settingsView);
 }

}
const avatarCache=new Map(),unreadByIdentity=new Map();
async function detect(i){
 const wc=panes.get(i.id)?.view.webContents;if(!wc||wc.isDestroyed())return;
 try{
  const snapshot=await wc.executeJavaScript(`({account:(${accounts.detectAccount.toString()})(),unread:(${detectXUnread.toString()})()})`),account=snapshot.account;
  const previousUnread=unreadByIdentity.get(i.id),nextUnread=updateUnread(previousUnread,account,snapshot.unread);
  const unreadChanged=JSON.stringify(previousUnread||null)!==JSON.stringify(nextUnread);
  if(nextUnread)unreadByIdentity.set(i.id,nextUnread);else unreadByIdentity.delete(i.id);
  if(account.avatarUrl){
   if(!avatarCache.has(account.avatarUrl))avatarCache.set(account.avatarUrl,media.downloadImage(wc.session,account.avatarUrl,'avatar').then(image=>nativeImage.createFromBuffer(Buffer.from(image.data,'base64')).resize({width:96,height:96,quality:'best'}).toDataURL()).catch(()=>''));
   account.avatar=await avatarCache.get(account.avatarUrl);
  }
  if(JSON.stringify(i.account)!==JSON.stringify(account)){
   const previous=i.lastAccountHandle||i.account?.handle;
   if(previous&&account.status==='signed-in'&&previous!==account.handle){i.accountProfiles||={};i.accountProfiles[previous]={prompt:i.prompt,prompts:i.prompts,promptLanguage:i.promptLanguage,profile:i.profile};Object.assign(i,{prompt:'',prompts:{},promptLanguage:'auto',profile:preferences.profile()},i.accountProfiles[account.handle]||{});i.profile=preferences.profile(i.profile);installToolbar(i).catch(()=>{});}
   if(account.status==='signed-in')i.lastAccountHandle=account.handle;
   i.account=account;i.name=account.status==='signed-in'?(account.name||account.handle):'';save();send();
  }else if(unreadChanged)send();
 }catch{}
}
function trackResize(wc){wc.on('before-mouse-event',(event,mouse)=>{
 if(!win||mouse.button==='right')return;
 const bounds=win.getContentBounds(),point=Number.isFinite(mouse.globalX)?{x:mouse.globalX,y:mouse.globalY}:screen.getCursorScreenPoint(),x=point.x-bounds.x,y=point.y-bounds.y;
 const left=state.sidebarCollapsed?64:state.sidebar,split=left+Math.round((bounds.width-left-1)*state.ratio)+.5;
 if(!overlay){
  if(wc===win.webContents&&mouse.type==='mouseDown'&&mouse.button==='left'&&x>0&&x<left-6&&y>=68&&y<bounds.height-40){const index=Math.floor((y-68+railScroll)/51);if(state.identities[index])railDrag={id:state.identities[index].id,startY:y,y,offset:y-(68+index*51-railScroll),moved:false};}
  if(railDrag&&mouse.type==='mouseMove'&&x>=0&&x<left&&Math.abs(y-railDrag.startY)>5){
   railDrag.moved=true;railDrag.y=y;event.preventDefault();const from=state.identities.findIndex(i=>i.id===railDrag.id),to=Math.max(0,Math.min(state.identities.length-1,Math.floor((y-68+railScroll)/51)));
   if(from!==to){const [entry]=state.identities.splice(from,1);state.identities.splice(to,0,entry);}send();
  }
  if(railDrag&&mouse.type==='mouseUp'){const moved=railDrag.moved;railDrag=null;if(moved){event.preventDefault();suppressSelectUntil=Date.now()+250;save();send();}}
 }

 if(mouse.type==='mouseDown'&&y>=0){if(!state.sidebarCollapsed&&Math.abs(x-left)<=5)resizeKind='rail';else if(Math.abs(x-split)<=5)resizeKind='pane';if(resizeKind)event.preventDefault();}
 if(resizeKind&&mouse.type==='mouseMove'){event.preventDefault();if(resizeKind==='rail')state.sidebar=Math.max(140,Math.min(300,x));else state.ratio=geometry.geometry(bounds.width,bounds.height,left,(x-left)/(bounds.width-left-1)).ratio;layout();send();}
 if(resizeKind&&mouse.type==='mouseUp'){event.preventDefault();resizeKind=null;save();send();}
});}
function createPane(partition,id,side){
 const ses=session.fromPartition(partition);configureWebSession(ses);
 const view=new WebContentsView({webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:side!=='ai'}}),wc=view.webContents;
 const pane={view,status:{phase:'loading'}};trackResize(wc);
 wc.on('dom-ready',()=>{wc.insertCSS(REMOTE_CSS,{cssOrigin:'user'}).catch(()=>{});});
 const status=(phase,extra={})=>{pane.status={phase,url:wc.getURL(),...extra};layout();send();};
 wc.on('did-start-loading',()=>status('loading'));
 wc.on('did-stop-loading',()=>{if(pane.status.phase!=='error')status('ready');});
 wc.on('did-fail-load',(_e,code,description,url,main)=>{if(main&&code!==-3)status('error',{code,description,url});});
 wc.on('render-process-gone',()=>status('error',{description:'Page process stopped'}));
 wc.on('did-finish-load',()=>{if(!wc.getURL().startsWith('https:')||pane.status.phase==='error')return;status('ready');const i=state.identities.find(i=>i.id===id);if(side==='social'&&i){detect(i);installToolbar(i).catch(()=>{});}});
 const remember=address=>{try{if(side==='social'){const i=state.identities.find(i=>i.id===id);if(i)i.socialUrl=model.url(address);}else if(new URL(address).origin===new URL(model.providers[id]).origin){if(id===state.ai.provider&&address!==state.ai.urls[id])cancelDelivery();state.ai.urls[id]=model.url(address);}save();}catch{}};
 wc.on('did-navigate',(_e,address)=>remember(address));wc.on('did-navigate-in-page',(_e,address,main)=>{if(main)remember(address);});
 wc.on('context-menu',()=>Menu.buildFromTemplate([{role:'copy'},{role:'paste'},{role:'selectAll'}]).popup());
 enableWebPopups(wc,{owner:()=>win,screen});win.contentView.addChildView(view);return pane;
}
function cancelDelivery(){for(const pane of aiPanes.values())if(!pane.view.webContents.isDestroyed())pane.view.webContents.executeJavaScriptInIsolatedWorld(reqoto.AI_WORLD,[{code:'globalThis.ReqotoDesktopCancelled=true'}]).catch(()=>{});}
async function activateAI(provider,address){
 if(provider!==state.ai.provider||address&&address!==state.ai.urls[provider])cancelDelivery();
 const target=model.aiTarget(state.ai,provider,address);state.ai=target;
 if(!aiPanes.has(provider)){
  const pane=createPane('persist:ai-'+provider,provider,'ai');aiPanes.set(provider,pane);pane.view.webContents.loadURL(target.urls[provider]).catch(()=>{});
 }else if(address&&aiPanes.get(provider).view.webContents.getURL()!==target.urls[provider])await aiPanes.get(provider).view.webContents.loadURL(target.urls[provider]).catch(()=>{});
 save();layout();send();for(const i of state.identities)installToolbar(i).catch(()=>{});
}
async function activate(id){
 const i=state.identities.find(i=>i.id===id);if(!i)throw Error('身份不存在');
 if(state.active!==id)cancelDelivery();
 const old=panes.get(state.active)?.view.webContents;
 if(old&&!old.isDestroyed())old.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:'globalThis.ReqotoDesktopGeneration=(globalThis.ReqotoDesktopGeneration||0)+1;if(globalThis.ReqotoDesktopQueue)ReqotoDesktopQueue.length=0;if(globalThis.ReqotoPostToolbar)ReqotoPostToolbar.setBusy(false);'}]).catch(()=>{});
 state.active=id;
 if(!panes.has(id)){const pane=createPane(model.partitions(i).social,id,'social');panes.set(id,pane);pane.view.webContents.loadURL(i.socialUrl).catch(()=>{});}
 save();layout();send();installToolbar(i).catch(()=>{});
}
function revision(i){return JSON.stringify([i.id,i.account?.handle,i.profile,state.lang,state.modelPaths]);}
async function installToolbar(i){
 const code=reqoto.installSource(state.lang,state.ai.provider),wc=panes.get(i.id)?.view.webContents;
 if(code&&wc&&!wc.isDestroyed()){
  await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code}]);
  const options={enabled:i.profile?.enabled===true,language:state.lang,revision:revision(i)};
  await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:`globalThis.ReqotoAnalysisContext=${collectContext.toString()};(${analysisPage.installAnalysis.toString()})(${JSON.stringify(options)})`}]);
 }
}
async function aiGenerating(){
 const wc=aiPane()?.view.webContents;if(!wc||wc.isDestroyed())return false;
 if(Date.now()-aiActivity.at<450)return aiActivity.busy;
 aiActivity.at=Date.now();
 try{aiActivity.busy=await wc.executeJavaScript(`Boolean(document.querySelector('button[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="停止生成"],button[aria-label="Stop response"]'))`);}catch{aiActivity.busy=false;}
 return aiActivity.busy;
}
async function pollAnalysis(){
 if(analysisBusy||overlay||settingsOpen||!win?.isVisible()||win.isMinimized()||!item()?.profile?.enabled)return;
 const i=item(),wc=panes.get(i.id)?.view.webContents;if(!wc||wc.isDestroyed()||!/^https:\/\/(www\.)?(x|twitter)\.com\//.test(wc.getURL()))return;
 if(await aiGenerating())return;
 if(analysisBusy)return;
 analysisBusy=true;const rev=revision(i),sourceUrl=wc.getURL();let entry,monitor;
 const assertCurrent=()=>{if(revision(i)!==rev||state.active!==i.id||wc.isDestroyed()||wc.getURL()!==sourceUrl||overlay||settingsOpen||!win?.isVisible()||win.isMinimized())throw Error('Screening context changed');};
 try{
  const result=await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:'(() => {globalThis.ReqotoAnalysisScan?.();return {feedback:globalThis.ReqotoFeedbackQueue?.shift(),entry:('+analysisPage.nextEntry.toString()+')(),account:('+accounts.detectAccount.toString()+')()};})()'}]);
  entry=result.entry;
  if(revision(i)!==rev||state.active!==i.id)throw Error('Screening context changed');
  if(result.account?.status!=='signed-in'||result.account.handle!==i.account?.handle)return;
  if(result.feedback?.revision===rev){
   const p=analysis.candidate(result.feedback.post),previous=i.profile.feedback.find(x=>x.id===p.id);i.profile.feedback=i.profile.feedback.filter(x=>x.id!==p.id);if(previous?.label!==result.feedback.label)i.profile.feedback.push({id:p.id,text:p.text,label:result.feedback.label});i.profile.feedback=i.profile.feedback.slice(-100);save();analysisCache.clear();await installToolbar(i);send();return;
  }
  entry=result.entry;if(!entry||entry.revision!==rev||entry.sourceUrl!==sourceUrl)return;
  const queueMs=Math.max(0,Date.now()-(entry.enqueuedAt||Date.now()));
  const key=JSON.stringify([rev,entry.post]);let target=analysisCache.get(key);let probing=false;
  const controller=new AbortController();
  const watch=async()=>{if(probing)return;probing=true;try{assertCurrent();const visible=await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:`(${analysisPage.postVisible.toString()})(${JSON.stringify(entry.post.id)})`}]);if(!visible||await aiGenerating())controller.abort();}catch{controller.abort();}finally{probing=false;}};
  if(!target){
   monitor=setInterval(watch,500);
   const prepareMedia=async()=>['d1-local','liquid-d1'].includes(i.profile.engine)?await prepareScreenMedia(entry.post,{assertCurrent,download:address=>media.downloadImage(wc.session,address),resize:inferencePhoto,captureVideo:async()=>{assertCurrent();const rect=await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:reqoto.videoRectSource(entry.post.id)}]);assertCurrent();if(!rect)throw Error('Video not visible');const crop=geometry.captureRect(rect,panes.get(i.id).view.getBounds(),wc.getZoomFactor());const shot=await wc.capturePage(crop);assertCurrent();return {dataUrl:inferencePhoto({mimeType:'image/png',data:shot.toPNG().toString('base64')}),timestamp:rect.time,preview:rect.preview};}}):entry.post;
   assertCurrent();target=i.profile.screening==='strict'?await judge.evaluate(i.profile.screenImages?await prepareMedia():entry.post,i.profile,{signal:controller.signal}):await judge.evaluateFast(entry.post,i.profile,{prepareMedia:i.profile.screenImages?prepareMedia:undefined,signal:controller.signal});
  }
  assertCurrent();const current=await wc.executeJavaScript('('+accounts.detectAccount.toString()+')()');assertCurrent();if(current?.handle!==i.account?.handle||current?.status!=='signed-in')return;
  analysisCache.set(key,target);while(analysisCache.size>500)analysisCache.delete(analysisCache.keys().next().value);
  const manual=i.profile.feedback.find(x=>x.id===entry.post.id),decision=manual?{...target,label:manual.label,manual:{label:manual.label}}:target;
  if(decision.timings)decision.timings={...decision.timings,queueMs};
  const title=analysis.resultSummary(decision,state.lang);
  await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:`(${analysisPage.applyResult.toString()})(${JSON.stringify(entry.post.id)},${JSON.stringify(decision)},${JSON.stringify(title)})`}]);
 }catch(error){if(entry&&!wc.isDestroyed()&&(error.message==='Screening context changed'||error.name==='AbortError'))await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:`(${analysisPage.releasePending.toString()})(${JSON.stringify(entry.post.id)},${JSON.stringify(rev)},${JSON.stringify(sourceUrl)})`}]).catch(()=>{});else if(entry&&revision(i)===rev&&state.active===i.id&&!wc.isDestroyed()&&wc.getURL()===sourceUrl&&!settingsOpen)await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:`(${analysisPage.applyResult.toString()})(${JSON.stringify(entry.post.id)},{label:'error'},${JSON.stringify(error.message)})`}]).catch(()=>{});}
 finally{clearInterval(monitor);analysisBusy=false;}
}
function inferencePhoto(photo){
 const data=Buffer.from(photo.data,'base64');if(data.length>8*1024*1024)throw Error('Image too large');
 let image=nativeImage.createFromBuffer(data);const size=image.getSize();if(image.isEmpty()||size.width*size.height>40000000)throw Error('Invalid image dimensions');
 const scale=Math.min(1,960/Math.max(size.width,size.height));if(scale<1)image=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'});return 'data:image/jpeg;base64,'+image.toJPEG(80).toString('base64');
}
function persistKeys(removed){
 const target=path.join(app.getPath('userData'),'cloud-keys.json');
 let encrypted={};try{encrypted=JSON.parse(fs.readFileSync(target,'utf8'));}catch{}
 if(removed)delete encrypted[removed];
 keyStorage=safeStorage.isEncryptionAvailable()?'encrypted':'session';
 if(keyStorage==='encrypted')for(const [provider,key]of Object.entries(keys))encrypted[provider]=safeStorage.encryptString(key).toString('base64');
 else if(!removed)return;
 fs.writeFileSync(target+'.tmp',JSON.stringify(encrypted),{mode:0o600});fs.renameSync(target+'.tmp',target);
}
async function fillAI(i,text,provider,attachments,assertCurrent){
 clipboard.writeText(text);const ai=aiPanes.get(provider)?.view.webContents;assertCurrent();
 if(!ai||new URL(ai.getURL()).origin!==new URL(model.providers[provider]).origin)throw Error('内容已复制；请先进入对应 AI 网站');
 const source=reqoto.aiSource();if(!source)throw Error('未找到 AI 输入框；内容已复制，请手动粘贴');
 await ai.executeJavaScriptInIsolatedWorld(reqoto.AI_WORLD,[{code:source}]);assertCurrent();await ai.executeJavaScriptInIsolatedWorld(reqoto.AI_WORLD,[{code:'globalThis.ReqotoDesktopCancelled=false'}]);assertCurrent();
 const invoke=message=>ai.executeJavaScriptInIsolatedWorld(reqoto.AI_WORLD,[{code:`globalThis.ReqotoDesktopComposer(${JSON.stringify({...message,assistant:provider,language:state.lang})})`}]);
 const filled=await invoke({type:'FILL_COMPOSER',text});
 if(!filled?.filled)throw Error(filled?.reason||'未找到 AI 输入框；内容已复制，请手动粘贴');
 assertCurrent();
 if(attachments.length){
  const result=await invoke({type:'ATTACH_IMAGES',images:attachments,expectedText:text});assertCurrent();
  if(!result?.attachedCount)throw Error(result?.reason||(state.lang==='zh'?'文字已填入，但未确认媒体附件。':'Text filled, but attachments were not confirmed.'));
  send(state.lang==='zh'?`已填入草稿；请核对 ${attachments.length} 个附件预览后自行发送`:`Draft ready; check all ${attachments.length} attachment previews before sending`);
 }else send('已填入 AI 输入框，请审阅后自行发送');
}
let toolbarBusy=false;
async function pollToolbar(){
 if(toolbarBusy||!item())return;
 const i=item(),provider=state.ai.provider,wc=panes.get(i.id)?.view.webContents;
 if(!wc||wc.isDestroyed()||!/^https:\/\/(www\.)?(x|twitter)\.com\//.test(wc.getURL()))return;
 toolbarBusy=true;let capture;
 try{
  capture=await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:'globalThis.ReqotoDesktopQueue?.shift() || null'}]);if(!capture)return;
  if(state.active!==i.id||state.ai.provider!==provider)throw Error('身份或 AI 已切换，未填入；内容已复制');
  const handle=capture.handle||i.account?.handle;if(capture.provider&&capture.provider!==provider)throw Error('身份、页面或 AI 已切换，请重新导入');await detect(i);if(handle!==i.account?.handle)throw Error('社媒账号已切换，请重新导入');
  if(i.account?.status!=='signed-in')throw Error('请先登录社媒账号');
  if(capture.packet?.sourceUrl&&capture.packet.sourceUrl!==wc.getURL())throw Error('身份、页面或 AI 已切换，请重新导入');
  const sourceUrl=wc.getURL(),accountHandle=i.account.handle,aiUrl=aiPanes.get(provider)?.view.webContents.getURL();
  const assertCurrent=()=>{if(state.active!==i.id||i.account?.handle!==accountHandle||state.ai.provider!==provider||wc.isDestroyed()||wc.getURL()!==sourceUrl||aiPanes.get(provider)?.view.webContents.getURL()!==aiUrl)throw Error('身份、页面或 AI 已切换，请重新导入');};
  const {language}=reqoto.promptFor(i,state.lang);
  const prepared=await preparePacket(capture.packet||{targetPost:capture.post,backgroundPosts:[],warnings:[]},{language,
   download:address=>media.downloadImage(wc.session,address),
   captureVideo:async()=>{assertCurrent();const rect=await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:reqoto.videoRectSource(capture.id)}]);assertCurrent();if(!rect)throw Error('Video not visible');const crop=geometry.captureRect(rect,panes.get(i.id).view.getBounds(),wc.getZoomFactor());const screenshot=await wc.capturePage(crop);assertCurrent();return {mimeType:'image/jpeg',data:screenshot.resize({width:Math.min(960,screenshot.getSize().width)}).toJPEG(80).toString('base64'),timestamp:rect.time};}
  });assertCurrent();
  await detect(i);assertCurrent();
  const text=reqoto.packetText(i,prepared.packet,language);
  await fillAI(i,text,provider,prepared.attachments,assertCurrent);
  await toolbarResult(wc,capture.id,prepared.packet.warnings.length?(state.lang==='en'?'Draft ready; review capture notes':'草稿已填入，请检查采集说明'):(state.lang==='en'?'Draft ready':'已填入草稿'),'success');
 }catch(error){send(error.message);if(capture)await toolbarResult(wc,capture.id,translate(error.message,state.lang),'error').catch(()=>{});}finally{toolbarBusy=false;}
}
async function toolbarResult(wc,id,message,status){await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:`(() => {ReqotoPostToolbar.setBusy(false);for(const card of document.querySelectorAll('article[data-testid="tweet"],[data-testid="twitterArticleReadView"]'))if(XCaptureExtract.cardIdentity(card)?.id===${JSON.stringify(id)})ReqotoPostToolbar.captureState(card,${JSON.stringify(id)},${JSON.stringify(message)},${JSON.stringify(status)});})()`}]);}
async function navigate(side,command){
 const p=side==='ai'?aiPane():panes.get(state.active);if(!p)return;const wc=p.view.webContents;
 if(side==='ai')cancelDelivery();
 if(command==='reload'){const target=p.status.url?.startsWith('https:')?p.status.url:side==='ai'?state.ai.urls[state.ai.provider]:item().socialUrl;await wc.loadURL(target).catch(()=>{});}
 if(command==='back'&&wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();
}
app.whenReady().then(()=>{
 try{
  const raw=JSON.parse(fs.readFileSync(file(),'utf8'));if(!Array.isArray(raw.identities))throw Error('Invalid state');
  state.identities=raw.identities.map(i=>({...model.identity(i),account:i.account,lastAccountHandle:i.lastAccountHandle,accountProfiles:i.accountProfiles,id:/^[a-f0-9-]{36}$/.test(i.id)?i.id:model.identity(i).id,...((i.legacyDraft||i.draft)?{legacyDraft:i.legacyDraft||i.draft}:{})}));
  state.lang=raw.lang==='en'?'en':'zh';state.sidebar=Math.max(140,Math.min(300,Number(raw.sidebar)||184));state.sidebarCollapsed=raw.sidebarCollapsed===true;state.active=raw.active;state.ratio=Math.max(.05,Math.min(.95,Number(raw.ratio)||.52));
  state.theme=['system','light','dark'].includes(raw.theme)?raw.theme:'system';state.templates=Array.isArray(raw.templates)?raw.templates.slice(0,50).map(t=>({...preferences.template(t),id:typeof t.id==='string'?t.id:require('node:crypto').randomUUID()})):[];state.modelPaths=raw.modelPaths;
  const previous=raw.identities.find(i=>i.id===raw.active);state.ai=raw.ai?model.aiState(raw.ai):model.aiState({provider:previous?.provider,urls:previous?{[previous.provider]:previous.aiUrl}:{}});
 }catch(error){if(error.code!=='ENOENT'){storageError=true;dialog.showErrorBox('无法读取工作台设置','原文件未覆盖。请先备份并检查 workspace.json。');}}
 nativeTheme.themeSource=state.theme;
 localModels=new LocalModels({paths:{...discovery(app.getPath('userData')),...state.modelPaths},onChange:()=>send()});state.modelPaths=localModels.paths;
 judge=new Judge(localModels,provider=>keys[provider]);
 try{const encrypted=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'cloud-keys.json'),'utf8'));if(safeStorage.isEncryptionAvailable()){keyStorage='encrypted';for(const p of ['jev','liquid-d1'])if(encrypted[p])keys[p]=safeStorage.decryptString(Buffer.from(encrypted[p],'base64'));}}catch{}
 win=new BrowserWindow({width:1500,height:960,minWidth:1080,minHeight:640,titleBarStyle:'hiddenInset',trafficLightPosition:{x:14,y:8},backgroundColor:nativeTheme.shouldUseDarkColors?'#1c1c1e':'#ffffff',icon:path.join(__dirname,'assets/reqoto.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
 nativeTheme.on('updated',()=>{layout();win?.setBackgroundColor(nativeTheme.shouldUseDarkColors?'#1c1c1e':'#ffffff');send();});
 if(process.platform==='darwin'&&fs.existsSync(path.join(__dirname,'assets/reqoto.png')))app.dock.setIcon(path.join(__dirname,'assets/reqoto.png'));
 trackResize(win.webContents);win.on('blur',()=>{resizeKind=null;railDrag=null;});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 settingsView=new WebContentsView({webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});settingsView.setBackgroundColor('#00000000');settingsView.setVisible(false);win.contentView.addChildView(settingsView);trackResize(settingsView.webContents);settingsView.webContents.setWindowOpenHandler(()=>({action:'deny'}));settingsView.webContents.on('will-navigate',e=>e.preventDefault());settingsView.webContents.loadFile(path.join(__dirname,'index.html'),{query:{surface:'settings'}});
 win.loadFile(path.join(__dirname,'index.html'));win.webContents.on('did-finish-load',()=>{activateAI(state.ai.provider);if(state.identities.length)activate(item()?.id||state.identities[0].id);else send();});
 win.on('resize',()=>{layout();send();});const accountPoll=setInterval(()=>{for(const i of state.identities)if(panes.has(i.id))detect(i);},3000),toolbarPoll=setInterval(pollToolbar,400),analysisPoll=setInterval(pollAnalysis,200);
 win.on('close',()=>{resizeKind=null;railDrag=null;});
 win.on('closed',()=>{win=null;clearInterval(accountPoll);clearInterval(toolbarPoll);clearInterval(analysisPoll);localModels.close();if(settingsView&&!settingsView.webContents.isDestroyed())settingsView.webContents.close();settingsView=null;for(const p of [...panes.values(),...aiPanes.values()])if(!p.view.webContents.isDestroyed())p.view.webContents.close();panes.clear();aiPanes.clear();win=null;});
 ipcMain.handle('workspace',async(event,action,payload)=>{
  if(!win||![win.webContents,settingsView?.webContents].includes(event.sender)||event.senderFrame!==event.sender.mainFrame)throw Error('Unauthorized');
  try{
   if(action==='state'){send();return;}
   if(action==='overlay'){overlay=!!payload;layout();return;}
   if(action==='sidebar'){state.sidebarCollapsed=!state.sidebarCollapsed;save();layout();send();return {ok:true};}
   if(action==='settingsPanel'){settingsOpen=payload===true;layout();send();if(settingsOpen)settingsView.webContents.focus();else win.webContents.focus();return {ok:true};}
   if(action==='theme'){state.theme=['system','light','dark'].includes(payload)?payload:'system';nativeTheme.themeSource=state.theme;save();send();return {ok:true};}
   if(action==='deleteAccount'){
    const target=state.identities.find(i=>i.id===payload?.id);
    const assertTarget=()=>{if(!target||state.active!==target.id||!state.identities.includes(target)||target.account?.handle!==payload.handle)throw Error('Account changed; reopen settings');};assertTarget();
    if(storageError)throw Error('Settings cannot be saved; account was not removed');
    const zh=state.lang==='zh',label=[target.account?.name,target.account?.handle].filter(Boolean).join(' ')||new URL(target.socialUrl).hostname;
    const confirmation=await dialog.showMessageBox(win,{type:'warning',message:zh?`删除 ${label}？`:`Delete ${label}?`,detail:zh?'此操作将清除该账号在本工作台中的登录状态、提示词与纠正记录，无法撤销。不会注销平台账号，也不会删除其他账号或右侧 AI 对话。':'This permanently removes this workspace account, its local login, prompts and feedback. Your social account, other workspace accounts and AI conversations are unaffected.',buttons:zh?['取消','删除账号']:['Cancel','Delete account'],defaultId:0,cancelId:0,noLink:true});
    if(confirmation.response!==1)return {ok:true};assertTarget();
    const previous={identities:state.identities,active:state.active},next=model.removeIdentity(state.identities,target.id,state.active);Object.assign(state,next);
    try{save();}catch(error){Object.assign(state,previous);throw error;}
    cancelDelivery();settingsOpen=false;railDrag=null;analysisCache.clear();avatarCache.clear();
    const pane=panes.get(target.id),ses=pane?.view.webContents.session||session.fromPartition(model.partitions(target).social);panes.delete(target.id);
    if(pane){win.contentView.removeChildView(pane.view);if(!pane.view.webContents.isDestroyed())pane.view.webContents.close({waitForBeforeUnload:false});}
    for(const popup of BrowserWindow.getAllWindows())if(popup!==win&&!popup.isDestroyed()&&popup.webContents.session===ses)popup.destroy();
    if(state.active)await activate(state.active);else{layout();send();}win.webContents.focus();
    const cleanup=await Promise.allSettled([ses.clearStorageData(),ses.clearCache(),ses.clearAuthCache()]);
    const incomplete=cleanup.some(r=>r.status==='rejected');send(incomplete?(zh?'账号已移除；部分本地登录缓存未能清理':'Account removed; some local login cache could not be cleared'):(zh?'账号已删除':'Account deleted'));
    return {ok:true,removed:true};
   }
   if(action==='settings'){
    const target=state.identities.find(i=>i.id===payload.id);if(!target||target.account?.handle!==payload.handle)throw Error('Account changed; reopen settings');
    const clean=model.identity(payload);target.profile=clean.profile;target.prompts=clean.prompts;target.promptLanguage=clean.promptLanguage;target.prompt='';save();analysisCache.clear();await installToolbar(target);send(state.lang==='zh'?'设置已保存':'Settings saved');return {ok:true};
   }
   if(action==='template'){
    if(payload.remove)state.templates=state.templates.filter(t=>t.id!==payload.remove);
    else{const clean=preferences.template(payload);if(!clean.name)throw Error('Template name required');if(state.templates.length>=50)throw Error('Template limit: 50');state.templates.push({...clean,id:require('node:crypto').randomUUID()});}save();send();return {ok:true};
   }
   if(action==='modelFile'){
    if(!['runtime','d1','mmproj'].includes(payload))throw Error('Invalid model');const selected=await dialog.showOpenDialog(win,{properties:['openFile'],...(payload==='runtime'?{}:{filters:[{name:'GGUF model',extensions:['gguf']}]})});
    if(!selected.canceled){localModels.setPath(payload,selected.filePaths[0]);state.modelPaths=localModels.paths;analysisCache.clear();save();send();}return {ok:true};
   }
   if(action==='modelStart'){await localModels.start(payload);send();return {ok:true};}
   if(action==='modelStop'){localModels.stop(payload);analysisCache.clear();send();return {ok:true};}
   if(action==='cloudKey'){
    if(!analysis.cloud[payload.provider])throw Error('Invalid provider');if(payload.remove)delete keys[payload.provider];else{if(typeof payload.key!=='string'||!payload.key.trim()||payload.key.length>500||/\s/.test(payload.key))throw Error('Invalid API key');keys[payload.provider]=payload.key;}
    persistKeys(payload.remove?payload.provider:null);analysisCache.clear();send();return {ok:true};
   }
   if(action==='analysisTest'){
    const post={id:'test',text:typeof payload.text==='string'?payload.text:'',author:'Local test'};
    if(payload.withImage){const selected=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Image',extensions:['jpg','jpeg','png','gif']}]});if(selected.canceled)return {ok:true};const file=selected.filePaths[0];if(fs.statSync(file).size>8*1024*1024)throw Error('Image too large');post.images=[inferencePhoto({data:fs.readFileSync(file).toString('base64')})];post.hasMedia=true;post.mediaManifest=[{role:'target',kind:'photo'}];}
    const started=Date.now(),result=await judge.evaluate(analysis.candidate(post),preferences.profile(payload.profile));return {ok:true,result,summary:analysis.resultSummary(result,state.lang),elapsedMs:Date.now()-started};
   }
   if(action==='recheck'){
    analysisCache.clear();const wc=panes.get(state.active)?.view.webContents;if(wc&&!wc.isDestroyed())await wc.executeJavaScriptInIsolatedWorld(reqoto.WORLD,[{code:'globalThis.ReqotoAnalysisSeen?.clear();if(globalThis.ReqotoAnalysisQueue)globalThis.ReqotoAnalysisQueue.length=0;'}]);return {ok:true};
   }
   if(action==='add'){const i=model.identity({socialUrl:payload.socialUrl});state.identities.push(i);overlay=false;await activate(i.id);}
   if(action==='select'&&Date.now()>suppressSelectUntil)await activate(payload);
   if(action==='railScroll')railScroll=Math.max(0,Number(payload)||0);
   if(action==='reorder'){state.identities=model.reorder(state.identities,payload);save();send();}
   if(action==='language'){state.lang=payload==='en'?'en':'zh';save();send();for(const i of state.identities)installToolbar(i).catch(()=>{});}
   if(action==='layout'){state.ratio=geometry.geometry(...win.getContentSize(),state.sidebarCollapsed?64:state.sidebar,Number(payload.ratio)||state.ratio).ratio;state.sidebar=Math.max(140,Math.min(300,Number(payload.sidebar)||state.sidebar));save();layout();send();}
   if(action==='retry')await navigate(payload==='social'?'social':'ai','reload');
   if(action==='nav')await navigate(payload.side,payload.command);
   if(action==='ai')await activateAI(payload.provider,payload.url);
   if(action==='prompt'){if(!item())throw Error('身份不存在');if(typeof payload==='string')item().prompt=payload.slice(0,20000);else{const clean=model.identity(payload);item().prompts=clean.prompts;item().promptLanguage=clean.promptLanguage;item().prompt='';}save();send('提示词已保存');}
   return {ok:true};
  }catch(error){send(error.message);return {ok:false,error:translate(error.message,state.lang)};}
 });
});
app.on('window-all-closed',()=>app.quit());
