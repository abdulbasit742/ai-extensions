(function () {
  "use strict";

  if (window.__ARIA_VIDEO_CAPTURE_ACTIVE__) {
    window.dispatchEvent(new Event("aria-video-show"));
    return;
  }
  window.__ARIA_VIDEO_CAPTURE_ACTIVE__ = true;

  const CONFIG = window.ARIA_VIDEO_CONFIG || {};
  const SERVER_BASES = CONFIG.serverBases || ["http://127.0.0.1:5050", "http://localhost:5050"];
  const PANEL_ID = "aria-video-capture-panel";
  const QUEUE_KEY = "aria_video_capture_queue_v2";
  const VERSION = "1.3.1";
  let serverBase = localStorage.getItem("aria_video_server") || SERVER_BASES[0];
  let detected = null;
  let lastStatus = "Ready.";
  let queueBusy = false;

  function platformName() {
    const host = location.hostname.replace(/^www\./, "");
    if (host.includes("kling")) return "Kling";
    if (host.includes("runway")) return "Runway";
    if (host.includes("heygen")) return "HeyGen";
    if (host.includes("notebooklm")) return "NotebookLM";
    if (host.includes("chatgpt")) return "ChatGPT";
    return host || "current site";
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function safeFileName(value, extension) {
    const base = String(value || platformName() || "aria_video")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "aria_video";
    return `${base}_${Date.now()}${extension || ".webm"}`;
  }

  function browserDownload(target, filename) {
    try {
      const url = target instanceof Blob ? URL.createObjectURL(target) : String(target || "");
      if (!url) return false;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || safeFileName(document.title, ".webm");
      link.style.display = "none";
      document.documentElement.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          link.remove();
          if (target instanceof Blob) URL.revokeObjectURL(url);
        } catch (err) {
          // Best-effort cleanup only.
        }
      }, 5000);
      return true;
    } catch (err) {
      setStatus("Browser download could not start: " + err.message);
      return false;
    }
  }

  async function api(path, body) {
    const bases = [serverBase, ...SERVER_BASES.filter((item) => item !== serverBase)];
    let lastError = null;
    for (const base of bases) {
      try {
        const response = await fetch(base + path, {
          method: body ? "POST" : "GET",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.message || data.last_message || response.statusText);
        }
        serverBase = base;
        localStorage.setItem("aria_video_server", base);
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("ARIA server not reachable");
  }

  async function apiForm(path, formData) {
    const bases = [serverBase, ...SERVER_BASES.filter((item) => item !== serverBase)];
    let lastError = null;
    for (const base of bases) {
      try {
        const response = await fetch(base + path, {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.message || data.last_message || response.statusText);
        }
        serverBase = base;
        localStorage.setItem("aria_video_server", base);
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("ARIA server not reachable");
  }

  function setStatus(message) {
    lastStatus = String(message || "");
    const node = document.querySelector("#aria-video-status");
    if (node) node.textContent = lastStatus;
  }

  function setDetails(message) {
    const details = document.querySelector("#aria-video-details");
    if (details) details.textContent = message || "";
  }

  function permissionConfirmed() {
    const node = document.querySelector("#aria-video-permission");
    const value = node ? node.checked : localStorage.getItem("aria_video_permission") === "yes";
    localStorage.setItem("aria_video_permission", value ? "yes" : "no");
    return value;
  }

  function autoUploadEnabled() {
    const node = document.querySelector("#aria-video-auto-upload");
    const value = node ? node.checked : localStorage.getItem("aria_video_auto_upload") !== "no";
    localStorage.setItem("aria_video_auto_upload", value ? "yes" : "no");
    return value;
  }

  function toneValue() {
    return document.querySelector("#aria-video-tone")?.value || localStorage.getItem("aria_video_tone") || "friendly";
  }

  function extraValue() {
    return document.querySelector("#aria-video-extra")?.value || localStorage.getItem("aria_video_extra") || "";
  }

  function rememberInputs() {
    localStorage.setItem("aria_video_tone", toneValue());
    localStorage.setItem("aria_video_extra", extraValue());
    localStorage.setItem("aria_video_auto_upload", autoUploadEnabled() ? "yes" : "no");
    localStorage.setItem("aria_video_permission", permissionConfirmed() ? "yes" : "no");
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (document.getElementById(PANEL_ID)?.contains(el)) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 12 && rect.height > 12 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < innerHeight && rect.left < innerWidth && style.visibility !== "hidden" && style.display !== "none";
  }

  function isDirectVideoSource(source) {
    const value = String(source || "").toLowerCase();
    if (!/^https?:\/\//i.test(value)) return false;
    if (value.includes("blob:") || value.includes(".m3u8") || value.includes("manifest")) return false;
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(value) || value.includes("video");
  }

  async function maybeAutoPrepareSocial(data) {
    renderDetails(data);
    if (!autoUploadEnabled()) return;
    setStatus((data.last_message || "Video ready.") + " Auto social pipeline starting...");
    await prepareSocialVideo();
  }

  function getVideos() {
    return Array.from(document.querySelectorAll("video")).map((video, index) => {
      const source = video.currentSrc || video.src || Array.from(video.querySelectorAll("source")).map((item) => item.src).find(Boolean) || "";
      const rect = video.getBoundingClientRect();
      return {
        index,
        source,
        duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0,
        width: Math.round(rect.width || video.videoWidth || 0),
        height: Math.round(rect.height || video.videoHeight || 0),
        visible: isVisible(video),
        element: video
      };
    }).filter((item) => item.source);
  }

  function detectVideo() {
    const videos = getVideos();
    videos.sort((a, b) => Number(b.visible) - Number(a.visible) || (b.width * b.height) - (a.width * a.height));
    detected = videos[0] || null;
    renderDetails();
    if (!detected) {
      setStatus("No video tag found. Use official Download if available, or queue visible cards from a gallery page.");
      return null;
    }
    if (!isDirectVideoSource(detected.source)) {
      setStatus("Streaming/blob video detected. ARIA will try official Download button, then import from Downloads.");
    } else {
      setStatus(`Detected ${platformName()} video: ${detected.width}x${detected.height}, ${detected.duration || "?"}s.`);
    }
    return detected;
  }

  async function saveDirectSource(source, title, pageUrl) {
    return api("/api/video-pipeline/save-url", {
      video_url: source,
      page_url: pageUrl || location.href,
      title: title || document.title || platformName(),
      permission_confirmed: true
    });
  }

  function findOfficialDownloadButton(skipEl) {
    const candidates = Array.from(document.querySelectorAll("button, a, [role='button'], [aria-label], [title]"));
    const downloadWords = ["download", "export", "save video", "save", "download video"];
    const blockedWords = ["sign in", "login", "subscribe", "pricing", "delete"];
    for (const el of candidates) {
      if (skipEl && el === skipEl) continue;
      if (!isVisible(el)) continue;
      const label = [
        el.innerText,
        el.textContent,
        el.getAttribute("aria-label"),
        el.getAttribute("title"),
        el.getAttribute("data-testid"),
        el.className
      ].join(" ").toLowerCase();
      if (!label.trim()) continue;
      if (blockedWords.some((word) => label.includes(word))) continue;
      if (downloadWords.some((word) => label.includes(word))) return el;
    }
    return null;
  }

  async function importLatestSince(afterTimestamp, quiet) {
    const data = await api("/api/video-pipeline/import-latest", {
      after_timestamp: afterTimestamp || 0
    });
    if (!quiet) {
      setStatus(data.last_message || "Imported latest video.");
      await maybeAutoPrepareSocial(data);
    }
    return data;
  }

  async function tryOfficialDownloadImport() {
    const button = findOfficialDownloadButton();
    if (!button) {
      return { ok: false, message: "No visible official Download/Export button found." };
    }
    const afterTimestamp = Math.floor(Date.now() / 1000) - 2;
    setStatus("Official Download button found. Clicking it, then waiting for Downloads folder...");
    button.click();
    await sleep(800);
    const menuButton = findOfficialDownloadButton(button);
    if (menuButton) {
      setStatus("Download menu option found. Clicking final Download/Export option...");
      menuButton.click();
    }
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await sleep(2500);
      try {
        const data = await importLatestSince(afterTimestamp, true);
        if (data && data.last_video) {
          setStatus(data.last_message || "Official download imported.");
          renderDetails(data);
          return { ok: true, data };
        }
      } catch (err) {
        setStatus(`Waiting for official download... ${attempt}/12`);
      }
    }
    return { ok: false, message: "Official download did not finish in Downloads folder yet." };
  }

  async function recordCurrentVideo() {
    const item = detected || detectVideo();
    const video = item?.element;
    if (!video) return { ok: false, message: "No video player found to record." };
    if (!window.MediaRecorder) return { ok: false, message: "This browser does not support MediaRecorder." };
    const capture = video.captureStream || video.mozCaptureStream;
    if (!capture) return { ok: false, message: "This video player does not allow visible-player recording." };

    setStatus("Recording visible video player into a local file. Keep this tab open...");
    const stream = capture.call(video);
    if (!stream || !stream.getTracks().length) {
      return { ok: false, message: "Video stream could not be captured from the player." };
    }
    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    const mimeType = mimeCandidates.find((item) => MediaRecorder.isTypeSupported(item)) || "";
    const chunks = [];
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      return { ok: false, message: "Recorder start failed: " + err.message };
    }

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch (err) {
          resolve({ ok: false, message: "Recorder stop failed: " + err.message });
        }
      };
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = (event) => {
        resolve({ ok: false, message: "Recorder error: " + (event.error?.message || "unknown") });
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          if (blob.size < 1024) {
            resolve({ ok: false, message: "Recorded video was empty." });
            return;
          }
          const filename = safeFileName(document.title || platformName(), ".webm");
          const downloadStarted = browserDownload(blob, filename);
          const form = new FormData();
          form.append("video", blob, filename);
          form.append("filename", filename);
          form.append("content_type", blob.type || "video/webm");
          form.append("page_url", location.href);
          form.append("title", document.title || platformName());
          form.append("permission_confirmed", "true");
          setStatus(`${downloadStarted ? "Browser download started. " : ""}Uploading recorded video (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB) to D drive...`);
          const data = await apiForm("/api/video-pipeline/upload", form);
          setStatus(data.last_message || "Recorded video saved.");
          renderDetails(data);
          resolve({ ok: true, data, method: "record" });
        } catch (err) {
          resolve({ ok: false, message: "Recorded upload failed: " + err.message });
        }
      };

      const maxSeconds = Number.isFinite(video.duration) && video.duration > 1
        ? Math.min(Math.ceil(video.duration) + 2, 180)
        : 45;
      try {
        recorder.start(1000);
        try {
          video.currentTime = 0;
        } catch (err) {
          // Some players do not allow seeking. Recording continues from the visible point.
        }
        video.play().catch(() => {});
        video.addEventListener("ended", finish, { once: true });
        setTimeout(finish, maxSeconds * 1000);
      } catch (err) {
        resolve({ ok: false, message: "Recorder could not start: " + err.message });
      }
    });
  }

  async function saveCurrentWithFallback(options = {}) {
    rememberInputs();
    const queueMode = Boolean(options.queueMode);
    const autoPrepare = options.autoPrepare !== false;
    if (!permissionConfirmed()) {
      const message = "Tick permission first. Save only your own/generated/allowed video.";
      setStatus(message);
      return { ok: false, message };
    }

    const item = detectVideo();
    if (item && isDirectVideoSource(item.source)) {
      try {
        setStatus("Saving direct video to ARIA D-drive folder...");
        const data = await saveDirectSource(item.source, document.title || platformName(), location.href);
        setStatus(data.last_message || "Video saved.");
        if (autoPrepare && !queueMode) await maybeAutoPrepareSocial(data);
        return { ok: true, data, method: "direct" };
      } catch (err) {
        setStatus("Direct save failed, trying official download: " + err.message);
      }
    }

    const official = await tryOfficialDownloadImport();
    if (official.ok) {
      if (autoPrepare && !queueMode) await maybeAutoPrepareSocial(official.data);
      return { ok: true, data: official.data, method: "official" };
    }

    setStatus("No official download found. Recording visible video player as fallback...");
    const recorded = await recordCurrentVideo();
    if (recorded.ok) {
      if (autoPrepare && !queueMode) await maybeAutoPrepareSocial(recorded.data);
      return recorded;
    }

    const message = recorded.message || official.message || "No direct video or official download found.";
    setStatus(message);
    return { ok: false, message };
  }

  async function saveDetectedVideo() {
    await saveCurrentWithFallback({ queueMode: false, autoPrepare: true });
  }

  async function importLatest() {
    rememberInputs();
    if (!permissionConfirmed()) {
      setStatus("Tick permission first. Import only videos you own or can reuse.");
      return;
    }
    setStatus("Importing latest video from Downloads/Videos...");
    try {
      const data = await importLatestSince(0, false);
      await maybeAutoPrepareSocial(data);
    } catch (err) {
      setStatus("Import failed: " + err.message);
    }
  }

  async function prepareSocialVideo() {
    rememberInputs();
    setStatus("Preparing captions and social tabs...");
    try {
      const data = await api("/api/video-pipeline/prepare-social", {
        platforms: ["facebook", "instagram", "linkedin", "x"],
        tone: toneValue(),
        extra: extraValue(),
        open_tabs: true,
        auto_post: true
      });
      setStatus(data.last_message || "Social video drafts ready.");
      renderDetails(data);
    } catch (err) {
      setStatus("Prepare failed: " + err.message);
    }
  }

  async function openFolder() {
    try {
      const data = await api("/api/video-pipeline/open-folder", {});
      setStatus(data.last_message || "Folder opened.");
    } catch (err) {
      setStatus("Open folder failed: " + err.message);
    }
  }

  function visibleVideoPageLinks() {
    const seen = new Set();
    const links = [];
    const current = location.href.split("#")[0];
    const good = /(video|short|ai-shorts|asset|creation|generate|work|project|detail|watch)/i;
    const bad = /(login|signup|pricing|settings|account|notification|search|profile|api|help|billing)/i;
    Array.from(document.querySelectorAll("a[href]")).forEach((anchor) => {
      if (!isVisible(anchor)) return;
      let href = "";
      try {
        href = new URL(anchor.getAttribute("href"), location.href).href.split("#")[0];
      } catch (err) {
        return;
      }
      if (!href.startsWith(location.origin)) return;
      if (href === current || seen.has(href)) return;
      if (bad.test(href)) return;
      const text = `${href} ${anchor.textContent || ""} ${anchor.getAttribute("aria-label") || ""}`;
      if (!good.test(text)) return;
      seen.add(href);
      links.push(href);
    });
    const html = document.documentElement.innerHTML || "";
    const pathMatches = html.match(/(?:https?:\/\/[^"'\\\s<>]+)?\/app\/(?:ai-video|ai-shorts-video)\/[^"'\\\s<>]+/gi) || [];
    pathMatches.forEach((raw) => {
      try {
        const href = new URL(raw.replace(/&amp;/g, "&"), location.origin).href.split("#")[0];
        if (!href.startsWith(location.origin) || href === current || seen.has(href) || bad.test(href)) return;
        seen.add(href);
        links.push(href);
      } catch (err) {
        // Ignore malformed app-state URL fragments.
      }
    });
    return links.slice(0, 40);
  }

  function readQueue() {
    try {
      const data = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "null");
      return data && Array.isArray(data.urls) ? data : null;
    } catch (err) {
      return null;
    }
  }

  function writeQueue(queue) {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function clearQueue() {
    sessionStorage.removeItem(QUEUE_KEY);
  }

  async function saveAllVisibleVideos() {
    rememberInputs();
    if (!permissionConfirmed()) {
      setStatus("Tick permission first. Save only your own/generated/allowed videos.");
      return { ok: false, error: "permission required" };
    }

    const directVideos = getVideos().filter((item) => item.visible && isDirectVideoSource(item.source));
    if (directVideos.length > 1) {
      setStatus(`Saving ${directVideos.length} direct visible videos one by one...`);
      let saved = 0;
      for (const item of directVideos) {
        try {
          await saveDirectSource(item.source, `${document.title || platformName()}_${item.index + 1}`, location.href);
          saved += 1;
          setStatus(`Saved ${saved}/${directVideos.length} visible videos...`);
          await sleep(900);
        } catch (err) {
          setStatus(`One video failed, continuing: ${err.message}`);
        }
      }
      if (saved && autoUploadEnabled()) await prepareSocialVideo();
      return { ok: true, message: `Saved ${saved}/${directVideos.length} visible direct videos.` };
    }

    const urls = visibleVideoPageLinks();
    if (!urls.length) {
      const single = await saveCurrentWithFallback({ queueMode: false, autoPrepare: true });
      return single.ok ? { ok: true, message: "Current video saved." } : { ok: false, error: single.message };
    }

    const queue = {
      urls,
      index: 0,
      saved: [],
      failed: [],
      returnUrl: location.href,
      startedAt: Date.now(),
      autoUpload: autoUploadEnabled(),
      tone: toneValue(),
      extra: extraValue()
    };
    writeQueue(queue);
    setStatus(`Queue ready: ${urls.length} pages. Opening first video page...`);
    await sleep(900);
    location.href = urls[0];
    return { ok: true, message: `Queued ${urls.length} visible video pages.` };
  }

  async function processQueueOnLoad() {
    if (queueBusy) return;
    const queue = readQueue();
    if (!queue || queue.index >= queue.urls.length) return;
    queueBusy = true;
    injectPanel();
    const permissionNode = document.querySelector("#aria-video-permission");
    if (permissionNode) permissionNode.checked = true;
    const autoNode = document.querySelector("#aria-video-auto-upload");
    if (autoNode) autoNode.checked = Boolean(queue.autoUpload);
    const toneNode = document.querySelector("#aria-video-tone");
    if (toneNode) toneNode.value = queue.tone || "friendly";
    const extraNode = document.querySelector("#aria-video-extra");
    if (extraNode) extraNode.value = queue.extra || "";

    setStatus(`Queue ${queue.index + 1}/${queue.urls.length}: saving this page...`);
    await sleep(1800);
    const result = await saveCurrentWithFallback({ queueMode: true, autoPrepare: false });
    if (result.ok && result.data?.last_video) {
      queue.saved.push(result.data.last_video);
      setStatus(`Saved ${queue.saved.length}; moving to next page...`);
    } else {
      queue.failed.push({ url: location.href, message: result.message || "save failed" });
      setStatus(`This page failed; moving next. Reason: ${result.message || "unknown"}`);
    }
    queue.index += 1;
    writeQueue(queue);
    await sleep(1600);
    if (queue.index < queue.urls.length) {
      location.href = queue.urls[queue.index];
      return;
    }

    clearQueue();
    queueBusy = false;
    if (queue.saved.length && queue.autoUpload) {
      setStatus(`Queue complete: ${queue.saved.length} saved, ${queue.failed.length} failed. Starting batch social upload...`);
      try {
        const data = await api("/api/video-pipeline/prepare-social-batch", {
          video_paths: queue.saved,
          platforms: ["facebook", "instagram", "linkedin", "x"],
          tone: queue.tone || toneValue(),
          extra: queue.extra || extraValue(),
          open_tabs: true,
          auto_post: true
        });
        setStatus(data.last_message || "Batch social upload ready.");
        renderDetails(data);
      } catch (err) {
        setStatus("Batch social start failed: " + err.message);
      }
    } else {
      setStatus(`Queue complete: ${queue.saved.length} saved, ${queue.failed.length} failed.`);
    }
  }

  function makeDraggable(panel, handle) {
    let dragging = false;
    let dx = 0;
    let dy = 0;
    handle.addEventListener("mousedown", (event) => {
      dragging = true;
      dx = event.clientX - panel.offsetLeft;
      dy = event.clientY - panel.offsetTop;
      event.preventDefault();
    });
    window.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      panel.style.left = Math.max(8, Math.min(innerWidth - 300, event.clientX - dx)) + "px";
      panel.style.top = Math.max(8, Math.min(innerHeight - 150, event.clientY - dy)) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => { dragging = false; });
  }

  function injectPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <style>
        #${PANEL_ID} {
          position: fixed;
          right: 18px;
          bottom: 72px;
          z-index: 2147483647;
          width: 372px;
          max-height: 78vh;
          overflow: auto;
          border-radius: 14px;
          border: 1px solid #22c55e;
          background: #101324;
          color: #f4fff8;
          box-shadow: 0 18px 48px rgba(0,0,0,.36);
          font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        }
        #${PANEL_ID} .head {
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding:12px 14px; cursor:move; border-bottom:1px solid rgba(255,255,255,.12);
        }
        #${PANEL_ID} strong { color:#96f7ba; }
        #${PANEL_ID} .body { padding:12px 14px; }
        #${PANEL_ID} input, #${PANEL_ID} textarea {
          width:100%; box-sizing:border-box; border-radius:8px; border:1px solid rgba(255,255,255,.18);
          background:#070a18; color:#fff; padding:8px; margin-top:8px; font:inherit;
        }
        #${PANEL_ID} textarea { min-height:54px; resize:vertical; }
        #${PANEL_ID} button {
          border:0; border-radius:8px; padding:8px 10px; color:white; background:#158352;
          font-weight:800; cursor:pointer; margin:6px 5px 0 0;
        }
        #${PANEL_ID} button.alt { background:#5633d8; }
        #${PANEL_ID} button.warn { background:#e5672f; }
        #${PANEL_ID} .box {
          white-space:pre-wrap; margin-top:10px; padding:9px; background:#070a18;
          border:1px solid rgba(255,255,255,.12); border-radius:9px; max-height:160px; overflow:auto;
        }
        #${PANEL_ID} .small { color:#cbd5ce; font-size:12px; }
        #${PANEL_ID} label { display:flex; gap:8px; align-items:center; margin-top:8px; color:#f8f1a6; }
        #${PANEL_ID} label input { width:auto; margin:0; }
      </style>
      <div class="head">
        <strong>ARIA Video Pipeline v${esc(VERSION)}</strong>
        <button id="aria-video-close" class="warn" style="padding:4px 8px;margin:0">x</button>
      </div>
      <div class="body">
        <div class="small">Own/generated/allowed videos only. Saves to D:\\ARIA_SOCIAL_MEDIA\\Videos when D drive exists. Direct save, official download import, then visible-player recording fallback.</div>
        <label><input id="aria-video-permission" type="checkbox" /> I own/have permission to reuse this video</label>
        <label><input id="aria-video-auto-upload" type="checkbox" checked /> Auto start social upload after save/import</label>
        <input id="aria-video-tone" value="${esc(localStorage.getItem("aria_video_tone") || "friendly")}" placeholder="caption tone" />
        <textarea id="aria-video-extra" placeholder="extra caption / social instructions">${esc(localStorage.getItem("aria_video_extra") || "")}</textarea>
        <button id="aria-video-detect">Detect video</button>
        <button id="aria-video-save" class="alt">Download current + save/upload</button>
        <button id="aria-video-official" class="alt">Official download + import</button>
        <button id="aria-video-record" class="alt">Record/download visible player</button>
        <button id="aria-video-queue" class="warn">Download all visible one by one</button>
        <button id="aria-video-import" class="alt">Import latest + auto upload</button>
        <button id="aria-video-social" class="warn">Prepare social video now</button>
        <button id="aria-video-folder">Open D video folder</button>
        <div id="aria-video-status" class="box">${esc(lastStatus)}</div>
        <div id="aria-video-details" class="box"></div>
      </div>
    `;
    document.documentElement.appendChild(panel);
    makeDraggable(panel, panel.querySelector(".head"));
    const permissionNode = panel.querySelector("#aria-video-permission");
    const autoNode = panel.querySelector("#aria-video-auto-upload");
    permissionNode.checked = localStorage.getItem("aria_video_permission") === "yes";
    autoNode.checked = localStorage.getItem("aria_video_auto_upload") !== "no";
    panel.querySelector("#aria-video-close").onclick = () => panel.remove();
    panel.querySelector("#aria-video-detect").onclick = detectVideo;
    panel.querySelector("#aria-video-save").onclick = saveDetectedVideo;
    panel.querySelector("#aria-video-official").onclick = async () => {
      rememberInputs();
      if (!permissionConfirmed()) {
        setStatus("Tick permission first.");
        return;
      }
      const result = await tryOfficialDownloadImport();
      if (result.ok && autoUploadEnabled()) await prepareSocialVideo();
      else setStatus(result.message || "Official download import failed.");
    };
    panel.querySelector("#aria-video-record").onclick = async () => {
      rememberInputs();
      if (!permissionConfirmed()) {
        setStatus("Tick permission first.");
        return;
      }
      const result = await recordCurrentVideo();
      if (result.ok && autoUploadEnabled()) await prepareSocialVideo();
      else setStatus(result.message || "Recording failed.");
    };
    panel.querySelector("#aria-video-queue").onclick = saveAllVisibleVideos;
    panel.querySelector("#aria-video-import").onclick = importLatest;
    panel.querySelector("#aria-video-social").onclick = prepareSocialVideo;
    panel.querySelector("#aria-video-folder").onclick = openFolder;
    detectVideo();
  }

  function renderDetails(data) {
    const videoText = detected
      ? `Detected source:\n${detected.source}\n\nSize: ${detected.width}x${detected.height}\nDuration: ${detected.duration || "unknown"}s`
      : "No video detected yet.";
    const stateText = data
      ? `\n\nARIA folder:\n${data.video_folder || ""}\nLast video:\n${data.last_video || ""}`
      : "";
    const queue = readQueue();
    const queueText = queue ? `\n\nQueue: ${queue.index + 1}/${queue.urls.length} | saved ${queue.saved.length} | failed ${queue.failed.length}` : "";
    setDetails(`Site: ${platformName()}\nExtension: v${VERSION}\n\n${videoText}${stateText}${queueText}`);
  }

  chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    (async () => {
      if (!message) return { ok: false, error: "No message." };
      if (message.type === "ARIA_VIDEO_SHOW") {
        injectPanel();
        return { ok: true, message: "Panel ready." };
      }
      if (message.type === "ARIA_VIDEO_SAVE_CURRENT") {
        injectPanel();
        const box = document.querySelector("#aria-video-permission");
        if (box) box.checked = true;
        const result = await saveCurrentWithFallback({ queueMode: false, autoPrepare: true });
        return result.ok ? { ok: true, message: "Current video save attempted." } : { ok: false, error: result.message };
      }
      if (message.type === "ARIA_VIDEO_RECORD_CURRENT") {
        injectPanel();
        const box = document.querySelector("#aria-video-permission");
        if (box) box.checked = true;
        const result = await recordCurrentVideo();
        if (result.ok && autoUploadEnabled()) await prepareSocialVideo();
        return result.ok ? { ok: true, message: "Current player recorded." } : { ok: false, error: result.message };
      }
      if (message.type === "ARIA_VIDEO_QUEUE_VISIBLE") {
        injectPanel();
        const box = document.querySelector("#aria-video-permission");
        if (box) box.checked = true;
        const result = await saveAllVisibleVideos();
        return result.ok ? { ok: true, message: result.message || "Queue started." } : { ok: false, error: result.error || "Queue failed." };
      }
      return { ok: false, error: "Unknown message." };
    })().then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  });

  window.addEventListener("aria-video-show", injectPanel);
  setTimeout(injectPanel, 1200);
  setTimeout(processQueueOnLoad, 2500);
})();
