// Account preferences and template compilation. No model or browser dependencies.
const engines = ['d1-local','liquid-d1','jev'];
const text=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
function profile(input={},legacy=false){
 return {enabled:input.enabled===true&&!(['embedding-local','hybrid'].includes(input.engine)),engine:engines.includes(input.engine)?input.engine:'d1-local',
  promptMode:input.promptMode==='custom'||legacy&&input.promptMode!=='guided'?'custom':'guided',
  persona:text(input.persona),tone:['natural','friendly','professional','playful'].includes(input.tone)?input.tone:'natural',
  voice:['direct','curious','empathetic'].includes(input.voice)?input.voice:'direct',
  length:input.length==='normal'?'normal':'short',replyLanguage:['zh','en'].includes(input.replyLanguage)?input.replyLanguage:'source',
  screenGoal:['conversation','share-experience','find-needs'].includes(input.screenGoal)?input.screenGoal:'conversation',screening:input.screening==='strict'?'strict':'balanced',skipTopics:text(input.skipTopics),topics:text(input.topics),avoid:text(input.avoid),criteria:text(input.criteria,4000),
  feedback:Array.isArray(input.feedback)?input.feedback.filter(x=>x&&['reply','skip'].includes(x.label)&&typeof x.text==='string').slice(-100).map(x=>({id:text(x.id,100),text:text(x.text,1800),label:x.label})):[]};
}
function compile(input,language='en'){
 const p=profile(input),zh=language==='zh';
 const tones={natural:['自然、克制','natural and restrained'],friendly:['友好、温暖','friendly and warm'],professional:['专业、清晰','professional and clear'],playful:['轻松、有趣，避免勉强开玩笑','playful without forced jokes']};
 const voices={direct:['直接、具体','direct and specific'],curious:['好奇，适当提出有意义的问题','curious, asking a meaningful question when useful'],empathetic:['理解对方处境，避免说教','empathetic without lecturing']};
 return [zh?'你正在帮助以下社媒账号准备公开回复。':'Help this social account prepare a public reply.',
  p.persona?`${zh?'人设与真实经验':'Persona and actual experience'}: ${p.persona}`:'',
  `${zh?'语气':'Tone'}: ${tones[p.tone][zh?0:1]}`,`${zh?'表达方式':'Voice'}: ${voices[p.voice][zh?0:1]}`,
  `${zh?'长度':'Length'}: ${p.length==='short'?(zh?'简短，通常一至两句':'brief, usually one or two sentences'):(zh?'按上下文适度展开':'expand only as the context needs')}`,
  p.topics?`${zh?'关注主题':'Interests'}: ${p.topics}`:'',p.avoid?`${zh?'避免':'Avoid'}: ${p.avoid}`:'',
  zh?'针对具体内容回应，不编造经历，不机械推销，不使用空泛赞美。缺少关键上下文时明确说明。':'Respond to specific details. Do not invent experience, force promotion, or add generic praise. Acknowledge missing essential context.',languageRule(p,language)].filter(Boolean).join('\n');
}
function languageRule(p,lang){return p.replyLanguage==='en'?'Write the actual reply in English.':p.replyLanguage==='zh'?'实际回复请使用中文。':lang==='zh'?'回复语言跟随原帖。':'Reply in the source post’s language.';}
function template(input){
 const p=profile(input.profile);delete p.enabled;delete p.engine;delete p.feedback;
 const prompts={};for(const lang of ['zh','en'])if(typeof input.prompts?.[lang]==='string')prompts[lang]=input.prompts[lang].slice(0,20000);
 return {name:text(input.name,60).trim(),profile:p,prompts,promptLanguage:['zh','en'].includes(input.promptLanguage)?input.promptLanguage:'auto'};
}
if(typeof module!=='undefined')module.exports={profile,compile,languageRule,template,engines};
else globalThis.ReqotoPreferences={profile,compile,languageRule,template,engines};
