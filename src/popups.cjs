const model=require('./model.cjs');
function popupBounds({owner,screen}){
 const parent=owner?.(),bounds=parent&&!parent.isDestroyed()?parent.getBounds():null;
 const area=(bounds?screen.getDisplayMatching(bounds):screen.getPrimaryDisplay()).workArea;
 const width=Math.min(520,area.width),height=Math.min(720,area.height);
 const center=bounds||area;
 return {width,height,x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,center.x+(center.width-width)/2))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,center.y+(center.height-height)/2)))};
}
function enableWebPopups(wc,environment){
 for(const hook of ['will-navigate','will-redirect'])wc.on(hook,(event,target)=>{try{model.url(target);}catch{event.preventDefault();}});
 wc.setWindowOpenHandler(({url})=>{
  try{if(url!=='about:blank')model.url(url);}catch{return {action:'deny'};}
  // Webpage window features must not hide the window or position it off-screen.
  return {action:'allow',overrideBrowserWindowOptions:{...popupBounds(environment),show:true,focusable:true,opacity:1,autoHideMenuBar:true,webPreferences:{session:wc.session,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}}};
 });
 wc.on('did-create-window',child=>{
  enableWebPopups(child.webContents,{...environment,owner:()=>child});child.setMenuBarVisibility(false);
  if(child.isDestroyed())return;if(child.isMinimized())child.restore();child.show();child.focus();
 });
}
module.exports={enableWebPopups,popupBounds};
