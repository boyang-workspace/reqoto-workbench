(function (root) {
  "use strict";

  function statusIdFromUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");
      if (!(["x.com", "twitter.com"].includes(host))) return "";
      const match = url.pathname.match(/^\/(?:[^/]+|i\/web)\/(?:status|article)\/(\d+)(?:\/|$)/);
      return match?.[1] || "";
    } catch {
      return "";
    }
  }

  function textOf(element) {
    return (element?.innerText ?? element?.textContent ?? "").replace(/\u0000/g, "").trim();
  }

  function articleTimeUrl(article, statusId) {
    for (const time of article.querySelectorAll("time")) {
      if (isQuoteMedia(time, article)) continue;
      const link = time.closest("a[href]");
      if (link && statusIdFromUrl(link.href) === statusId) return link.href;
    }
    return "";
  }

  function articleHasStatusLink(article, statusId) {
    return [...article.querySelectorAll('a[href*="/status/"]')]
      .some((link) => !isQuoteMedia(link, article) && statusIdFromUrl(link.href) === statusId);
  }

  function mainArticle(document, statusId) {
    const articles = [...document.querySelectorAll("article")];
    return articles.find((article) => articleTimeUrl(article, statusId)) ||
      articles.find((article) => articleHasStatusLink(article, statusId)) || null;
  }

  function isQuoteContainer(element) {
    return element.matches?.('[data-testid="quoteTweet"]') || (element.getAttribute?.('role') === 'link' &&
      Boolean(element.querySelector('time')) && Boolean(element.querySelector('[data-testid="tweetText"], [data-testid="User-Name"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]')));
  }

  function isQuoteMedia(element, article) {
    if (element.closest("article") !== article || element.closest('[data-testid="quoteTweet"]')) return true;
    for (let parent = element.parentElement; parent && parent !== article; parent = parent.parentElement) {
      if (isQuoteContainer(parent)) return true;
    }
    return false;
  }

  function mainPostImages(article) {
    const urls = [];
    const seen = new Set();
    for (const image of article.querySelectorAll('[data-testid="tweetPhoto"] img[src]')) {
      if (isQuoteMedia(image, article)) continue;
      try {
        const url = new URL(image.currentSrc || image.src);
        if (url.protocol !== "https:" || url.hostname !== "pbs.twimg.com" ||
            !url.pathname.startsWith("/media/")) continue;
        const key = `${url.pathname}?format=${url.searchParams.get("format") || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(url.href);
        if (urls.length === 4) break;
      } catch { /* Ignore non-media and malformed image URLs. */ }
    }
    return urls;
  }

  function articleReadView(document, pageUrl, postId) {
    const page = new URL(pageUrl);
    if (/^\/[^/]+\/article\/\d+(?:\/|$)/.test(page.pathname)) {
      return document.querySelector('[data-testid="twitterArticleReadView"]');
    }
    const outer = mainArticle(document, postId);
    return [...(outer?.querySelectorAll('[data-testid="twitterArticleReadView"]') || [])]
      .find((view) => !view.closest('[role="link"]')) || null;
  }

  function articleImages(view) {
    const urls = [];
    const seen = new Set();
    for (const image of view.querySelectorAll('img[src]')) {
      try {
        const url = new URL(image.currentSrc || image.src);
        if (url.protocol !== "https:" || url.hostname !== "pbs.twimg.com" ||
            !url.pathname.startsWith("/media/")) continue;
        const key = `${url.pathname}?format=${url.searchParams.get("format") || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(url.href);
        if (urls.length === 4) break;
      } catch { /* Ignore unrelated images and malformed URLs. */ }
    }
    return urls;
  }

  function articleBodyText(view) {
    const containers = [...view.querySelectorAll('[data-contents="true"]')];
    const body = containers.sort((a, b) =>
      b.querySelectorAll('[data-block="true"]').length - a.querySelectorAll('[data-block="true"]').length)[0];
    if (!body) return "";
    return [...body.querySelectorAll('[data-block="true"]')]
      .filter((block) => {
        const enclosing = block.parentElement?.closest('[data-block="true"]');
        return !enclosing || !body.contains(enclosing);
      })
      .map((block) => {
        const code = block.querySelector('[data-testid="markdown-code-block"] code, pre code');
        if (code) return `\`\`\`\n${textOf(code)}\n\`\`\``;
        if (block.matches("section")) {
          if (block.querySelector('video, [data-testid="videoPlayer"]')) return "[Embedded video]";
          if (block.querySelector('img[src^="https://pbs.twimg.com/media/"]')) return "[Article image]";
        }
        const line = textOf(block);
        if (!line) return "";
        if (block.matches("li")) return `- ${line}`;
        if (block.matches("h1,h2,h3")) return `## ${line}`;
        return line;
      }).filter(Boolean).join("\n\n");
  }

  function extractArticle(document, pageUrl, postId, view) {
    const title = textOf(view.querySelector('[data-testid="twitter-article-title"]'));
    const body = articleBodyText(view);
    if (!title || !body) return { ok: false, errorCode: "articleLoading" };
    const page = new URL(pageUrl);
    const pathHandle = page.pathname.split("/")[1] || "";
    const outer = mainArticle(document, postId);
    const userName = textOf(outer?.querySelector('[data-testid="User-Name"]'));
    const handle = userName.match(/@[A-Za-z0-9_]{1,15}/)?.[0] || `@${pathHandle}`;
    const displayName = userName.split("\n").map((line) => line.trim())
      .find((line) => line && !line.startsWith("@")) ||
      [...view.querySelectorAll(`a[href="/${pathHandle}"]`)].map(textOf)
        .find((line) => line && !line.startsWith("@")) || "";
    const canonical = new URL(`/${pathHandle}/article/${postId}`, page.origin);
    const truncated = body.length > 49900;
    return { ok: true, post: {
      id: postId, kind: "article", title: title.slice(0, 500),
      text: body.slice(0, 49900), truncated,
      author: displayName.slice(0, 160), handle,
      url: canonical.href, images: articleImages(view),
      articleHasVideo: Boolean(view.querySelector('video, [data-testid="videoPlayer"]')),
      video: null
    } };
  }

  function mainPostVideo(article) {
    const media = [...article.querySelectorAll('video, [data-testid="videoPlayer"]')]
      .find((element) => !isQuoteMedia(element, article));
    if (!media) return null;
    const video = media.matches("video") ? media : media.querySelector("video");
    let url = "";
    for (const candidate of [video?.currentSrc, video?.src, video?.querySelector("source[src]")?.src]) {
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "https:" && parsed.hostname === "video.twimg.com" &&
            parsed.pathname.toLowerCase().endsWith(".mp4")) { url = parsed.href; break; }
      } catch { /* X commonly uses blob URLs; these cannot be downloaded by the extension. */ }
    }
    let poster = "";
    const posterCandidate = video?.poster || media.querySelector("img[src]")?.currentSrc ||
      media.querySelector("img[src]")?.src || media.closest('[data-testid="videoPlayer"]')?.querySelector("img[src]")?.src;
    try {
      const parsed = new URL(posterCandidate);
      if (parsed.protocol === "https:" && parsed.hostname === "pbs.twimg.com" &&
          /^\/(?:media|ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\//.test(parsed.pathname)) {
        poster = parsed.href;
      }
    } catch { /* No usable preview. */ }
    return { url, poster };
  }

  function mainVideoElement(document, pageUrl) {
    const statusId = statusIdFromUrl(pageUrl);
    const article = statusId && mainArticle(document, statusId);
    if (!article) return null;
    return [...article.querySelectorAll("video")]
      .find((element) => !isQuoteMedia(element, article)) || null;
  }

  function cardIdentity(card, pageUrl = card?.ownerDocument?.location?.href) {
    if (!card?.isConnected) return null;
    if (card.matches('[data-testid="twitterArticleReadView"]') && !card.closest('article')) {
      const id = statusIdFromUrl(pageUrl);
      return id ? { id, url: pageUrl } : null;
    }
    if (!card.matches('article[data-testid="tweet"]')) return null;
    for (const time of card.querySelectorAll('time')) {
      if (isQuoteMedia(time, card)) continue;
      const link = time.closest('a[href]');
      const id = statusIdFromUrl(link?.href);
      if (id) { const url = new URL(link.href); url.search = ''; url.hash = ''; return { id, url: url.href }; }
    }
    return null;
  }

  function ownElements(card, selector) {
    return [...card.querySelectorAll(selector)].filter(element => !isQuoteMedia(element, card));
  }

  function incompleteCard(card) {
    const more = ownElements(card, '[data-testid="tweet-text-show-more-link"], button, a, [role="button"]')
      .some(element => element.dataset.testid === 'tweet-text-show-more-link' || /^(show more|显示更多|顯示更多|展开|展開)$/i.test(textOf(element)));
    const fullArticle = ownElements(card, '[data-testid="twitterArticleReadView"]').length > 0;
    const articlePreview = !fullArticle && ownElements(card, 'a[href*="/article/"], img[alt="Article cover image"], [data-testid="article-cover-image"]').length > 0;
    return { incomplete: more || articlePreview, articlePreview };
  }

  function quotedContext(card) {
    const containers = [...card.querySelectorAll('[data-testid="quoteTweet"], [role="link"]')]
      .filter(element => element.closest('article') === card &&
        isQuoteContainer(element));
    const quote = containers.find(element => !containers.some(other => other !== element && other.contains(element)));
    if (!quote) return null;
    const nested = containers.filter(element => element !== quote && quote.contains(element));
    const direct = selector => [...quote.querySelectorAll(selector)].filter(element => !nested.some(inner => inner.contains(element)));
    const link = direct('time').map(time => time.closest('a[href]')).find(anchor => statusIdFromUrl(anchor?.href))
      || direct('a[href]').find(anchor => statusIdFromUrl(anchor.href));
    const name = textOf(direct('[data-testid="User-Name"]')[0]);
    const text = textOf(direct('[data-testid="tweetText"]')[0]);
    return { text: text.slice(0, 6000), author: name.slice(0, 160), url: link?.href || '',
      incomplete: text.length > 6000 || nested.length > 0 || direct('[data-testid="tweet-text-show-more-link"],button,a,[role="button"]').some(element => element.dataset.testid === 'tweet-text-show-more-link' || /^(show more|显示更多|顯示更多)$/i.test(textOf(element))),
      hasMedia: direct('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], video').length > 0 };
  }

  function extractTimelinePost(card, pageUrl = card?.ownerDocument?.location?.href) {
    const identity = cardIdentity(card, pageUrl);
    if (!identity) return { ok: false, errorCode: 'postLoading' };
    const document = card.ownerDocument;
    const view = card.matches('[data-testid="twitterArticleReadView"]') ? card : ownElements(card, '[data-testid="twitterArticleReadView"]')[0];
    if (view) return extractArticle(document, identity.url, identity.id, view);
    const result = extractMainPost(document, identity.url);
    const flags = incompleteCard(card);
    const quote = quotedContext(card);
    if (!result.ok && quote && (quote.text || quote.hasMedia)) {
      result.ok = true;
      result.post = { ...identity, text:'', author:textOf(ownElements(card, '[data-testid="User-Name"]')[0]).slice(0, 160), images:[], video:null };
      delete result.errorCode;
    }
    // An Article preview can have no tweetText. Preserve only visible preview text.
    if (!result.ok && flags.articlePreview) {
      const preview = ownElements(card, 'a[href*="/article/"]')[0] || ownElements(card, 'img[alt="Article cover image"], [data-testid="article-cover-image"]')[0]?.closest('[role="link"]');
      if (!textOf(preview)) return result;
      result.ok = true;
      result.post = { ...identity, text: textOf(preview).slice(0, 50000), author: textOf(ownElements(card, '[data-testid="User-Name"]')[0]).slice(0, 160), images: [], video: null };
      delete result.errorCode;
    }
    if (!result.ok) return result;
    result.post.captureScope = 'card';
    result.post.incomplete = flags.incomplete || textOf(ownElements(card, '[data-testid="tweetText"]')[0]).length > 50000;
    result.post.articlePreview = flags.articlePreview;
    result.post.quotedPost = quote;
    return result;
  }

  async function sampleMainVideoFrames(document, pageUrl) {
    const video = mainVideoElement(document, pageUrl);
    if (!video) return [];
    if (video.readyState < 2) {
      await new Promise((resolve) => {
        const finish = () => { clearTimeout(timeout); video.removeEventListener("loadeddata", finish); resolve(); };
        const timeout = setTimeout(finish, 700);
        video.addEventListener("loadeddata", finish, { once: true });
      });
    }
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return [];

    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return [];

    const frames = [];
    const seen = new Set();
    for (let index = 0; index < 3; index += 1) {
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        const data = dataUrl.startsWith("data:image/jpeg;base64,") ? dataUrl.slice(23) : "";
        if (data && data.length <= 2_000_000 && !seen.has(data)) {
          frames.push({ name: `x-post-video-frame-${frames.length + 1}.jpg`, mimeType: "image/jpeg", data });
          seen.add(data);
        }
      } catch { break; /* Cross-origin or protected frames cannot be read. */ }
      if (index === 2 || video.paused || video.ended) break;
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    return frames;
  }

  function extractMainPost(document, pageUrl) {
    const statusId = statusIdFromUrl(pageUrl);
    if (!statusId) return { ok: false, errorCode: "openPost" };

    const articleView = articleReadView(document, pageUrl, statusId);
    if (articleView) return extractArticle(document, pageUrl, statusId, articleView);

    const article = mainArticle(document, statusId);
    if (!article) return { ok: false, errorCode: "postLoading" };

    const textElement = [...article.querySelectorAll('[data-testid="tweetText"]')]
      .find((element) => !isQuoteMedia(element, article));
    const text = textOf(textElement);
    const images = mainPostImages(article);
    const video = mainPostVideo(article);
    if (!text && !images.length && !video) return { ok: false, errorCode: "noPostText" };

    const userName = textOf(ownElements(article, '[data-testid="User-Name"]')[0]);
    const handle = userName.match(/@[A-Za-z0-9_]{1,15}/)?.[0] || "";
    const author = userName.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("@")) || "";
    const timeUrl = articleTimeUrl(article, statusId);
    const canonical = new URL(timeUrl || pageUrl);
    canonical.search = "";
    canonical.hash = "";

    return {
      ok: true,
      post: {
        id: statusId,
        text: text.slice(0, 50000),
        author: author.slice(0, 160),
        handle,
        url: canonical.href,
        images,
        video
      }
    };
  }

  root.XCaptureExtract = { statusIdFromUrl, extractMainPost, sampleMainVideoFrames, cardIdentity, extractTimelinePost, incompleteCard, isQuoteMedia, isQuoteContainer };
  if (typeof module !== "undefined" && module.exports) module.exports = root.XCaptureExtract;
})(typeof globalThis !== "undefined" ? globalThis : this);
