(function () {
  "use strict";

  const DEFAULT_SERVER_BASE = "http://127.0.0.1:5050";
  const SERVER_BASE_KEY = "ariaServerBase";
  let apiBase = DEFAULT_SERVER_BASE + "/api/clickup";
  const STATE_KEY = "__ARIA_CLICKUP_EXTENSION_SENDER__";
  const PANEL_ID = "aria-clickup-extension-panel";
  const PANEL_POS_KEY = "ariaClickupSenderPanelPosition";
  const PANEL_MIN_KEY = "ariaClickupSenderPanelMinimized";
  const COUNT_PREFIX = "ariaClickupSenderPromptCount:";
  const OPTIONS_KEY = "ariaClickupSenderOptions";
  const DEFAULT_INTERVAL_MS = 30000;
  const MIN_INTERVAL_MS = 1000;
  const RESPONSE_STABLE_MS = 8000;
  const DEFAULT_TITLE_KEYWORD = "Money-Making";
  const DEFAULT_OPTIONS = {
    sendMode: "number",
    customText: ".",
    intervalMs: DEFAULT_INTERVAL_MS
  };
  let tabScopeToken = "";
  const PAGE_SCOPE_ID = `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const BUSY_PHRASES = [
    "working on it",
    "generating",
    "thinking",
    "please wait",
    "stop generating",
    "responding",
    "loading"
  ];

  if (window[STATE_KEY]) {
    return;
  }

  const state = {
    running: false,
    intervalMs: DEFAULT_INTERVAL_MS,
    timer: null,
    poller: null,
    counterScope: counterScope(),
    runCount: loadRunCount(),
    claimed: false,
    manualMode: false,
    minimized: loadPanelMinimized(),
    options: { ...DEFAULT_OPTIONS },
    busySince: 0,
    lastPageSignature: "",
    lastPageChangeAt: Date.now(),
    ticking: false,
    backgroundScheduler: false,
    lastMessage: "Extension loaded. Waiting for dashboard Start."
  };

  function getInstanceId() {
    try {
      const key = "ariaClickupSenderInstanceId";
      let value = sessionStorage.getItem(key);
      if (!value) {
        value = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(key, value);
      }
      return value;
    } catch (err) {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  const INSTANCE_ID = getInstanceId();

  function currentTabScopeId() {
    return tabScopeToken || PAGE_SCOPE_ID;
  }

  function requestBrowserTabScope() {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
      chrome.runtime.sendMessage({ type: "ARIA_GET_TAB_ID" }, (reply) => {
        if (chrome.runtime.lastError || !reply || reply.tabId === undefined || reply.tabId === null) return;
        const nextToken = `tab-${reply.tabId}`;
        if (tabScopeToken === nextToken) return;
        tabScopeToken = nextToken;
        state.counterScope = counterScope();
        state.runCount = readRunCount(state.counterScope);
        updatePanelMeta();
      });
    } catch (err) {}
  }

  function normalizeServerBase(value) {
    let base = String(value || DEFAULT_SERVER_BASE).trim();
    if (!base) base = DEFAULT_SERVER_BASE;
    if (!/^https?:\/\//i.test(base)) base = "http://" + base;
    base = base.replace(/\/+$/, "");
    base = base.replace(/\/api\/clickup$/i, "").replace(/\/api$/i, "");
    return base;
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (data) => {
            resolve(data || {});
          });
          return;
        }
      } catch (err) {}
      resolve({});
    });
  }

  function configuredServerBases() {
    const cfg = window.ARIA_CLICKUP_CONFIG || {};
    const bases = Array.isArray(cfg.serverBases) ? cfg.serverBases : [];
    return bases.map(normalizeServerBase).filter(Boolean);
  }

  async function serverBaseCandidates() {
    const stored = await storageGet([SERVER_BASE_KEY]);
    return Array.from(new Set([
      stored[SERVER_BASE_KEY],
      ...configuredServerBases(),
      DEFAULT_SERVER_BASE,
      "http://localhost:5050"
    ].map(normalizeServerBase).filter(Boolean)));
  }

  async function loadApiBase() {
    const candidates = await serverBaseCandidates();
    apiBase = (candidates[0] || DEFAULT_SERVER_BASE) + "/api/clickup";
    return apiBase;
  }

  async function fetchApi(path, options) {
    const candidates = await serverBaseCandidates();
    let lastError = null;
    for (const base of candidates) {
      try {
        const response = await fetch(base + "/api/clickup" + path, options);
        apiBase = base + "/api/clickup";
        return response;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("ARIA server not reachable");
  }

  function loadRunCount() {
    return readRunCount(counterScope());
  }

  function readRunCount(scope) {
    try {
      const saved = Number.parseInt(sessionStorage.getItem(COUNT_PREFIX + scope) || "0", 10);
      return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveRunCount() {
    try {
      sessionStorage.setItem(COUNT_PREFIX + state.counterScope, String(state.runCount));
    } catch (err) {}
  }

  function draftScopeId() {
    try {
      const key = "ariaClickupDraftCounterScope";
      let value = sessionStorage.getItem(key);
      if (!value) {
        value = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(key, value);
      }
      return value;
    } catch (err) {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function counterScope() {
    try {
      const url = new URL(location.href);
      const conversationId = url.searchParams.get("conversationId");
      if (conversationId) {
        return `conversation:${conversationId}:${currentTabScopeId()}`;
      }
      const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
      if (cleanPath === "/" || cleanPath.includes("/ai/brain")) {
        return `draft:${url.origin}${cleanPath}${url.search}:${currentTabScopeId()}`;
      }
      return `url:${url.origin}${cleanPath}${url.search}:${currentTabScopeId()}`;
    } catch (err) {
      return `draft:${currentTabScopeId()}`;
    }
  }

  function ensureCounterScope() {
    const nextScope = counterScope();
    if (state.counterScope === nextScope) return;
    const previousScope = state.counterScope;
    const previousCount = state.runCount;
    state.counterScope = nextScope;
    const saved = readRunCount(nextScope);
    if (saved === 0 && previousScope && previousScope.startsWith("draft:") && nextScope.startsWith("conversation:") && previousCount > 0) {
      state.runCount = previousCount;
      saveRunCount();
    } else {
      state.runCount = saved;
    }
    updatePanelMeta();
  }

  function loadPanelMinimized() {
    try {
      return localStorage.getItem(PANEL_MIN_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function savePanelMinimized() {
    try {
      localStorage.setItem(PANEL_MIN_KEY, state.minimized ? "1" : "0");
    } catch (err) {}
  }

  function sanitizeOptions(options) {
    const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
    if (!["number", "dot", "custom"].includes(merged.sendMode)) {
      merged.sendMode = "number";
    }
    merged.customText = String(merged.customText || ".").slice(0, 400);
    merged.intervalMs = Math.max(MIN_INTERVAL_MS, Number.parseInt(merged.intervalMs, 10) || DEFAULT_INTERVAL_MS);
    return merged;
  }

  function loadOptions() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([OPTIONS_KEY], (data) => {
            state.options = sanitizeOptions(data && data[OPTIONS_KEY]);
            state.intervalMs = state.options.intervalMs;
            updatePanelMeta();
            resolve(state.options);
          });
          return;
        }
      } catch (err) {}
      resolve(state.options);
    });
  }

  function applyOptions(options) {
    state.options = sanitizeOptions(options);
    const intervalChanged = state.intervalMs !== state.options.intervalMs;
    state.intervalMs = state.options.intervalMs;
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [OPTIONS_KEY]: state.options });
      }
    } catch (err) {}
    if (intervalChanged && state.running) {
      setStatus(`Interval updated: ${Math.round(state.intervalMs / 1000)}s`);
      registerBackgroundScheduler();
      schedule(1000);
    }
    updatePanelMeta();
    return state.options;
  }

  function nextSendText() {
    ensureCounterScope();
    const mode = state.options.sendMode;
    if (mode === "dot") return ".";
    if (mode === "custom") return state.options.customText || ".";
    return String(state.runCount + 1);
  }

  function resetCounter(nextNumber) {
    ensureCounterScope();
    const n = Math.max(1, Number.parseInt(nextNumber || "1", 10) || 1);
    state.runCount = n - 1;
    saveRunCount();
    setStatus(`Counter reset. Next: ${nextSendText()}`);
    return state.runCount;
  }

  function modeLabel() {
    if (state.options.sendMode === "dot") return "dot";
    if (state.options.sendMode === "custom") return "custom";
    return "number";
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getSavedPanelPosition(panel) {
    try {
      const raw = localStorage.getItem(PANEL_POS_KEY);
      if (!raw) return null;
      const pos = JSON.parse(raw);
      const width = panel.offsetWidth || 290;
      const height = panel.offsetHeight || 120;
      return {
        left: clamp(Number(pos.left) || 18, 8, Math.max(8, window.innerWidth - width - 8)),
        top: clamp(Number(pos.top) || 18, 8, Math.max(8, window.innerHeight - height - 8))
      };
    } catch (err) {
      return null;
    }
  }

  function placePanel(panel) {
    const saved = getSavedPanelPosition(panel);
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    if (saved) {
      panel.style.left = `${saved.left}px`;
      panel.style.top = `${saved.top}px`;
      return;
    }
    requestAnimationFrame(() => {
      const left = Math.max(8, window.innerWidth - panel.offsetWidth - 18);
      const top = Math.max(8, window.innerHeight - panel.offsetHeight - 18);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });
  }

  function makePanelDraggable(panel, handle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const dragRoot = panel;
    const interactiveSelector = "button,a,input,textarea,select,[contenteditable='true']";

    const save = () => {
      try {
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({
          left: parseInt(panel.style.left, 10) || 18,
          top: parseInt(panel.style.top, 10) || 18
        }));
      } catch (err) {}
    };

    handle.title = "Drag to move. Double-click to reset position.";
    panel.title = "Drag any empty panel area to move. Double-click title to reset.";
    panel.style.cursor = "move";
    handle.style.cursor = "move";
    handle.style.userSelect = "none";

    dragRoot.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest(interactiveSelector)) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = panel.offsetLeft;
      startTop = panel.offsetTop;
      dragRoot.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    dragRoot.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const nextLeft = clamp(startLeft + event.clientX - startX, 8, Math.max(8, window.innerWidth - panel.offsetWidth - 8));
      const nextTop = clamp(startTop + event.clientY - startY, 8, Math.max(8, window.innerHeight - panel.offsetHeight - 8));
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    });

    dragRoot.addEventListener("pointerup", (event) => {
      if (!dragging) return;
      dragging = false;
      try {
        dragRoot.releasePointerCapture(event.pointerId);
      } catch (err) {}
      save();
    });

    handle.addEventListener("dblclick", () => {
      try {
        localStorage.removeItem(PANEL_POS_KEY);
      } catch (err) {}
      panel.style.left = "";
      panel.style.top = "";
      placePanel(panel);
    });

    window.addEventListener("resize", () => {
      const nextLeft = clamp(panel.offsetLeft, 8, Math.max(8, window.innerWidth - panel.offsetWidth - 8));
      const nextTop = clamp(panel.offsetTop, 8, Math.max(8, window.innerHeight - panel.offsetHeight - 8));
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
      save();
    });
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 8 &&
      rect.height > 8 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0";
  }

  function inPanel(el) {
    return Boolean(el && el.closest && el.closest("#" + PANEL_ID));
  }

  function textOf(el) {
    return String(
      (el && (
        el.innerText ||
        el.textContent ||
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("title")
      )) || ""
    ).toLowerCase();
  }

  function bottomText() {
    const chunks = [];
    const minTop = window.innerHeight * 0.55;
    document.querySelectorAll("div,span,button,[role='status'],[aria-live],textarea,[contenteditable='true']").forEach((el) => {
      if (inPanel(el) || !visible(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom >= minTop) {
        chunks.push(textOf(el));
      }
    });
    return chunks.join(" ");
  }

  function isBusy(input) {
    if (document.readyState === "loading") {
      return { busy: true, reason: "page loading" };
    }
    if (input) {
      const inputText = textOf(input);
      if (inputText.includes("working on it") || inputText.includes("generating") || inputText.includes("please wait")) {
        return { busy: true, reason: "composer busy" };
      }
    }
    const buttons = Array.from(document.querySelectorAll("button")).filter((btn) => visible(btn) && !inPanel(btn));
    const stopButton = buttons.find((btn) => {
      const label = (
        (btn.getAttribute("aria-label") || "") + " " +
        (btn.getAttribute("title") || "") + " " +
        (btn.textContent || "")
      ).toLowerCase().trim();
      return label.includes("cancel generating") ||
        label.includes("stop generating") ||
        label.includes("stop response");
    });
    if (stopButton) {
      return { busy: true, reason: "stop generating button visible" };
    }
    return { busy: false, reason: "ready" };
  }

  function findInput() {
    const selectors = [
      ".ProseMirror",
      "div[role='textbox']",
      "[contenteditable='true']",
      "textarea",
      "[data-testid*='input' i]",
      "[aria-label*='message' i]",
      "[aria-label*='prompt' i]",
      "[placeholder*='Tell AI' i]",
      "[placeholder*='what to do' i]"
    ];
    const scored = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el) || el.disabled || el.readOnly) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 220 || rect.height < 18) return;
        const label = textOf(el);
        let score = 0;
        score += rect.bottom / Math.max(1, window.innerHeight);
        if (rect.top > window.innerHeight * 0.45) score += 4;
        if (label.includes("tell ai") || label.includes("what to do") || label.includes("message") || label.includes("prompt")) score += 4;
        if (String(el.getAttribute("contenteditable") || "").toLowerCase() === "true") score += 2;
        if (String(el.getAttribute("role") || "").toLowerCase() === "textbox") score += 2;
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") score += 2;
        scored.push({ el, score, bottom: rect.bottom });
      });
    }
    scored.sort((a, b) => (b.score - a.score) || (b.bottom - a.bottom));
    return scored.length ? scored[0].el : null;
  }

  function setInputText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
      if (descriptor && descriptor.set) descriptor.set.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    const current = String(el.innerText || el.textContent || "").trim();
    if (current !== text) {
      el.textContent = text;
    }
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clickSendOrEnter(el) {
    el.focus();
    const inputRect = el.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll("button")).filter((btn) => {
      return visible(btn) &&
        !inPanel(btn) &&
        !btn.disabled &&
        String(btn.getAttribute("aria-disabled") || "").toLowerCase() !== "true";
    });
    const labelledSend = buttons.find((btn) => {
      const label = ((btn.getAttribute("aria-label") || "") + " " + (btn.textContent || "") + " " + (btn.getAttribute("title") || "")).toLowerCase();
      return label.includes("send") || label.includes("submit");
    });
    if (labelledSend) {
      labelledSend.click();
      return true;
    }

    const candidates = buttons
      .map((btn) => ({ btn, rect: btn.getBoundingClientRect(), label: textOf(btn) }))
      .filter((item) => {
        const r = item.rect;
        if (item.label.includes("source") || item.label.includes("model") || item.label.includes("attach") || item.label.includes("plus")) {
          return false;
        }
        return r.top >= inputRect.top - 80 &&
          r.bottom <= inputRect.bottom + 90 &&
          r.left >= inputRect.left + inputRect.width * 0.62 &&
          r.width <= 100 &&
          r.height <= 100;
      })
      .sort((a, b) => b.rect.right - a.rect.right);

    if (candidates.length) {
      candidates[0].btn.click();
      return true;
    }

    ["keydown", "keypress", "keyup"].forEach((type) => {
      const event = new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      el.dispatchEvent(event);
      document.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    });
    return true;
  }

  function clickableText(el) {
    return String(
      (el && (
        el.innerText ||
        el.textContent ||
        el.getAttribute("aria-label") ||
        el.getAttribute("title")
      )) || ""
    ).replace(/\s+/g, " ").trim();
  }

  function badFollowupText(text) {
    const lower = String(text || "").toLowerCase().trim();
    if (!lower || lower.length < 8 || lower.length > 320) return true;
    return [
      "copy",
      "like",
      "dislike",
      "share",
      "all sources",
      "opus",
      "brain",
      "tell ai",
      "what to do next",
      "follow ups",
      "follow up",
      "clickup needs your permission"
    ].some((blocked) => lower === blocked || lower.includes(blocked));
  }

  function clickElementLikeUser(el) {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + Math.min(rect.width - 6, Math.max(6, rect.width / 2));
    const clientY = rect.top + Math.min(rect.height - 6, Math.max(6, rect.height / 2));
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      const EventClass = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      el.dispatchEvent(new EventClass(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        buttons: type.endsWith("down") ? 1 : 0,
        clientX,
        clientY
      }));
    });
    if (typeof el.click === "function") {
      el.click();
    }
  }

  function findFollowupButton() {
    const labelCandidates = Array.from(document.querySelectorAll("div,span,p,strong"))
      .filter((el) => visible(el) && !inPanel(el))
      .map((el) => ({ el, text: clickableText(el).toLowerCase(), rect: el.getBoundingClientRect() }))
      .filter((item) => item.text === "follow ups" || item.text === "follow up")
      .sort((a, b) => b.rect.top - a.rect.top);

    if (!labelCandidates.length) return null;
    const labelRect = labelCandidates[0].rect;

    const candidates = Array.from(document.querySelectorAll("button,a,[role='button'],div"))
      .filter((el) => visible(el) && !inPanel(el))
      .filter((el) => !el.matches("textarea,input,select,[contenteditable='true']"))
      .map((el) => ({ el, text: clickableText(el), rect: el.getBoundingClientRect() }))
      .filter((item) => {
        const r = item.rect;
        if (badFollowupText(item.text)) return false;
        if (r.top < labelRect.bottom - 6 || r.top > labelRect.bottom + 270) return false;
        if (r.width < 180 || r.height < 28) return false;
        if (r.left < window.innerWidth * 0.08 || r.right > window.innerWidth * 0.96) return false;
        return true;
      })
      .sort((a, b) => {
        const aArrow = a.text.trim().startsWith("→") || a.text.trim().startsWith("->") ? 0 : 1;
        const bArrow = b.text.trim().startsWith("→") || b.text.trim().startsWith("->") ? 0 : 1;
        return (aArrow - bArrow) || (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left);
      });

    return candidates.length ? candidates[0] : null;
  }

  function pageSignature() {
    const chunks = [];
    document.querySelectorAll("main,section,article,div,p,li,pre,code,span,h1,h2,h3,h4,button").forEach((el) => {
      if (inPanel(el) || !visible(el)) return;
      if (el.matches && el.matches("textarea,input,select,[contenteditable='true']")) return;
      const text = clickableText(el);
      if (text) chunks.push(text);
    });
    return chunks.join(" ").replace(/\s+/g, " ").slice(-6000);
  }

  function responseStable() {
    const signature = pageSignature();
    const now = Date.now();
    if (!state.lastPageSignature) {
      state.lastPageSignature = signature;
      state.lastPageChangeAt = now;
      return { stable: false, waitedMs: 0 };
    }
    if (signature !== state.lastPageSignature) {
      state.lastPageSignature = signature;
      state.lastPageChangeAt = now;
      return { stable: false, waitedMs: 0 };
    }
    const waitedMs = now - state.lastPageChangeAt;
    return { stable: waitedMs >= RESPONSE_STABLE_MS, waitedMs };
  }

  function resetResponseWatch() {
    state.lastPageSignature = "";
    state.lastPageChangeAt = Date.now();
  }

  function makePanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "background:#111827",
      "color:#f9fafb",
      "border:1px solid #22c55e",
      "border-radius:10px",
      "padding:10px 12px",
      "font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.25)",
      "width:300px",
      "max-width:min(300px,calc(100vw - 16px))",
      "touch-action:none"
    ].join(";");
    panel.innerHTML = [
      "<div id='aria-clickup-extension-drag' style='font-weight:700;color:#86efac;display:flex;align-items:center;justify-content:space-between;gap:10px'>",
      "<span>ARIA ClickUp Sender</span>",
      "<span style='display:flex;align-items:center;gap:6px'>",
      "<span style='font-size:11px;color:#9ca3af'>drag</span>",
      "<button id='aria-clickup-extension-min' title='Minimize panel' style='border:0;border-radius:6px;padding:2px 7px;background:#1f2937;color:#e5e7eb;cursor:pointer;font-weight:800'>_</button>",
      "</span>",
      "</div>",
      "<div id='aria-clickup-extension-body'>",
      "<div id='aria-clickup-extension-status' style='margin-top:6px;color:#d1d5db'>Waiting...</div>",
      "<div id='aria-clickup-extension-meta' style='margin-top:5px;color:#9ca3af;font-size:11px'></div>",
      "<div style='display:flex;gap:8px;margin-top:9px;flex-wrap:wrap'>",
      "<button id='aria-clickup-extension-run' style='border:0;border-radius:6px;padding:5px 10px;background:#16a34a;color:white;cursor:pointer;font-weight:700'>Run</button>",
      "<button id='aria-clickup-extension-stop' style='border:0;border-radius:6px;padding:5px 10px;background:#ef4444;color:white;cursor:pointer;font-weight:700'>Stop</button>",
      "<button id='aria-clickup-extension-reset' style='border:0;border-radius:6px;padding:5px 10px;background:#374151;color:white;cursor:pointer;font-weight:700'>Reset #</button>",
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(panel);
    placePanel(panel);
    makePanelDraggable(panel, panel.querySelector("#aria-clickup-extension-drag"));
    panel.querySelector("#aria-clickup-extension-run").onclick = () => runFromPanel();
    panel.querySelector("#aria-clickup-extension-stop").onclick = () => {
      state.manualMode = true;
      stop(true);
    };
    panel.querySelector("#aria-clickup-extension-reset").onclick = () => resetCounter(1);
    panel.querySelector("#aria-clickup-extension-min").onclick = () => {
      state.minimized = !state.minimized;
      savePanelMinimized();
      updatePanelMeta();
    };
    updatePanelMeta();
  }

  function removePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
  }

  function setStatus(message) {
    state.lastMessage = message;
    const el = document.getElementById("aria-clickup-extension-status");
    if (el) el.textContent = `${message} | sent: ${state.runCount}`;
    updatePanelMeta();
    console.log("[ARIA ClickUp Extension]", message);
  }

  function updatePanelMeta() {
    const body = document.getElementById("aria-clickup-extension-body");
    const minBtn = document.getElementById("aria-clickup-extension-min");
    const meta = document.getElementById("aria-clickup-extension-meta");
    if (body) body.style.display = state.minimized ? "none" : "block";
    if (minBtn) minBtn.textContent = state.minimized ? "+" : "_";
    if (meta) {
      ensureCounterScope();
      meta.textContent = `Mode: ${modeLabel()} | next: ${nextSendText()} | sent: ${state.runCount} | wait: ${Math.round(state.intervalMs / 1000)}s | chat: ${state.counterScope.replace(/^(conversation|draft|url):/, "")}`;
    }
  }

  async function post(path, body) {
    try {
      await fetchApi(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    } catch (err) {
      console.warn("[ARIA ClickUp Extension] post failed", err);
    }
  }

  async function postJson(path, body) {
    const response = await fetchApi(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    return response.json();
  }

  function sendLog(message) {
    post("/inpage-log", {
      source: "extension",
      message,
      runCount: state.runCount,
      url: location.href
    });
  }

  async function runFromPanel() {
    setStatus("Starting this tab only");
    try {
      await loadOptions();
      state.manualMode = true;
      state.claimed = true;
      start(state.intervalMs || DEFAULT_INTERVAL_MS);
      sendLog(`Started local ClickUp tab automation: ${location.href}`);
    } catch (err) {
      console.warn("[ARIA ClickUp Extension] panel run failed", err);
      state.manualMode = true;
      state.claimed = true;
      start(state.intervalMs || DEFAULT_INTERVAL_MS);
    }
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
          resolve({ ok: false, error: "runtime unavailable" });
          return;
        }
        chrome.runtime.sendMessage(message, (reply) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(reply || { ok: true });
        });
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    });
  }

  async function registerBackgroundScheduler() {
    ensureCounterScope();
    const reply = await sendRuntimeMessage({
      type: "ARIA_REGISTER_TAB",
      intervalMs: state.intervalMs,
      scopeId: state.counterScope,
      url: location.href,
      title: document.title
    });
    state.backgroundScheduler = Boolean(reply && reply.ok);
    if (state.backgroundScheduler) {
      sendLog(`Background scheduler registered for ClickUp tab: ${location.href}`);
      updatePanelMeta();
    }
    return state.backgroundScheduler;
  }

  async function unregisterBackgroundScheduler() {
    await sendRuntimeMessage({ type: "ARIA_UNREGISTER_TAB" });
    state.backgroundScheduler = false;
    updatePanelMeta();
  }

  function sameClickupTarget(config) {
    const targetUrl = String(config.target_url || "").trim();
    const titleKeyword = String(config.title_keyword || DEFAULT_TITLE_KEYWORD).trim().toLowerCase();
    if (targetUrl) {
      try {
        const target = new URL(targetUrl);
        const current = new URL(location.href);
        const targetConversation = target.searchParams.get("conversationId");
        const currentConversation = current.searchParams.get("conversationId");
        if (targetConversation || currentConversation) {
          return target.host === current.host && targetConversation === currentConversation;
        }
        const targetClean = target.href.replace(/[#?].*$/, "").replace(/\/$/, "");
        const currentClean = current.href.replace(/[#?].*$/, "").replace(/\/$/, "");
        return currentClean === targetClean || currentClean.startsWith(targetClean);
      } catch (err) {
        return location.href.includes(targetUrl);
      }
    }
    if (titleKeyword) {
      return document.title.toLowerCase().includes(titleKeyword);
    }
    return false;
  }

  async function claimTargetTab() {
    ensureCounterScope();
    const claim = await postJson("/extension-claim", {
      instance_id: INSTANCE_ID,
      page_url: location.href,
      page_title: document.title,
      scope_id: state.counterScope,
      run_count: state.runCount
    });
    state.claimed = Boolean(claim.claim_allowed);
    return state.claimed;
  }

  async function tickInner() {
    if (!state.running) return;
    ensureCounterScope();
    const input = findInput();
    if (!input) {
      setStatus("Waiting: input not found");
      schedule(2000);
      return;
    }
    const busy = isBusy(input);
    if (busy.busy) {
      if (!state.busySince) {
        state.busySince = Date.now();
      }
      const waitedMs = Date.now() - state.busySince;
      setStatus(`Waiting: ${busy.reason} (${Math.round(waitedMs / 1000)}s)`);
      schedule(2500);
      return;
    } else {
      state.busySince = 0;
    }

    const stable = responseStable();
    if (!stable.stable) {
      setStatus(`Waiting: response still settling (${Math.round(stable.waitedMs / 1000)}s)`);
      schedule(2500);
      return;
    }

    await loadOptions();
    const followup = findFollowupButton();
    if (followup) {
      clickElementLikeUser(followup.el);
      state.runCount += 1;
      saveRunCount();
      const text = followup.text.replace(/^\s*(→|->)\s*/, "").slice(0, 80);
      setStatus(`Clicked #${state.runCount} follow-up: ${text}`);
      sendLog(`Clicked #${state.runCount} follow-up: ${text}`);
      resetResponseWatch();
      schedule(state.intervalMs);
      return;
    }

    const sendText = nextSendText();
    setInputText(input, sendText);
    await new Promise((resolve) => setTimeout(resolve, 450));
    clickSendOrEnter(input);
    state.runCount += 1;
    saveRunCount();
    setStatus(`Sent #${state.runCount}: ${sendText} + Enter`);
    sendLog(`Sent #${state.runCount}: ${sendText} + Enter`);
    resetResponseWatch();
    schedule(state.intervalMs);
  }

  async function tick() {
    if (!state.running || state.ticking) return;
    state.ticking = true;
    try {
      await tickInner();
    } finally {
      state.ticking = false;
    }
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    if (state.running) {
      state.timer = setTimeout(tick, Math.max(1000, Number(ms) || state.intervalMs));
    }
  }

  function start(intervalMs) {
    ensureCounterScope();
    const nextIntervalMs = Math.max(MIN_INTERVAL_MS, Number(intervalMs) || DEFAULT_INTERVAL_MS);
    const intervalChanged = state.intervalMs !== nextIntervalMs;
    state.intervalMs = nextIntervalMs;
    if (!state.running) {
      state.running = true;
      makePanel();
      resetResponseWatch();
      setStatus("Running on locked target tab");
      registerBackgroundScheduler();
      schedule(500);
    } else if (intervalChanged) {
      setStatus(`Interval updated: ${Math.round(state.intervalMs / 1000)}s`);
      registerBackgroundScheduler();
      schedule(1000);
    } else {
      registerBackgroundScheduler();
    }
    updatePanelMeta();
  }

  function stop(localOnly) {
    state.running = false;
    state.claimed = false;
    clearTimeout(state.timer);
    setStatus("Stopped");
    unregisterBackgroundScheduler();
    if (!localOnly) {
      post("/extension-state", {
        running: false,
        message: "Stopped from ClickUp page panel."
      });
    }
  }

  async function pollDashboard() {
    try {
      await loadApiBase();
      const response = await fetchApi("/extension-state", { cache: "no-store" });
      const config = await response.json();
      if (state.manualMode) {
        if (!document.getElementById(PANEL_ID)) {
          makePanel();
        }
        return;
      }
      const targetOk = sameClickupTarget(config);
      if (config.running && targetOk) {
        const allowed = await claimTargetTab();
        if (allowed) {
          start(config.interval_ms || DEFAULT_INTERVAL_MS);
        } else {
          if (state.running) stop(true);
          removePanel();
        }
      } else if (config.running && !targetOk) {
        if (state.running) stop(true);
        removePanel();
      } else {
        if (state.running) stop(true);
        if (!document.getElementById(PANEL_ID)) {
          makePanel();
        }
        setStatus(config.message || "Extension idle. Click dashboard Start.");
      }
    } catch (err) {
      if (!document.getElementById(PANEL_ID)) {
        makePanel();
      }
      setStatus("Dashboard server not reachable");
    }
  }

  function currentStatus() {
    ensureCounterScope();
    return {
      running: state.running,
      runCount: state.runCount,
      counterScope: state.counterScope,
      nextSendText: nextSendText(),
      sendMode: state.options.sendMode,
      customText: state.options.customText,
      lastMessage: state.lastMessage,
      intervalMs: state.intervalMs,
      claimed: state.claimed,
      manualMode: state.manualMode,
      backgroundScheduler: state.backgroundScheduler,
      url: location.href,
      title: document.title
    };
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const type = message && message.type;
      if (type === "ARIA_START") {
        (async () => {
          if (message.options) applyOptions(message.options);
          state.manualMode = true;
          state.claimed = true;
          start(message.intervalMs || state.intervalMs || DEFAULT_INTERVAL_MS);
          sendLog(`Started local ClickUp automation from popup: ${location.href}`);
          sendResponse({ ok: true, ...currentStatus() });
        })();
        return true;
      }
      if (type === "ARIA_OPTIONS") {
        applyOptions(message.options || {});
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      if (type === "ARIA_RESET_COUNTER") {
        resetCounter(message.nextNumber || 1);
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      if (type === "ARIA_STOP") {
        state.manualMode = true;
        stop(true);
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      if (type === "ARIA_BACKGROUND_TICK") {
        tick().finally(() => {
          sendResponse({ ok: true, ...currentStatus() });
        });
        return true;
      }
      if (type === "ARIA_STATUS") {
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      return false;
    });
  }

  window[STATE_KEY] = {
    start,
    stop,
    status: currentStatus
  };

  loadApiBase();
  loadOptions();
  requestBrowserTabScope();
  state.poller = setInterval(pollDashboard, 1000);
  pollDashboard();
})();
