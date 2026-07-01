(function () {
  "use strict";

  const PANEL_ID = "aria-x-giveaway-panel";
  const PANEL_POS_KEY = "ariaXGiveawayPanelPosition";
  const STATE_PREFIX = "ariaXGiveawayState:";
  const HIGHLIGHT_CLASS = "aria-x-giveaway-highlight";
  const FRIENDS_KEY = "ariaXGiveawayApprovedFriends";

  const state = {
    analysis: null,
    friendHandle: "",
    approvedFriends: [],
    currentGuideKey: "",
    autoCompletePending: false,
    lastMessage: "Open a giveaway post, then click Analyze."
  };

  function normalizeHandle(handle) {
    const value = String(handle || "").trim().replace(/^@+/, "");
    return value ? "@" + value : "";
  }

  function uniqueHandles(handles) {
    const out = [];
    const seen = new Set();
    handles.forEach((handle) => {
      const normalized = normalizeHandle(handle);
      const key = normalized.toLowerCase();
      if (normalized && !seen.has(key)) {
        seen.add(key);
        out.push(normalized);
      }
    });
    return out;
  }

  function parseHandleList(text) {
    return uniqueHandles(String(text || "").split(/[\s,;]+/).filter(Boolean));
  }

  function loadApprovedFriends() {
    try {
      return parseHandleList(localStorage.getItem(FRIENDS_KEY) || "");
    } catch (err) {
      return [];
    }
  }

  function saveApprovedFriends(handles) {
    state.approvedFriends = uniqueHandles(handles || []);
    try {
      localStorage.setItem(FRIENDS_KEY, state.approvedFriends.join(", "));
    } catch (err) {}
    return state.approvedFriends;
  }

  function applyOptions(options) {
    if (!options) return;
    if (typeof options.approvedFriends === "string") {
      saveApprovedFriends(parseHandleList(options.approvedFriends));
      const input = document.getElementById("aria-x-friends");
      if (input) input.value = state.approvedFriends.join(", ");
    }
    if (typeof options.friendHandle === "string") {
      state.friendHandle = normalizeHandle(options.friendHandle);
      const input = document.getElementById("aria-x-friend");
      if (input) input.value = state.friendHandle;
    }
  }

  function cleanText(text) {
    return String(text || "").replace(/[^\S\r\n]+/g, " ").trim();
  }

  function cleanCommentText(text) {
    return cleanText(text).replace(/^["'`]+|["'`]+$/g, "").slice(0, 180);
  }

  function currentPostKey() {
    const match = location.pathname.match(/\/status\/(\d+)/i);
    if (match) return "status:" + match[1];
    return "url:" + location.href.replace(/[?#].*$/, "");
  }

  function loadChecklist() {
    try {
      return JSON.parse(localStorage.getItem(STATE_PREFIX + currentPostKey()) || "{}");
    } catch (err) {
      return {};
    }
  }

  function saveChecklist(data) {
    try {
      localStorage.setItem(STATE_PREFIX + currentPostKey(), JSON.stringify(data || {}));
    } catch (err) {}
  }

  function injectStyles() {
    if (document.getElementById("aria-x-giveaway-style")) return;
    const style = document.createElement("style");
    style.id = "aria-x-giveaway-style";
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 18px;
        bottom: 82px;
        width: 350px;
        z-index: 2147483647;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #10b981;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, .28);
        font: 13px/1.45 "Segoe UI", Arial, sans-serif;
        overflow: hidden;
        max-height: calc(100vh - 24px);
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .aria-x-head {
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
        background: #111827;
        border-bottom: 1px solid rgba(255,255,255,.09);
        user-select: none;
      }
      #${PANEL_ID} .aria-x-title { color: #86efac; font-weight: 800; }
      #${PANEL_ID} .aria-x-close {
        border: 0;
        background: transparent;
        color: #f8fafc;
        font-size: 16px;
        cursor: pointer;
      }
      #${PANEL_ID} .aria-x-body {
        padding: 10px 12px 12px;
        max-height: calc(100vh - 74px);
        overflow: auto;
      }
      #${PANEL_ID} button {
        border: 0;
        border-radius: 7px;
        padding: 7px 9px;
        margin: 4px 4px 4px 0;
        background: #1d4ed8;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      #${PANEL_ID} button.safe { background: #059669; }
      #${PANEL_ID} button.warn { background: #ea580c; }
      #${PANEL_ID} button.light { background: #334155; }
      #${PANEL_ID} input {
        width: 100%;
        padding: 8px;
        border: 1px solid #334155;
        background: #020617;
        color: #f8fafc;
        border-radius: 7px;
        margin: 6px 0;
        outline: none;
      }
      #${PANEL_ID} textarea {
        width: 100%;
        min-height: 54px;
        resize: vertical;
        padding: 8px;
        border: 1px solid #334155;
        background: #020617;
        color: #f8fafc;
        border-radius: 7px;
        margin: 6px 0;
        outline: none;
      }
      #${PANEL_ID} .aria-x-status {
        margin-top: 8px;
        padding: 8px;
        border-radius: 8px;
        background: rgba(15, 23, 42, .72);
        border: 1px solid rgba(148, 163, 184, .25);
        color: #dbeafe;
        max-height: 240px;
        overflow: auto;
        white-space: pre-wrap;
      }
      #${PANEL_ID} .aria-x-note {
        color: #fbbf24;
        font-size: 12px;
        margin-bottom: 6px;
      }
      #${PANEL_ID} label {
        display: block;
        margin: 5px 0;
        color: #e5e7eb;
      }
      .${HIGHLIGHT_CLASS} {
        outline: 3px solid #10b981 !important;
        outline-offset: 4px !important;
        border-radius: 999px !important;
        box-shadow: 0 0 0 6px rgba(16, 185, 129, .18) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function makePanel() {
    injectStyles();
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="aria-x-head">
        <div class="aria-x-title">ARIA X Giveaway Assistant</div>
        <button class="aria-x-close" title="Hide">x</button>
      </div>
      <div class="aria-x-body">
        <div class="aria-x-note">Safe mode: analyze, highlight, and draft only. You confirm every public action.</div>
        <input id="aria-x-friend" placeholder="@friend to tag in comment if required" />
        <textarea id="aria-x-friends" placeholder="Approved tag list only: @friend1, @friend2, @friend3"></textarea>
        <div>
          <button class="safe" data-action="best-run">Best safe run</button>
          <button class="safe" data-action="next-action">Next action</button>
          <button class="light" data-action="mark-done">Mark highlighted done</button>
          <button class="safe" data-action="prepare">Smart prepare</button>
          <button class="safe" data-action="analyze">Analyze</button>
          <button data-action="highlight">Highlight actions</button>
          <button class="safe" data-action="guide-like">Guide Like</button>
          <button class="safe" data-action="guide-repost">Guide Repost</button>
          <button data-action="profiles">Open follow profiles</button>
          <button data-action="copy">Copy comment</button>
          <button class="warn" data-action="draft">Fill reply draft</button>
          <button class="warn" data-action="profile-post">Fill profile post draft</button>
          <button class="light" data-action="save-friends">Save tag list</button>
          <button class="light" data-action="reset-panel">Reset bottom panel</button>
        </div>
        <div id="aria-x-checklist"></div>
        <div class="aria-x-status" id="aria-x-status">Open a giveaway post, then click Analyze.</div>
      </div>
    `;
    document.body.appendChild(panel);
    restorePanelPosition(panel);
    wirePanel(panel);
    ensurePanelVisible(panel);
    return panel;
  }

  function placePanelBottom(panel) {
    panel.style.left = "auto";
    panel.style.top = "auto";
    panel.style.right = "18px";
    panel.style.bottom = "82px";
    try {
      localStorage.removeItem(PANEL_POS_KEY);
    } catch (err) {}
  }

  function ensurePanelVisible(panel) {
    window.requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      if (
        rect.right < 40 ||
        rect.bottom < 40 ||
        rect.left > window.innerWidth - 40 ||
        rect.top > window.innerHeight - 40 ||
        rect.top < -20
      ) {
        placePanelBottom(panel);
        return;
      }
      if (panel.style.left && panel.style.left !== "auto") {
        const left = Math.max(6, Math.min(window.innerWidth - panel.offsetWidth - 6, rect.left));
        const top = Math.max(6, Math.min(window.innerHeight - panel.offsetHeight - 6, rect.top));
        panel.style.left = left + "px";
        panel.style.top = top + "px";
      }
    });
  }

  function restorePanelPosition(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || "null");
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        panel.style.left = pos.left + "px";
        panel.style.top = pos.top + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }
    } catch (err) {}
  }

  function wirePanel(panel) {
    panel.querySelector(".aria-x-close").addEventListener("click", () => panel.remove());

    const input = panel.querySelector("#aria-x-friend");
    const friendsInput = panel.querySelector("#aria-x-friends");
    state.approvedFriends = loadApprovedFriends();
    if (friendsInput) friendsInput.value = state.approvedFriends.join(", ");
    input.addEventListener("input", () => {
      state.friendHandle = normalizeHandle(input.value);
      renderAnalysis();
    });
    if (friendsInput) {
      friendsInput.addEventListener("change", () => {
        saveApprovedFriends(parseHandleList(friendsInput.value));
        renderAnalysis();
      });
    }

    panel.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button.dataset.action));
    });

    const head = panel.querySelector(".aria-x-head");
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    head.addEventListener("pointerdown", (event) => {
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      head.setPointerCapture(event.pointerId);
    });
    head.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const left = Math.max(6, Math.min(window.innerWidth - panel.offsetWidth - 6, event.clientX - offsetX));
      const top = Math.max(6, Math.min(window.innerHeight - panel.offsetHeight - 6, event.clientY - offsetY));
      panel.style.left = left + "px";
      panel.style.top = top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    head.addEventListener("pointerup", (event) => {
      dragging = false;
      try {
        const rect = panel.getBoundingClientRect();
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
      } catch (err) {}
      try { head.releasePointerCapture(event.pointerId); } catch (err) {}
    });
  }

  function setStatus(message) {
    state.lastMessage = message;
    const el = document.getElementById("aria-x-status");
    if (el) el.textContent = message;
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 8 && rect.height > 8 && style.display !== "none" && style.visibility !== "hidden";
  }

  function visibleArticles() {
    return Array.from(document.querySelectorAll("article")).filter((article) => {
      const rect = article.getBoundingClientRect();
      return rect.width > 220 && rect.height > 80 && rect.bottom > 0 && rect.top < window.innerHeight;
    });
  }

  function selectedArticle() {
    const articles = visibleArticles();
    if (!articles.length) return null;
    const centerY = window.innerHeight / 2;
    return articles
      .map((article) => {
        const rect = article.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - centerY);
        return { article, distance, area: rect.width * rect.height };
      })
      .sort((a, b) => a.distance - b.distance || b.area - a.area)[0].article;
  }

  function extractText(article) {
    if (!article) return "";
    const lines = [];
    article.querySelectorAll('[data-testid="tweetText"], div[lang], span').forEach((node) => {
      const text = cleanText(node.innerText || node.textContent || "");
      if (text && text.length > 1 && !lines.includes(text)) lines.push(text);
    });
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function extractAuthorHandle(article) {
    if (!article) return "";
    const links = Array.from(article.querySelectorAll('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]'));
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/(?:x\.com|twitter\.com)?\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i);
      if (!match) continue;
      const handle = match[1];
      if (!["home", "explore", "notifications", "messages", "i", "settings", "search"].includes(handle.toLowerCase())) {
        return normalizeHandle(handle);
      }
    }
    return "";
  }

  function extractAllHandles(text, article) {
    const handles = [];
    String(text || "").replace(/(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,15})/g, (_, prefix, handle) => {
      handles.push("@" + handle);
      return _;
    });
    const author = extractAuthorHandle(article);
    if (author) handles.unshift(author);
    return uniqueHandles(handles);
  }

  function extractRequiredHandles(text, article) {
    const author = extractAuthorHandle(article);
    const lines = String(text || "").split(/\n+/);
    const handles = [];
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (/\bfollow\b|\bfollowing\b|\bfollow must\b|\bmust follow\b/.test(lower)) {
        const matches = line.match(/@[A-Za-z0-9_]{1,15}/g) || [];
        handles.push(...matches);
        if (!matches.length && /\bme\b|\bmust follow\b|\bfollow must\b/.test(lower) && author) {
          handles.push(author);
        }
      }
    });
    if (!handles.length && /\bmust follow\b|\bfollow must\b|\bfollow me\b/.test(String(text || "").toLowerCase()) && author) {
      handles.push(author);
    }
    return uniqueHandles(handles);
  }

  function extractCommentKeyword(text) {
    const source = String(text || "");
    const patterns = [
      /\bwrite\s+["'“”‘’]([^"'“”‘’\n]{1,60})["'“”‘’]\s+(?:in|on)\s+(?:the\s+)?comments?/i,
      /\bcomment\s+["'“”‘’]([^"'“”‘’\n]{1,60})["'“”‘’]/i,
      /\breply\s+["'“”‘’]([^"'“”‘’\n]{1,60})["'“”‘’]/i,
      /\band\s+write\s+["'“”‘’]([^"'“”‘’\n]{1,60})["'“”‘’]/i,
      /\bcomment\s+([A-Za-z0-9#@$][A-Za-z0-9 #@$._-]{1,50})(?:\s|$)/i
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (!match || !match[1]) continue;
      let value = cleanCommentText(match[1]);
      value = value.replace(/\s+(?:in|on)\s+(?:the\s+)?comments?.*$/i, "").trim();
      value = value.replace(/\s+and\s+i.*$/i, "").trim();
      value = value.replace(/\s+&\s+i.*$/i, "").trim();
      value = value.replace(/\s+to\s+get.*$/i, "").trim();
      if (value && !/^(and|or|the|a|an|with|section)$/i.test(value)) return value;
    }
    return "";
  }

  function extractTagCount(text) {
    const lower = String(text || "").toLowerCase();
    const numeric = lower.match(/tag\s+(\d+)\s+(?:friends?|people|users?)/i);
    if (numeric) return Math.max(1, Number.parseInt(numeric[1], 10) || 1);
    if (/tag\s+(?:a|one|1)\s+friend/i.test(lower)) return 1;
    if (/tag\s+friends?|mention\s+friends?/.test(lower)) return 1;
    return 0;
  }

  function analyzeRules(text) {
    const lower = String(text || "").toLowerCase();
    return {
      follow: /\bfollow\b|\bfollowing\b|\bmust follow\b|\bfollow must\b/.test(lower),
      repost: /\bretweet\b|\brepost\b|\brt\b|retweet\s*\+|repost\s*\+/.test(lower),
      like: /\blike\b|\bliked\b|retweet\s*\+\s*like|repost\s*\+\s*like/.test(lower),
      comment: /\bcomment\b|\breply\b|\bwrite\b|\btag\b|mention/.test(lower),
      tagFriend: /tag\s+(?:\d+\s+)?friends?|tag\s+a\s+friend|mention\s+(?:a\s+)?friend/.test(lower),
      notifications: /turn\s+on\s+notifications?|notifications?\s+on|notify/.test(lower)
    };
  }

  function pickTagHandles(analysis) {
    const needed = Math.max(1, Number(analysis && analysis.tagCount) || 1);
    const manual = normalizeHandle(state.friendHandle);
    const approved = uniqueHandles([manual, ...state.approvedFriends]).filter(Boolean);
    if (!approved.length) return [];
    const shuffled = approved
      .map((handle) => ({ handle, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((entry) => entry.handle);
    return shuffled.slice(0, needed);
  }

  function makeCommentDraft(analysis) {
    const base = analysis.commentKeyword || "Done";
    if (analysis.rules.tagFriend) {
      const tags = pickTagHandles(analysis);
      if (tags.length) return `${base} ${tags.join(" ")}`;
      return `${base} @friend`;
    }
    return base;
  }

  function makeProfilePostDraft(analysis) {
    const source = analysis || state.analysis || analyzeCurrentPost();
    if (!source) {
      return "Sharing this giveaway. Good luck everyone.";
    }
    const author = source.authorHandle || (source.requiredHandles && source.requiredHandles[0]) || "";
    const tags = [];
    const text = source.text || "";
    const hashtagMatches = text.match(/#[A-Za-z0-9_]+/g) || [];
    hashtagMatches.slice(0, 4).forEach((tag) => {
      if (!tags.includes(tag)) tags.push(tag);
    });
    if (!tags.length) tags.push("#giveaway");
    const sourceLine = author ? ` from ${author}` : "";
    return [
      `Entering this giveaway${sourceLine}.`,
      "Done: follow, like, repost, and comment requirements prepared.",
      `Good luck everyone. ${tags.join(" ")}`
    ].join("\n");
  }

  function analyzeCurrentPost() {
    const article = selectedArticle();
    if (!article) {
      state.analysis = null;
      setStatus("No visible X post found. Open the giveaway post and scroll it into view.");
      return null;
    }
    const text = extractText(article);
    const rules = analyzeRules(text);
    const analysis = {
      article,
      text,
      rules,
      url: location.href,
      key: currentPostKey(),
      authorHandle: extractAuthorHandle(article),
      handles: extractAllHandles(text, article),
      requiredHandles: extractRequiredHandles(text, article),
      commentKeyword: extractCommentKeyword(text),
      tagCount: extractTagCount(text)
    };
    if (analysis.requiredHandles.length) analysis.rules.follow = true;
    if (analysis.commentKeyword || analysis.tagCount) analysis.rules.comment = true;
    state.analysis = analysis;
    renderAnalysis();
    return analysis;
  }

  function renderAnalysis() {
    const panel = makePanel();
    const checklistEl = panel.querySelector("#aria-x-checklist");
    const analysis = state.analysis;
    if (!analysis) {
      checklistEl.innerHTML = "";
      return;
    }
    const saved = loadChecklist();
    const items = [
      ["follow", `Follow profile(s): ${analysis.requiredHandles.join(", ") || analysis.authorHandle || "profile mentioned"}`, analysis.rules.follow],
      ["notifications", "Turn on notifications", analysis.rules.notifications],
      ["repost", "Repost / Retweet", analysis.rules.repost],
      ["like", "Like post", analysis.rules.like],
      ["comment", `Comment${analysis.commentKeyword ? `: ${analysis.commentKeyword}` : ""}${analysis.tagCount ? ` + tag ${analysis.tagCount} friend(s)` : ""}`, analysis.rules.comment || analysis.rules.tagFriend]
    ].filter((item) => item[2]);

    checklistEl.innerHTML = items.map(([key, label]) => `
      <label>
        <input type="checkbox" data-check="${key}" ${saved[key] ? "checked" : ""}>
        ${label}
      </label>
    `).join("");
    checklistEl.querySelectorAll("input[data-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const data = loadChecklist();
        data[checkbox.dataset.check] = checkbox.checked;
        saveChecklist(data);
      });
    });

    const rules = items.map(([, label]) => "- " + label).join("\n") || "- No common giveaway rule detected";
    const draft = makeCommentDraft(analysis);
    const chosenTags = pickTagHandles(analysis);
    const required = analysis.requiredHandles.length ? analysis.requiredHandles.join(", ") : "None detected";
    const allHandles = analysis.handles.length ? analysis.handles.join(", ") : "No handles found";
    const approved = state.approvedFriends.length ? state.approvedFriends.join(", ") : "None saved";
    setStatus(
      `Required follows: ${required}\n` +
      `All handles found: ${allHandles}\n\n` +
      `Rules:\n${rules}\n\n` +
      `Approved tag list: ${approved}\n` +
      `Selected tag(s): ${chosenTags.join(", ") || "none; add approved friends first"}\n\n` +
      `Comment draft:\n${draft}\n\n` +
      "Use Highlight, then manually confirm Follow/Repost/Like/Reply in X."
    );
  }

  function requiredStepKeys(analysis) {
    const steps = [];
    if (!analysis) return steps;
    if (analysis.rules.follow) steps.push("follow");
    if (analysis.rules.like) steps.push("like");
    if (analysis.rules.repost) steps.push("repost");
    if (analysis.rules.comment || analysis.rules.tagFriend || analysis.commentKeyword) steps.push("comment");
    if (analysis.rules.notifications) steps.push("notifications");
    return steps;
  }

  function initializeChecklist(analysis) {
    const saved = loadChecklist();
    requiredStepKeys(analysis).forEach((key) => {
      if (typeof saved[key] !== "boolean") saved[key] = false;
    });
    saveChecklist(saved);
    return saved;
  }

  function highlightElements(elements) {
    let count = 0;
    elements.forEach((el) => {
      if (visible(el)) {
        el.classList.add(HIGHLIGHT_CLASS);
        count += 1;
      }
    });
    return count;
  }

  function highlightActions() {
    document.querySelectorAll("." + HIGHLIGHT_CLASS).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    const article = (state.analysis && state.analysis.article) || selectedArticle();
    const roots = article ? [article, document] : [document];
    const selectors = [
      '[data-testid="like"]',
      '[data-testid="unlike"]',
      '[data-testid="retweet"]',
      '[data-testid="unretweet"]',
      '[data-testid="reply"]',
      '[aria-label*="Like" i]',
      '[aria-label*="Repost" i]',
      '[aria-label*="Retweet" i]',
      '[aria-label*="Reply" i]',
      '[aria-label*="Follow" i]',
      '[data-testid*="follow" i]'
    ];
    const elements = [];
    roots.forEach((root) => {
      selectors.forEach((selector) => {
        root.querySelectorAll(selector).forEach((el) => elements.push(el));
      });
    });
    const count = highlightElements(elements);
    setStatus(count ? `Highlighted ${count} control(s). Public actions still need your manual click.` : "No action buttons found yet. Open the post or profile card first.");
  }

  function findActionControls(kind) {
    const article = (state.analysis && state.analysis.article) || selectedArticle();
    const roots = article ? [article] : [document];
    const selectors = kind === "like"
      ? [
          '[data-testid="like"]',
          '[data-testid="unlike"]',
          '[aria-label*="Like" i]',
          '[aria-label*="Unlike" i]'
        ]
      : [
          '[data-testid="retweet"]',
          '[data-testid="unretweet"]',
          '[aria-label*="Repost" i]',
          '[aria-label*="Retweet" i]',
          '[aria-label*="Undo repost" i]',
          '[aria-label*="Undo Retweet" i]'
        ];
    const controls = [];
    roots.forEach((root) => {
      selectors.forEach((selector) => {
        root.querySelectorAll(selector).forEach((el) => {
          if (visible(el) && !controls.includes(el)) controls.push(el);
        });
      });
    });
    return controls;
  }

  function guidePublicAction(kind) {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    state.currentGuideKey = kind === "like" ? "like" : "repost";
    document.querySelectorAll("." + HIGHLIGHT_CLASS).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    const controls = findActionControls(kind);
    if (!controls.length) {
      setStatus(`Could not find the ${kind} button on the visible post. Scroll the giveaway post into view, then try again.`);
      return;
    }
    const target = controls[0];
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    window.setTimeout(() => target.classList.add(HIGHLIGHT_CLASS), 300);
    const label = cleanText(target.getAttribute("aria-label") || target.innerText || "");
    const alreadyDone = kind === "like"
      ? /unlike/i.test(label) || target.getAttribute("data-testid") === "unlike"
      : /undo|unretweet/i.test(label) || target.getAttribute("data-testid") === "unretweet";
    const name = kind === "like" ? "Like" : "Repost/Retweet";
    setStatus(
      alreadyDone
        ? `${name} already looks done on this post.\n\nI highlighted the control so you can verify it. Use Mark highlighted done to record it.`
        : `${name} button highlighted.\n\nClick the highlighted ${name} button yourself. ARIA will record the click and move to the next action.`
    );
  }

  function findFollowControls() {
    const selectors = [
      '[data-testid*="follow" i]',
      '[aria-label*="Follow" i]',
      'button'
    ];
    const controls = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        const text = cleanText(el.innerText || el.getAttribute("aria-label") || "");
        if (visible(el) && /follow/i.test(text) && !/following|follows you/i.test(text) && !controls.includes(el)) {
          controls.push(el);
        }
      });
    });
    return controls;
  }

  function guideFollowAction() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    state.currentGuideKey = "follow";
    document.querySelectorAll("." + HIGHLIGHT_CLASS).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
    const controls = findFollowControls();
    if (controls.length) {
      controls[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      window.setTimeout(() => controls[0].classList.add(HIGHLIGHT_CLASS), 300);
      setStatus("Follow button highlighted.\n\nClick the highlighted Follow button yourself. ARIA will mark it done and move to the next action. If it misses, click Mark highlighted done.");
      return;
    }
    const handles = analysis.requiredHandles.length ? analysis.requiredHandles : (analysis.authorHandle ? [analysis.authorHandle] : analysis.handles);
    setStatus(
      `Follow required, but no visible Follow button found.\n\nOpen required profile(s): ${handles.join(", ") || "profile mentioned"}\nThen follow manually and click Mark highlighted done.`
    );
  }

  function guideNotificationsAction() {
    state.currentGuideKey = "notifications";
    setStatus(
      "Notifications are required.\n\nOpen the required profile, turn on notifications manually, then click Mark highlighted done."
    );
  }

  async function guideCommentAction() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    state.currentGuideKey = "comment";
    await fillReplyDraft();
    setStatus(
      `${state.lastMessage}\n\nAfter reviewing, click Reply yourself. ARIA will mark comment done and move next. If it misses, click Mark highlighted done.`
    );
  }

  async function guideNextAction() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    const saved = initializeChecklist(analysis);
    const next = requiredStepKeys(analysis).find((key) => !saved[key]);
    if (!next) {
      state.currentGuideKey = "";
      setStatus("All detected giveaway requirements are marked done for this post.");
      renderAnalysis();
      return;
    }
    if (next === "follow") return guideFollowAction();
    if (next === "like") return guidePublicAction("like");
    if (next === "repost") return guidePublicAction("repost");
    if (next === "comment") return guideCommentAction();
    if (next === "notifications") return guideNotificationsAction();
  }

  function markCurrentGuideDone() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    const key = state.currentGuideKey;
    if (!key) {
      setStatus("No highlighted/current action to mark. Click Next action first.");
      return;
    }
    const saved = initializeChecklist(analysis);
    saved[key] = true;
    saveChecklist(saved);
    renderAnalysis();
    setStatus(`${key.charAt(0).toUpperCase() + key.slice(1)} marked done.\n\nClick Next action for the next requirement.`);
  }

  async function bestSafeRun() {
    const analysis = analyzeCurrentPost();
    if (!analysis) return;
    initializeChecklist(analysis);
    const draft = makeCommentDraft(analysis);
    try {
      await navigator.clipboard.writeText(draft);
    } catch (err) {}
    highlightActions();
    await guideNextAction();
  }

  function openProfiles() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    const handles = analysis.requiredHandles.length ? analysis.requiredHandles : (analysis.authorHandle ? [analysis.authorHandle] : analysis.handles);
    if (!handles.length) {
      setStatus("No @handles found in this post.");
      return;
    }
    handles.slice(0, 8).forEach((handle, index) => {
      setTimeout(() => {
        window.open("https://x.com/" + handle.replace(/^@/, ""), "_blank", "noopener,noreferrer");
      }, index * 350);
    });
    setStatus(`Opened ${handles.slice(0, 8).join(", ")}.\nFollow manually if required, then tick checklist.`);
  }

  async function copyComment() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    const draft = makeCommentDraft(analysis);
    try {
      await navigator.clipboard.writeText(draft);
      setStatus(`Copied comment draft:\n${draft}`);
    } catch (err) {
      setStatus(`Copy failed. Manual draft:\n${draft}`);
    }
  }

  function setEditableText(el, text) {
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));
  }

  function findReplyInput() {
    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '[aria-label*="Post text" i][contenteditable="true"]',
      '[aria-label*="Tweet text" i][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      '[contenteditable="true"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && visible(el)) return el;
    }
    return null;
  }

  async function fillReplyDraft() {
    const analysis = state.analysis || analyzeCurrentPost();
    if (!analysis) return;
    const draft = makeCommentDraft(analysis);
    const article = analysis.article || selectedArticle();
    const replyButton = article && (article.querySelector('[data-testid="reply"]') || article.querySelector('[aria-label*="Reply" i]'));
    if (replyButton) {
      replyButton.click();
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    const input = findReplyInput();
    if (!input) {
      await copyComment();
      setStatus("Could not find reply box. I copied the draft instead. Paste it manually.");
      return;
    }
    setEditableText(input, draft);
    setStatus(`Reply draft filled, not submitted:\n${draft}\n\nReview it and click Reply yourself.`);
  }

  async function openComposeIfNeeded(forceCompose) {
    if (!forceCompose && findReplyInput()) return true;
    const selectors = [
      'a[href="/compose/post"]',
      'a[data-testid="SideNav_NewTweet_Button"]',
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label="Post"]',
      '[aria-label="Tweet"]'
    ];
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && visible(button)) {
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 900));
        return Boolean(findReplyInput());
      }
    }
    return false;
  }

  async function fillProfilePostDraft() {
    const analysis = state.analysis || analyzeCurrentPost();
    const draft = makeProfilePostDraft(analysis);
    const opened = await openComposeIfNeeded(true);
    const input = findReplyInput();
    if (!opened || !input) {
      try {
        await navigator.clipboard.writeText(draft);
      } catch (err) {}
      setStatus(`Could not find the profile post composer. I copied this draft instead:\n\n${draft}`);
      return;
    }
    setEditableText(input, draft);
    setStatus(`Profile post draft filled, not submitted:\n${draft}\n\nReview it and click Post yourself.`);
  }

  async function smartPrepare() {
    const analysis = analyzeCurrentPost();
    if (!analysis) return;
    highlightActions();
    const draft = makeCommentDraft(analysis);
    try {
      await navigator.clipboard.writeText(draft);
    } catch (err) {}
    const saved = loadChecklist();
    ["follow", "notifications", "repost", "like", "comment"].forEach((key) => {
      if (analysis.rules[key] || (key === "comment" && (analysis.rules.tagFriend || analysis.commentKeyword))) {
        saved[key] = Boolean(saved[key]);
      }
    });
    saveChecklist(saved);
    if (analysis.rules.comment || analysis.rules.tagFriend || analysis.commentKeyword) {
      await fillReplyDraft();
    }
    const required = [
      analysis.rules.follow ? "Follow required profile(s)" : "",
      analysis.rules.notifications ? "Turn on notifications" : "",
      analysis.rules.repost ? "Repost/Retweet" : "",
      analysis.rules.like ? "Like" : "",
      (analysis.rules.comment || analysis.rules.tagFriend || analysis.commentKeyword) ? `Comment draft: ${draft}` : ""
    ].filter(Boolean).join("\n- ");
    setStatus(
      `Smart prepare done.\n\n- ${required || "No common requirements detected"}\n\n` +
      "I highlighted controls, copied the comment draft, and filled the reply draft when the reply box was available. Public actions still need your manual click."
    );
  }

  function runAction(action) {
    const panel = makePanel();
    if (action === "best-run") {
      return bestSafeRun();
    }
    if (action === "next-action") {
      return guideNextAction();
    }
    if (action === "mark-done") {
      markCurrentGuideDone();
      return;
    }
    if (action === "prepare") {
      return smartPrepare();
    }
    if (action === "panel" || action === "reset-panel") {
      placePanelBottom(panel);
      setStatus("Floating panel reset to bottom-right. Drag the dark header if you want to move it.");
      return;
    }
    if (action === "analyze") {
      analyzeCurrentPost();
      return;
    }
    if (action === "highlight") {
      if (!state.analysis) analyzeCurrentPost();
      highlightActions();
      return;
    }
    if (action === "guide-like") {
      guidePublicAction("like");
      return;
    }
    if (action === "guide-repost") {
      guidePublicAction("repost");
      return;
    }
    if (action === "profiles") {
      openProfiles();
      return;
    }
    if (action === "copy") {
      return copyComment();
    }
    if (action === "draft") {
      return fillReplyDraft();
    }
    if (action === "profile-post") {
      return fillProfilePostDraft();
    }
    if (action === "save-friends") {
      const input = document.getElementById("aria-x-friends");
      saveApprovedFriends(parseHandleList(input ? input.value : ""));
      setStatus(`Saved approved tag list:\n${state.approvedFriends.join(", ") || "No friends saved yet."}`);
      return;
    }
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "ARIA_X_COMMAND") return false;
      makePanel();
      applyOptions(message.options);
      Promise.resolve(runAction(message.command)).then(() => {
        sendResponse({ ok: true, message: state.lastMessage });
      });
      return true;
    });
  }

  makePanel();
})();
