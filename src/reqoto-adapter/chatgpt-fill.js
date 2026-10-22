(function () {
  "use strict";

  const assistant = ["grok.com", "www.grok.com"].includes(location.hostname) ? "grok" : location.hostname === "chatgpt.com" ? "chatgpt" : null;
  if (!assistant || globalThis.ReqotoComposerFillInstalled) return;
  globalThis.ReqotoComposerFillInstalled = true;
  const trFor = (language, key) => XReplyLocale.forAssistant(language, key, assistant);

  // Support Grok's desktop rich editor and its narrow-layout textarea.
  // Open roots are queried locally; no frame or closed-root access is needed.
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

  async function waitForComposer() {
    const deadline = Date.now() + 3500;
    do { const composer = findComposer(); if (composer) return composer; await new Promise(resolve => setTimeout(resolve,100)); } while (Date.now() < deadline);
    return null;
  }

  function plainText(value) {
    return (value || "").replace(/[\u200b-\u200d\ufeff]/g, "").trim();
  }

  function draftText(element) {
    return plainText(element instanceof HTMLTextAreaElement ? element.value : element.innerText || element.textContent);
  }

  function sameContent(actual, expected) {
    const normalize = (value) => plainText(value).replace(/\s+/g, " ");
    return normalize(actual) === normalize(expected);
  }

  async function fillComposer(text, language) {
    const tr = (key) => trFor(language, key);
    if (typeof text !== "string" || !text.trim()) return { filled: false, reason: tr("noFillText") };
    const composer = await waitForComposer();
    if (!composer) return { filled:false, reason:tr("composerMissing") };
    if (draftText(composer)) return { filled: false, reason: tr("draftExists") };
    if (attachmentCount(composer)) return { filled: false, reason: tr("existingAttachment") };

    composer.focus();
    if (composer instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(composer, text);
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    } else {
      const selection = window.getSelection();
      if (!selection) return { filled: false, reason: tr("focusFailed") };
      selection.selectAllChildren(composer);
      selection.collapseToEnd();
      if (!document.execCommand("insertText", false, text)) {
        return { filled: false, reason: tr("textRejected") };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!sameContent(draftText(composer), text)) {
      return { filled: false, reason: tr("textNotKept") };
    }
    return { filled: true };
  }

  function attachmentCount(composer) {
    const scope = composedClosest(composer, "form") || composer.parentElement?.parentElement || composer.getRootNode();
    return queryAll(
      '[data-testid*="attachment"], [data-testid*="thumbnail"], ' +
      'img[src^="blob:"], img[src^="data:image/"], video, ' +
      'button[aria-label*="Remove file"], button[aria-label*="Remove image"], button[aria-label*="Remove attachment"], button[aria-label*="Delete attachment"], button[aria-label="Remove this attachment"]', scope
    ).length;
  }

  function imageFiles(images) {
    if (!Array.isArray(images) || !images.length || images.length > 4) return [];
    return images.map((image, index) => {
      if (!image || !["image/jpeg", "image/png", "image/gif"].includes(image.mimeType) ||
          typeof image.data !== "string" || image.data.length > 12_000_000) throw new Error("invalid image");
      const bytes = Uint8Array.from(atob(image.data), (character) => character.charCodeAt(0));
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("invalid image size");
      const extension = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" }[image.mimeType];
      const name = typeof image.name === "string" &&
        new RegExp(`^x-post-(?:image|video-frame)-[1-4]\\.${extension}$`).test(image.name)
        ? image.name : `x-post-image-${index + 1}.${extension}`;
      return new File([bytes], name, { type: image.mimeType });
    });
  }

  function findAttachmentInput(composer, accepts) {
    const form = composedClosest(composer, "form");
    const valid = element => element.isConnected && !element.disabled && accepts(element.accept || "") &&
      !composedClosest(element, 'article, nav, aside, [role=dialog], [data-message-author-role]');
    const local = form ? queryAll('input[type="file"]', form).filter(valid) : [];
    if (local.length === 1) return local[0];
    if (local.length > 1) return null;
    const candidates = queryAll('input[type="file"]').filter(element => valid(element) &&
      (!composedClosest(element, "form") || composedClosest(element, "form") === form));
    return candidates.length === 1 ? candidates[0] : null;
  }

  async function attachImages(images, language) {
    const tr = (key) => trFor(language, key);
    const composer = findComposer();
    if (!composer) return { attachedCount: 0, reason: tr("composerMissing") };
    const before = attachmentCount(composer);
    if (before) return { attachedCount: 0, reason: tr("existingAttachment") };

    let files;
    try { files = imageFiles(images); }
    catch { return { attachedCount: 0, reason: tr("photoAttachFailed") }; }
    if (!files.length) return { attachedCount: 0, reason: tr("photoAttachFailed") };

    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    const input = findAttachmentInput(composer, accept => !accept || accept.includes("image") ||
      accept.includes(".png") || accept.includes(".jpg"));
    if (input && (input.multiple || files.length === 1)) {
      if (input.files?.length) return { attachedCount: 0, reason: tr("existingAttachment") };
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } else {
      composer.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true, composed: true, cancelable: true, clipboardData: transfer
      }));
    }

    for (const delay of [150, 350, 1000, 1500]) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (attachmentCount(composer) > before) return { attachedCount: 1 };
    }
    return { attachedCount: 0, reason: tr("photoCheckPreview") };
  }

  async function attachVideo(video, language) {
    const tr = (key) => trFor(language, key);
    const composer = findComposer();
    if (!composer) return { attachedCount: 0, reason: tr("composerMissing") };
    const before = attachmentCount(composer);
    if (before) return { attachedCount: 0, reason: tr("existingAttachment") };
    if (!video || video.mimeType !== "video/mp4" || typeof video.data !== "string" ||
        video.data.length > 23_000_000) return { attachedCount: 0, reason: tr("videoAttachFailed") };
    let file;
    try {
      const bytes = Uint8Array.from(atob(video.data), (character) => character.charCodeAt(0));
      if (bytes.length < 12 || bytes.length > 16 * 1024 * 1024 ||
          String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") throw new Error("invalid MP4");
      file = new File([bytes], "x-post-video.mp4", { type: "video/mp4" });
    } catch { return { attachedCount: 0, reason: tr("videoAttachFailed") }; }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = findAttachmentInput(composer, accept => !accept || accept.includes("video") ||
      accept.includes(".mp4") || accept.includes("*/*"));
    if (input) {
      if (input.files?.length) return { attachedCount: 0, reason: tr("existingAttachment") };
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } else {
      composer.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true, composed: true, cancelable: true, clipboardData: transfer
      }));
    }
    for (const delay of [150, 350, 1000, 1500]) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (attachmentCount(composer) > before) return { attachedCount: 1 };
    }
    return { attachedCount: 0, reason: tr("videoCheckPreview") };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["FILL_COMPOSER", "ATTACH_IMAGES", "ATTACH_VIDEO"].includes(message?.type)) return;
    if (assistant === "grok" && !(location.pathname === "/" || /^\/(?:c|chat)\/[^/]+\/?$/.test(location.pathname))) { sendResponse({filled:false,attachedCount:0,reason:"Open a Grok chat to prepare this post."}); return; }
    if (message.type !== "FILL_COMPOSER" && typeof message.expectedText === "string") { const composer=findComposer(); if (!composer || !sameContent(draftText(composer),message.expectedText)) { sendResponse({attachedCount:0,reason:trFor(message.language,"draftExists")}); return; } }
    if (message.assistant && message.assistant !== assistant) { sendResponse({ filled:false, attachedCount:0, reason:"Selected assistant changed. Capture again." }); return; }
    const operation = message.type === "FILL_COMPOSER"
      ? fillComposer(message.text, message.language)
      : message.type === "ATTACH_IMAGES"
        ? attachImages(message.images, message.language)
        : attachVideo(message.video, message.language);
    operation
      .then(sendResponse)
      .catch(() => sendResponse(message.type === "FILL_COMPOSER"
        ? { filled: false, reason: trFor(message.language, "fillFailed") }
        : { attachedCount: 0, reason: trFor(message.language,
          message.type === "ATTACH_VIDEO" ? "videoAttachFailed" : "photoAttachFailed") }));
    return true;
  });
})();
