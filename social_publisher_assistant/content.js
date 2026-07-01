(function () {
  "use strict";

  if (window.__ARIA_SOCIAL_PUBLISHER_ACTIVE__) {
    window.dispatchEvent(new Event("aria-social-refresh-request"));
    return;
  }
  window.__ARIA_SOCIAL_PUBLISHER_ACTIVE__ = true;

  const CONFIG = window.ARIA_SOCIAL_CONFIG || {};
  const SERVER_BASES = CONFIG.serverBases || ["http://127.0.0.1:5050", "http://localhost:5050"];
  const EXTENSION_VERSION = "1.4.7";
  const PANEL_ID = "aria-social-publisher-panel";
  const CAMPAIGN_DONE_PREFIX = "aria_social_campaign_done:";
  let serverBase = localStorage.getItem("aria_social_server") || SERVER_BASES[0];
  let state = {};
  let campaignBusy = false;
  let lastStatusMessage = "Loaded.";
  let heartbeatTimer = 0;

  function platform() {
    if (location.hostname.includes("instagram")) return "instagram";
    if (location.hostname.includes("linkedin")) return "linkedin";
    if (location.hostname.includes("x.com") || location.hostname.includes("twitter")) return "x";
    return "facebook";
  }

  function activeDialog() {
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'], .artdeco-modal"));
    return dialogs
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter((item) => item.rect.width > 120 && item.rect.height > 120 && item.rect.bottom > 0 && item.rect.top < innerHeight)
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0]?.node || document;
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

  async function api(path, options = {}) {
    const bases = [serverBase, ...SERVER_BASES.filter((item) => item !== serverBase)];
    let lastError = null;
    for (const base of bases) {
      try {
        const response = await fetch(base + path, {
          ...options,
          headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.message || data.error || response.statusText);
        }
        serverBase = base;
        localStorage.setItem("aria_social_server", base);
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("ARIA server not reachable");
  }

  async function hasAutomationPermission(action) {
    try {
      const safety = await api("/api/automation-safety/state");
      if (!safety.permission_active) {
        setStatus(`${action} blocked: dashboard permission is OFF.`);
        return false;
      }
      return true;
    } catch (err) {
      setStatus(`${action} blocked: safety server check failed.`);
      return false;
    }
  }

  function setStatus(message) {
    lastStatusMessage = String(message || "");
    const node = document.querySelector("#aria-social-status");
    if (node) node.textContent = message;
    queueHeartbeat("status");
  }

  function queueHeartbeat(reason) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => reportExtensionStatus(reason), 700);
  }

  async function reportExtensionStatus(reason) {
    const payload = {
      platform: platform(),
      url: location.href,
      title: document.title,
      status: lastStatusMessage,
      reason: reason || "heartbeat",
      version: EXTENSION_VERSION,
      visible: !document.hidden,
      panel: Boolean(document.getElementById(PANEL_ID))
    };
    const bases = [serverBase, ...SERVER_BASES.filter((item) => item !== serverBase)];
    for (const base of bases) {
      try {
        const response = await fetch(base + "/api/social/extension-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(response.statusText);
        serverBase = base;
        localStorage.setItem("aria_social_server", base);
        return true;
      } catch (err) {
        // Try the next configured server base.
      }
    }
    return false;
  }

  function bestCaptionTarget() {
    const selectors = [
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "textarea",
      "[aria-label*='caption' i]",
      "[aria-label*='write' i]",
      "[aria-label*='post' i]"
    ];
    const candidates = [];
    const roots = [activeDialog(), document];
    for (const root of roots) {
      for (const selector of selectors) {
        root.querySelectorAll(selector).forEach((node) => {
        const isTextBox = node.isContentEditable || node.tagName === "TEXTAREA" || node.getAttribute("role") === "textbox";
        if (!isTextBox) return;
        const rect = node.getBoundingClientRect();
        const visible = rect.width > 80 && rect.height > 20 && rect.bottom > 0 && rect.top < innerHeight;
        if (!visible) return;
        const label = [
          node.getAttribute("aria-label"),
          node.getAttribute("placeholder"),
          node.getAttribute("data-testid"),
          node.textContent
        ].filter(Boolean).join(" ").toLowerCase();
        if (label.includes("search") || label.includes("comment") || label.includes("reply")) return;
        let score = rect.width * rect.height + rect.top;
        if (/what'?s on your mind|caption|write|create post|post text|add a caption|share your thoughts|what do you want to talk about|what is happening|tweet text/i.test(label)) {
          score += 1000000;
        }
        if (node.closest("[role='dialog'], .artdeco-modal")) score += 500000;
        if (rect.top > innerHeight * 0.35) score += 50000;
        candidates.push({ node, score });
      });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] ? candidates[0].node : null;
  }

  function bestReplyTarget() {
    const selectors = [
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "textarea"
    ];
    const candidates = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const rect = node.getBoundingClientRect();
        const visible = rect.width > 80 && rect.height > 20 && rect.bottom > 0 && rect.top < innerHeight;
        if (!visible) return;
        const label = [
          node.getAttribute("aria-label"),
          node.getAttribute("placeholder"),
          node.textContent
        ].filter(Boolean).join(" ").toLowerCase();
        if (label.includes("search")) return;
        let score = rect.width * rect.height + rect.top;
        if (/comment|reply|write a reply|post your reply|add a comment/i.test(label)) score += 1000000;
        if (node.closest("[role='dialog'], .artdeco-modal")) score += 500000;
        candidates.push({ node, score });
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] ? candidates[0].node : null;
  }

  function setElementText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
      if (descriptor && descriptor.set) descriptor.set.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }

  function textMatches(value, needles) {
    const text = String(value || "").trim().toLowerCase();
    return needles.some((needle) => text === needle || text.includes(needle));
  }

  function visibleClickableElements() {
    return Array.from(document.querySelectorAll("button, [role='button'], a, input[type='button'], input[type='submit'], div[tabindex], span[role='button']"))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 12 && rect.height > 12 && rect.bottom > 0 && rect.top < innerHeight && style.visibility !== "hidden" && style.display !== "none";
      });
  }

  function clickByText(needles) {
    const items = visibleClickableElements();
    for (const node of items) {
      const label = [
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.innerText,
        node.textContent,
        node.value
      ].filter(Boolean).join(" ");
      if (textMatches(label, needles)) {
        node.click();
        return true;
      }
    }
    return false;
  }

  function clickUploadControl() {
    const fileInput = document.querySelector("input[type='file']");
    if (fileInput) {
      fileInput.click();
      return true;
    }
    if (platform() === "instagram") {
      return clickByText(["create", "new post", "select from computer", "select from device", "upload"]);
    }
    if (platform() === "linkedin") {
      return clickByText(["add media", "media", "add a photo", "photo", "image", "upload"]);
    }
    if (platform() === "x") {
      return clickByText(["add photos or video", "media", "add photo", "photo", "image", "upload"]);
    }
    return clickByText(["photo/video", "photo", "add photos", "add photo", "photo or video", "upload"]);
  }

  function findFileInput() {
    const inputs = Array.from(document.querySelectorAll("input[type='file']"));
    if (!inputs.length) return null;
    inputs.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const as = (ar.width * ar.height) + (a.closest("[role='dialog'], .artdeco-modal") ? 100000 : 0);
      const bs = (br.width * br.height) + (b.closest("[role='dialog'], .artdeco-modal") ? 100000 : 0);
      return bs - as;
    });
    return inputs[0];
  }

  function fileNameFromPath(path) {
    return String(path || "aria-social-image.png").split(/[\\/]/).pop() || "aria-social-image.png";
  }

  function mimeFromPath(path) {
    const lower = String(path || "").toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".m4v")) return "video/x-m4v";
    return "image/png";
  }

  async function fetchImageFile(path) {
    const url = serverBase + "/api/social/image-file?path=" + encodeURIComponent(path || "");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Image fetch failed: " + response.status);
    const blob = await response.blob();
    return new File([blob], fileNameFromPath(path), { type: blob.type || mimeFromPath(path) });
  }

  async function uploadViaFileInput() {
    const imagePath = state.last_image || "";
    if (!imagePath) return false;
    let fileInput = findFileInput();
    if (!fileInput) return false;
    const file = await fetchImageFile(imagePath);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    setStatus("Media attached directly from ARIA folder. Waiting for preview...");
    return true;
  }

  function clickPublishOnce() {
    if (platform() === "instagram") {
      return clickByText(["next", "share", "post", "publish"]);
    }
    if (platform() === "linkedin") {
      return clickByText(["post"]);
    }
    if (platform() === "x") {
      return clickByText(["post", "reply"]);
    }
    return clickByText(["post", "share", "publish"]);
  }

  async function ensureComposerOpen() {
    if (bestCaptionTarget()) return true;
    let opened = false;
    if (platform() === "instagram") {
      opened = clickByText(["create", "new post", "select from computer", "select from device"]);
    } else if (platform() === "linkedin") {
      opened = clickByText(["start a post", "create a post", "share a post"]);
      if (!opened) opened = clickByText(["create"]);
      await sleep(900);
      if (!bestCaptionTarget()) clickByText(["post"]);
    } else if (platform() === "x") {
      opened = clickByText(["post", "what is happening", "compose"]);
      await sleep(900);
    } else {
      opened = clickByText([
        "what's on your mind",
        "whats on your mind",
        "create post",
        "write something",
        "photo/video",
        "photo or video"
      ]);
    }
    if (opened) await sleep(1300);
    return opened || !!bestCaptionTarget() || !!document.querySelector("input[type='file']");
  }

  async function desktopSelectImage() {
    setStatus("Opening desktop file picker helper...");
    return api("/api/social/desktop-select-image", {
      method: "POST",
      body: JSON.stringify({ wait_seconds: 1.1 })
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function copyCaption() {
    const caption = state.last_caption || "";
    if (!caption) {
      setStatus("No caption yet. Click Prepare first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(caption);
      setStatus("Caption copied.");
    } catch (err) {
      setStatus("Copy failed: " + err.message);
    }
  }

  async function fillCaption() {
    const caption = state.last_caption || "";
    if (!caption) {
      setStatus("No caption yet. Click Prepare first.");
      return false;
    }
    await ensureComposerOpen();
    const target = bestCaptionTarget();
    if (!target) {
      setStatus("Caption box not found. Open the social compose box first, then click Fill caption.");
      return false;
    }
    setElementText(target, caption);
    setStatus("Caption filled. Select/upload image, then review and post manually.");
    return true;
  }

  async function fillCommentDraft() {
    if (!state.last_caption) await prepare();
    const draft = state.last_caption || "Great post.";
    const target = bestReplyTarget() || bestCaptionTarget();
    if (!target) {
      setStatus("Comment/reply box not found. Open the comment/reply box first, then click Fill comment draft.");
      return;
    }
    setElementText(target, draft);
    setStatus("Comment/reply draft filled. Review it and click the public button yourself.");
  }

  function highlightEngagementActions() {
    const actionWords = [
      "like",
      "react",
      "comment",
      "reply",
      "repost",
      "retweet",
      "share",
      "send"
    ];
    let count = 0;
    visibleClickableElements().forEach((node) => {
      const label = [
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.innerText,
        node.textContent,
        node.value
      ].filter(Boolean).join(" ").toLowerCase();
      if (!actionWords.some((word) => label.includes(word))) return;
      node.style.outline = "3px solid #18b981";
      node.style.outlineOffset = "3px";
      node.setAttribute("data-aria-social-highlight", "true");
      count += 1;
    });
    setStatus(`Highlighted ${count} possible engagement buttons. Click only the ones you want.`);
  }

  async function uploadCurrentImage() {
    await ensureComposerOpen();
    const platformCaption = state.last_caption || "";
    const platformImage = state.last_image || "";
    const platformName = state.last_platform || platform();
    try {
      const directUploaded = await uploadViaFileInput();
      if (directUploaded) {
        await sleep(2200);
        if (state.last_caption) await fillCaption();
        setStatus("Image selected directly and caption filled. Review, then publish or click Auto Post.");
        return true;
      }
    } catch (err) {
      setStatus("Direct image attach failed; trying desktop picker fallback...");
    }
    const clicked = clickUploadControl();
    if (!clicked) {
      setStatus("Image upload button not found. Open compose/create post box first.");
      return false;
    }
    try {
      await sleep(900);
      const result = await desktopSelectImage();
      state = {
        ...result,
        last_caption: platformCaption || result.last_caption || "",
        last_image: platformImage || result.last_image || "",
        last_platform: platformName || result.last_platform || platform()
      };
      render();
      setStatus("Image selected. Waiting for preview, then refilling caption...");
      await sleep(2200);
      if (state.last_caption) await fillCaption();
      setStatus("Image selected and caption filled. Review, then publish or click Auto Post.");
      return true;
    } catch (err) {
      setStatus("Auto image select failed. Image path copied; paste it in file picker manually.");
      return false;
    }
  }

  async function autoPublish() {
    setStatus("Auto Post started...");
    try {
      if (!(await hasAutomationPermission("Auto Post"))) return;
      if (!state.last_caption) {
        await prepare();
      }
      await ensureComposerOpen();
      await fillCaption();
      await sleep(900);
      const uploaded = await uploadCurrentImage();
      if (!uploaded) return;
      setStatus("Waiting for image preview before publishing...");
      await sleep(platform() === "instagram" ? 4500 : platform() === "x" ? 2600 : 3500);
      let clicked = clickPublishOnce();
      if (platform() === "instagram") {
        await sleep(1600);
        clicked = clickPublishOnce() || clicked;
        await sleep(1600);
        clicked = clickPublishOnce() || clicked;
      } else if (platform() === "linkedin") {
        await sleep(1400);
        clicked = clickPublishOnce() || clicked;
      } else if (platform() === "x") {
        await sleep(1200);
        clicked = clickPublishOnce() || clicked;
      }
      if (!clicked) {
        setStatus("Post/Share button not found. Review the draft and click Post manually.");
        return;
      }
      await api("/api/social-campaign/platform-posted", {
        method: "POST",
        body: JSON.stringify({ platform: platform(), media_path: state.last_image || "" })
      }).catch(() => null);
      await api("/api/social/mark-posted", {
        method: "POST",
        body: JSON.stringify({ image_path: state.last_image || "" })
      }).catch(() => null);
      setStatus("Auto Post clicked. Check page confirmation.");
    } catch (err) {
      setStatus("Auto Post failed: " + err.message);
    }
  }

  async function refresh() {
    try {
      state = await api("/api/social/state");
      render();
    } catch (err) {
      setStatus("ARIA server not reachable: " + err.message);
    }
  }

  function campaignKey(campaign, item) {
    return [
      campaign.job_id || campaign.started_at || "campaign",
      platform(),
      item && item.image ? item.image : "",
      item && item.caption ? item.caption.slice(0, 60) : ""
    ].join("|");
  }

  async function autoFillCampaignDraft(force = false) {
    if (campaignBusy) return false;
    campaignBusy = true;
    try {
      const campaign = await api("/api/social-campaign/state");
      if (!campaign || campaign.status !== "drafts_ready") {
        reportExtensionStatus("campaign-not-ready");
        return false;
      }
      const item = (campaign.prepared || []).find((entry) => String(entry.platform || "").toLowerCase() === platform());
      if (!item || !item.success || !item.caption || !item.image) {
        setStatus(`Campaign is ready, but no ${platform()} draft was found yet.`);
        return false;
      }
      const key = campaignKey(campaign, item);
      const storageKey = CAMPAIGN_DONE_PREFIX + key;
      if (localStorage.getItem(storageKey) === "1") {
        setStatus(`Campaign draft already filled on this ${platform()} tab. Use Mark posted or refresh if you want to retry.`);
        return true;
      }
      state = {
        ...state,
        last_platform: platform(),
        last_caption: item.caption,
        last_image: item.image,
        last_caption_source: "social_campaign",
        last_message: `Campaign draft detected for ${platform()}. Auto filling caption and image.`
      };
      render();
      setStatus(`Campaign ready for ${platform()}. Opening composer and filling draft...`);
      await ensureComposerOpen();
      const filled = await fillCaption();
      if (!filled) return false;
      await sleep(900);
      const uploaded = await uploadCurrentImage();
      if (!uploaded) {
        setStatus("Campaign caption filled, but image upload did not complete. Click Auto upload image or Fill campaign draft again.");
        return false;
      }
      if (campaign.auto_post === true) {
        if (!(await hasAutomationPermission("Campaign Auto Post"))) {
          setStatus("Campaign draft filled, but Auto Post is blocked until dashboard permission is ON.");
          return false;
        }
        setStatus("Campaign media attached. Auto Post requested; waiting for preview...");
        await sleep(platform() === "instagram" ? 5200 : platform() === "x" ? 3000 : 4200);
        let clicked = clickPublishOnce();
        if (platform() === "instagram") {
          await sleep(1700);
          clicked = clickPublishOnce() || clicked;
        } else if (platform() === "linkedin") {
          await sleep(1500);
          clicked = clickPublishOnce() || clicked;
        } else if (platform() === "x") {
          await sleep(1200);
          clicked = clickPublishOnce() || clicked;
        }
        if (clicked) {
          await api("/api/social-campaign/platform-posted", {
            method: "POST",
            body: JSON.stringify({ platform: platform(), media_path: state.last_image || "" })
          }).catch(() => null);
          await api("/api/social/mark-posted", {
            method: "POST",
            body: JSON.stringify({ image_path: state.last_image || "" })
          }).catch(() => null);
          localStorage.setItem(storageKey, "1");
          setStatus("Campaign Auto Post clicked. Check page confirmation.");
        } else {
          setStatus("Campaign draft filled, but Post/Share button was not found. Open this tab and click Auto Post.");
        }
      } else {
        localStorage.setItem(storageKey, "1");
        setStatus("Campaign draft filled and media selected. Review it, then click the final public Post/Share button.");
      }
      reportExtensionStatus("campaign-filled");
      return true;
    } catch (err) {
      setStatus("Campaign auto-fill waiting: " + (err && err.message ? err.message : err));
      return false;
    } finally {
      campaignBusy = false;
    }
  }

  async function prepare() {
    setStatus("Asking Groq for caption...");
    try {
      state = await api("/api/social/prepare", {
        method: "POST",
        body: JSON.stringify({
          platform: platform(),
          tone: document.querySelector("#aria-social-tone")?.value || "friendly",
          extra: document.querySelector("#aria-social-extra")?.value || ""
        })
      });
      render();
      setStatus("Draft ready. Caption copied and available to fill.");
    } catch (err) {
      setStatus("Prepare failed: " + err.message);
    }
  }

  async function markPosted() {
    try {
      state = await api("/api/social/mark-posted", { method: "POST", body: "{}" });
      render();
      setStatus("Marked posted.");
    } catch (err) {
      setStatus("Mark failed: " + err.message);
    }
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        if (!message || !message.type) return;
        if (message.type === "ARIA_SOCIAL_PREPARE") await prepare();
        if (message.type === "ARIA_SOCIAL_FILL") await fillCaption();
        if (message.type === "ARIA_SOCIAL_UPLOAD") await uploadCurrentImage();
        if (message.type === "ARIA_SOCIAL_AUTO_POST") await autoPublish();
        if (message.type === "ARIA_SOCIAL_CAMPAIGN_DRAFT") await autoFillCampaignDraft(true);
        if (message.type === "ARIA_SOCIAL_FILL_COMMENT") await fillCommentDraft();
        if (message.type === "ARIA_SOCIAL_HIGHLIGHT_ACTIONS") highlightEngagementActions();
        if (message.type === "ARIA_SOCIAL_REFRESH") await refresh();
        sendResponse({ ok: true });
      })().catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    });
  }

  window.addEventListener("aria-social-refresh-request", () => {
    injectPanel();
    refresh();
  });

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
      panel.style.left = Math.max(8, Math.min(innerWidth - 280, event.clientX - dx)) + "px";
      panel.style.top = Math.max(8, Math.min(innerHeight - 140, event.clientY - dy)) + "px";
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
          width: 330px;
          max-height: 74vh;
          overflow: auto;
          border-radius: 14px;
          border: 1px solid #18b981;
          background: #0f1326;
          color: #eefcf5;
          box-shadow: 0 18px 48px rgba(0,0,0,.34);
          font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        }
        #${PANEL_ID} .head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          padding:12px 14px;
          cursor: move;
          border-bottom:1px solid rgba(255,255,255,.12);
        }
        #${PANEL_ID} strong { color:#94f7bd; }
        #${PANEL_ID} .body { padding:12px 14px; }
        #${PANEL_ID} input, #${PANEL_ID} textarea {
          width:100%;
          box-sizing:border-box;
          border-radius:8px;
          border:1px solid rgba(255,255,255,.18);
          background:#070a18;
          color:#fff;
          padding:8px;
          margin-top:8px;
          font:inherit;
        }
        #${PANEL_ID} button {
          border:0;
          border-radius:8px;
          padding:8px 10px;
          color:white;
          background:#158352;
          font-weight:800;
          cursor:pointer;
          margin:6px 5px 0 0;
        }
        #${PANEL_ID} button.alt { background:#5633d8; }
        #${PANEL_ID} button.warn { background:#e5672f; }
        #${PANEL_ID} .box {
          white-space:pre-wrap;
          margin-top:10px;
          padding:9px;
          background:#070a18;
          border:1px solid rgba(255,255,255,.12);
          border-radius:9px;
          max-height:160px;
          overflow:auto;
        }
        #${PANEL_ID} .small { color:#c7cec9; font-size:12px; }
      </style>
      <div class="head">
        <strong>ARIA Social Publisher</strong>
        <button id="aria-social-close" class="warn" style="padding:4px 8px;margin:0">x</button>
      </div>
      <div class="body">
        <div class="small">Auto helper: prepares caption, opens composer, selects image, and can click Post/Share. Review before using Auto Post.</div>
        <input id="aria-social-tone" placeholder="tone, e.g. friendly, viral, professional" value="friendly" />
        <textarea id="aria-social-extra" placeholder="extra instructions for Groq caption"></textarea>
        <button id="aria-social-prepare">Prepare ${esc(platform())} draft</button>
        <button id="aria-social-copy" class="alt">Copy caption</button>
        <button id="aria-social-fill" class="warn">Fill caption</button>
        <button id="aria-social-upload" class="alt">Auto upload image</button>
        <button id="aria-social-campaign" class="alt">Fill campaign draft now</button>
        <button id="aria-social-auto-post" class="warn">Auto Post</button>
        <button id="aria-social-comment" class="alt">Fill comment draft</button>
        <button id="aria-social-highlight" class="alt">Highlight actions</button>
        <button id="aria-social-posted" class="alt">Mark posted</button>
        <button id="aria-social-refresh">Refresh</button>
        <div id="aria-social-status" class="box">Connecting...</div>
        <div id="aria-social-details" class="box"></div>
      </div>
    `;
    document.documentElement.appendChild(panel);
    makeDraggable(panel, panel.querySelector(".head"));
    panel.querySelector("#aria-social-close").onclick = () => panel.remove();
    panel.querySelector("#aria-social-prepare").onclick = prepare;
    panel.querySelector("#aria-social-copy").onclick = copyCaption;
    panel.querySelector("#aria-social-fill").onclick = fillCaption;
    panel.querySelector("#aria-social-upload").onclick = uploadCurrentImage;
    panel.querySelector("#aria-social-campaign").onclick = () => autoFillCampaignDraft(true);
    panel.querySelector("#aria-social-auto-post").onclick = autoPublish;
    panel.querySelector("#aria-social-comment").onclick = fillCommentDraft;
    panel.querySelector("#aria-social-highlight").onclick = highlightEngagementActions;
    panel.querySelector("#aria-social-posted").onclick = markPosted;
    panel.querySelector("#aria-social-refresh").onclick = refresh;
  }

  function render() {
    injectPanel();
    const detail = document.querySelector("#aria-social-details");
    if (!detail) return;
    detail.textContent =
      `Folder: ${state.image_folder || ""}\n` +
      `Images found: ${state.image_count || 0}\n` +
      `Selected media: ${state.last_image || "(none)"}\n` +
      `Media type: ${state.last_media_type || "image"}\n\n` +
      `Sheet CSV: ${state.sheet_file || "(none)"}\n\n` +
      `Extension: v${EXTENSION_VERSION} on ${platform()} (${document.hidden ? "hidden" : "visible"})\n\n` +
      `Caption:\n${state.last_caption || "(click Prepare)"}`;
    setStatus(state.last_message || "Ready.");
  }

  injectPanel();
  refresh();
  setTimeout(() => {
    reportExtensionStatus("loaded");
    autoFillCampaignDraft(false);
  }, 1500);
  setInterval(autoFillCampaignDraft, 5000);
  setInterval(() => reportExtensionStatus("heartbeat"), 10000);
  window.addEventListener("focus", () => autoFillCampaignDraft(false));
  document.addEventListener("visibilitychange", () => {
    reportExtensionStatus(document.hidden ? "hidden" : "visible");
    autoFillCampaignDraft(false);
  });
})();
