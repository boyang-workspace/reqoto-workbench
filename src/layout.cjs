// Shared native/renderer geometry. Settings cover the page without resizing it.
(function(root){
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function geometry(width,height,sidebar=184,ratio=.52){
  const left=Number(sidebar)===64?64:clamp(Number(sidebar)||184,140,300),available=Math.max(2,width-left-1),minSocial=Math.min(320,available/2),minAI=Math.min(220,available/2);
  ratio=clamp(Number(ratio)||.52,minSocial/available,1-minAI/available);const middle=Math.round(available*ratio);
  return {left,middle,ratio,drawerWidth:Math.max(1,Math.min(440,middle-24)),social:{x:left,y:38,width:middle,height:Math.max(1,height-38)},ai:{x:left+middle+1,y:38,width:available-middle,height:Math.max(1,height-38)}};
 }
 function socialZoom(width,address){
  let isX=false;try{isX=/^(www\.)?(x|twitter)\.com$/.test(new URL(address).hostname);}catch{}
  if(!isX||width<=780)return 1;
  // Smoothly make room for X's desktop columns; never reduce below 80%.
  const transition=1-.2*clamp((width-780)/180,0,1);
  return Math.max(.8,transition,Math.min(1,width/1280));
 }
 function captureRect(rect,bounds,zoom=1){
  const x=Math.max(0,Math.round(rect.x*zoom)),y=Math.max(0,Math.round(rect.y*zoom)),width=Math.min(bounds.width-x,Math.round(rect.width*zoom)),height=Math.min(bounds.height-y,Math.round(rect.height*zoom));
  if(![x,y,width,height].every(Number.isFinite)||width<64||height<48)throw Error('Video not visible');return {x,y,width,height};
 }
 const api={geometry,socialZoom,captureRect};if(typeof module!=='undefined')module.exports=api;else root.ReqotoLayout=api;
})(globalThis);
