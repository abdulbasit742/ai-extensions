(function () {
  "use strict";

  const DEFAULT_SERVER_BASE = "http://127.0.0.1:5050";
  const SERVER_BASE_KEY = "ariaUniversalServerBase";
  const STATE_KEY = "__ARIA_UNIVERSAL_EXTENSION_SENDER__";
  const PANEL_ID = "aria-universal-extension-panel";
  const PANEL_POS_KEY = "ariaUniversalSenderPanelPosition";
  const PANEL_MIN_KEY = "ariaUniversalSenderPanelMinimized";
  const COUNT_PREFIX = "ariaUniversalSenderCount:";
  const RESPONSE_STABLE_MS = 8000;
  const DEFAULT_CONFIG = {
    intervalMs: 5000,
    sendText: "{n}",
    sendMode: "auto"
  };
  const PAGE_SCOPE_ID = `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (window[STATE_KEY]) return;

  let apiBase = DEFAULT_SERVER_BASE + "/api/universal";
  let tabScopeToken = "";

  const state = {
    running: false,
    intervalMs: DEFAULT_CONFIG.intervalMs,
    sendText: DEFAULT_CONFIG.sendText,
    sendMode: DEFAULT_CONFIG.sendMode,
    timer: null,
    poller: null,
    counterScope: counterScope(),
    runCount: loadRunCount(),
    claimed: false,
    minimized: loadPanelMinimized(),
    busySince: 0,
    lastPageSignature: "",
    lastPageChangeAt: Date.now(),
    lastMessage: "Extension loaded. Waiting for Start.",
    serverBase: DEFAULT_SERVER_BASE,
    manualMode: false,
    ticking: false,
    backgroundScheduler: false
  };

  function getInstanceId() {
    try {
      const key = "ariaUniversalSenderInstanceId";
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
    base = base.replace(/\/api\/universal$/i, "").replace(/\/api$/i, "");
    return base;
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (data) => resolve(data || {}));
          return;
        }
      } catch (err) {}
      resolve({});
    });
  }

  function storageSet(data) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data);
      }
    } catch (err) {}
  }

  function configuredServerBases() {
    const cfg = window.ARIA_UNIVERSAL_CONFIG || {};
    const bases = Array.isArray(cfg.serverBases) ? cfg.serverBases : [];
    return bases.map(normalizeServerBase).filter(Boolean);
  }

  async function loadApiBase() {
    const stored = await storageGet([SERVER_BASE_KEY]);
    const candidates = [
      stored[SERVER_BASE_KEY],
      ...configuredServerBases(),
      DEFAULT_SERVER_BASE,
      "http://localhost:5050"
    ].map(normalizeServerBase);
    const unique = Array.from(new Set(candidates));
    state.serverBase = unique[0] || DEFAULT_SERVER_BASE;
    apiBase = state.serverBase + "/api/universal";
    return apiBase;
  }

  async function fetchJson(path, options) {
    await loadApiBase();
    const stored = await storageGet([SERVER_BASE_KEY]);
    const bases = Array.from(new Set([
      stored[SERVER_BASE_KEY],
      state.serverBase,
      ...configuredServerBases(),
      DEFAULT_SERVER_BASE,
      "http://localhost:5050"
    ].map(normalizeServerBase)));
    let lastError = null;
    for (const base of bases) {
      try {
        const response = await fetch(base + "/api/universal" + path, options || { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.serverBase = base;
        apiBase = base + "/api/universal";
        storageSet({ [SERVER_BASE_KEY]: base });
        return response.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("ARIA server not reachable");
  }

  async function postJson(path, body) {
    return fetchJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  }

  async function post(path, body) {
    try {
      await postJson(path, body);
    } catch (err) {
      console.warn("[ARIA Universal Extension] post failed", err);
    }
  }

  function draftScopeId() {
    try {
      const key = "ariaUniversalDraftCounterScope";
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
      const conversationId = url.searchParams.get("conversationId") || url.searchParams.get("chatId") || url.searchParams.get("threadId");
      if (conversationId) return `${url.host}:conversation:${conversationId}:${currentTabScopeId()}`;
      const chatMatch = url.pathname.match(/\/c\/([^/?#]+)/i);
      if (chatMatch && chatMatch[1]) return `${url.host}:conversation:${chatMatch[1]}:${currentTabScopeId()}`;
      const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
      if (cleanPath === "/" && !url.search) return `${url.host}:draft:${currentTabScopeId()}`;
      return `${url.host}:page:${url.origin}${cleanPath}${url.search}:${currentTabScopeId()}`;
    } catch (err) {
      return `draft:${currentTabScopeId()}`;
    }
  }

  function readRunCount(scope) {
    try {
      const saved = Number.parseInt(sessionStorage.getItem(COUNT_PREFIX + scope) || "0", 10);
      return Number.isFinite(saved) && saved >= 0 ? saved : 0;
    } catch (err) {
      return 0;
    }
  }

  function loadRunCount() {
    return readRunCount(counterScope());
  }

  function saveRunCount() {
    try {
      sessionStorage.setItem(COUNT_PREFIX + state.counterScope, String(state.runCount));
    } catch (err) {}
  }

  function ensureCounterScope() {
    const nextScope = counterScope();
    if (state.counterScope === nextScope) return;
    const oldScope = state.counterScope;
    const oldCount = state.runCount;
    state.counterScope = nextScope;
    const saved = readRunCount(nextScope);
    if (saved === 0 && oldScope && oldScope.includes(":draft:") && nextScope.includes(":conversation:") && oldCount > 0) {
      state.runCount = oldCount;
      saveRunCount();
    } else {
      state.runCount = saved;
    }
    updatePanelMeta();
  }

  function resetCounter(nextNumber) {
    ensureCounterScope();
    const next = Math.max(1, Number.parseInt(nextNumber || "1", 10) || 1);
    state.runCount = next - 1;
    saveRunCount();
    updatePanelMeta();
    setStatus(`Counter reset. Next: ${nextSendText()}`);
  }

  function nextSendText() {
    ensureCounterScope();
    const nextNumber = state.runCount + 1;
    const raw = String(state.sendText || "{n}");
    if (/^(#|number|num|counter)$/i.test(raw.trim())) return String(nextNumber);
    return raw.replace(/\{n\}/gi, String(nextNumber));
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
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
        el.value ||
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("title") ||
        el.id ||
        el.name
      )) || ""
    ).toLowerCase();
  }

  function collectRoots() {
    const roots = [document];
    const seen = new Set(roots);
    for (let i = 0; i < roots.length; i += 1) {
      const root = roots[i];
      try {
        root.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot && !seen.has(el.shadowRoot)) {
            seen.add(el.shadowRoot);
            roots.push(el.shadowRoot);
          }
          if (el.tagName === "IFRAME") {
            try {
              const doc = el.contentDocument;
              if (doc && !seen.has(doc)) {
                seen.add(doc);
                roots.push(doc);
              }
            } catch (err) {}
          }
        });
      } catch (err) {}
    }
    return roots;
  }

  function queryAll(selector) {
    const out = [];
    collectRoots().forEach((root) => {
      try {
        root.querySelectorAll(selector).forEach((el) => out.push(el));
      } catch (err) {}
    });
    return out;
  }

  function inputAllowed(el) {
    if (!el || inPanel(el) || el.disabled || el.readOnly) return false;
    const ariaDisabled = String(el.getAttribute("aria-disabled") || "").toLowerCase();
    if (ariaDisabled === "true") return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = String(el.getAttribute("type") || "text").toLowerCase();
      return ["", "text", "search", "email", "url", "tel", "number"].includes(type);
    }
    return String(el.getAttribute("contenteditable") || "").toLowerCase() === "true" ||
      String(el.getAttribute("role") || "").toLowerCase() === "textbox";
  }

  function findInput() {
    const selectors = [
      "textarea",
      "input[type='text']",
      "input[type='search']",
      "input[type='email']",
      "input[type='url']",
      "input:not([type])",
      "[contenteditable='true']",
      "div[role='textbox']",
      "[role='textbox']",
      ".ProseMirror",
      "[data-testid*='input' i]",
      "[data-testid*='composer' i]",
      "[data-testid*='textarea' i]",
      "[aria-label*='message' i]",
      "[aria-label*='prompt' i]",
      "[placeholder*='message' i]",
      "[placeholder*='ask' i]",
      "[placeholder*='reply' i]"
    ];
    const scored = [];
    selectors.forEach((selector) => {
      queryAll(selector).forEach((el) => {
        if (!visible(el) || !inputAllowed(el)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 14) return;
        const label = textOf(el);
        let score = 0;
        score += rect.bottom / Math.max(1, window.innerHeight);
        if (rect.top > window.innerHeight * 0.35) score += 4;
        if (label.match(/message|prompt|ask|type|tell|reply|comment|search|input|write|chat|what to do/)) score += 8;
        if (el.tagName === "TEXTAREA") score += 5;
        if (String(el.getAttribute("contenteditable") || "").toLowerCase() === "true") score += 4;
        if (String(el.getAttribute("role") || "").toLowerCase() === "textbox") score += 3;
        scored.push({ el, score, bottom: rect.bottom });
      });
    });
    scored.sort((a, b) => (b.score - a.score) || (b.bottom - a.bottom));
    return scored.length ? scored[0].el : null;
  }

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const descriptor = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) descriptor.set.call(el, value);
    else el.value = value;
  }

  function setInputText(el, text) {
    el.click();
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      setNativeValue(el, text);
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
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSendButton(el) {
    const selectors = [
      "button[type='submit']",
      "input[type='submit']",
      "button[data-testid*='send' i]",
      "button[data-testid*='submit' i]",
      "button[data-testid*='post' i]",
      "button[aria-label*='Send' i]",
      "button[aria-label*='Submit' i]",
      "button[aria-label*='Post' i]",
      "button[aria-label*='Reply' i]",
      "button[aria-label*='Search' i]",
      "button[title*='Send' i]",
      "button[title*='Submit' i]",
      "button[title*='Search' i]"
    ];
    for (const selector of selectors) {
      const button = queryAll(selector).find((btn) =>
        visible(btn) &&
        !inPanel(btn) &&
        !btn.disabled &&
        String(btn.getAttribute("aria-disabled") || "").toLowerCase() !== "true"
      );
      if (button) return button;
    }

    const inputRect = el.getBoundingClientRect();
    const candidates = queryAll("button,input[type='submit'],[role='button']")
      .filter((btn) => visible(btn) && !inPanel(btn) && !btn.disabled && String(btn.getAttribute("aria-disabled") || "").toLowerCase() !== "true")
      .map((btn) => ({ btn, rect: btn.getBoundingClientRect(), label: textOf(btn) }))
      .filter((item) => {
        const label = item.label;
        const r = item.rect;
        if (label.match(/attach|upload|mic|voice|menu|settings|model|filter|sort|cancel|stop/)) return false;
        const nearInput = r.top >= inputRect.top - 160 &&
          r.bottom <= inputRect.bottom + 160 &&
          r.left >= inputRect.left - 80;
        const semantic = label.match(/send|submit|post|reply|comment|search|go|continue|next|enter/);
        return nearInput || semantic;
      })
      .sort((a, b) => {
        const aSemantic = a.label.match(/send|submit|post|reply|comment|search|go|continue|next|enter/) ? 1 : 0;
        const bSemantic = b.label.match(/send|submit|post|reply|comment|search|go|continue|next|enter/) ? 1 : 0;
        return (bSemantic - aSemantic) || (b.rect.right - a.rect.right);
      });
    return candidates.length ? candidates[0].btn : null;
  }

  function pressEnter(el) {
    el.focus();
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
    });
    const form = el.closest && el.closest("form");
    if (form && typeof form.requestSubmit === "function") {
      try {
        form.requestSubmit();
      } catch (err) {}
    }
  }

  async function sendInput(el) {
    const mode = state.sendMode || "auto";
    if (mode !== "enter") {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const button = findSendButton(el);
        if (button) {
          button.click();
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      if (mode === "button") return false;
    }
    pressEnter(el);
    return true;
  }

  function pageSignature() {
    let text = "";
    try {
      text = String(document.body && document.body.innerText || "");
    } catch (err) {}
    return text.replace(/\s+/g, " ").slice(-4000);
  }

  function resetResponseWatch() {
    state.lastPageSignature = pageSignature();
    state.lastPageChangeAt = Date.now();
    state.busySince = 0;
  }

  function isBusy(input) {
    const busyButton = queryAll("button,[role='button']")
      .find((btn) => visible(btn) && !inPanel(btn) && textOf(btn).match(/stop|cancel|generating|responding|pause/));
    if (busyButton) return { busy: true, reason: "stop/responding control visible" };

    const progress = queryAll("[role='progressbar'],[aria-busy='true'],.spinner,.loading")
      .find((el) => visible(el) && !inPanel(el));
    if (progress) return { busy: true, reason: "page loading" };

    const bottomText = queryAll("div,span,p,button,[aria-live],[role='status']")
      .filter((el) => visible(el) && !inPanel(el) && el.getBoundingClientRect().top > window.innerHeight * 0.35)
      .slice(-80)
      .map(textOf)
      .join(" ");
    if (bottomText.match(/working on it|thinking|generating|responding|loading|please wait|running|writing|creating/)) {
      return { busy: true, reason: "response is active" };
    }
    if (input && (input.disabled || input.readOnly || String(input.getAttribute("aria-disabled") || "").toLowerCase() === "true")) {
      return { busy: true, reason: "input disabled" };
    }
    return { busy: false, reason: "ready" };
  }

  function responseStable() {
    const signature = pageSignature();
    if (signature !== state.lastPageSignature) {
      state.lastPageSignature = signature;
      state.lastPageChangeAt = Date.now();
      return { stable: false, waitedMs: 0 };
    }
    const waitedMs = Date.now() - state.lastPageChangeAt;
    return { stable: waitedMs >= RESPONSE_STABLE_MS, waitedMs };
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

  function loadPanelPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || "{}");
      if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) return saved;
    } catch (err) {}
    return null;
  }

  function savePanelPosition(left, top) {
    try {
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left, top }));
    } catch (err) {}
  }

  function makeDraggable(panel, handle) {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target && event.target.closest && event.target.closest("button,input,select")) return;
      dragging = true;
      panel.setPointerCapture(event.pointerId);
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      event.preventDefault();
    });
    panel.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const left = Math.min(window.innerWidth - 80, Math.max(0, startLeft + event.clientX - startX));
      const top = Math.min(window.innerHeight - 50, Math.max(0, startTop + event.clientY - startY));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    panel.addEventListener("pointerup", (event) => {
      if (!dragging) return;
      dragging = false;
      try {
        panel.releasePointerCapture(event.pointerId);
      } catch (err) {}
      const rect = panel.getBoundingClientRect();
      savePanelPosition(rect.left, rect.top);
    });
  }

  function makePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "background:#101827",
      "color:#f9fafb",
      "border:1px solid #22c55e",
      "border-radius:10px",
      "padding:0",
      "font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.25)",
      "width:330px",
      "max-width:calc(100vw - 24px)",
      "overflow:hidden"
    ].join(";");
    const pos = loadPanelPosition();
    if (pos) {
      panel.style.left = `${pos.left}px`;
      panel.style.top = `${pos.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }
    panel.innerHTML = [
      "<div id='aria-universal-extension-drag' style='display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;cursor:move;background:#0b1220'>",
      "<div><strong style='color:#86efac'>ARIA Universal Sender</strong><span style='opacity:.65;margin-left:8px'>drag</span></div>",
      "<button id='aria-universal-extension-min' style='border:0;border-radius:5px;padding:2px 7px;background:#1f2937;color:#fff;cursor:pointer'>_</button>",
      "</div>",
      "<div id='aria-universal-extension-body' style='padding:10px 12px'>",
      "<div id='aria-universal-extension-status' style='color:#d1d5db;white-space:pre-wrap'>Waiting...</div>",
      "<div id='aria-universal-extension-meta' style='margin-top:4px;color:#93c5fd;font-size:11px'></div>",
      "<input id='aria-universal-extension-text' style='margin-top:8px;width:100%;box-sizing:border-box;border-radius:7px;border:1px solid #334155;background:#0f172a;color:#fff;padding:7px' />",
      "<div style='display:flex;gap:6px;margin-top:7px'>",
      "<input id='aria-universal-extension-seconds' type='number' min='1' style='width:72px;border-radius:7px;border:1px solid #334155;background:#0f172a;color:#fff;padding:7px' />",
      "<select id='aria-universal-extension-mode' style='flex:1;border-radius:7px;border:1px solid #334155;background:#0f172a;color:#fff;padding:7px'><option value='auto'>Auto</option><option value='button'>Button</option><option value='enter'>Enter</option></select>",
      "</div>",
      "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:8px'>",
      "<button id='aria-universal-extension-run' style='border:0;border-radius:6px;padding:6px 10px;background:#16a34a;color:white;cursor:pointer'>Run</button>",
      "<button id='aria-universal-extension-stop' style='border:0;border-radius:6px;padding:6px 10px;background:#ef4444;color:white;cursor:pointer'>Stop</button>",
      "<button id='aria-universal-extension-reset' style='border:0;border-radius:6px;padding:6px 10px;background:#2563eb;color:white;cursor:pointer'>Reset #</button>",
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(panel);
    makeDraggable(panel, panel.querySelector("#aria-universal-extension-drag"));
    panel.querySelector("#aria-universal-extension-stop").onclick = () => stop(true);
    panel.querySelector("#aria-universal-extension-reset").onclick = () => resetCounter(1);
    panel.querySelector("#aria-universal-extension-run").onclick = () => runCurrentPageFromPanel();
    panel.querySelector("#aria-universal-extension-min").onclick = () => {
      state.minimized = !state.minimized;
      savePanelMinimized();
      updatePanelMeta();
    };
    syncPanelInputs();
    updatePanelMeta();
    return panel;
  }

  function removePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
  }

  function syncPanelInputs() {
    const text = document.getElementById("aria-universal-extension-text");
    const seconds = document.getElementById("aria-universal-extension-seconds");
    const mode = document.getElementById("aria-universal-extension-mode");
    if (text) text.value = state.sendText || "{n}";
    if (seconds) seconds.value = String(Math.round(state.intervalMs / 1000));
    if (mode) mode.value = state.sendMode || "auto";
  }

  function readPanelInputs() {
    const text = document.getElementById("aria-universal-extension-text");
    const seconds = document.getElementById("aria-universal-extension-seconds");
    const mode = document.getElementById("aria-universal-extension-mode");
    if (text) state.sendText = text.value || "{n}";
    if (seconds) state.intervalMs = Math.max(1000, (Number.parseInt(seconds.value || "5", 10) || 5) * 1000);
    if (mode) state.sendMode = mode.value || "auto";
  }

  function updatePanelMeta() {
    const body = document.getElementById("aria-universal-extension-body");
    const minBtn = document.getElementById("aria-universal-extension-min");
    const meta = document.getElementById("aria-universal-extension-meta");
    if (body) body.style.display = state.minimized ? "none" : "block";
    if (minBtn) minBtn.textContent = state.minimized ? "+" : "_";
    if (meta) {
      ensureCounterScope();
      meta.textContent = `server: ${state.serverBase} | next: ${nextSendText()} | sent: ${state.runCount} | wait: ${Math.round(state.intervalMs / 1000)}s`;
    }
  }

  function setStatus(message) {
    state.lastMessage = message;
    const el = document.getElementById("aria-universal-extension-status");
    if (el) el.textContent = `${message} | sent: ${state.runCount}`;
    updatePanelMeta();
    console.log("[ARIA Universal Extension]", message);
  }

  function sendLog(message) {
    post("/inpage-log", {
      source: "extension",
      message,
      runCount: state.runCount,
      scope_id: state.counterScope,
      nextSendText: nextSendText(),
      url: location.href,
      title: document.title
    });
  }

  function sameTarget(config) {
    const targetUrl = String(config.target_url || "").trim();
    const titleKeyword = String(config.title_keyword || "").trim().toLowerCase();
    if (!targetUrl && !titleKeyword) return false;
    if (targetUrl) {
      try {
        const target = new URL(targetUrl);
        const current = new URL(location.href);
        if (target.host && target.host !== current.host) return false;
        const targetClean = target.href.replace(/[#].*$/, "").replace(/\/$/, "");
        const currentClean = current.href.replace(/[#].*$/, "").replace(/\/$/, "");
        const targetIsRoot = (target.pathname === "/" || target.pathname === "") && !target.search;
        if (!targetIsRoot && currentClean !== targetClean && !currentClean.startsWith(targetClean)) return false;
      } catch (err) {
        if (!location.href.toLowerCase().includes(targetUrl.toLowerCase())) return false;
      }
    }
    if (titleKeyword) {
      const titleAndUrl = `${document.title} ${location.href}`.toLowerCase();
      if (!titleAndUrl.includes(titleKeyword)) return false;
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

  async function tick() {
    if (state.ticking) return;
    if (!state.running) return;
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
      }
      state.busySince = 0;
      const stable = responseStable();
      if (!stable.stable) {
        setStatus(`Waiting: page still settling (${Math.round(stable.waitedMs / 1000)}s)`);
        schedule(2500);
        return;
      }
      readPanelInputs();
      const text = nextSendText();
      setInputText(input, text);
      await new Promise((resolve) => setTimeout(resolve, 650));
      const sent = await sendInput(input);
      if (!sent) {
        setStatus("Send button not found");
        schedule(2000);
        return;
      }
      state.runCount += 1;
      saveRunCount();
      resetResponseWatch();
      setStatus(`Sent ${JSON.stringify(text)}`);
      sendLog(`Sent ${JSON.stringify(text)}`);
      schedule(state.intervalMs);
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

  function applyConfig(config) {
    state.intervalMs = Math.max(1000, Number(config.interval_ms) || state.intervalMs || DEFAULT_CONFIG.intervalMs);
    state.sendText = String(config.send_text || state.sendText || "{n}");
    state.sendMode = String(config.send_mode || state.sendMode || "auto").toLowerCase();
    if (!["auto", "enter", "button"].includes(state.sendMode)) state.sendMode = "auto";
    syncPanelInputs();
  }

  function start(config) {
    ensureCounterScope();
    applyConfig(config || {});
    registerBackgroundScheduler();
    if (!state.running) {
      state.running = true;
      makePanel();
      resetResponseWatch();
      setStatus("Running on locked target tab");
      schedule(500);
    } else {
      setStatus(`Running. Interval ${Math.round(state.intervalMs / 1000)}s`);
      schedule(1000);
    }
    updatePanelMeta();
  }

  function stop(localOnly) {
    state.running = false;
    state.claimed = false;
    state.manualMode = false;
    clearTimeout(state.timer);
    unregisterBackgroundScheduler();
    setStatus("Stopped");
    if (!localOnly) {
      post("/extension-state", {
        running: false,
        message: "Stopped from universal page panel."
      });
    }
  }

  async function runCurrentPageFromPanel() {
    try {
      makePanel();
      readPanelInputs();
      state.manualMode = true;
      try {
        await postJson("/extension-state", {
          running: true,
          interval_ms: state.intervalMs,
          send_text: state.sendText,
          send_mode: state.sendMode,
          target_url: location.href,
          title_keyword: document.title || "",
          message: "Started from Universal page panel."
        });
        const allowed = await claimTargetTab();
        if (!allowed) {
          setStatus("Another matching target tab is already active");
          return;
        }
      } catch (err) {
        setStatus("Serverless mode: running this tab without ARIA server.");
      }
      start({
        running: true,
        interval_ms: state.intervalMs,
        send_text: state.sendText,
        send_mode: state.sendMode
      });
    } catch (err) {
      setStatus(`Run failed: ${err.message || err}`);
    }
  }

  async function pollDashboard() {
    if (state.manualMode) return;
    try {
      const config = await fetchJson("/extension-state", { cache: "no-store" });
      const targetOk = sameTarget(config);
      if (config.running && targetOk) {
        const allowed = await claimTargetTab();
        if (allowed) start(config);
        else {
          if (state.running) stop(true);
          removePanel();
        }
      } else if (config.running && !targetOk) {
        if (state.running) stop(true);
        removePanel();
      } else {
        if (state.running) stop(true);
        if (targetOk) {
          makePanel();
          setStatus(config.message || "Universal extension idle. Click Start.");
        } else {
          removePanel();
        }
      }
    } catch (err) {
      if (state.running) return;
      if (!document.getElementById(PANEL_ID)) makePanel();
      setStatus("ARIA server not reachable. Set Server URL in extension popup.");
    }
  }

  function currentStatus() {
    ensureCounterScope();
    return {
      running: state.running,
      runCount: state.runCount,
      counterScope: state.counterScope,
      nextSendText: nextSendText(),
      sendText: state.sendText,
      sendMode: state.sendMode,
      lastMessage: state.lastMessage,
      intervalMs: state.intervalMs,
      serverBase: state.serverBase,
      claimed: state.claimed,
      manualMode: state.manualMode,
      backgroundScheduler: state.backgroundScheduler,
      url: location.href,
      title: document.title
    };
  }

  function registerBackgroundScheduler() {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
      chrome.runtime.sendMessage({
        type: "ARIA_UNIVERSAL_REGISTER_TAB",
        intervalMs: state.intervalMs,
        url: location.href,
        title: document.title,
        scopeId: state.counterScope
      }, (reply) => {
        if (!chrome.runtime.lastError && reply && reply.ok) {
          state.backgroundScheduler = true;
          updatePanelMeta();
        }
      });
    } catch (err) {}
  }

  function unregisterBackgroundScheduler() {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
      chrome.runtime.sendMessage({ type: "ARIA_UNIVERSAL_UNREGISTER_TAB" }, () => {});
    } catch (err) {}
    state.backgroundScheduler = false;
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const type = message && message.type;
      if (type === "ARIA_UNIVERSAL_START") {
        (async () => {
          if (message.serverBase) {
            storageSet({ [SERVER_BASE_KEY]: normalizeServerBase(message.serverBase) });
          }
          state.manualMode = true;
          applyConfig({
            interval_ms: message.intervalMs,
            send_text: message.sendText,
            send_mode: message.sendMode
          });
          try {
            await postJson("/extension-state", {
              running: true,
              interval_ms: state.intervalMs,
              send_text: state.sendText,
              send_mode: state.sendMode,
              target_url: location.href,
              title_keyword: document.title || "",
              message: "Started from Universal popup."
            });
            const allowed = await claimTargetTab();
            if (!allowed) setStatus("Another matching target tab is already active");
          } catch (err) {
            setStatus("Serverless mode: running without ARIA server.");
          }
          start({ interval_ms: state.intervalMs, send_text: state.sendText, send_mode: state.sendMode });
          sendResponse({ ok: true, ...currentStatus() });
        })().catch((err) => sendResponse({ ok: false, error: String(err && err.message || err), ...currentStatus() }));
        return true;
      }
      if (type === "ARIA_UNIVERSAL_STOP") {
        stop(true);
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      if (type === "ARIA_UNIVERSAL_BACKGROUND_TICK") {
        if (state.running) tick();
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      if (type === "ARIA_UNIVERSAL_STATUS") {
        makePanel();
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      if (type === "ARIA_UNIVERSAL_RESET") {
        resetCounter(message.nextNumber || 1);
        sendResponse({ ok: true, ...currentStatus() });
        return true;
      }
      return false;
    });
  }

  window[STATE_KEY] = {
    start,
    stop,
    status: currentStatus,
    runCurrentPageFromPanel,
    resetCounter
  };

  requestBrowserTabScope();
  loadApiBase().then(() => {
    state.poller = setInterval(pollDashboard, 2000);
    pollDashboard();
  });
})();
