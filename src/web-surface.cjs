// Remote websites may declare Electron drag regions. Only our shell owns window dragging.
const REMOTE_CSS='*::before,*::after,*{-webkit-app-region:no-drag!important}';
function clipboardWriteAllowed(wc,permission,origin){
 if(permission!=='clipboard-sanitized-write'||!wc||wc.isDestroyed())return false;
 try{return new URL(origin).protocol==='https:'&&new URL(wc.getURL()).origin===new URL(origin).origin;}catch{return false;}
}
function configureWebSession(ses){
 ses.setPermissionCheckHandler((wc,permission,origin)=>clipboardWriteAllowed(wc,permission,origin));
 ses.setPermissionRequestHandler((wc,permission,callback,details)=>callback(clipboardWriteAllowed(wc,permission,details.requestingUrl||wc.getURL())));
}
module.exports={REMOTE_CSS,clipboardWriteAllowed,configureWebSession};
