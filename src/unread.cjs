// Executed in the account's own page. Only X navigation badges count, never feed text.
function detectXUnread(){
 if(!/(^|\.)(x|twitter)\.com$/.test(location.hostname))return null;
 const links=[...document.querySelectorAll('a[data-testid="AppTabBar_Notifications_Link"],a[data-testid="AppTabBar_DirectMessage_Link"],a[href="/notifications"],a[href="/messages"],a[href="/i/chat"]')];
 if(!links.length)return null;
 const positive=text=>{const numbers=String(text||'').match(/\d+/g);return numbers?numbers.some(n=>Number(n)>0):/unread|未读|新通知|新消息/i.test(text||'');};
 const hasUnread=links.some(link=>{
  const label=link.getAttribute('aria-label')||'';
  if(/unread|未读|新通知|新消息/i.test(label)&&positive(label))return true;
  for(const node of link.querySelectorAll('[aria-label],[data-testid="notificationIndicator"],[data-testid="unreadBadge"],span')){
   if(node.getAttribute('aria-hidden')==='true')continue;
   const value=node.getAttribute('aria-label')||node.textContent||'';
   if((/^\s*\d+\+?\s*$/.test(value)||/unread|未读|新通知|新消息/i.test(value))&&positive(value))return true;
   if(['notificationIndicator','unreadBadge'].includes(node.getAttribute('data-testid'))&&!value.trim())return true;
  }
  return false;
 });
 return {hasUnread};
}
function updateUnread(previous,account,reading){
 if(account?.platform!=='X'||account.status!=='signed-in')return null;
 if(reading&&typeof reading.hasUnread==='boolean')return {handle:account.handle,hasUnread:reading.hasUnread};
 return previous?.handle===account.handle?previous:null;
}
module.exports={detectXUnread,updateUnread};
