(function(){const assistant=location.hostname.includes("grok.com")?"grok":"chatgpt";
  function shadowRootFor(element) { return element.shadowRoot || null; }
  function queryAll(selector, scope = document) {
    if (assistant !== "grok") return [...scope.querySelectorAll(selector)];
    const roots = [scope], seen = new Set(), result = [];
    for (let index = 0; index < roots.length && index < 100; index++) {
      const current = roots[index];
      if (seen.has(current)) continue;
      seen.add(current);
      result.push(...current.querySelectorAll(selector));
      for (const element of current.querySelectorAll("*")) { const shadow=shadowRootFor(element); if (shadow) roots.push(shadow); }
      const hosted=shadowRootFor(current); if (hosted) roots.push(hosted);
    }
    return result;
  }
  function composedClosest(element, selector) {
    let current = element;
    while (current) {
      const found = current.closest?.(selector);
      if (found) return found;
      current = current.getRootNode?.().host;
    }
    return null;
  }
  function findComposer() {
    const selectors = assistant === "grok" ? [
      'form[data-composer="true"] [contenteditable="true"]',
      'form[data-composer="true"] [contenteditable="plaintext-only"]',
      '[contenteditable][aria-label="Ask Grok anything"]',
      'form[data-composer="true"] textarea[aria-label="Ask Grok anything"]',
      'textarea[placeholder="Ask Grok anything"]', 'textarea[aria-label="Ask Grok anything"]',
      'textarea[placeholder*="Grok"]', '[contenteditable="true"][role="textbox"]', 'textarea[placeholder]'
    ] : [
      'form #prompt-textarea',
      'form [contenteditable="true"].ProseMirror',
      "#prompt-textarea",
      '[contenteditable="true"].ProseMirror',
      '[contenteditable="true"][role="textbox"]',
      'textarea[placeholder]'
    ];
    for (const selector of selectors) {
      const candidates = queryAll(selector).filter((candidate) =>
        !composedClosest(candidate, '[data-message-author-role], article, nav, aside, [role=dialog]') &&
        !candidate.disabled && !candidate.readOnly && candidate.isConnected && candidate.getAttribute("aria-hidden") !== "true" &&
        getComputedStyle(candidate).visibility !== "hidden" && [...candidate.getClientRects()].some(rect => rect.width > 0 && rect.height > 0));
      const element = assistant === "grok" && candidates.length !== 1 ? null : candidates[0];
      if (element && element.isConnected && element.getClientRects().length &&
          (element.isContentEditable || element instanceof HTMLTextAreaElement)) return element;
    }
    return null;
  }


return findComposer();})()