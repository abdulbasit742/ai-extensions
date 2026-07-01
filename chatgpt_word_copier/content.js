(function () {
  "use strict";

  const STATE_KEY = "__ARIA_GPT_WORD_COPIER__";
  const PANEL_ID = "aria-gpt-word-copier-panel";
  const PANEL_POS_KEY = "ariaGptWordCopierPanelPos";
  const RESPONSE_STABLE_MS = 4500;
  const DEFAULTS = {
    server: "http://127.0.0.1:5050",
    startNumber: 1,
    endNumber: 50,
    intervalSeconds: 8,
    saveMode: "code",
    prefix: ""
  };

  if (window[STATE_KEY]) return;

  const state = {
    running: false,
    timer: null,
    options: { ...DEFAULTS },
    nextNumber: 1,
    lastSentNumber: null,
    awaitingSave: false,
    lastSavedSignature: "",
    lastPageSignature: "",
    lastPageChangeAt: Date.now(),
    lastSentAt: 0,
    ticking: false,
    savedCount: 0,
    lastMessage: "Ready. Open popup or panel and click Run."
  };

  function normalizeBase(value) {
    let base = String(value || DEFAULTS.server).trim();
    if (!base) base = DEFAULTS.server;
    if (!/^https?:\/\//i.test(base)) base = "http://" + base;
    return base.replace(/\/+$/, "");
  }

  function sanitizeOptions(options) {
    const merged = { ...DEFAULTS, ...(options || {}) };
    merged.server = normalizeBase(merged.server);
    merged.startNumber = Math.max(1, parseInt(merged.startNumber || "1", 10) || 1);
    merged.endNumber = Math.max(merged.startNumber, parseInt(merged.endNumber || "50", 10) || 50);
    merged.intervalSeconds = Math.max(2, parseInt(merged.intervalSeconds || "8", 10) || 8);
    merged.saveMode = merged.saveMode === "full" ? "full" : "code";
    merged.prefix = String(merged.prefix || "").slice(0, 300);
    return merged;
  }

  function setStatus(message) {
    state.lastMessage = String(message || "");
    const el = document.getElementById("aria-gpt-word-status");
    if (el) el.textContent = statusLine();
    updateMeta();
    console.log("[ARIA GPT Word]", message);
  }

  function statusLine() {
    return `${state.lastMessage}\nNext: ${state.nextNumber} | End: ${state.options.endNumber} | Saved: ${state.savedCount}`;
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 8 && rect.height > 8 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
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

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
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
      "#" + PANEL_ID
    ].join(",")).forEach((el) => el.remove());
    return cleanText(clone.innerText || clone.textContent || "");
  }

  function queryCandidates(selectors) {
    const seen = new Set();
    const found = [];
    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((node) => {
          if (seen.has(node) || inPanel(node) || !visible(node)) return;
          seen.add(node);
          const text = textFromNode(node);
          if (text.length >= 20 && !text.includes("ARIA GPT to Word")) {
            found.push({ node, text, top: node.getBoundingClientRect().top });
          }
        });
      } catch (err) {}
    });
    return found;
  }

  function latestAssistantNode() {
    const candidates = queryCandidates([
      "[data-message-author-role='assistant']",
      "article[data-testid*='conversation-turn']",
      "article",
      "main [role='article']",
      "main .markdown",
      "main [class*='markdown']"
    ]).filter((item) => !/^(ask anything|message chatgpt|chatgpt can make mistakes)/i.test(item.text));
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.top - b.top);
    return candidates[candidates.length - 1].node;
  }

  function extractCodeBlocks(node) {
    if (!node) return [];
    const blocks = [];
    node.querySelectorAll("pre").forEach((pre) => {
      if (!visible(pre) || inPanel(pre)) return;
      const codeEl = pre.querySelector("code");
      const code = cleanText((codeEl && codeEl.innerText) || pre.innerText || pre.textContent || "");
      if (!code || code.length < 3) return;
      let language = "code";
      if (codeEl) {
        const className = String(codeEl.className || "");
        const match = className.match(/language-([A-Za-z0-9_#+.-]+)/);
        if (match) language = match[1];
      }
      const header = pre.parentElement ? String(pre.parentElement.innerText || "").split("\n")[0] : "";
      if (header && header.length < 40 && !/copy|download|preview/i.test(header)) language = header.trim();
      blocks.push({ language, code });
    });
    return blocks;
  }

  function latestCapture() {
    const node = latestAssistantNode();
    const responseText = textFromNode(node);
    const codeBlocks = extractCodeBlocks(node);
    const signature = cleanText(responseText).slice(-5000) + "|" + codeBlocks.map((b) => b.code.slice(0, 120)).join("|");
    return { node, responseText, codeBlocks, signature };
  }

  function pageSignature() {
    const node = latestAssistantNode();
    if (!node) return "";
    return cleanText(node.innerText || node.textContent || "").slice(-6000);
  }

  function responseStable() {
    const signature = pageSignature();
    const now = Date.now();
    if (!signature) return { stable: false, waitedMs: 0 };
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
        let score = rect.bottom / Math.max(1, window.innerHeight);
        const label = textOf(el);
        if (rect.top > window.innerHeight * 0.45) score += 5;
        if (el.id === "prompt-textarea") score += 8;
        if (label.includes("message") || label.includes("prompt")) score += 4;
        if (String(el.getAttribute("role") || "").toLowerCase() === "textbox") score += 2;
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
    if (cleanText(el.innerText || el.textContent || "") !== text) {
      el.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = text;
      el.appendChild(p);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSendButton(input) {
    const selectors = [
      "button[data-testid='composer-send-button']",
      "button[data-testid='send-button']",
      "button[aria-label='Send prompt']",
      "button[aria-label*='Send' i]",
      "button[title*='Send' i]",
      "button[type='submit']"
    ];
    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (visible(btn) && !inPanel(btn) && !btn.disabled && String(btn.getAttribute("aria-disabled") || "").toLowerCase() !== "true") {
        return btn;
      }
    }
    const inputRect = input.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll("button")).filter((btn) => visible(btn) && !inPanel(btn) && !btn.disabled);
    buttons.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const ad = Math.abs(ar.left - inputRect.right) + Math.abs(ar.top - inputRect.top);
      const bd = Math.abs(br.left - inputRect.right) + Math.abs(br.top - inputRect.top);
      return ad - bd;
    });
    return buttons[0] || null;
  }

  async function clickSendOrEnter(input) {
    const btn = findSendButton(input);
    if (btn) {
      btn.click();
      return true;
    }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    return true;
  }

  function isBusy(input) {
    if (document.readyState === "loading") return { busy: true, reason: "page loading" };
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
      if (visible(btn) && !inPanel(btn)) return { busy: true, reason: "ChatGPT is responding" };
    }
    const thinking = Array.from(document.querySelectorAll("main *")).some((el) => {
      if (!visible(el) || inPanel(el)) return false;
      const txt = cleanText(el.innerText || el.textContent || "");
      return /thinking|working on it|generating/i.test(txt) && txt.length < 80;
    });
    if (thinking) return { busy: true, reason: "ChatGPT is thinking" };
    return { busy: false, reason: "ready" };
  }

  function nextPromptText() {
    const n = state.nextNumber;
    return state.options.prefix ? `${state.options.prefix} ${n}` : String(n);
  }

  async function apiPost(path, body) {
    const res = await fetch(state.options.server + "/api/gpt-word" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    return res.json();
  }

  async function saveLatest(reason) {
    const capture = latestCapture();
    if (!capture.responseText && !capture.codeBlocks.length) {
      setStatus("No assistant response found to save yet.");
      return { ok: false, error: "no_response" };
    }
    if (capture.signature && capture.signature === state.lastSavedSignature && reason !== "manual") {
      setStatus("Latest response already saved. Moving on.");
      return { ok: true, duplicate: true };
    }
    const numberToSave = state.lastSentNumber || Math.max(1, state.nextNumber - 1);
    const result = await apiPost("/append", {
      number: numberToSave,
      prompt_text: String(numberToSave),
      response_text: capture.responseText,
      code_blocks: capture.codeBlocks,
      source_url: location.href,
      page_title: document.title,
      save_mode: state.options.saveMode
    });
    if (result && result.success) {
      state.lastSavedSignature = capture.signature;
      state.savedCount += 1;
      setStatus(result.message || `Saved #${numberToSave} to Word.`);
      return { ok: true, result };
    }
    setStatus((result && result.message) || "Could not save to Word.");
    return { ok: false, result };
  }

  async function sendNext() {
    const input = findInput();
    if (!input) {
      setStatus("Waiting: ChatGPT input not found.");
      return false;
    }
    const prompt = nextPromptText();
    setInputText(input, prompt);
    await new Promise((resolve) => setTimeout(resolve, 650));
    await clickSendOrEnter(input);
    state.lastSentNumber = state.nextNumber;
    state.nextNumber += 1;
    state.awaitingSave = true;
    state.lastSentAt = Date.now();
    resetResponseWatch();
    setStatus(`Sent prompt #${state.lastSentNumber}: ${prompt}`);
    return true;
  }

  async function tick(source) {
    if (!state.running || state.ticking) return;
    state.ticking = true;
    try {
      const input = findInput();
      const busy = isBusy(input);
      if (busy.busy) {
        setStatus(`Waiting: ${busy.reason}`);
        schedule(2000);
        return;
      }
      const stable = responseStable();
      if (state.awaitingSave && !stable.stable) {
        setStatus(`Waiting: response still settling (${Math.round(stable.waitedMs / 1000)}s)`);
        schedule(2000);
        return;
      }
      if (state.awaitingSave) {
        await saveLatest("auto");
        state.awaitingSave = false;
      }
      if (state.nextNumber > state.options.endNumber) {
        stop(false);
        setStatus(`Done. Reached end number ${state.options.endNumber}.`);
        return;
      }
      const elapsed = state.lastSentAt ? Date.now() - state.lastSentAt : state.options.intervalSeconds * 1000;
      const waitMs = state.options.intervalSeconds * 1000 - elapsed;
      if (waitMs > 0) {
        setStatus(`Waiting ${Math.ceil(waitMs / 1000)}s before next number.`);
        schedule(waitMs);
        return;
      }
      await sendNext();
      schedule(2000);
    } catch (err) {
      setStatus(`Error: ${err && err.message ? err.message : err}`);
      schedule(4000);
    } finally {
      state.ticking = false;
    }
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    if (state.running) {
      state.timer = setTimeout(() => tick("page"), Math.max(1000, Number(ms) || 2000));
    }
  }

  function sendRuntime(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (reply) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(reply || { ok: true });
        });
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    });
  }

  function start(options) {
    state.options = sanitizeOptions(options || state.options);
    state.nextNumber = state.options.startNumber;
    state.lastSentNumber = null;
    state.awaitingSave = false;
    state.running = true;
    state.lastSentAt = 0;
    makePanel();
    resetResponseWatch();
    sendRuntime({ type: "ARIA_GPT_WORD_REGISTER", intervalMs: state.options.intervalSeconds * 1000, url: location.href, title: document.title });
    setStatus("Running. First number will be sent now.");
    schedule(300);
  }

  function stop(sendUnregister = true) {
    state.running = false;
    clearTimeout(state.timer);
    if (sendUnregister) sendRuntime({ type: "ARIA_GPT_WORD_UNREGISTER" });
    setStatus("Stopped.");
  }

  function currentStatus() {
    return {
      ok: true,
      running: state.running,
      nextNumber: state.nextNumber,
      endNumber: state.options.endNumber,
      intervalSeconds: state.options.intervalSeconds,
      saveMode: state.options.saveMode,
      savedCount: state.savedCount,
      lastSentNumber: state.lastSentNumber,
      lastMessage: state.lastMessage,
      url: location.href,
      title: document.title
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function placePanel(panel) {
    let left = window.innerWidth - 330;
    let top = window.innerHeight - 210;
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || "null");
      if (saved) {
        left = Number(saved.left) || left;
        top = Number(saved.top) || top;
      }
    } catch (err) {}
    panel.style.left = `${clamp(left, 8, Math.max(8, window.innerWidth - 320))}px`;
    panel.style.top = `${clamp(top, 8, Math.max(8, window.innerHeight - 180))}px`;
  }

  function makeDraggable(panel, handle) {
    let dragging = false;
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let st = 0;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest("button,input,select,textarea")) return;
      dragging = true;
      sx = event.clientX;
      sy = event.clientY;
      sl = panel.offsetLeft;
      st = panel.offsetTop;
      panel.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    panel.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const left = clamp(sl + event.clientX - sx, 8, Math.max(8, window.innerWidth - panel.offsetWidth - 8));
      const top = clamp(st + event.clientY - sy, 8, Math.max(8, window.innerHeight - panel.offsetHeight - 8));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });
    panel.addEventListener("pointerup", (event) => {
      if (!dragging) return;
      dragging = false;
      try { panel.releasePointerCapture(event.pointerId); } catch (err) {}
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: panel.offsetLeft, top: panel.offsetTop }));
    });
  }

  function makePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      updateMeta();
      return panel;
    }
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "width:300px",
      "background:#0f172a",
      "color:#e5f9ef",
      "border:2px solid #10b981",
      "box-shadow:0 16px 40px rgba(0,0,0,.25)",
      "border-radius:10px",
      "font:13px system-ui,Segoe UI,sans-serif",
      "padding:12px"
    ].join(";");
    panel.innerHTML = [
      '<div id="aria-gpt-word-drag" style="display:flex;justify-content:space-between;gap:8px;cursor:move;font-weight:900;color:#86efac;">',
      "<span>ARIA GPT to Word</span><span>drag</span>",
      "</div>",
      '<div id="aria-gpt-word-meta" style="font-size:11px;color:#cbd5e1;margin-top:5px;"></div>',
      '<div id="aria-gpt-word-status" style="white-space:pre-wrap;margin:8px 0;color:#f8fafc;"></div>',
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">',
      '<button id="aria-gpt-word-run" style="background:#10b981;color:white;border:0;border-radius:7px;padding:7px 10px;font-weight:900;">Run</button>',
      '<button id="aria-gpt-word-stop" style="background:#ef4444;color:white;border:0;border-radius:7px;padding:7px 10px;font-weight:900;">Stop</button>',
      '<button id="aria-gpt-word-save" style="background:#4f46e5;color:white;border:0;border-radius:7px;padding:7px 10px;font-weight:900;">Save latest</button>',
      '<button id="aria-gpt-word-open" style="background:#f97316;color:white;border:0;border-radius:7px;padding:7px 10px;font-weight:900;">Open Word</button>',
      "</div>"
    ].join("");
    document.body.appendChild(panel);
    placePanel(panel);
    makeDraggable(panel, panel.querySelector("#aria-gpt-word-drag"));
    panel.querySelector("#aria-gpt-word-run").onclick = () => start(state.options);
    panel.querySelector("#aria-gpt-word-stop").onclick = () => stop(true);
    panel.querySelector("#aria-gpt-word-save").onclick = () => saveLatest("manual");
    panel.querySelector("#aria-gpt-word-open").onclick = async () => {
      try {
        const result = await apiPost("/open-document", {});
        setStatus(result.message || "Open Word requested.");
      } catch (err) {
        setStatus("ARIA server not reachable.");
      }
    };
    updateMeta();
    setStatus(state.lastMessage);
    return panel;
  }

  function updateMeta() {
    const meta = document.getElementById("aria-gpt-word-meta");
    if (!meta) return;
    meta.textContent = `range ${state.nextNumber}-${state.options.endNumber} | wait ${state.options.intervalSeconds}s | mode ${state.options.saveMode}`;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message && message.type;
    if (type === "ARIA_GPT_WORD_START") {
      start(message.options || {});
      sendResponse(currentStatus());
      return true;
    }
    if (type === "ARIA_GPT_WORD_STOP") {
      stop(true);
      sendResponse(currentStatus());
      return true;
    }
    if (type === "ARIA_GPT_WORD_STATUS_PAGE") {
      makePanel();
      sendResponse(currentStatus());
      return true;
    }
    if (type === "ARIA_GPT_WORD_SAVE_LATEST") {
      if (message.options) state.options = sanitizeOptions(message.options);
      saveLatest("manual").then((result) => sendResponse({ ...currentStatus(), result }));
      return true;
    }
    if (type === "ARIA_GPT_WORD_TICK") {
      tick("background").then(() => sendResponse(currentStatus()));
      return true;
    }
    return false;
  });

  window[STATE_KEY] = {
    start,
    stop,
    status: currentStatus,
    saveLatest
  };

  makePanel();
})();
