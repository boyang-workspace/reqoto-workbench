// Only signed-in account controls are inspected; never infer identity from feed posts.
function detectAccount() {
 const host=location.hostname;
 if (/(^|\.)(x|twitter)\.com$/.test(host)) {
  const button=document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  const profile=document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
  if (!button || !profile) return {platform:'X',status:document.querySelector('input[autocomplete="username"],input[name="text"],a[href="/login"]') || /onboarding|login|logout/.test(location.href) ? 'signed-out':'unknown'};
  const handle=(button.innerText.match(/@[A-Za-z0-9_]+/)||[])[0] || '@'+new URL(profile.href).pathname.split('/').filter(Boolean)[0];
  const name=button.innerText.split('\n').map(s=>s.trim()).find(s=>s && !s.startsWith('@')) || button.querySelector?.('img[alt]')?.getAttribute('alt')?.trim() || handle;
  const photo=button.querySelector?.('img[src]');
  let avatarUrl='';try{const u=new URL(photo?.currentSrc||photo?.src||'');if(u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/profile_images/'))avatarUrl=u.href;}catch{}
  return {platform:'X',status:'signed-in',handle,name,avatarUrl};
 }
 if (/(^|\.)xiaohongshu\.com$/.test(host)) {
  const me=document.querySelector('a.user[href*="/user/profile/"],.user.side-bar-component a[href*="/user/profile/"],a.channel.user[href*="/user/profile/"]');
  if(me){ const name=me.querySelector('.name,.user-name')?.textContent?.trim();const id=new URL(me.href).pathname.split('/').pop();let avatarUrl='';try{const u=new URL(me.querySelector('img')?.src||'');if(u.protocol==='https:'&&/(^|\.)xhscdn\.com$/.test(u.hostname))avatarUrl=u.href;}catch{} if(name && !['我','Me'].includes(name))return {platform:'小红书',status:'signed-in',name,handle:id,avatarUrl}; }
  return {platform:'小红书',status:document.querySelector('.login-container,.login-modal')?'signed-out':'unknown'};
 }
 return {platform:host,status:'unknown'};
}
function label(i, lang='zh') {
 const a=i.account;
 if(a?.status==='signed-in')return {name:a.name || a.handle,detail:a.handle || a.platform};
 let platform=a?.platform;
 if(!platform){try{const host=new URL(i.socialUrl).hostname;platform=host==='x.com'?'X':host.includes('xiaohongshu')?'小红书':host;}catch{platform='';}}
 return {name:platform,detail:lang==='en'?(a?.status==='signed-out'?'Sign in':'Detecting account'):(a?.status==='signed-out'?'未登录':'待识别')};
}
module.exports={detectAccount,label};
