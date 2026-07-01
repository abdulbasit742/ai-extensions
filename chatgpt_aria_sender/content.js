(function () {
  "use strict";

  const DEFAULT_SERVER_BASE = "http://127.0.0.1:5050";
  const SERVER_BASE_KEY = "ariaServerBase";
  let apiBase = DEFAULT_SERVER_BASE + "/api/chatgpt";
  const STATE_KEY = "__ARIA_CHATGPT_EXTENSION_SENDER__";
  const PANEL_ID = "aria-chatgpt-extension-panel";
  const PANEL_POS_KEY = "ariaChatgptSenderPanelPosition";
  const PANEL_MIN_KEY = "ariaChatgptSenderPanelMinimized";
  const COUNT_PREFIX = "ariaChatgptSenderPromptCount:";
  const OPTIONS_KEY = "ariaChatgptSenderOptions";
  const RESPONSE_STABLE_MS = 8000;
  const DEFAULT_TITLE_KEYWORD = "ChatGPT";
  const DEFAULT_OPTIONS = {
    sendMode: "number",
    customText: ".",
    intervalMs: 5000
  };
  let tabScopeToken = "";
  const PAGE_SCOPE_ID = `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (window[STATE_KEY]) {
    return;
  }

  const state = {
    running: false,
    intervalMs: 5000,
    timer: null,
    poller: null,
    imagePoller: null,
    counterScope: counterScope(),
    runCount: loadRunCount(),
    claimed: false,
    manualMode: false,
    minimized: loadPanelMinimized(),
    options: { ...DEFAULT_OPTIONS },
    busySince: 0,
    lastPageSignature: "",
    lastPageChangeAt: Date.now(),
    lastSentAt: 0,
    ticking: false,
    backgroundScheduler: false,
    savedImageKeys: new Set(),
    imageSaveCount: 0,
    queuedPrompt: "",
    queuedPromptId: "",
    queuedPromptSent: false,
    lastMessage: "Extension loaded. Waiting for dashboard Start."
  };

  function getInstanceId() {
    try {
      const key = "ariaChatgptSenderInstanceId";
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

  function normalizeServerBase(value) {
    let base = String(value || DEFAULT_SERVER_BASE).trim();
    if (!base) base = DEFAULT_SERVER_BASE;
    if (!/^https?:\/\//i.test(base)) base = "http://" + base;
    base = base.replace(/\/+$/, "");
    base = base.replace(/\/api\/chatgpt$/i, "").replace(/\/api$/i, "");
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
    const cfg = window.ARIA_CHATGPT_CONFIG || {};
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
    apiBase = (candidates[0] || DEFAULT_SERVER_BASE) + "/api/chatgpt";
    return apiBase;
  }

  async function fetchApi(path, options) {
    const candidates = await serverBaseCandidates();
    let lastError = null;
    for (const base of candidates) {
      try {
        const response = await fetch(base + "/api/chatgpt" + path, options);
        apiBase = base + "/api/chatgpt";
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
      const key = "ariaChatgptDraftCounterScope";
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
      const chatMatch = url.pathname.match(/\/c\/([^/?#]+)/i);
      if (chatMatch && chatMatch[1]) {
        return `conversation:${chatMatch[1]}:${currentTabScopeId()}`;
      }
      const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
      if (cleanPath === "/") {
        return `draft:${currentTabScopeId()}`;
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
    merged.intervalMs = Math.max(1000, Number.parseInt(merged.intervalMs, 10) || 5000);
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
    if (state.queuedPrompt && !state.queuedPromptSent) return state.queuedPrompt;
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
      const width = panel.offsetWidth || 300;
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
        el.getAttribute("title") ||
        el.id
      )) || ""
    ).toLowerCase();
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

  function pageSignature() {
    const chunks = [];
    document.querySelectorAll("main,article,section,div,p,li,pre,code,span,h1,h2,h3,h4,button").forEach((el) => {
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

  function isBusy(input) {
    if (document.readyState === "loading") {
      return { busy: true, reason: "page loading" };
    }
    if (input && (input.disabled || input.readOnly || String(input.getAttribute("aria-disabled") || "").toLowerCase() === "true")) {
      return { busy: true, reason: "composer disabled" };
    }
    const stopSelectors = [
      "button[data-testid='stop-button']",
      "button[aria-label*='Stop' i]",
      "button[title*='Stop' i]"
    ];
    for (const selector of stopSelectors) {
      const btn = document.querySelector(selector);
      if (visible(btn) && !inPanel(btn)) {
        return { busy: true, reason: "ChatGPT is responding" };
      }
    }
    return { busy: false, reason: "ready" };
  }

  function findInput() {
    const selectors = [
      "#prompt-textarea",
      "textarea[data-id='root']",
      "textarea[placeholder*='Message' i]",
      "textarea",
      ".ProseMirror",
      "div[role='textbox']",
      "[contenteditable='true']",
      "[data-testid*='composer' i]",
      "[data-testid*='textarea' i]"
    ];
    const scored = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        if (!visible(el) || inPanel(el) || el.disabled || el.readOnly) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 180 || rect.height < 18) return;
        const label = textOf(el);
        let score = 0;
        score += rect.bottom / Math.max(1, window.innerHeight);
        if (rect.top > window.innerHeight * 0.45) score += 5;
        if (el.id === "prompt-textarea") score += 8;
        if (label.includes("message") || label.includes("chatgpt") || label.includes("prompt")) score += 4;
        if (String(el.getAttribute("contenteditable") || "").toLowerCase() === "true") score += 2;
        if (String(el.getAttribute("role") || "").toLowerCase() === "textbox") score += 2;
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") score += 3;
        scored.push({ el, score, bottom: rect.bottom });
      });
    }
    scored.sort((a, b) => (b.score - a.score) || (b.bottom - a.bottom));
    return scored.length ? scored[0].el : null;
  }

  function setInputText(el, text) {
    el.click();
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
      el.innerHTML = "";
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      el.appendChild(paragraph);
    }
    const finalRange = document.createRange();
    finalRange.selectNodeContents(el);
    finalRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(finalRange);
    el.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSendButton(el) {
    const sendSelectors = [
      "button[data-testid='composer-send-button']",
      "button[data-testid='send-button']",
      "button[aria-label='Send prompt']",
      "button[aria-label*='Send' i]",
      "button[aria-label*='Submit' i]",
      "button[title*='Send' i]",
      "button[type='submit']"
    ];
    for (const selector of sendSelectors) {
      const btn = document.querySelector(selector);
      if (visible(btn) && !inPanel(btn) && !btn.disabled && String(btn.getAttribute("aria-disabled") || "").toLowerCase() !== "true") {
        return btn;
      }
    }

    const inputRect = el.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll("button")).filter((btn) => {
      return visible(btn) &&
        !inPanel(btn) &&
        !btn.disabled &&
        String(btn.getAttribute("aria-disabled") || "").toLowerCase() !== "true";
    });
    const candidates = buttons
      .map((btn) => ({ btn, rect: btn.getBoundingClientRect(), label: textOf(btn) }))
      .filter((item) => {
        const r = item.rect;
        if (item.label.includes("attach") || item.label.includes("voice") || item.label.includes("model") || item.label.includes("tools")) {
          return false;
        }
        return r.top >= inputRect.top - 90 &&
          r.bottom <= inputRect.bottom + 100 &&
          r.left >= inputRect.left + inputRect.width * 0.55 &&
          r.width <= 110 &&
          r.height <= 110;
      })
      .sort((a, b) => b.rect.right - a.rect.right);
    if (candidates.length) {
      return candidates[0].btn;
    }
    return null;
  }

  async function clickSendOrEnter(el) {
    el.focus();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const button = findSendButton(el);
      if (button) {
        button.click();
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
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
      window.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
      document.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    });
    const form = el.closest && el.closest("form");
    if (form && typeof form.requestSubmit === "function") {
      try {
        form.requestSubmit();
      } catch (err) {
        console.warn("[ARIA ChatGPT Extension] form submit fallback failed", err);
      }
    }
    return true;
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
      "border:1px solid #38bdf8",
      "border-radius:10px",
      "padding:10px 12px",
      "font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.25)",
      "width:310px",
      "max-width:min(310px,calc(100vw - 16px))",
      "touch-action:none"
    ].join(";");
    panel.innerHTML = [
      "<div id='aria-chatgpt-extension-drag' style='font-weight:700;color:#7dd3fc;display:flex;align-items:center;justify-content:space-between;gap:10px'>",
      "<span>ARIA ChatGPT Sender</span>",
      "<span style='display:flex;align-items:center;gap:6px'>",
      "<span style='font-size:11px;color:#9ca3af'>drag</span>",
      "<button id='aria-chatgpt-extension-min' title='Minimize panel' style='border:0;border-radius:6px;padding:2px 7px;background:#1f2937;color:#e5e7eb;cursor:pointer;font-weight:800'>_</button>",
      "</span>",
      "</div>",
      "<div id='aria-chatgpt-extension-body'>",
      "<div id='aria-chatgpt-extension-status' style='margin-top:6px;color:#d1d5db'>Waiting...</div>",
      "<div id='aria-chatgpt-extension-meta' style='margin-top:5px;color:#9ca3af;font-size:11px'></div>",
      "<div style='display:flex;gap:8px;margin-top:9px;flex-wrap:wrap'>",
      "<button id='aria-chatgpt-extension-run' style='border:0;border-radius:6px;padding:5px 10px;background:#16a34a;color:white;cursor:pointer;font-weight:700'>Run</button>",
      "<button id='aria-chatgpt-extension-stop' style='border:0;border-radius:6px;padding:5px 10px;background:#ef4444;color:white;cursor:pointer;font-weight:700'>Stop</button>",
      "<button id='aria-chatgpt-extension-reset' style='border:0;border-radius:6px;padding:5px 10px;background:#374151;color:white;cursor:pointer;font-weight:700'>Reset #</button>",
      "<button id='aria-chatgpt-extension-tools' title='Save selected/latest ChatGPT response, copy it, and make it available to Codex, Claude, Cursor, VS Code, ClickUp, and Gemini from ARIA dashboard' style='border:0;border-radius:6px;padding:5px 10px;background:#2563eb;color:white;cursor:pointer;font-weight:700'>Send to tools</button>",
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(panel);
    placePanel(panel);
    makePanelDraggable(panel, panel.querySelector("#aria-chatgpt-extension-drag"));
    panel.querySelector("#aria-chatgpt-extension-run").onclick = () => runFromPanel();
    panel.querySelector("#aria-chatgpt-extension-stop").onclick = () => {
      state.manualMode = true;
      stop(true);
    };
    panel.querySelector("#aria-chatgpt-extension-reset").onclick = () => resetCounter(1);
    panel.querySelector("#aria-chatgpt-extension-tools").onclick = () => sendLatestToCodingTools();
    panel.querySelector("#aria-chatgpt-extension-min").onclick = () => {
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
    const el = document.getElementById("aria-chatgpt-extension-status");
    if (el) el.textContent = `${message} | sent: ${state.runCount}`;
    updatePanelMeta();
    console.log("[ARIA ChatGPT Extension]", message);
  }

  function updatePanelMeta() {
    const body = document.getElementById("aria-chatgpt-extension-body");
    const minBtn = document.getElementById("aria-chatgpt-extension-min");
    const meta = document.getElementById("aria-chatgpt-extension-meta");
    if (body) body.style.display = state.minimized ? "none" : "block";
    if (minBtn) minBtn.textContent = state.minimized ? "+" : "_";
    if (meta) {
      ensureCounterScope();
      const wake = state.backgroundScheduler ? "bg wake: on" : "bg wake: local";
      meta.textContent = `Mode: ${modeLabel()} | next: ${nextSendText()} | sent: ${state.runCount} | wait: ${Math.round(state.intervalMs / 1000)}s | ${wake} | chat: ${state.counterScope.replace(/^(conversation|draft|url):/, "")} | images: ${state.imageSaveCount}`;
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
      console.warn("[ARIA ChatGPT Extension] post failed", err);
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
      sendLog(`Background scheduler registered for tab: ${location.href}`);
      updatePanelMeta();
    }
    return state.backgroundScheduler;
  }

  async function unregisterBackgroundScheduler() {
    const reply = await sendRuntimeMessage({ type: "ARIA_UNREGISTER_TAB" });
    state.backgroundScheduler = false;
    return Boolean(reply && reply.ok);
  }

  async function runFromPanel() {
    setStatus("Starting this tab only");
    try {
      await loadOptions();
      state.manualMode = true;
      state.claimed = true;
      start(state.intervalMs || 5000);
      sendLog(`Started local tab automation: ${location.href}`);
    } catch (err) {
      console.warn("[ARIA ChatGPT Extension] panel run failed", err);
      state.manualMode = true;
      state.claimed = true;
      start(state.intervalMs || 5000);
    }
  }

  function shouldSaveImage(img) {
    if (!visible(img) || inPanel(img)) return false;
    const src = String(img.currentSrc || img.src || "");
    if (!src || src.startsWith("chrome-extension://")) return false;
    const lower = src.toLowerCase();
    if (
      lower.includes("avatar") ||
      lower.includes("favicon") ||
      lower.includes("logo") ||
      lower.includes("sprite") ||
      lower.includes("emoji")
    ) {
      return false;
    }
    const rect = img.getBoundingClientRect();
    const naturalW = Number(img.naturalWidth || 0);
    const naturalH = Number(img.naturalHeight || 0);
    const width = Math.max(rect.width, naturalW);
    const height = Math.max(rect.height, naturalH);
    if (width < 256 || height < 256) return false;
    if (width * height < 90000) return false;
    return true;
  }

  function imageKey(img) {
    const src = String(img.currentSrc || img.src || "");
    return [
      src.slice(0, 400),
      img.naturalWidth || 0,
      img.naturalHeight || 0,
      String(img.alt || "").slice(0, 120)
    ].join("|");
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read image blob."));
      reader.readAsDataURL(blob);
    });
  }

  function imageToCanvasDataUrl(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || Math.round(img.getBoundingClientRect().width);
    canvas.height = img.naturalHeight || Math.round(img.getBoundingClientRect().height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  async function saveImageElement(img) {
    const key = imageKey(img);
    if (!key || state.savedImageKeys.has(key)) return;
    state.savedImageKeys.add(key);
    const src = String(img.currentSrc || img.src || "");
    try {
      let dataUrl = "";
      let mime = "image/png";
      try {
        const response = await fetch(src, { credentials: "include", cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`image fetch failed: ${response.status}`);
        }
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size < 1024) {
          return;
        }
        mime = blob.type;
        dataUrl = await blobToDataUrl(blob);
      } catch (fetchErr) {
        dataUrl = imageToCanvasDataUrl(img);
        mime = "image/png";
      }
      const result = await postJson("/save-image", {
        image_key: key,
        data_url: dataUrl,
        mime,
        alt: img.alt || img.getAttribute("aria-label") || "chatgpt_image",
        source_url: src,
        page_url: location.href,
        natural_width: img.naturalWidth || 0,
        natural_height: img.naturalHeight || 0
      });
      if (result && result.success && !result.already_saved) {
        state.imageSaveCount += 1;
        setStatus(`Saved image ${state.imageSaveCount}`);
      }
    } catch (err) {
      console.warn("[ARIA ChatGPT Extension] image save failed", err);
      state.savedImageKeys.delete(key);
    }
  }

  function scanForImages() {
    document.querySelectorAll("img").forEach((img) => {
      if (shouldSaveImage(img)) {
        saveImageElement(img);
      }
    });
  }

  function textFromNode(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll([
      "button",
      "svg",
      "nav",
      "textarea",
      "input",
      "form",
      "[contenteditable='true']",
      "[aria-hidden='true']",
      "#aria-chatgpt-extension-panel",
      "[data-testid='copy-turn-action-button']",
      "[data-testid='feedback-turn-action-button']"
    ].join(",")).forEach((el) => el.remove());
    return String(clone.innerText || clone.textContent || "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function queryCandidates(selectors) {
    const seen = new Set();
    const found = [];
    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((node) => {
          if (seen.has(node)) return;
          seen.add(node);
          const rect = node.getBoundingClientRect();
          const text = textFromNode(node);
          if (text.length >= 20 && rect.width > 80 && rect.height > 20 && !text.includes("ARIA ChatGPT Sender")) {
            found.push({ node, text });
          }
        });
      } catch (err) {}
    });
    return found;
  }

  function latestAssistantText() {
    const selectors = [
      "[data-message-author-role='assistant']",
      "article[data-testid*='conversation-turn']",
      "article",
      "main [role='article']",
      "main .markdown",
      "main [class*='markdown']"
    ];
    const candidates = queryCandidates(selectors)
      .filter((item) => !/^(ask anything|message chatgpt|chatgpt can make mistakes)/i.test(item.text));
    if (!candidates.length) return "";
    candidates.sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top);
    return candidates[candidates.length - 1].text;
  }

  async function clipboardText() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) return "";
      return String(await navigator.clipboard.readText() || "").trim();
    } catch (err) {
      return "";
    }
  }

  async function sendLatestToCodingTools() {
    setStatus("Saving latest ChatGPT response for coding tools...");
    const selected = String(window.getSelection && window.getSelection().toString() || "").trim();
    const latest = latestAssistantText();
    const clip = selected.length >= 20 ? "" : await clipboardText();
    const content = selected.length >= 20 ? selected : (latest.length >= 20 ? latest : clip);
    if (!content || content.length < 20) {
      setStatus("No ChatGPT response found. Select/copy text first, then click again.");
      return;
    }
    try {
      const result = await postJson("/save-coding-context", {
        content,
        source_url: location.href,
        page_title: document.title,
        scope_id: state.counterScope,
        run_count: state.runCount,
        source_kind: selected.length >= 20 ? "selection" : (latest.length >= 20 ? "latest_response" : "clipboard")
      });
      setStatus(result.message || "Saved response for coding tools.");
    } catch (err) {
      setStatus(`Coding bridge failed: ${err && err.message ? err.message : err}`);
    }
  }

  function sameChatgptTarget(config) {
    const targetUrl = String(config.target_url || "").trim();
    const titleKeyword = String(config.title_keyword || DEFAULT_TITLE_KEYWORD).trim().toLowerCase();
    const hostOk = location.host === "chatgpt.com" || location.host === "chat.openai.com";
    if (!hostOk) return false;
    if (targetUrl) {
      try {
        const target = new URL(targetUrl);
        const current = new URL(location.href);
        if (target.host && target.host !== current.host) return false;
        const targetPath = target.pathname.replace(/\/$/, "");
        if (targetPath && targetPath !== "") {
          const currentClean = current.href.replace(/[#?].*$/, "").replace(/\/$/, "");
          const targetClean = target.href.replace(/[#?].*$/, "").replace(/\/$/, "");
          return currentClean === targetClean || currentClean.startsWith(targetClean);
        }
        return true;
      } catch (err) {
        return location.href.includes(targetUrl);
      }
    }
    if (titleKeyword) {
      return document.title.toLowerCase().includes(titleKeyword);
    }
    return true;
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

  async function tick(source) {
    if (!state.running) return;
    if (state.ticking) return;
    state.ticking = true;
    try {
    ensureCounterScope();
    const input = findInput();
    if (!input) {
      setStatus("Waiting: input not found");
      schedule(2000);
      return;
    }
    const busy = isBusy(input);
    if (busy.busy) {
      if (!state.busySince) state.busySince = Date.now();
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

    const elapsedSinceSend = state.lastSentAt ? Date.now() - state.lastSentAt : state.intervalMs;
    if (state.lastSentAt && elapsedSinceSend < state.intervalMs) {
      const waitMs = Math.max(1000, state.intervalMs - elapsedSinceSend);
      setStatus(`Waiting: next send in ${Math.ceil(waitMs / 1000)}s`);
      schedule(waitMs);
      return;
    }

    await loadOptions();
    const usingQueuedPrompt = Boolean(state.queuedPrompt && !state.queuedPromptSent);
    const sendText = nextSendText();
    setInputText(input, sendText);
    await new Promise((resolve) => setTimeout(resolve, 650));
    await clickSendOrEnter(input);
    if (usingQueuedPrompt) {
      state.queuedPromptSent = true;
      post("/extension-state", {
        queued_prompt_sent: true,
        message: `Queued ChatGPT prompt sent by ARIA extension: ${state.queuedPromptId || "prompt"}`
      });
    } else {
      state.runCount += 1;
      saveRunCount();
    }
    state.lastSentAt = Date.now();
    setStatus(usingQueuedPrompt ? "Sent queued image/social prompt + Enter" : `Sent #${state.runCount}: ${sendText} + Enter${source ? ` (${source})` : ""}`);
    sendLog(usingQueuedPrompt ? `Sent queued prompt ${state.queuedPromptId || ""} + Enter` : `Sent #${state.runCount}: ${sendText} + Enter${source ? ` (${source})` : ""}`);
    resetResponseWatch();
    schedule(state.intervalMs);
    } finally {
      state.ticking = false;
    }
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    if (state.running) {
      state.timer = setTimeout(() => tick("page"), Math.max(1000, Number(ms) || state.intervalMs));
    }
  }

  function start(intervalMs) {
    ensureCounterScope();
    const nextIntervalMs = Math.max(1000, Number(intervalMs) || 5000);
    const intervalChanged = state.intervalMs !== nextIntervalMs;
    state.intervalMs = nextIntervalMs;
    if (!state.running) {
      state.running = true;
      state.lastSentAt = 0;
      makePanel();
      resetResponseWatch();
      setStatus(state.manualMode ? "Running on this ChatGPT tab only" : "Running on dashboard target tab");
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
    setStatus(localOnly ? "Stopped on this tab only" : "Stopped");
    unregisterBackgroundScheduler();
    if (!localOnly) {
      post("/extension-state", {
        running: false,
        message: "Stopped from ChatGPT page panel."
      });
    }
  }

  async function pollDashboard() {
    try {
      await loadApiBase();
      const response = await fetchApi("/extension-state", { cache: "no-store" });
      const config = await response.json();
      const targetOk = sameChatgptTarget(config);
      const hasDashboardQueuedPrompt = Boolean(
        config.running &&
        targetOk &&
        String(config.queued_prompt || "").trim() &&
        !Boolean(config.queued_prompt_sent)
      );
      if (state.manualMode && !hasDashboardQueuedPrompt) {
        if (!document.getElementById(PANEL_ID)) {
          makePanel();
        }
        return;
      }
      if (hasDashboardQueuedPrompt) {
        state.manualMode = false;
      }
      if (config.running && targetOk) {
        state.queuedPrompt = String(config.queued_prompt || "");
        state.queuedPromptId = String(config.queued_prompt_id || "");
        state.queuedPromptSent = Boolean(config.queued_prompt_sent);
        const allowed = await claimTargetTab();
        if (allowed) {
          start(config.interval_ms || 5000);
        } else {
          if (state.running) stop(true);
          if (!document.getElementById(PANEL_ID)) makePanel();
          setStatus("Another dashboard target is active. Run still starts this tab only.");
        }
      } else if (config.running && !targetOk) {
        if (state.running) stop(true);
        if (!document.getElementById(PANEL_ID)) makePanel();
        setStatus("Dashboard target is another ChatGPT tab. Run still starts this tab only.");
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
      imageSaveCount: state.imageSaveCount,
      lastMessage: state.lastMessage,
      intervalMs: state.intervalMs,
      claimed: state.claimed,
      manualMode: state.manualMode,
      backgroundScheduler: state.backgroundScheduler,
      lastSentAt: state.lastSentAt,
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
          start(message.intervalMs || state.intervalMs || 5000);
          sendLog(`Started local tab automation from popup: ${location.href}`);
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
        tick("background").finally(() => {
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
  state.imagePoller = setInterval(scanForImages, 4000);
  pollDashboard();
  scanForImages();
})();
