(function (root) {
  "use strict";

  function statusId(value) {
    try {
      const url = new URL(value);
      if (!["x.com", "twitter.com"].includes(url.hostname.replace(/^www\./, ""))) return "";
      return url.pathname.match(/^\/[^/]+\/status\/(\d+)(?:\/|$)/)?.[1] || "";
    } catch { return ""; }
  }

  function own(article, selector) {
    return [...article.querySelectorAll(selector)].filter(element => root.XCaptureExtract
      ? !root.XCaptureExtract.isQuoteMedia(element, article)
      : element.closest("article") === article && !element.closest('[data-testid="quoteTweet"]'));
  }

  // Accept only a displayed number; missing counters are never converted to 0.
  function parseCount(value) {
    const match = String(value || "").replace(/[\u00a0\u202f]/g, " ").match(/(?:^|[^\d])([\d]+(?:[., ]\d+)*)(?:\s*([kKmMbB万萬亿億千])(?=$|[^A-Za-z\d]))?/);
    if (!match) return null;
    let number = match[1].trim().replace(/ /g, "");
    const suffix = (match[2] || "").toLowerCase();
    if (suffix && /^[0-9]+,[0-9]{1,2}$/.test(number)) number = number.replace(",", ".");
    else number = number.replace(/,/g, "");
    if (!suffix && /^\d{1,3}(?:\.\d{3})+$/.test(number)) number = number.replace(/\./g, "");
    const amount = Number(number);
    const multiplier = { k: 1e3, m: 1e6, b: 1e9, 万: 1e4, 萬: 1e4, 亿: 1e8, 億: 1e8, 千: 1e3 }[suffix] || 1;
    return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * multiplier) : null;
  }

  function counter(article, selector) {
    const element = own(article, selector)[0];
    if (!element) return null;
    const labelled = parseCount(element.getAttribute("aria-label"));
    if (labelled !== null) return labelled;
    const text = (element.innerText ?? element.textContent ?? "").trim();
    return parseCount(text);
  }

  function cardPost(article, options = {}) {
    if (!article?.matches?.('article[data-testid="tweet"]')) return null;
    const timeLink = own(article, "time")
      .map((time) => time.closest("a[href]"))
      .find((link) => link && link.closest("article") === article && statusId(link.href));
    if (!timeLink) return null;
    const textElement = own(article, '[data-testid="tweetText"]')[0];
    const text = (textElement?.innerText ?? textElement?.textContent ?? "").trim();
    const personal = options.personal ?? root.ReqotoBuild?.personalProfile === true;
    const hasMedia = own(article, '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], video, img[src*="pbs.twimg.com/media/"]').length > 0;
    const hasQuotedPost = Boolean(article.querySelector('[data-testid="quoteTweet"]')) || [...article.querySelectorAll('[role="link"]')].some(element => element.closest('article') === article &&
      (root.XCaptureExtract ? root.XCaptureExtract.isQuoteContainer(element) : element.querySelector('time') && element.querySelector('[data-testid="tweetText"]')));
    if (personal ? !text && !hasMedia && !hasQuotedPost : text.length < 20) return null;
    const name = own(article, '[data-testid="User-Name"]')[0];
    const author = (name?.innerText ?? name?.textContent ?? "").trim().slice(0, 160);
    const post = { id: statusId(timeLink.href), text: text.slice(0, 1800), author };
    if (!personal) return post;
    const time = own(article, "time").find(element => element.closest("a[href]") === timeLink);
    const published = Date.parse(time?.getAttribute("datetime") || "");
    return { ...post, hasMedia, hasQuotedPost,
      publishedAt: Number.isFinite(published) ? published : null,
      observedAt: options.now ?? Date.now(),
      metrics: {
        replies: counter(article, '[data-testid="reply"]'),
        views: counter(article, 'a[href$="/analytics"], a[href*="/analytics?"], [data-testid="analytics"]'),
        likes: counter(article, '[data-testid="like"], [data-testid="unlike"]'),
        reposts: counter(article, '[data-testid="retweet"], [data-testid="unretweet"]')
      }
    };
  }

  function needsVisualContext(post) {
    return Boolean((post.hasMedia || post.hasQuotedPost) && post.text.trim().length < 20);
  }

  // Trial cues, not predicted reply reach. Heat never changes the content label.
  function opportunity(post, now = Date.now()) {
    const ageHours = Number.isFinite(post.publishedAt) && post.publishedAt <= now ? (now - post.publishedAt) / 3600000 : null;
    const replies = post.metrics?.replies ?? null;
    const views = post.metrics?.views ?? null;
    const fresh = ageHours !== null && ageHours < 6;
    const active = replies !== null && replies >= 3;
    const crowded = replies !== null && replies >= 100;
    const visibleReach = ageHours !== null && ageHours < 24 && views !== null && views >= 1000;
    const priority = fresh && !crowded && (active || visibleReach) ? "higher" : "normal";
    const cue = crowded ? "crowded" : fresh ? "fresh" : active ? "active" : visibleReach ? "reach" : ageHours !== null && ageHours >= 24 ? "older" : "unknown";
    return { ageHours, replies, views, priority, cue };
  }

  function decisionKey(post, provider, focus, feedbackSignature = "") {
    return JSON.stringify([provider, focus, feedbackSignature, post.id, post.text, Boolean(post.hasMedia), Boolean(post.hasQuotedPost)]);
  }

  function feedbackItems(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.filter((item) => {
      if (!item || !/^\d+$/.test(item.id) || !["reply", "skip"].includes(item.label) ||
          typeof item.text !== "string" || (!item.text.trim() && !item.hasMedia && !item.hasQuotedPost)) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 30).map((item) => ({
      id: item.id,
      label: item.label,
      text: item.text.trim().slice(0, 360),
      author: typeof item.author === "string" ? item.author.slice(0, 80) : "",
      ...(item.hasMedia ? { hasMedia: true } : {}),
      ...(item.hasQuotedPost ? { hasQuotedPost: true } : {})
    }));
  }

  function updateFeedback(value, action) {
    const items = feedbackItems(value);
    const next = items.filter(item => item.id !== action.id);
    if (action.mode === "toggle" && items.find(item => item.id === action.id)?.label !== action.label) {
      next.unshift({ ...action.post, id:action.id, label:action.label });
    }
    return feedbackItems(next);
  }

  function terms(text) {
    const value = String(text || "").toLowerCase();
    const result = new Set((value.match(/[a-z0-9]{3,}/g) || [])
      .filter((word) => !["the", "and", "for", "this", "that", "with", "from", "you", "your", "are", "was"].includes(word)));
    for (const run of value.match(/[\u3400-\u9fff]+/g) || []) {
      for (let index = 0; index < run.length - 1; index += 1) result.add(run.slice(index, index + 2));
    }
    return result;
  }

  function selectExamples(post, items) {
    const postTerms = terms(post.text);
    return ["reply", "skip"].flatMap((label) => feedbackItems(items)
      .filter((item) => item.label === label && item.id !== post.id && !needsVisualContext(item))
      .map((item, index) => ({ item, score: [...terms(item.text)].filter((term) => postTerms.has(term)).length, index }))
      .filter(({ score }) => root.ReqotoBuild?.personalProfile !== true || score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, 2)
      .map(({ item }) => ({ label: item.label, text: item.text, author: item.author })));
  }

  root.ReqotoTriageCore = { cardPost, statusId, feedbackItems, updateFeedback, selectExamples, parseCount, needsVisualContext, opportunity, decisionKey };
  if (typeof module !== "undefined" && module.exports) module.exports = root.ReqotoTriageCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
