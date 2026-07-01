(function () {
  "use strict";

  const DEFAULT_SERVER_BASE = "http://127.0.0.1:5050";
  const SERVER_BASE_KEY = "ariaServerBase";
  const STATE_KEY = "__ARIA_TIKTOK_UPLOAD_ASSISTANT__";
  const PANEL_ID = "aria-tiktok-upload-panel";
  const PANEL_POS_KEY = "ariaTikTokUploadPanelPosition";

  if (window[STATE_KEY]) return;
  window[STATE_KEY] = true;

  let apiBase = DEFAULT_SERVER_BASE + "/api/tiktok";
  const state = {
    running: false,
    claimed: false,
    timer: null,
    runCount: 0,
    currentVideo: null,
    lastMessage: "TikTok uploader loaded."
  };

  function instanceId() {
    try {
      const key = "ariaTikTokUploaderInstanceId";
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

  const INSTANCE_ID = instanceId();

  function normalizeServerBase(value) {
    let base = String(value || DEFAULT_SERVER_BASE).trim();
    if (!base) base = DEFAULT_SERVER_BASE;
    if (!/^https?:\/\//i.test(base)) base = "http://" + base;
    return base.replace(/\/+$/, "").replace(/\/api\/tiktok$/i, "").replace(/\/api$/i, "");
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (data) => resolve(data || {}));
          return;
        }
      } catch (err) {}
      resolve({});
    });
  }

  async function serverBaseCandidates() {
    const stored = await storageGet([SERVER_BASE_KEY]);
    const cfg = window.ARIA_TIKTOK_CONFIG || {};
    const bases = Array.isArray(cfg.serverBases) ? cfg.serverBases : [];
    return Array.from(new Set([
      stored[SERVER_BASE_KEY],
      ...bases,
      DEFAULT_SERVER_BASE,
      "http://localhost:5050"
    ].map(normalizeServerBase).filter(Boolean)));
  }

  async function fetchApi(path, options) {
    const candidates = await serverBaseCandidates();
    let lastError = null;
    for (const base of candidates) {
      try {
        const response = await fetch(base + "/api/tiktok" + path, options);
        apiBase = base + "/api/tiktok";
        return response;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("ARIA server not reachable");
  }

  async function getJson(path) {
    const response = await fetchApi(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`ARIA server ${response.status}`);
    return response.json();
  }

  async function postJson(path, body) {
    const response = await fetchApi(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!response.ok) throw new Error(`ARIA server ${response.status}`);
    return response.json();
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 5 && rect.height > 5 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function textOf(el) {
    return String(el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
  }

  function injectStyles() {
    if (document.getElementById("aria-tiktok-upload-style")) return;
    const style = document.createElement("style");
    style.id = "aria-tiktok-upload-style";
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 18px;
        bottom: 22px;
        z-index: 2147483647;
        width: 360px;
        max-width: calc(100vw - 24px);
        background: #101827;
        color: #f9fafb;
        border: 1px solid #00f2ea;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,.28);
        font: 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;
        overflow: hidden;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .aria-head {
        padding: 10px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        background: #111827;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      #${PANEL_ID} .aria-title { color: #67e8f9; font-weight: 800; }
      #${PANEL_ID} .aria-body { padding: 12px; max-height: calc(100vh - 90px); overflow: auto; }
      #${PANEL_ID} button {
        border: 0;
        border-radius: 8px;
        padding: 8px 10px;
        margin: 4px 4px 4px 0;
        color: white;
        background: #0f766e;
        font-weight: 700;
        cursor: pointer;
      }
      #${PANEL_ID} button.warn { background: #ef4444; }
      #${PANEL_ID} button.light { background: #334155; }
      #${PANEL_ID} .aria-box {
        margin-top: 8px;
        padding: 10px;
        border: 1px solid rgba(148,163,184,.26);
        border-radius: 8px;
        background: rgba(15,23,42,.72);
        white-space: pre-wrap;
      }
      .aria-tiktok-highlight {
        outline: 3px solid #00f2ea !important;
        outline-offset: 5px !important;
        box-shadow: 0 0 0 7px rgba(0,242,234,.18) !important;
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
      <div class="aria-head">
        <div class="aria-title">ARIA TikTok Uploader</div>
        <button class="light" id="aria-tiktok-close" title="Hide">x</button>
      </div>
      <div class="aria-body">
        <div style="color:#fde68a;margin-bottom:8px">Safe mode: ARIA guides upload + fills caption. You select file and click final Post yourself.</div>
        <button id="aria-tiktok-run">Run</button>
        <button class="light" id="aria-tiktok-next">Load next video</button>
        <button class="light" id="aria-tiktok-caption">Fill caption</button>
        <button class="light" id="aria-tiktok-upload">Click upload box</button>
        <button class="light" id="aria-tiktok-copy">Copy path + caption</button>
        <button class="warn" id="aria-tiktok-stop">Stop</button>
        <button class="light" id="aria-tiktok-posted">Mark posted</button>
        <div class="aria-box" id="aria-tiktok-status">Waiting...</div>
      </div>
    `;
    document.body.appendChild(panel);
    restorePanel(panel);
    wirePanel(panel);
    return panel;
  }

  function restorePanel(panel) {
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
    const head = panel.querySelector(".aria-head");
    let drag = null;
    head.addEventListener("mousedown", (event) => {
      if (event.target && event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      event.preventDefault();
    });
    window.addEventListener("mousemove", (event) => {
      if (!drag) return;
      const left = Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, event.clientX - drag.dx));
      const top = Math.max(8, Math.min(innerHeight - panel.offsetHeight - 8, event.clientY - drag.dy));
      panel.style.left = left + "px";
      panel.style.top = top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      const rect = panel.getBoundingClientRect();
      try {
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (err) {}
    });
    panel.querySelector("#aria-tiktok-close").onclick = () => panel.remove();
    panel.querySelector("#aria-tiktok-run").onclick = () => start();
    panel.querySelector("#aria-tiktok-next").onclick = () => loadNextVideo();
    panel.querySelector("#aria-tiktok-caption").onclick = () => fillCaption();
    panel.querySelector("#aria-tiktok-upload").onclick = () => clickUploadBox();
    panel.querySelector("#aria-tiktok-copy").onclick = () => copyCurrentVideo();
    panel.querySelector("#aria-tiktok-stop").onclick = () => stop();
    panel.querySelector("#aria-tiktok-posted").onclick = () => markPosted();
  }

  function setStatus(message) {
    state.lastMessage = message;
    const el = document.getElementById("aria-tiktok-status");
    if (el) el.textContent = `${message}\n\nRuns: ${state.runCount}${state.currentVideo ? "\nVideo: " + state.currentVideo.name : ""}`;
    console.log("[ARIA TikTok]", message);
  }

  function sameTarget(config) {
    if (!/tiktok\.com$/i.test(location.hostname) && !location.hostname.includes("tiktok.com")) return false;
    const target = String(config.target_url || "").trim();
    if (!target) return true;
    try {
      const targetUrl = new URL(target);
      if (targetUrl.host && targetUrl.host !== location.host) return false;
      if (targetUrl.pathname && targetUrl.pathname !== "/" && !location.pathname.startsWith(targetUrl.pathname.replace(/\/$/, ""))) {
        return false;
      }
    } catch (err) {}
    return true;
  }

  async function claim() {
    const reply = await postJson("/extension-claim", {
      instance_id: INSTANCE_ID,
      page_url: location.href,
      page_title: document.title
    });
    state.claimed = Boolean(reply.claim_allowed);
    return state.claimed;
  }

  function candidateButtons() {
    return Array.from(document.querySelectorAll("button,[role='button'],a,label,input[type='file']"))
      .filter((el) => visible(el) && !el.closest("#" + PANEL_ID));
  }

  function findUploadControl() {
    const fileInput = document.querySelector("input[type='file']");
    if (fileInput) return fileInput;
    const words = /select file|upload|choose file|browse|drag/i;
    return candidateButtons().find((el) => words.test(textOf(el)) || words.test(el.getAttribute("aria-label") || ""));
  }

  function clickUploadBox() {
    const target = findUploadControl();
    if (!target) {
      setStatus("Upload control not found. Open TikTok upload page and wait for it to load.");
      return false;
    }
    target.classList.add("aria-tiktok-highlight");
    target.scrollIntoView({ block: "center", inline: "center" });
    setTimeout(() => target.click(), 250);
    setStatus("Upload box clicked. Select the queued video file in the file picker.");
    return true;
  }

  function captionFields() {
    const selectors = [
      "textarea",
      "[contenteditable='true']",
      "[data-e2e*='caption']",
      "[aria-label*='caption' i]",
      "[placeholder*='caption' i]",
      "[placeholder*='description' i]"
    ];
    const fields = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (visible(el) && !el.closest("#" + PANEL_ID) && !fields.includes(el)) fields.push(el);
      });
    });
    return fields;
  }

  function setInputText(el, value) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
    } else {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  async function loadNextVideo() {
    const data = await getJson("/next-video");
    if (!data.success || !data.video) {
      state.currentVideo = null;
      setStatus(data.message || "No queued video found.");
      return null;
    }
    state.currentVideo = data.video;
    setStatus(`Next video loaded.\nPath copied-ready:\n${data.video.path}\n\nCaption:\n${data.video.caption}`);
    return data.video;
  }

  async function copyCurrentVideo() {
    const video = state.currentVideo || await loadNextVideo();
    if (!video) return false;
    const text = `VIDEO PATH:\n${video.path}\n\nCAPTION:\n${video.caption}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied video path and caption. Use the path in the file picker, then Fill caption.");
      return true;
    } catch (err) {
      setStatus(`Clipboard failed. Manually use:\n${text}`);
      return false;
    }
  }

  async function fillCaption() {
    const video = state.currentVideo || await loadNextVideo();
    if (!video) return false;
    const fields = captionFields();
    if (!fields.length) {
      setStatus("Caption field not found yet. Select/upload the video first, then click Fill caption.");
      return false;
    }
    setInputText(fields[0], video.caption);
    fields[0].classList.add("aria-tiktok-highlight");
    setStatus("Caption filled. Review privacy/cover settings, then click Post yourself.");
    return true;
  }

  function findPostButton() {
    return candidateButtons().find((el) => /post|publish|schedule/i.test(textOf(el)) || /post|publish|schedule/i.test(el.getAttribute("aria-label") || ""));
  }

  async function step() {
    if (!state.running) return;
    try {
      const cfg = await getJson("/extension-state");
      state.running = Boolean(cfg.running);
      if (!state.running) {
        setStatus(cfg.message || "Stopped from dashboard.");
        return;
      }
      if (!sameTarget(cfg)) {
        setStatus("Waiting for matching TikTok upload page.");
        schedule(4000);
        return;
      }
      if (!await claim()) {
        setStatus("Another TikTok tab is active. Waiting...");
        schedule(5000);
        return;
      }
      makePanel();
      if (!state.currentVideo) await loadNextVideo();
      const captionDone = await fillCaption();
      if (!captionDone) {
        await copyCurrentVideo();
        clickUploadBox();
      } else {
        const post = findPostButton();
        if (post) post.classList.add("aria-tiktok-highlight");
      }
      state.runCount += 1;
      schedule(5000);
    } catch (err) {
      setStatus(`TikTok helper waiting: ${err.message || err}`);
      schedule(6000);
    }
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    if (state.running) state.timer = setTimeout(step, ms);
  }

  async function start() {
    makePanel();
    state.running = true;
    setStatus("Starting TikTok helper...");
    await loadNextVideo();
    step();
  }

  async function stop() {
    clearTimeout(state.timer);
    state.running = false;
    try {
      await postJson("/extension-state", { running: false, message: "Stopped from TikTok page panel." });
    } catch (err) {}
    setStatus("Stopped.");
  }

  async function markPosted() {
    const video = state.currentVideo || await loadNextVideo();
    const data = await postJson("/mark-posted", { path: video ? video.path : "" });
    state.currentVideo = null;
    setStatus(data.message || (data.state && data.state.message) || "Marked posted.");
    await loadNextVideo();
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const type = message && message.type;
      if (!type) return false;
      (async () => {
        if (type === "ARIA_TIKTOK_SHOW") {
          makePanel();
          sendResponse({ ok: true });
          return;
        }
        if (type === "ARIA_TIKTOK_RUN") {
          await start();
          sendResponse({ ok: true, message: state.lastMessage });
          return;
        }
        if (type === "ARIA_TIKTOK_STOP") {
          await stop();
          sendResponse({ ok: true, message: state.lastMessage });
          return;
        }
        if (type === "ARIA_TIKTOK_UPLOAD_BOX") {
          sendResponse({ ok: clickUploadBox(), message: state.lastMessage });
          return;
        }
        if (type === "ARIA_TIKTOK_FILL_CAPTION") {
          const ok = await fillCaption();
          sendResponse({ ok, message: state.lastMessage });
          return;
        }
        sendResponse({ ok: false, error: "Unknown TikTok action." });
      })().catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
      return true;
    });
  }

  async function pollDashboard() {
    try {
      const cfg = await getJson("/extension-state");
      if (cfg.running && !state.running && sameTarget(cfg)) {
        await start();
      } else if (!cfg.running && state.running) {
        clearTimeout(state.timer);
        state.running = false;
        setStatus(cfg.message || "Stopped from dashboard.");
      }
    } catch (err) {}
    setTimeout(pollDashboard, 5000);
  }

  makePanel();
  pollDashboard();
})();
