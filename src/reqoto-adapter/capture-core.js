(function (root) {
  "use strict";

  const locale = root.XReplyLocale || (typeof require === "function" ? require("./locale.js") : null);
  const DEFAULT_PROMPT = locale.defaults.en;
  const LEGACY_DEFAULT_PROMPT = locale.legacyChineseDefault;

  function resolvePrompt(value) {
    const prompt = typeof value === "string" ? value.trim() : "";
    return locale.isDefault(prompt) ? DEFAULT_PROMPT : prompt;
  }

  function sanitizeQuotedPost(value) {
    if (!value || typeof value.text !== "string" || value.text.length > 6000 || typeof value.author !== "string" || value.author.length > 160) return null;
    let url = "";
    try { const parsed = new URL(value.url); if (parsed.protocol === "https:" && ["x.com", "twitter.com"].includes(parsed.hostname.replace(/^www\./, "")) && value.url.length <= 2048) url = parsed.href; } catch {}
    return { text:value.text, author:value.author, url, incomplete:value.incomplete === true, hasMedia:value.hasMedia === true };
  }

  function formatCapture(prompt, post, language = "en") {
    const author = [post.author, post.handle].filter(Boolean).join(" ");
    const tr = (key) => locale.t(language, key);
    const isArticle = post.kind === "article";
    return [
      locale.isDefault(prompt?.trim()) ? locale.defaults[locale.normalizeLanguage(language)] : prompt.trim(),
      "",
      tr("languageRule"),
      tr("decisionRule"),
      post.incomplete ? tr(post.articlePreview ? "articlePreviewRule" : "incompletePostRule") : null,
      post.quotedPost ? tr("quotedPostRule") : null,
      isArticle ? tr("articleContextRule") : null,
      post.images?.length ? tr(isArticle ? "articleImageContextRule" : "imageContextRule") : null,
      post.articleHasVideo ? tr("articleVideoRule") : null,
      post.video ? tr("videoContextRule") : null,
      post.video?.frames?.length ? tr("videoFramesRule") : null,
      "",
      tr(isArticle ? "articleIntro" : "quoteIntro"),
      tr(isArticle ? "articleStart" : "postStart"),
      author ? `${tr("author")}: ${author}` : null,
      isArticle ? `${tr("articleTitle")}: ${post.title || ""}` : null,
      `${tr(isArticle ? "articleBody" : "post")}:\n${post.text.trim() || tr(post.video ? "videoOnlyPost" : post.quotedPost ? "quoteOnlyPost" : "imageOnlyPost")}`,
      post.truncated ? tr("articleTruncated") : null,
      post.quotedPost ? [tr("quotedPostStart"),
        `${tr("author")}: ${post.quotedPost.author || ""}`,
        `${tr("post")}:\n${post.quotedPost.text || tr("quotedTextMissing")}`,
        post.quotedPost.url ? `${tr("link")}: ${post.quotedPost.url}` : null,
        post.quotedPost.incomplete ? tr("incompletePostRule") : null,
        post.quotedPost.hasMedia ? tr("quotedMediaMissing") : null,
        tr("quotedPostEnd")].filter(Boolean).join("\n") : null,
      `${tr("link")}: ${post.url}`,
      tr(isArticle ? "articleEnd" : "postEnd")
    ].filter((line) => line !== null).join("\n");
  }

  function isAssistantUrl(value, assistant = "chatgpt") {
    try { const url = new URL(value); return url.protocol === "https:" && (assistant === "grok" ? (["grok.com", "www.grok.com"].includes(url.hostname) && (url.pathname === "/" || /^\/(?:c|chat)\/[^/]+\/?$/.test(url.pathname))) : url.hostname === "chatgpt.com"); } catch { return false; }
  }

  function chooseAssistantTab(sourceTab, tabs, language = "en", assistant = "chatgpt") {
    const candidates = tabs.filter((tab) => {
      return isAssistantUrl(tab.url, assistant);
    });
    if (!candidates.length) return { tab: null, reason: locale.forAssistant(language, "noChatGPT", assistant) };

    const splitId = sourceTab.splitViewId;
    if (Number.isInteger(splitId) && splitId >= 0) {
      const paired = candidates.filter((tab) => tab.splitViewId === splitId);
      if (paired.length === 1) return { tab: paired[0], reason: "" };
    }
    if (candidates.length === 1) return { tab: candidates[0], reason: "" };
    return { tab: null, reason: locale.forAssistant(language, "multipleChatGPT", assistant) };
  }

  const chooseChatGPTTab = (sourceTab, tabs, language) => chooseAssistantTab(sourceTab, tabs, language, "chatgpt");
  root.XCaptureCore = { DEFAULT_PROMPT, resolvePrompt, formatCapture, chooseChatGPTTab, chooseAssistantTab, isAssistantUrl, sanitizeQuotedPost };
  if (typeof module !== "undefined" && module.exports) module.exports = root.XCaptureCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
