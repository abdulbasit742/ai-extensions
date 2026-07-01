(function () {
  const OPTIONS_KEY = "ariaImageSaverOptions";
  const SEEN_KEY = `ariaImageSaverSeen:${location.origin}${location.pathname}`;
  const PANEL_ID = "aria-image-saver-panel";
  const DEFAULTS = {
    folderName: "Basit Social Media",
    filenamePrefix: "chatgpt_image",
    autoSave: true,
    promptTemplate: "Create a high quality social media image for: {prompt}. Make it polished, clear, and ready for social media. Do not add text unless I explicitly ask for text."
  };

  const state = {
    options: { ...DEFAULTS },
    seen: new Set(),
    savedCount: 0,
    scanning: false,
    status: "Ready.",
    lastSaved: "",
    observer: null
  };

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(value) {
    return new Promise((resolve) => chrome.storage.local.set(value, resolve));
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (reply) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(reply || { ok: false, error: "No response." });
      });
    });
  }

  function sanitizePathPart(value, fallback) {
    const cleaned = String(value || "")
      .replace(/[<>:"\\|?*\x00-\x1f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || fallback;
  }

  function slug(value, fallback) {
    const cleaned = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70);
    return cleaned || fallback;
  }

  function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function shortHash(text) {
    let h = 2166136261;
    const s = String(text || "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).slice(0, 6);
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 20 && rect.height > 20 && style.visibility !== "hidden" && style.display !== "none";
  }

  function imageLooksGenerated(img) {
    if (!img || !img.src || !isVisible(img)) return false;
    const src = img.currentSrc || img.src;
    if (/\.svg($|\?)/i.test(src) || src.startsWith("data:image/svg")) return false;
    if (/avatar|profile|favicon|logo|emoji|sprite|icon/i.test(src)) return false;

    const rect = img.getBoundingClientRect();
    const naturalW = Number(img.naturalWidth) || 0;
    const naturalH = Number(img.naturalHeight) || 0;
    const bigEnough = naturalW >= 256 || naturalH >= 256 || rect.width >= 180 || rect.height >= 180;
    const knownGenerated = /backend-api\/estuary\/content|oaiusercontent|oaidalleapiprodscus|sdmntpr|images\.openai/i.test(src);
    const inConversation = Boolean(img.closest("main, article, [data-message-author-role], [data-testid]"));
    return (bigEnough && inConversation) || knownGenerated;
  }

  async function loadState() {
    const data = await storageGet([OPTIONS_KEY, SEEN_KEY]);
    state.options = { ...DEFAULTS, ...(data[OPTIONS_KEY] || {}) };
    state.seen = new Set(Array.isArray(data[SEEN_KEY]) ? data[SEEN_KEY] : []);
    updatePanel();
  }

  async function saveOptions(next) {
    state.options = { ...state.options, ...next };
    await storageSet({ [OPTIONS_KEY]: state.options });
    updatePanel();
  }

  async function rememberSeen(key) {
    state.seen.add(key);
    await storageSet({ [SEEN_KEY]: Array.from(state.seen).slice(-500) });
  }

  function findPromptInput() {
    const selectors = [
      "#prompt-textarea",
      "[data-testid='prompt-textarea']",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "textarea",
      ".ProseMirror",
      "[role='textbox']"
    ];
    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll(selector)).filter(isVisible);
      const candidate = candidates[candidates.length - 1];
      if (candidate) return candidate;
    }
    return null;
  }

  function setInputText(input, text) {
    input.focus();
    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
  }

  function clickSend(input) {
    const selectors = [
      "[data-testid='send-button']",
      "button[aria-label='Send prompt']",
      "button[aria-label='Send message']",
      "button[aria-label*='Send' i]",
      "button[type='submit']"
    ];
    for (const selector of selectors) {
      const button = Array.from(document.querySelectorAll(selector)).find((btn) => isVisible(btn) && !btn.disabled && btn.getAttribute("aria-disabled") !== "true");
      if (button) {
        button.click();
        return true;
      }
    }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    return true;
  }

  async function generateImage(prompt) {
    const cleanPrompt = String(prompt || "").trim();
    if (!cleanPrompt) {
      setStatus("Write an image prompt first.");
      return { ok: false, error: "Prompt required." };
    }
    const input = findPromptInput();
    if (!input) {
      setStatus("ChatGPT input box not found. Open a ChatGPT chat first.");
      return { ok: false, error: "Input box not found." };
    }
    const finalPrompt = state.options.promptTemplate.replaceAll("{prompt}", cleanPrompt);
    setInputText(input, finalPrompt);
    await new Promise((resolve) => setTimeout(resolve, 250));
    clickSend(input);
    setStatus("Image prompt sent. Auto-save is watching for generated images.");
    scheduleScan(4000);
    return { ok: true };
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function payloadForImage(src) {
    if (src.startsWith("data:image/")) {
      return { dataUrl: src, sourceUrl: src.slice(0, 80) };
    }

    const shouldFetchInPage = src.startsWith("blob:") || /chatgpt\.com\/backend-api\/estuary\/content/i.test(src);
    if (shouldFetchInPage) {
      try {
        const response = await fetch(src, { credentials: "include" });
        if (response.ok) {
          const blob = await response.blob();
          return { dataUrl: await blobToDataUrl(blob), sourceUrl: src };
        }
      } catch (err) {
        console.warn("[ARIA Image Saver] page fetch failed, using URL download", err);
      }
    }

    return { url: src, sourceUrl: src };
  }

  function filenameForImage(src) {
    const folder = sanitizePathPart(state.options.folderName, DEFAULTS.folderName);
    const prefix = slug(state.options.filenamePrefix, "chatgpt-image");
    return `${folder}/${timestamp()}_${prefix}_${shortHash(src)}.png`;
  }

  async function saveImage(img, reason) {
    const src = img.currentSrc || img.src;
    const key = `${src}|${img.naturalWidth || 0}|${img.naturalHeight || 0}`;
    if (state.seen.has(key)) return { ok: true, skipped: true };
    await rememberSeen(key);

    try {
      const payload = await payloadForImage(src);
      const filename = filenameForImage(src);
      const reply = await sendMessage({
        type: "ARIA_IMAGE_DOWNLOAD",
        payload: {
          ...payload,
          filename,
          reason
        }
      });
      if (!reply.ok) throw new Error(reply.error || "Download failed.");
      state.savedCount += 1;
      state.lastSaved = reply.filename || filename;
      setStatus(`Saved image ${state.savedCount}: ${state.lastSaved}`);
      return reply;
    } catch (err) {
      setStatus(`Save failed: ${err.message || err}`);
      return { ok: false, error: String(err.message || err) };
    }
  }

  async function scanImages(reason = "scan") {
    if (state.scanning) return { ok: true, busy: true };
    state.scanning = true;
    let found = 0;
    let saved = 0;
    try {
      const images = Array.from(document.images).filter(imageLooksGenerated);
      for (const img of images) {
        found += 1;
        const result = await saveImage(img, reason);
        if (result && result.ok && !result.skipped) saved += 1;
      }
      if (!saved && reason === "manual") setStatus(`Checked ${found} image(s). No new image to save.`);
      return { ok: true, found, saved };
    } finally {
      state.scanning = false;
      updatePanel();
    }
  }

  let scanTimer = null;
  function scheduleScan(delay = 1200) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      if (state.options.autoSave) scanImages("auto").catch((err) => setStatus(`Scan failed: ${err.message || err}`));
    }, delay);
  }

  function startObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(() => scheduleScan(1800));
    state.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    setInterval(() => {
      if (state.options.autoSave) scheduleScan(100);
    }, 7000);
  }

  function setStatus(text) {
    state.status = text;
    updatePanel();
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="aria-img-head">
        <strong>ARIA Image Saver</strong>
        <button type="button" data-act="hide">x</button>
      </div>
      <div class="aria-img-note">Serverless. Saves to browser Downloads / Basit Social Media.</div>
      <textarea data-field="prompt" placeholder="Image prompt..."></textarea>
      <input data-field="folder" placeholder="Downloads subfolder" />
      <input data-field="prefix" placeholder="filename prefix" />
      <div class="aria-img-row">
        <button type="button" data-act="generate">Generate image</button>
        <button type="button" data-act="save">Save visible</button>
      </div>
      <div class="aria-img-row">
        <button type="button" data-act="toggle">Auto-save ON</button>
        <button type="button" data-act="downloads">Open Downloads</button>
      </div>
      <div class="aria-img-status"></div>
    `;
    const style = document.createElement("style");
    style.textContent = `
      #${PANEL_ID} {
        position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
        width: 330px; max-width: calc(100vw - 28px);
        background: #101423; color: #f8fafc; border: 2px solid #10b981;
        border-radius: 12px; box-shadow: 0 12px 38px rgba(0,0,0,.35);
        font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; overflow: hidden;
      }
      #${PANEL_ID}.aria-hidden { display: none; }
      #${PANEL_ID} .aria-img-head { cursor: move; display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.12); }
      #${PANEL_ID} .aria-img-head strong { color:#86efac; font-size:15px; }
      #${PANEL_ID} button { border:0; border-radius:8px; padding:9px 10px; font-weight:700; cursor:pointer; background:#22c55e; color:white; }
      #${PANEL_ID} button[data-act="hide"] { background:transparent; color:#fff; padding:0 4px; font-size:18px; }
      #${PANEL_ID} button[data-act="save"], #${PANEL_ID} button[data-act="toggle"] { background:#4f46e5; }
      #${PANEL_ID} button[data-act="downloads"] { background:#f97316; }
      #${PANEL_ID} textarea, #${PANEL_ID} input { width:calc(100% - 28px); margin:10px 14px 0; box-sizing:border-box; background:#090d1a; color:#f8fafc; border:1px solid rgba(255,255,255,.22); border-radius:8px; padding:10px; outline:none; }
      #${PANEL_ID} textarea { min-height:76px; resize:vertical; }
      #${PANEL_ID} .aria-img-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 14px 0; }
      #${PANEL_ID} .aria-img-note { color:#fde68a; padding:10px 14px 0; font-size:12px; }
      #${PANEL_ID} .aria-img-status { margin:12px 14px 14px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:10px; min-height:38px; white-space:pre-wrap; }
    `;
    document.documentElement.appendChild(style);
    document.body.appendChild(panel);
    wirePanel(panel);
    updatePanel();
  }

  function wirePanel(panel) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    const head = panel.querySelector(".aria-img-head");
    head.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startRight = parseFloat(panel.style.right || "18") || 18;
      startBottom = parseFloat(panel.style.bottom || "18") || 18;
      head.setPointerCapture(event.pointerId);
    });
    head.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      panel.style.right = `${Math.max(0, startRight - (event.clientX - startX))}px`;
      panel.style.bottom = `${Math.max(0, startBottom - (event.clientY - startY))}px`;
    });
    head.addEventListener("pointerup", () => { dragging = false; });

    panel.addEventListener("click", async (event) => {
      const action = event.target && event.target.dataset ? event.target.dataset.act : "";
      if (!action) return;
      if (action === "hide") {
        panel.classList.add("aria-hidden");
        return;
      }
      await syncOptionsFromPanel();
      if (action === "generate") {
        await generateImage(panel.querySelector("[data-field='prompt']").value);
      } else if (action === "save") {
        await scanImages("manual");
      } else if (action === "toggle") {
        await saveOptions({ autoSave: !state.options.autoSave });
        setStatus(`Auto-save ${state.options.autoSave ? "ON" : "OFF"}.`);
      } else if (action === "downloads") {
        await sendMessage({ type: "ARIA_IMAGE_SHOW_DOWNLOADS" });
      }
    });

    panel.addEventListener("change", syncOptionsFromPanel);
  }

  async function syncOptionsFromPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    await saveOptions({
      folderName: panel.querySelector("[data-field='folder']").value,
      filenamePrefix: panel.querySelector("[data-field='prefix']").value
    });
  }

  function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const folder = panel.querySelector("[data-field='folder']");
    const prefix = panel.querySelector("[data-field='prefix']");
    const toggle = panel.querySelector("[data-act='toggle']");
    const status = panel.querySelector(".aria-img-status");
    if (folder && document.activeElement !== folder) folder.value = state.options.folderName || DEFAULTS.folderName;
    if (prefix && document.activeElement !== prefix) prefix.value = state.options.filenamePrefix || DEFAULTS.filenamePrefix;
    if (toggle) toggle.textContent = `Auto-save ${state.options.autoSave ? "ON" : "OFF"}`;
    if (status) status.textContent = `${state.status}\nSaved this page: ${state.savedCount}`;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return false;
    if (message.type === "ARIA_IMAGE_STATUS") {
      sendResponse({ ok: true, status: state.status, savedCount: state.savedCount, options: state.options, page: location.href });
      return true;
    }
    if (message.type === "ARIA_IMAGE_OPTIONS") {
      saveOptions(message.options || {}).then(() => sendResponse({ ok: true, options: state.options }));
      return true;
    }
    if (message.type === "ARIA_IMAGE_GENERATE") {
      generateImage(message.prompt || "").then(sendResponse);
      return true;
    }
    if (message.type === "ARIA_IMAGE_SAVE_VISIBLE") {
      scanImages("manual").then(sendResponse);
      return true;
    }
    if (message.type === "ARIA_IMAGE_SHOW_PANEL") {
      createPanel();
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.classList.remove("aria-hidden");
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  loadState().then(() => {
    createPanel();
    startObserver();
    scheduleScan(2500);
  });
})();
