(function (root) {
  "use strict";
  if (root.ReqotoBuild?.postToolbar !== true || !document.body) return;
  if (root.ReqotoPostToolbar) return;
  const records = new Map();
  let language = "en", assistant = "chatgpt", enabled = false, busy = false, captureHandler, feedbackHandler, scheduled;
  const tr = key => XReplyLocale.forAssistant(language, key, assistant);
  const captureLabel = () => (language === "zh" ? "发送至 " : "Send to ") + (assistant === "grok" ? "Grok" : "ChatGPT");
  function captureIcon(record, success) { const key=String(success)+captureLabel();if(record.captureIconKey===key)return;record.captureIconKey=key;record.capture.innerHTML = success ? check : logo; const label=document.createElement("span"); label.textContent=captureLabel(); record.capture.append(label); }
  const logo = '<svg viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" rx="26" fill="#ffd83d"/><rect x="30" y="25" width="21" height="78" rx="6" fill="#171717"/><rect x="43" y="25" width="53" height="50" rx="23" fill="#171717"/><path d="M54 66h22l28 37H79L54 66Z" fill="#171717"/><rect x="53" y="42" width="24" height="16" rx="8" fill="#ffd83d"/></svg>';
  const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const css = [
    ':host{display:block;width:100%;height:36px;margin-top:6px;box-sizing:border-box;container-type:inline-size}',
    '*{box-sizing:border-box}.bar{height:36px;display:flex;align-items:center;gap:8px;padding:0 7px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--fg);font:500 11px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;overflow:hidden}',
    'button,a{font:inherit;color:inherit;flex:none}button{display:grid;place-items:center;width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;cursor:pointer}',
    'button:hover,a:hover{background:var(--hover)}button:focus-visible,a:focus-visible{outline:2px solid #e5ba1e;outline-offset:1px}button:disabled{cursor:default;opacity:.4}',
    '.capture-wrap{position:relative;flex:none;width:136px;height:28px;display:grid;place-items:center}.capture{display:flex;justify-content:center;gap:5px;width:136px;height:24px;padding:0 6px;font-size:10px;white-space:nowrap;background:#ffd83d;color:#171717;border-color:#e4bf26;border-radius:6px}.capture:hover{background:#ffdf55}.capture svg{flex:none;width:16px;height:16px}.capture.success{background:#16824f;border-color:#16824f;color:white}.capture.success svg{width:16px;height:16px}',
    '.ring{position:absolute;left:3px;top:0;width:28px;height:28px;pointer-events:none;transform:rotate(-90deg)}.ring circle{fill:none;stroke:#d5a619;stroke-width:2;stroke-linecap:round;stroke-dasharray:78.54;stroke-dashoffset:78.54}.ring.spin{animation:spin 1.1s linear infinite}.ring.spin circle{stroke-dashoffset:56}@keyframes spin{to{transform:rotate(270deg)}}',
    '.content{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden}.signal{flex:none;max-width:94px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.signal[data-state=reply]{color:var(--reply)}.signal[data-state=unsure],.signal[data-state=checking]{color:var(--review)}.signal[data-state=error],.signal[data-state=pageStale],.signal[data-state=requestFailed],.signal[data-state=saveError]{color:var(--error)}',
    '.heat{display:flex;align-items:center;gap:6px;min-width:0;opacity:.8;white-space:nowrap;overflow:hidden}.cue{font-size:10px}.numbers{font-size:10px;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}.message{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.message.success{color:var(--reply)}.message.error{color:var(--error)}',
    '.corrections{display:flex;align-items:center;gap:2px;flex:none}.corrections button{width:22px;height:22px;font-size:17px;font-weight:500}.corrections button[aria-pressed=true]{background:#ffd83d;color:#171717}.open{display:grid;place-items:center;width:20px;height:22px;text-decoration:none;border-radius:5px;font-size:15px;color:var(--review)}',
    '[hidden]{display:none!important}.open[hidden]{display:grid!important;visibility:hidden}@container(max-width:350px){.cue{display:none}.bar{gap:5px}.content{gap:5px}.signal{max-width:82px}}@container(max-width:400px){.numbers{display:none}}@container(max-width:300px){.heat{display:none}.bar{gap:4px}.signal{max-width:55px}.capture-wrap,.capture{width:126px}.capture{font-size:9px}.open{width:16px}}@media(prefers-reduced-motion:reduce){.ring.spin{animation:none}}'
  ].join("\n");

  function text(element, value) { if (element.textContent !== value) element.textContent = value; }
  function theme(host) {
    const background = getComputedStyle(document.body).backgroundColor;
    const rgb = background.match(/\d+(?:\.\d+)?/g);
    const dark = rgb && (rgb.length < 4 || Number(rgb[3]) > 0) ? rgb.slice(0, 3).reduce((sum, n) => sum + Number(n), 0) < 380 : root.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const values = dark ? { bg:host.dataset.reqotoState === "reply" ? "#163d2b" : "#ffffff0c", border:host.dataset.reqotoState === "reply" ? "#285b40" : "#ffffff10", fg:"#aab2ba", hover:"#ffffff0c", reply:"#77d0a1", review:"#d8b957", error:"#efa785" }
      : { bg:host.dataset.reqotoState === "reply" ? "#e8f6ee" : "#f3f4f5", border:host.dataset.reqotoState === "reply" ? "#d1e9dc" : "#e8ebed", fg:"#536471", hover:"#e5e8eb", reply:"#227a50", review:"#8a6b17", error:"#aa5030" };
    for (const [key, value] of Object.entries(values)) host.style.setProperty("--" + key, value);
  }
  function actionGroup(target) {
    const reply = [...target.querySelectorAll('[data-testid="reply"]')].find(element => !XCaptureExtract.isQuoteMedia(element, target));
    const group = reply?.closest('[role="group"]');
    return group && group.closest("article") === target ? group : null;
  }
  function position(record) {
    const group = actionGroup(record.target);
    if (group) { if (group.nextElementSibling !== record.host) group.after(record.host); return true; }
    if (record.target.matches('[data-testid="twitterArticleReadView"]') && !record.target.closest("article")) {
      if (record.host.parentElement !== record.target) record.target.append(record.host);
      return true;
    }
    return false;
  }
  function refresh(record) {
    const manual = record.signal?.manual;
    captureIcon(record, record.capture.classList.contains("success"));
    record.capture.title = captureLabel() + (record.lastCaptureMessage ? "\n" + record.lastCaptureMessage : "");
    record.capture.setAttribute("aria-label", captureLabel());
    record.capture.disabled = busy;
    const labels = { checking: language === "zh" ? "判断中…" : "Checking…", reply:"REPLY", unsure:"REVIEW", skip:"SKIP",
      error:language === "zh" ? "模型未连接" : "Model offline", keyMissing:language === "zh" ? "需要密钥" : "Add key",
      pageStale:language === "zh" ? "请刷新 X" : "Refresh X", requestFailed:language === "zh" ? "判断失败" : "Analysis failed",
      keyInvalid:language === "zh" ? "检查密钥" : "Check key", quota:language === "zh" ? "检查额度" : "Check credits",
      rateLimited:language === "zh" ? "模型繁忙" : "Model busy", saveError:language === "zh" ? "保存失败" : "Save failed" };
    const state = record.signal?.state || "";
    text(record.badge, (labels[state] || (enabled ? (language === "zh" ? "待筛选" : "PENDING") : tr("toolbarOff"))) + (manual ? (language === "zh" ? " · 我" : " · You") : ""));
    record.badge.dataset.state = state;
    record.host.dataset.reqotoState = state;
    record.badge.title = record.signal?.title || record.badge.textContent;
    const canCorrect = enabled && Boolean(ReqotoTriageCore.cardPost(record.target));
    for (const button of record.feedback) {
      button.disabled = !canCorrect;
      button.title = tr(button.dataset.label === "reply" ? "markReplyExample" : "markSkipExample");
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(manual?.label === button.dataset.label));
    }
    record.open.href = record.url;
    record.open.title = tr("toolbarOpen");
    record.open.setAttribute("aria-label", record.open.title);
    record.open.hidden = !XCaptureExtract.incompleteCard(record.target).incomplete;
    theme(record.host);
  }
  function ensure(target) {
    const identity = XCaptureExtract.cardIdentity(target);
    if (!identity) return null;
    let record = records.get(target);
    if (record && record.id !== identity.id) {
      clearTimeout(record.timeout); record.host.remove(); records.delete(target); record = null;
    }
    if (record) { position(record); refresh(record); return record; }
    const host = document.createElement("reqoto-post-tools");
    host.dataset.reqotoToolbar = "";
    host.dataset.reqotoReplyStamp = "";
    host.dataset.reqotoPostId = identity.id;
    host.style.cssText = "display:block;width:100%;height:36px;min-height:36px;flex:0 0 36px;align-self:stretch;margin-top:6px;box-sizing:border-box;";
    const shadow = host.attachShadow({ mode:"open" });
    shadow.innerHTML = '<style>' + css + '</style><div class="bar" role="toolbar" aria-label="Reqoto"><div class="capture-wrap"><button class="capture" type="button">' + logo +
      '</button><svg class="ring" viewBox="0 0 28 28" aria-hidden="true" hidden><circle cx="14" cy="14" r="12.5"/></svg></div><div class="content"><span class="signal"></span><span class="heat"><span class="cue"></span><span class="numbers"></span></span><span class="message" role="status" aria-live="polite" hidden></span></div><div class="corrections"><button type="button" data-label="reply">+</button><button type="button" data-label="skip">−</button></div><a class="open" hidden>↗</a></div>';
    record = { target, host, id:identity.id, url:identity.url, shadow, capture:shadow.querySelector(".capture"), ring:shadow.querySelector(".ring"),
      badge:shadow.querySelector(".signal"), heat:shadow.querySelector(".heat"), cue:shadow.querySelector(".cue"), numbers:shadow.querySelector(".numbers"),
      message:shadow.querySelector(".message"), feedback:[...shadow.querySelectorAll(".corrections button")], open:shadow.querySelector(".open") };
    shadow.querySelector(".bar").append(shadow.querySelector(".capture-wrap"));
    if (!position(record)) return null;
    records.set(target, record);
    host.addEventListener("click", event => event.stopPropagation());
    host.addEventListener("pointerdown", event => event.stopPropagation());
    host.addEventListener("keydown", event => event.stopPropagation());
    record.capture.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); if (!busy) captureHandler?.(target, record.id); });
    record.feedback.forEach(button => button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); if (enabled) feedbackHandler?.(target, button.dataset.label); }));
    refresh(record);
    return record;
  }
  function scan() {
    scheduled = null;
    for (const [target, record] of records) if (!target.isConnected) { clearTimeout(record.timeout); records.delete(target); }
    document.querySelectorAll('article[data-testid="tweet"]').forEach(target => {
      const record = ensure(target), post = ReqotoTriageCore.cardPost(target);
      if (!record || !post) return;
      const info = ReqotoTriageCore.opportunity(post);
      const value = n => n === null ? (language === 'zh' ? '未知' : 'unknown') : new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US').format(n);
      const age = info.ageHours === null ? (language === 'zh' ? '发布时间未知' : 'Post age unknown') : info.ageHours < 1
        ? Math.floor(info.ageHours * 60) + (language === 'zh' ? ' 分钟前' : 'm ago') : Math.floor(info.ageHours) + (language === 'zh' ? ' 小时前' : 'h ago');
      setOpportunity(target, info, age + ' · ' + value(info.replies) + (language === 'zh' ? ' 回复 · ' : ' replies · ') + value(info.views) + (language === 'zh' ? ' 浏览\n' : ' views\n') + (language === 'zh' ? '试验提示，不预测回复曝光。' : 'Trial cues; not a prediction of reply reach.'));
    });
    document.querySelectorAll('[data-testid="twitterArticleReadView"]').forEach(view => { if (!view.closest("article")) ensure(view); });
  }
  function schedule() { if (scheduled === undefined || scheduled === null) scheduled = setTimeout(scan, 40); }
  function configure(options) {
    language = XReplyLocale.normalizeLanguage(options.language); enabled = options.enabled === true;
    records.forEach(refresh);
  }
  function setSignal(target, signal) {
    const record = ensure(target); if (!record) return;
    record.signal = signal;
    refresh(record);
  }
  function clearSignals(target) {
    const list = target ? [records.get(target)] : [...records.values()];
    list.filter(Boolean).forEach(record => { record.signal = null; refresh(record); });
  }
  function setOpportunity(target, info, title) {
    const record = ensure(target); if (!record) return;
    const higher = info.priority === "higher" && record.signal?.state === "reply";
    record.host.dataset.reqotoPriority = higher ? "higher" : "normal";
    const labels = language === "zh" ? { fresh:"新帖", active:"有讨论", crowded:"拥挤", reach:"曝光", older:"较早", unknown:"" }
      : { fresh:"Fresh", active:"Discussion", crowded:"Crowded", reach:"Reach", older:"Older", unknown:"" };
    text(record.cue, (higher ? "↑ " : "") + (labels[info.cue] || ""));
    const number = n => n === null ? "—" : new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en", { notation:"compact", maximumFractionDigits:1 }).format(n);
    const age = info.ageHours === null ? "—" : info.ageHours < 1 ? Math.floor(info.ageHours * 60) + "m" : Math.floor(info.ageHours) + "h";
    text(record.numbers, age + " · " + number(info.replies) + (language === 'zh' ? " 回复 · " : " replies · ") + number(info.views) + (language === 'zh' ? " 浏览" : " views"));
    record.heat.title = title;
    record.heat.setAttribute("aria-label", title.split("\n")[0]);
  }
  function setBusy(value) { busy = value; records.forEach(record => { record.capture.disabled = value; }); }
  function captureState(target, id, message, state = "", percent = null) {
    const record = records.get(target);
    if (!record || record.id !== id || !target.isConnected || XCaptureExtract.cardIdentity(target)?.id !== id) return;
    clearTimeout(record.timeout);
    if (state === "success" || state === "error") record.lastCaptureMessage = message;
    if (state === "progress") record.lastCaptureMessage = "";
    captureIcon(record, record.capture.classList.contains("success"));
    record.capture.title = captureLabel() + (record.lastCaptureMessage ? "\n" + record.lastCaptureMessage : "");
    record.badge.hidden = Boolean(message); record.heat.hidden = Boolean(message); record.message.hidden = !message;
    text(record.message, message || "");
    record.message.title = message || "";
    record.message.className = "message " + state;
    record.ring.hidden = state !== "progress";
    record.ring.classList.toggle("spin", !Number.isFinite(percent));
    record.ring.querySelector("circle").style.strokeDashoffset = String(78.54 * (1 - (Number.isFinite(percent) ? percent : 0) / 100));
    record.capture.classList.toggle("success", state === "success");
    captureIcon(record, state === "success");
    if (state === "success") record.timeout = setTimeout(() => captureState(target, id, "", "complete"), 3000);
    if (state === "complete") { record.capture.classList.add("success"); captureIcon(record, true); }
  }
  root.ReqotoPostToolbar = { ensure, configure, setSignal, clearSignals, setOpportunity, setBusy, captureState,
    onCapture(handler) { captureHandler = handler; }, onFeedback(handler) { feedbackHandler = handler; } };
  new MutationObserver(mutations => {
    if (mutations.some(mutation => {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return !mutation.target.closest?.("[data-reqoto-toolbar]") && !(nodes.length && nodes.every(node => node.nodeType === 1 && node.matches?.("[data-reqoto-toolbar]")));
    })) schedule();
  }).observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:["href","datetime","aria-label"] });
  new MutationObserver(() => records.forEach(record => theme(record.host))).observe(document.body, { attributes:true, attributeFilter:["style","class"] });
  chrome.storage.local.get(["captureDestination"]).then(settings => { assistant = root.ReqotoBuild?.grokCapture === true && settings.captureDestination === "grok" ? "grok" : "chatgpt"; records.forEach(refresh); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.captureDestination) { assistant = root.ReqotoBuild?.grokCapture === true && changes.captureDestination.newValue === "grok" ? "grok" : "chatgpt"; records.forEach(refresh); } });
  scan();
})(typeof globalThis !== "undefined" ? globalThis : this);
