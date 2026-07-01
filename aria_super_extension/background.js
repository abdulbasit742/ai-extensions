importScripts("lib/db.js");
importScripts("lib/jszip.min.js");

const RUNNERS_KEY = "ariaSuperTabRunners";
const SAVED_IMAGES_KEY = "ariaSuperSavedImages";
const GROQ_SETTINGS_KEY = "ariaSuperGroqSettings";
const SOCIAL_LOG_KEY = "ariaSuperSocialLog";
const DRIVE_QUEUE_KEY = "ariaSuperDriveQueue";
const CODE_VAULT_DEFAULT_PROJECT = "aria-code-vault";
const ALARM_NAME = "aria-super-runner-watchdog";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const DIRECT_VIDEO_MENU_ID = "aria-super-download-direct-video";
const ARIA_SERVER_URLS = ["http://127.0.0.1:5050", "http://localhost:5050"];
const OPTIONS_KEY = "ariaSuperOptions";
const FUSION_MEMORY_KEY = "ariaSuperFusionMemory";
const API_VAULT_KEY = "ariaApiVault";
const DEFAULT_IMAGE_FOLDER = "Basit Social Media";
const DEFAULT_VIDEO_FOLDER = "Basit Social Media/HeyGen Videos";
const runners = new Map();
const codeVaultDb = new CodeDB();
let offscreenCreating = null;
let latestOptionsCache = {};
let fusionMemory = [];
// ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
let syncLeaderTabId = 0;

// ARIA v4.8.0 — Feature 15 / background fix: keep recent options available for downloads and webhook jobs.
chrome.storage.local.get([OPTIONS_KEY], (data) => {
  latestOptionsCache = data && data[OPTIONS_KEY] && typeof data[OPTIONS_KEY] === "object" ? data[OPTIONS_KEY] : {};
});
chrome.storage.local.get([FUSION_MEMORY_KEY], (data) => {
  fusionMemory = Array.isArray(data && data[FUSION_MEMORY_KEY]) ? data[FUSION_MEMORY_KEY] : [];
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes && changes[OPTIONS_KEY]) {
    latestOptionsCache = changes[OPTIONS_KEY].newValue && typeof changes[OPTIONS_KEY].newValue === "object"
      ? changes[OPTIONS_KEY].newValue
      : {};
  }
});

function now() {
  return Date.now();
}

function isSupportedUrl(url) {
  return /^(https?:|file:)\/\//i.test(String(url || ""));
}

function isDirectVideoUrl(url) {
  const value = String(url || "");
  return value.startsWith("data:video/") ||
    value.startsWith("blob:") ||
    /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(value);
}

function videoExtensionFromUrl(url) {
  const value = String(url || "");
  const dataMatch = value.match(/^data:video\/([a-z0-9.+-]+)/i);
  if (dataMatch) return dataMatch[1].replace("quicktime", "mov").replace("x-m4v", "m4v");
  const fileMatch = value.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/i);
  if (fileMatch && ["mp4", "webm", "mov", "m4v"].includes(fileMatch[1].toLowerCase())) return fileMatch[1].toLowerCase();
  return "mp4";
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

function runnerToObject(runner) {
  return {
    tabId: runner.tabId,
    windowId: runner.windowId,
    intervalMs: runner.intervalMs,
    lastTickAt: runner.lastTickAt || 0,
    mode: runner.mode || "universal",
    url: runner.url || "",
    title: runner.title || "",
    scopeId: runner.scopeId || "",
    syncMode: runner.syncMode || "off",
    syncLeader: runner.tabId && runner.tabId === syncLeaderTabId,
    failureCount: runner.failureCount || 0,
    updatedAt: runner.updatedAt || now()
  };
}

function saveRunners() {
  const data = {};
  runners.forEach((runner, tabId) => {
    data[String(tabId)] = runnerToObject(runner);
  });
  chrome.storage.local.set({ [RUNNERS_KEY]: data });
}

function setTabAutoDiscardable(tabId, autoDiscardable) {
  try {
    chrome.tabs.update(tabId, { autoDiscardable }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[ARIA Nexus] tab discard setting failed", chrome.runtime.lastError.message);
      }
    });
  } catch (err) {
    console.warn("[ARIA Nexus] tab discard setting failed", err);
  }
}

async function ensureOffscreenDocument(force = false) {
  try {
    if (!chrome.offscreen || (!force && runners.size === 0)) return;
    if (offscreenCreating) {
      await offscreenCreating;
      return;
    }
    const hasDocument = await chrome.offscreen.hasDocument();
    if (hasDocument) return;
    offscreenCreating = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["CLIPBOARD"],
      justification: "Copy approved ARIA Nexus tab responses and relay clipboard-safe automation data."
    });
    await offscreenCreating;
  } catch (err) {
    console.warn("[ARIA Nexus] offscreen unavailable", err);
  } finally {
    offscreenCreating = null;
  }
}

function writeClipboardText(payload, sendResponse) {
  const text = String((payload && payload.text) || "");
  if (!text) {
    sendResponse({ ok: false, error: "No text received for clipboard." });
    return;
  }
  ensureOffscreenDocument(true).then(() => {
    chrome.runtime.sendMessage({ type: "ARIA_SUPER_OFFSCREEN_WRITE_CLIPBOARD", text }, (reply) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse(reply || { ok: false, error: "Clipboard writer did not reply." });
    });
  }).catch((err) => {
    sendResponse({ ok: false, error: String(err && err.message || err) });
  });
}

// ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
function readClipboardText(sendResponse) {
  ensureOffscreenDocument(true).then(() => {
    chrome.runtime.sendMessage({ type: "ARIA_SUPER_OFFSCREEN_READ_CLIPBOARD" }, (reply) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message, text: "" });
        return;
      }
      sendResponse(reply || { ok: false, error: "Clipboard reader did not reply.", text: "" });
    });
  }).catch((err) => {
    sendResponse({ ok: false, error: String(err && err.message || err), text: "" });
  });
}

function queryTabs(query) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query(query, (tabs) => {
        if (chrome.runtime.lastError) resolve([]);
        else resolve(Array.isArray(tabs) ? tabs : []);
      });
    } catch (err) {
      resolve([]);
    }
  });
}

function sendMessageToTab(tabId, payload) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, payload, (reply) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message || "Tab did not answer." });
          return;
        }
        resolve(reply || { ok: false, error: "Target tab did not reply." });
      });
    } catch (err) {
      resolve({ ok: false, error: String(err && err.message || err) });
    }
  });
}

function injectContentScript(tabId) {
  return new Promise((resolve) => {
    try {
      if (!chrome.scripting || !chrome.scripting.executeScript) {
        resolve({ ok: false, error: "Scripting API unavailable." });
        return;
      }
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve({ ok: true });
      });
    } catch (err) {
      resolve({ ok: false, error: String(err && err.message || err) });
    }
  });
}

function isChatGptUrl(url) {
  const value = String(url || "").toLowerCase();
  return value.startsWith("https://chatgpt.com/") || value.startsWith("https://chat.openai.com/");
}

async function relayClickUpToChatGpt(message, sender) {
  const text = String((message && message.text) || "").trim();
  if (!text) return { ok: false, error: "No ClickUp text received." };
  const tabs = (await queryTabs({})).filter((tab) => isChatGptUrl(tab.url));
  if (!tabs.length) {
    try {
      chrome.tabs.create({ url: "https://chatgpt.com/", active: true });
    } catch (err) {}
    return { ok: false, error: "ChatGPT tab not found. Opened ChatGPT; wait for it to load, then run again." };
  }
  const senderWindow = sender && sender.tab ? sender.tab.windowId : null;
  const target = tabs.find((tab) => senderWindow !== null && tab.windowId === senderWindow) ||
    tabs.find((tab) => tab.active && senderWindow !== null && tab.windowId === senderWindow) ||
    tabs.find((tab) => tab.active) ||
    tabs[0];
  const payload = {
    type: "ARIA_SUPER_RECEIVE_EXTERNAL_TEXT",
    text,
    sendNow: message.sendNow !== false,
    source: "ClickUp",
    sourceUrl: message.sourceUrl || (sender && sender.tab ? sender.tab.url : ""),
    sourceTitle: message.sourceTitle || (sender && sender.tab ? sender.tab.title : ""),
    mode: message.mode || "all"
  };
  let reply = await sendMessageToTab(target.id, payload);
  if (!reply || !reply.ok) {
    const injected = await injectContentScript(target.id);
    if (injected && injected.ok) reply = await sendMessageToTab(target.id, payload);
  }
  if (!reply || !reply.ok) {
    return {
      ok: false,
      error: reply && reply.error ? reply.error : "ChatGPT tab did not accept the text. Refresh ChatGPT once, then retry.",
      targetTabId: target.id,
      targetTitle: target.title || "ChatGPT"
    };
  }
  return {
    ok: true,
    message: reply.message || "ClickUp text sent to ChatGPT.",
    targetTabId: target.id,
    targetTitle: target.title || reply.title || "ChatGPT",
    sent: Boolean(reply.sent),
    rowCount: message.rowCount || 1
  };
}

function ensureAlarm() {
  if (chrome.alarms) {
    if (runners.size > 0) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
    else chrome.alarms.clear(ALARM_NAME);
  }
  ensureOffscreenDocument(false);
}

function registerRunner(sender, message) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || tab.id === undefined || tab.id === null || !isSupportedUrl(tab.url || message.url)) {
    return { ok: false, error: "Open a normal website tab first." };
  }
  const intervalMs = Math.max(1000, Number(message.intervalMs) || 5000);
  const existing = runners.get(tab.id) || {};
  const runner = {
    ...existing,
    tabId: tab.id,
    windowId: tab.windowId,
    intervalMs,
    lastTickAt: 0,
    mode: message.mode || existing.mode || "universal",
    url: message.url || tab.url || existing.url || "",
    title: message.title || tab.title || existing.title || "",
    scopeId: message.scopeId || existing.scopeId || "",
    // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
    syncMode: message.syncMode || existing.syncMode || "off",
    failureCount: 0,
    updatedAt: now()
  };
  runners.set(tab.id, runner);
  if (runner.syncMode === "leader") syncLeaderTabId = tab.id;
  setTabAutoDiscardable(tab.id, false);
  saveRunners();
  ensureAlarm();
  pump(true);
  return { ok: true, tabId: tab.id, runner: runnerToObject(runner), runningTabs: runners.size };
}

function unregisterRunner(sender) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || tab.id === undefined || tab.id === null) {
    return { ok: false, error: "No tab found." };
  }
  runners.delete(tab.id);
  if (syncLeaderTabId === tab.id) syncLeaderTabId = 0;
  setTabAutoDiscardable(tab.id, true);
  saveRunners();
  ensureAlarm();
  return { ok: true, tabId: tab.id, runningTabs: runners.size };
}

// ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
function claimSyncLeader(sender, sendResponse) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || tab.id === undefined || tab.id === null) {
    sendResponse({ ok: false, error: "No sender tab found." });
    return;
  }
  syncLeaderTabId = tab.id;
  const runner = runners.get(tab.id) || {
    tabId: tab.id,
    windowId: tab.windowId,
    intervalMs: 5000,
    lastTickAt: 0,
    mode: "universal",
    url: tab.url || "",
    title: tab.title || "",
    scopeId: "",
    failureCount: 0
  };
  runner.syncMode = "leader";
  runner.updatedAt = now();
  runners.set(tab.id, runner);
  saveRunners();
  ensureAlarm();
  sendResponse({ ok: true, leaderTabId: syncLeaderTabId, runner: runnerToObject(runner), runningTabs: runners.size });
}

// ARIA v4.9.0 — Feature 10: Auto Screenshot on Stop
function captureTabScreenshot(sender, payload, sendResponse) {
  const tab = sender && sender.tab ? sender.tab : null;
  const windowId = tab && tab.windowId !== undefined ? tab.windowId : undefined;
  if (!chrome.tabs || !chrome.tabs.captureVisibleTab || !chrome.downloads) {
    sendResponse({ ok: false, error: "Screenshot/download API not available." });
    return;
  }
  chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      sendResponse({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Screenshot failed." });
      return;
    }
    const filename = normalizeFilename(`ARIA Screenshots/aria_screenshot_${timestamp()}.png`, "ARIA Screenshots", `aria_screenshot_${timestamp()}.png`);
    chrome.downloads.download({ url: dataUrl, filename, conflictAction: "uniquify", saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        sendResponse({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Screenshot download failed." });
      } else {
        sendResponse({ ok: true, filename, downloadId, reason: payload && payload.reason || "" });
      }
    });
  });
}

// ARIA v4.9.0 — Feature 12: Prompt Chaining Across Tabs
function chainStart(message, sendResponse) {
  const targetTabId = Number(message && message.targetTabId) || 0;
  if (!targetTabId) {
    sendResponse({ ok: false, error: "No chain target tab selected." });
    return;
  }
  chrome.tabs.sendMessage(targetTabId, {
    type: "ARIA_SUPER_START",
    options: message.options || {},
    resetPromptFirst: false,
    activeTabId: targetTabId,
    chainTriggered: true
  }, (reply) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message, targetTabId });
    } else {
      sendResponse({ ok: true, targetTabId, reply: reply || {} });
    }
  });
}

// ARIA v4.27.0 - Native Browser Input Fallback
// Last-resort click/key dispatch through Chrome DevTools Protocol. This only
// runs when a content script explicitly asks for it after normal DOM events
// left a prompt stuck in the input.
function debuggerCommand(target, method, params = {}) {
  return new Promise((resolve) => {
    if (!chrome.debugger || !chrome.debugger.sendCommand) {
      resolve({ ok: false, error: "Debugger API unavailable." });
      return;
    }
    try {
      chrome.debugger.sendCommand(target, method, params, (result) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message || `${method} failed.` });
        } else {
          resolve({ ok: true, result });
        }
      });
    } catch (err) {
      resolve({ ok: false, error: String(err && err.message || err) });
    }
  });
}

// ARIA v4.27.0 - Native Browser Input Fallback
async function withDebuggerTarget(tabId, fn) {
  if (!chrome.debugger || !chrome.debugger.attach || !chrome.debugger.detach) {
    return { ok: false, error: "Debugger API unavailable." };
  }
  const target = { tabId: Number(tabId) };
  if (!target.tabId) return { ok: false, error: "No sender tab id for native input." };
  const attached = await new Promise((resolve) => {
    try {
      chrome.debugger.attach(target, "1.3", () => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message || "Debugger attach failed." });
        } else {
          resolve({ ok: true });
        }
      });
    } catch (err) {
      resolve({ ok: false, error: String(err && err.message || err) });
    }
  });
  if (!attached.ok) return attached;
  try {
    return await fn(target);
  } finally {
    try {
      chrome.debugger.detach(target, () => void chrome.runtime.lastError);
    } catch (err) {}
  }
}

// ARIA v4.27.0 - Native Browser Input Fallback
function nativeClick(message, sender, sendResponse) {
  const tab = sender && sender.tab ? sender.tab : null;
  const x = Math.max(1, Math.round(Number(message && message.x) || 0));
  const y = Math.max(1, Math.round(Number(message && message.y) || 0));
  if (!tab || typeof tab.id !== "number" || !x || !y) {
    sendResponse({ ok: false, error: "Native click needs a normal sender tab and coordinates." });
    return;
  }
  withDebuggerTarget(tab.id, async (target) => {
    const moved = await debuggerCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
      button: "none",
      clickCount: 0
    });
    if (!moved.ok) return moved;
    const pressed = await debuggerCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1
    });
    if (!pressed.ok) return pressed;
    const released = await debuggerCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 0,
      clickCount: 1
    });
    return released.ok ? { ok: true, x, y, label: String(message && message.label || "native click") } : released;
  }).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: String(err && err.message || err) });
  });
}

// ARIA v4.27.0 - Native Browser Input Fallback
function nativeEnter(message, sender, sendResponse) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || typeof tab.id !== "number") {
    sendResponse({ ok: false, error: "Native Enter needs a normal sender tab." });
    return;
  }
  let modifiers = 0;
  if (message && message.altKey) modifiers |= 1;
  if (message && message.ctrlKey) modifiers |= 2;
  if (message && message.metaKey) modifiers |= 4;
  if (message && message.shiftKey) modifiers |= 8;
  const common = {
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    modifiers
  };
  withDebuggerTarget(tab.id, async (target) => {
    const down = await debuggerCommand(target, "Input.dispatchKeyEvent", {
      ...common,
      type: "rawKeyDown"
    });
    if (!down.ok) return down;
    const up = await debuggerCommand(target, "Input.dispatchKeyEvent", {
      ...common,
      type: "keyUp"
    });
    return up.ok ? { ok: true, label: String(message && message.label || "native Enter"), modifiers } : up;
  }).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: String(err && err.message || err) });
  });
}

function sendWakeTick(tabId, runner, force) {
  chrome.tabs.sendMessage(tabId, { type: "ARIA_SUPER_BACKGROUND_TICK", force: Boolean(force), sentAt: now() }, (reply) => {
    const next = runners.get(tabId);
    if (!next) return;
    if (chrome.runtime.lastError || !reply || !reply.ok) {
      next.failureCount = (next.failureCount || 0) + 1;
      next.updatedAt = now();
      // ARIA v4.9.0 — Fix 2: remove stale runners after 5 failed wake ticks.
      if (next.failureCount >= 5) {
        runners.delete(tabId);
        if (syncLeaderTabId === tabId) syncLeaderTabId = 0;
        setTabAutoDiscardable(tabId, true);
      } else {
        runners.set(tabId, next);
      }
      saveRunners();
      ensureAlarm();
      return;
    }
    if (reply.running === false) {
      runners.delete(tabId);
      if (syncLeaderTabId === tabId) syncLeaderTabId = 0;
      setTabAutoDiscardable(tabId, true);
      saveRunners();
      ensureAlarm();
      return;
    }
    next.failureCount = 0;
    next.intervalMs = Math.max(1000, Number(reply.intervalMs) || next.intervalMs || 5000);
    next.mode = reply.mode || next.mode;
    next.url = reply.url || next.url;
    next.title = reply.title || next.title;
    next.scopeId = reply.counterScope || next.scopeId;
    next.syncMode = reply.syncMode || next.syncMode || "off";
    if (next.syncMode === "leader") syncLeaderTabId = tabId;
    next.updatedAt = now();
    runners.set(tabId, next);
    saveRunners();
    ensureAlarm();
    // ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
    if ((next.syncMode || "off") === "leader" && syncLeaderTabId === tabId) {
      broadcastSyncTick(tabId, next);
    }
  });
}

// ARIA v4.9.0 — Feature 1: Multi-Tab Sync Mode
function broadcastSyncTick(leaderTabId, leaderRunner) {
  runners.forEach((runner, tabId) => {
    if (tabId === leaderTabId || (runner.syncMode || "off") !== "follower") return;
    chrome.tabs.sendMessage(tabId, {
      type: "ARIA_SUPER_SYNC_TICK",
      leaderTabId,
      leaderTitle: leaderRunner.title || "",
      sentAt: now()
    }, () => {
      if (chrome.runtime.lastError) {
        const next = runners.get(tabId);
        if (!next) return;
        next.failureCount = (next.failureCount || 0) + 1;
        if (next.failureCount >= 5) runners.delete(tabId);
        else runners.set(tabId, next);
        saveRunners();
      }
    });
  });
}

function pump(force = false) {
  const t = now();
  runners.forEach((runner, tabId) => {
    const intervalMs = Math.max(1000, Number(runner.intervalMs) || 5000);
    const wakeEveryMs = Math.max(1000, Math.min(intervalMs, 5000));
    if (!force && runner.lastTickAt && t - runner.lastTickAt < wakeEveryMs) return;
    runner.lastTickAt = t;
    runners.set(tabId, runner);
    sendWakeTick(tabId, runner, force);
  });
}

function sanitizePathPart(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[<>:"\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function normalizeFilename(filename, fallbackFolder = "ARIA Downloads", fallbackFile = "aria_file.txt") {
  // ARIA v4.8.0 — background fix: respect the configured image/output folder instead of hardcoding one path.
  const configuredFolder = latestOptionsCache && latestOptionsCache.imageFolder
    ? latestOptionsCache.imageFolder
    : DEFAULT_IMAGE_FOLDER;
  const effectiveFolder = fallbackFolder && fallbackFolder !== "ARIA Downloads"
    ? fallbackFolder
    : configuredFolder || "ARIA Downloads";
  const fallbackPath = `${effectiveFolder || "ARIA Downloads"}/${fallbackFile || "aria_file.txt"}`;
  const parts = String(filename || fallbackPath).split(/[\\/]+/).filter(Boolean);
  if (!parts.length) return fallbackPath;
  return parts.map((part, index) => sanitizePathPart(part, index === parts.length - 1 ? fallbackFile : effectiveFolder)).join("/");
}

function directVideoFilename(url, folder) {
  const safeFolder = sanitizePathPart(folder || DEFAULT_VIDEO_FOLDER, DEFAULT_VIDEO_FOLDER);
  return normalizeFilename(`${safeFolder}/${timestamp()}_direct_video_${shortHash(url)}.${videoExtensionFromUrl(url)}`, safeFolder, "direct_video.mp4");
}

function markdownFilename(title) {
  const safeTitle = sanitizePathPart(title || "aria_drive_capture", "aria_drive_capture").slice(0, 90);
  return normalizeFilename(`ARIA Drive Fallback/${safeTitle}_${timestamp()}.md`, "ARIA Drive Fallback", "aria_drive_capture.md");
}

function saveImageRecord(record) {
  chrome.storage.local.get([SAVED_IMAGES_KEY], (data) => {
    const saved = Array.isArray(data[SAVED_IMAGES_KEY]) ? data[SAVED_IMAGES_KEY] : [];
    saved.unshift({ ...record, savedAt: new Date().toISOString() });
    chrome.storage.local.set({ [SAVED_IMAGES_KEY]: saved.slice(0, 300) });
  });
}

function downloadImage(sender, payload, sendResponse) {
  const url = payload.dataUrl || payload.url;
  if (!url) {
    sendResponse({ ok: false, error: "No download URL received." });
    return;
  }
  const folder = sanitizePathPart(payload.folder || payload.imageFolder || DEFAULT_IMAGE_FOLDER, DEFAULT_IMAGE_FOLDER);
  const filename = normalizeFilename(payload.filename || `${folder}/${timestamp()}_image.png`, folder, "image.png");
  chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }, (downloadId) => {
    if (chrome.runtime.lastError || !downloadId) {
      sendResponse({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Download failed." });
      return;
    }
    saveImageRecord({
      downloadId,
      filename,
      sourceUrl: payload.sourceUrl || payload.url || "",
      pageUrl: sender && sender.tab ? sender.tab.url : "",
      title: sender && sender.tab ? sender.tab.title : ""
    });
    sendResponse({ ok: true, downloadId, filename });
  });
}

function downloadTextFile(sender, payload, sendResponse) {
  const content = String((payload && payload.content) || "");
  if (!content.trim()) {
    sendResponse({ ok: false, error: "No text received for Drive fallback download." });
    return;
  }
  const filename = normalizeFilename((payload && payload.filename) || markdownFilename(payload && payload.title), "ARIA Drive Fallback", "aria_drive_capture.md");
  const header = [
    `# ${(payload && payload.title) || "ARIA Drive Capture"}`,
    "",
    `Saved: ${new Date().toISOString()}`,
    `Source URL: ${(payload && payload.source_url) || (sender && sender.tab ? sender.tab.url : "") || "n/a"}`,
    `Platform: ${(payload && payload.platform) || "unknown"}`,
    "",
    "---",
    "",
  ].join("\n");
  const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(header + content)}`;
  chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }, (downloadId) => {
    if (chrome.runtime.lastError || !downloadId) {
      sendResponse({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Text download failed." });
      return;
    }
    sendResponse({ ok: true, downloadId, filename });
  });
}

function queueDriveSave(payload, reason, sendResponse) {
  chrome.storage.local.get([DRIVE_QUEUE_KEY], (data) => {
    const queue = Array.isArray(data[DRIVE_QUEUE_KEY]) ? data[DRIVE_QUEUE_KEY] : [];
    const item = {
      id: `${Date.now()}_${shortHash(JSON.stringify(payload || {}))}`,
      payload: payload || {},
      reason: String(reason || "server unavailable"),
      queuedAt: new Date().toISOString(),
    };
    queue.push(item);
    const maxQueue = 200;
    const dropped = Math.max(0, queue.length - maxQueue);
    const trimmed = queue.slice(-maxQueue);
    const nearCapacity = trimmed.length >= 180;
    chrome.storage.local.set({ [DRIVE_QUEUE_KEY]: trimmed }, () => {
      sendResponse({
        ok: true,
        queued: true,
        queueCount: trimmed.length,
        maxQueue,
        dropped,
        warning: dropped
          ? `Drive queue full; dropped ${dropped} oldest item(s).`
          : (nearCapacity ? `Drive queue near capacity (${trimmed.length}/${maxQueue}). Flush or save soon.` : ""),
        item
      });
    });
  });
}

async function postDrivePayload(payload) {
  let lastError = "";
  for (const base of ARIA_SERVER_URLS) {
    try {
      const response = await fetch(`${base}/api/drive/save-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        data = { message: text };
      }
      if (!response.ok || data.success === false) {
        lastError = data.error || data.message || `HTTP ${response.status}`;
        continue;
      }
      return data;
    } catch (err) {
      lastError = String(err && err.message || err);
    }
  }
  throw new Error(lastError || "ARIA server not reachable.");
}

function flushDriveQueue(sendResponse) {
  chrome.storage.local.get([DRIVE_QUEUE_KEY], async (data) => {
    const queue = Array.isArray(data[DRIVE_QUEUE_KEY]) ? data[DRIVE_QUEUE_KEY] : [];
    const saved = [];
    const remaining = [];
    for (const item of queue) {
      try {
        const result = await postDrivePayload(item.payload || {});
        saved.push({ id: item.id, path: result.path || "", message: result.message || "saved" });
      } catch (err) {
        remaining.push({ ...item, lastError: String(err && err.message || err), lastTriedAt: new Date().toISOString() });
      }
    }
    const maxQueue = 200;
    const dropped = Math.max(0, remaining.length - maxQueue);
    const trimmed = remaining.slice(-maxQueue);
    chrome.storage.local.set({ [DRIVE_QUEUE_KEY]: trimmed }, () => {
      sendResponse({
        ok: true,
        savedCount: saved.length,
        remainingCount: trimmed.length,
        maxQueue,
        dropped,
        saved,
        warning: dropped ? `Drive queue still full; dropped ${dropped} oldest unsaved item(s).` : "",
        message: `Drive queue flush complete. Saved: ${saved.length}. Remaining: ${trimmed.length}.`,
      });
    });
  });
}

function getDriveQueue(sendResponse) {
  chrome.storage.local.get([DRIVE_QUEUE_KEY], (data) => {
    const queue = Array.isArray(data[DRIVE_QUEUE_KEY]) ? data[DRIVE_QUEUE_KEY] : [];
    sendResponse({ ok: true, queueCount: queue.length, queue: queue.slice(-20) });
  });
}

function downloadDirectVideo(sender, payload, sendResponse) {
  const url = String((payload && payload.url) || "").trim();
  if (!url) {
    sendResponse({ ok: false, error: "Paste an official direct video URL first." });
    return;
  }
  if (!isDirectVideoUrl(url)) {
    sendResponse({
      ok: false,
      error: "This is not a direct video file URL. Use the platform's official Export/Download first; ARIA will not bypass protected or premium downloads."
    });
    return;
  }
  const filename = directVideoFilename(url, payload && payload.folder);
  chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }, (downloadId) => {
    if (chrome.runtime.lastError || !downloadId) {
      sendResponse({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Download failed." });
      return;
    }
    saveImageRecord({
      downloadId,
      filename,
      sourceUrl: url,
      pageUrl: sender && sender.tab ? sender.tab.url : "",
      title: sender && sender.tab ? sender.tab.title : "",
      kind: "direct-video"
    });
    sendResponse({ ok: true, downloadId, filename });
  });
}

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: DIRECT_VIDEO_MENU_ID,
      title: "ARIA: save direct video to Basit Social Media",
      contexts: ["link", "video", "page"]
    }, () => {});
  });
}

function maskKey(key) {
  const value = String(key || "").trim();
  if (!value) return "";
  if (value.length <= 10) return value.slice(0, 3) + "...";
  return value.slice(0, 6) + "..." + value.slice(-4);
}

function normalizedProvider(value) {
  const provider = String(value || "groq").trim().toLowerCase();
  if (["openai", "openrouter", "custom"].includes(provider)) return provider;
  return "groq";
}

function defaultModelForProvider(provider) {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "openrouter") return "meta-llama/llama-3.1-8b-instruct:free";
  return "llama-3.3-70b-versatile";
}

function defaultEndpointForProvider(provider) {
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1/chat/completions";
  return "https://api.groq.com/openai/v1/chat/completions";
}

function allowedLlmEndpoint(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (value.startsWith("https://")) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(value);
}

function isLocalLlmEndpoint(url) {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(String(url || "").trim());
}

function llmSettingsFromStorage(rawSettings) {
  const settings = rawSettings || {};
  const provider = normalizedProvider(settings.provider || settings.llmProvider);
  const apiKey = String(
    (provider === "openai" ? settings.openaiApiKey : "") ||
    (provider === "openrouter" ? settings.openrouterApiKey : "") ||
    (provider === "custom" ? settings.customApiKey : "") ||
    (provider === "groq" ? settings.groqApiKey : "") ||
    settings.apiKey ||
    ""
  ).trim();
  const textModel = String(settings.textModel || defaultModelForProvider(provider)).trim();
  const customBase = String(settings.apiBaseUrl || settings.baseUrl || "").trim();
  const endpoint = provider === "custom" ? customBase : defaultEndpointForProvider(provider);
  return { provider, apiKey, textModel, endpoint };
}

async function callOpenAiCompatibleChat(settings, messages, options) {
  const cfg = llmSettingsFromStorage(settings);
  if (!cfg.apiKey && !(cfg.provider === "custom" && isLocalLlmEndpoint(cfg.endpoint))) {
    return { ok: false, error: `${cfg.provider} API key not saved in extension.` };
  }
  if (!allowedLlmEndpoint(cfg.endpoint)) {
    return { ok: false, error: "LLM endpoint must be https:// or local http://127.0.0.1 / localhost." };
  }
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://aria.local";
    headers["X-Title"] = "ARIA Nexus One Hub";
  }
  const response = await fetch(cfg.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.textModel,
      messages,
      max_tokens: Math.max(60, Math.min(1200, Number(options && options.maxTokens) || 360)),
      temperature: Number.isFinite(Number(options && options.temperature)) ? Number(options.temperature) : 0.45
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: `${cfg.provider} HTTP ${response.status}: ${JSON.stringify(json).slice(0, 260)}` };
  }
  const text = String(json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content || "").trim();
  if (!text) return { ok: false, error: `${cfg.provider} returned empty text.` };
  return { ok: true, text, provider: cfg.provider, model: cfg.textModel };
}

function fallbackSmartPrompt(payload) {
  const latest = String(payload && payload.latestResponse || "").replace(/\s+/g, " ").trim();
  const lower = latest.toLowerCase();
  if (lower.includes("error") || lower.includes("failed") || lower.includes("traceback")) {
    return "I ran into this error. Please diagnose the root cause, give the exact fix, and provide the corrected files/commands only.";
  }
  if (lower.includes("missing") || lower.includes("provide") || lower.includes("paste") || lower.includes("send me")) {
    return "Please continue by explaining exactly what information or file is needed next, then give the safest next step I should perform.";
  }
  if (lower.includes("zip") || lower.includes("complete") || lower.includes("all files")) {
    return "Create the final ZIP/package checklist and include any remaining files or verification steps needed to finish the project.";
  }
  return "Continue with the next best implementation step. If code is needed, provide complete filenames and complete code blocks, not partial snippets.";
}

function getGroqSettings(sendResponse) {
  chrome.storage.local.get([GROQ_SETTINGS_KEY], (data) => {
    const settings = data[GROQ_SETTINGS_KEY] || {};
    const cfg = llmSettingsFromStorage(settings);
    sendResponse({
      ok: true,
      provider: cfg.provider,
      apiKeySet: Boolean(cfg.apiKey),
      apiKeyMasked: maskKey(cfg.apiKey),
      groqApiKeySet: Boolean(cfg.apiKey),
      groqApiKeyMasked: maskKey(cfg.apiKey),
      textModel: cfg.textModel,
      apiBaseUrl: cfg.endpoint
    });
  });
}

function healthCheck(sendResponse) {
  chrome.storage.local.get([GROQ_SETTINGS_KEY], (data) => {
    const settings = data[GROQ_SETTINGS_KEY] || {};
    const runnerData = {};
    runners.forEach((runner, tabId) => {
      runnerData[String(tabId)] = runnerToObject(runner);
    });
    sendResponse({
      ok: true,
      extensionName: chrome.runtime.getManifest().name,
      version: chrome.runtime.getManifest().version,
      runningTabs: runners.size,
      runners: runnerData,
      offscreenSupported: Boolean(chrome.offscreen),
      alarmsSupported: Boolean(chrome.alarms),
      downloadsSupported: Boolean(chrome.downloads),
      groqApiKeySet: Boolean(llmSettingsFromStorage(settings).apiKey),
      groqApiKeyMasked: maskKey(llmSettingsFromStorage(settings).apiKey),
      provider: llmSettingsFromStorage(settings).provider,
      apiKeySet: Boolean(llmSettingsFromStorage(settings).apiKey),
      apiKeyMasked: maskKey(llmSettingsFromStorage(settings).apiKey),
      textModel: llmSettingsFromStorage(settings).textModel,
      checkedAt: new Date().toISOString()
    });
  });
}

function saveGroqSettings(payload, sendResponse) {
  chrome.storage.local.get([GROQ_SETTINGS_KEY], (data) => {
    const oldSettings = data[GROQ_SETTINGS_KEY] || {};
    const provider = normalizedProvider(payload.provider || payload.llmProvider || oldSettings.provider || oldSettings.llmProvider);
    const apiKey = String(payload.apiKey || payload.groqApiKey || "").trim();
    const next = {
      ...oldSettings,
      provider,
      llmProvider: provider,
      textModel: payload.textModel || oldSettings.textModel || defaultModelForProvider(provider),
      apiBaseUrl: payload.apiBaseUrl || oldSettings.apiBaseUrl || "",
      updatedAt: new Date().toISOString()
    };
    if (apiKey) {
      next.apiKey = apiKey;
      if (provider === "openai") next.openaiApiKey = apiKey;
      else if (provider === "openrouter") next.openrouterApiKey = apiKey;
      else if (provider === "custom") next.customApiKey = apiKey;
      else next.groqApiKey = apiKey;
    }
    chrome.storage.local.set({ [GROQ_SETTINGS_KEY]: next }, () => {
      const cfg = llmSettingsFromStorage(next);
      sendResponse({
        ok: true,
        provider: cfg.provider,
        apiKeySet: Boolean(cfg.apiKey),
        apiKeyMasked: maskKey(cfg.apiKey),
        groqApiKeySet: Boolean(cfg.apiKey),
        groqApiKeyMasked: maskKey(cfg.apiKey),
        textModel: cfg.textModel,
        apiBaseUrl: cfg.endpoint
      });
    });
  });
}

function appendSocialLog(record) {
  chrome.storage.local.get([SOCIAL_LOG_KEY], (data) => {
    const rows = Array.isArray(data[SOCIAL_LOG_KEY]) ? data[SOCIAL_LOG_KEY] : [];
    rows.unshift({ ...record, at: new Date().toISOString() });
    chrome.storage.local.set({ [SOCIAL_LOG_KEY]: rows.slice(0, 300) });
  });
}

function groqCaption(payload, sendResponse) {
  chrome.storage.local.get([GROQ_SETTINGS_KEY], async (data) => {
    const settings = data[GROQ_SETTINGS_KEY] || {};
    const platform = String(payload.platform || "social media");
    const tone = String(payload.tone || "friendly");
    const topic = String(payload.topic || "").trim();
    const extra = String(payload.extra || "").trim();
    const pageText = String(payload.pageText || "").replace(/\s+/g, " ").slice(0, 1500);
    const imageName = String(payload.imageName || "").trim();
    const system = [
      "You are ARIA's social media copywriter.",
      "Write concise, natural social media captions and comments.",
      "Do not claim fake giveaways, earnings, or endorsements.",
      "Return only the final text, no markdown."
    ].join(" ");
    const user = [
      `Platform: ${platform}`,
      `Tone: ${tone}`,
      topic ? `Topic: ${topic}` : "",
      imageName ? `Image/file: ${imageName}` : "",
      extra ? `Extra instruction: ${extra}` : "",
      pageText ? `Visible page/post context: ${pageText}` : "",
      "Write one ready-to-paste caption or comment. Keep it useful and human."
    ].filter(Boolean).join("\n");
    try {
      const reply = await callOpenAiCompatibleChat(settings, [
        { role: "system", content: system },
        { role: "user", content: user }
      ], {
        maxTokens: 260,
        temperature: 0.75
      });
      if (!reply.ok) {
        sendResponse(reply);
        return;
      }
      const text = String(reply.text || "").trim();
      if (!text) {
        sendResponse({ ok: false, error: "LLM returned empty caption." });
        return;
      }
      appendSocialLog({ platform, tone, topic, imageName, text, source: reply.provider || "llm" });
      sendResponse({ ok: true, text, source: reply.provider || "llm", model: reply.model });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
  });
}

function smartPrompt(payload, sendResponse) {
  chrome.storage.local.get([GROQ_SETTINGS_KEY], async (data) => {
    const settings = data[GROQ_SETTINGS_KEY] || {};
    const latest = String(payload.latestResponse || "").slice(-7000);
    const recent = Array.isArray(payload.recentResponses) ? payload.recentResponses.slice(-3).map((item) => String(item || "").slice(-2500)) : [];
    const userInstruction = String(payload.instruction || "").trim();
    const site = String(payload.site || "AI agent");
    const title = String(payload.title || "");
    const url = String(payload.url || "");
    const nextNumber = String(payload.nextNumber || "");
    const system = [
      "You are ARIA Smart Prompt Planner.",
      "Generate exactly one next prompt to send to an AI/coding agent.",
      "Use the latest response context and produce a useful continuation, not a bare number.",
      "If the agent asks for missing files, logs, screenshots, or command output, ask for the smallest exact item needed.",
      "If files/code are being generated, ask for the next complete file or next batch with filenames in fenced code blocks.",
      "For Google Antigravity, make the prompt explicit: state the project goal, exact next coding step, expected files, and ask it to explain any permission request before approval.",
      "If Antigravity or any coding agent shows model/usage limits, produce a compact handoff prompt suitable for Claude, Gemini Flash/Pro, GPT OSS, OpenAI Codex, or another coding agent.",
      "If work seems complete, ask for verification, ZIP/package, or the next highest-value implementation step.",
      "Keep it concise, direct, and ready to paste. Return only the prompt text."
    ].join(" ");
    const user = [
      `Site: ${site}`,
      title ? `Page title: ${title}` : "",
      url ? `URL: ${url}` : "",
      nextNumber ? `Current sequence/next number: ${nextNumber}` : "",
      userInstruction ? `User instruction for prompt style: ${userInstruction}` : "",
      recent.length ? `Recent context:\n${recent.map((row, idx) => `--- recent ${idx + 1} ---\n${row}`).join("\n\n")}` : "",
      latest ? `Latest response:\n${latest}` : "",
      "Now write the single best next prompt."
    ].filter(Boolean).join("\n\n");
    try {
      const cfg = llmSettingsFromStorage(settings);
      if (!cfg.apiKey) {
        sendResponse({ ok: true, text: fallbackSmartPrompt(payload), source: "fallback", warning: `${cfg.provider} API key not saved.` });
        return;
      }
      const reply = await callOpenAiCompatibleChat(settings, [
        { role: "system", content: system },
        { role: "user", content: user }
      ], {
        maxTokens: 360,
        temperature: 0.35
      });
      if (!reply.ok) {
        sendResponse({ ok: true, text: fallbackSmartPrompt(payload), source: "fallback", warning: reply.error });
        return;
      }
      const text = String(reply.text || "").replace(/^["']|["']$/g, "").trim();
      sendResponse({ ok: true, text: text || fallbackSmartPrompt(payload), source: reply.provider || "llm", model: reply.model });
    } catch (err) {
      sendResponse({ ok: true, text: fallbackSmartPrompt(payload), source: "fallback", warning: String(err && err.message || err) });
    }
  });
}

// ARIA v4.15.0 - Revenue Action Brief: ethical opportunity/draft generation from current page context.
function fallbackRevenueBrief(payload) {
  const mode = String(payload && payload.mode || "brief");
  const topic = String(payload && payload.topic || "").trim();
  const platform = String(payload && payload.platform || "current page");
  const base = topic || "the visible page/context";
  if (mode === "draft") {
    return [
      `Hi, I noticed ${base} and thought this could be turned into a practical AI automation workflow.`,
      "I can help with a clear plan, simple implementation, and a fast first version.",
      "Would you like me to share a short checklist or demo idea?"
    ].join(" ");
  }
  return [
    "Revenue Action Brief",
    `Source: ${platform}`,
    `Opportunity: Turn ${base} into a clear offer, lead magnet, or helpful follow-up.`,
    "Fast actions:",
    "1. Identify the exact pain point or desired outcome from the page.",
    "2. Prepare one helpful short message, no fake claims or pressure.",
    "3. Save the lead/topic, then follow up with a useful checklist or demo.",
    "Ready draft:",
    "Hi, I saw this and can help turn it into a simple AI automation/workflow. Want me to share a quick plan?"
  ].join("\n");
}

function revenueBrief(payload, sendResponse) {
  chrome.storage.local.get([GROQ_SETTINGS_KEY], async (data) => {
    const settings = data[GROQ_SETTINGS_KEY] || {};
    const mode = String(payload.mode || "brief");
    const platform = String(payload.platform || "current page");
    const tone = String(payload.tone || "friendly");
    const topic = String(payload.topic || "").trim();
    const extra = String(payload.extra || "").trim();
    const pageText = String(payload.pageText || "").replace(/\s+/g, " ").slice(0, 5000);
    const system = [
      "You are ARIA Revenue Action Planner.",
      "Create ethical, useful business follow-up ideas from the visible page context.",
      "Never make fake earning claims, fake endorsements, fake scarcity, spam, deception, or mass unsolicited messaging.",
      "Focus on helpful offers, lead capture, content ideas, follow-up text, and practical next steps.",
      mode === "draft"
        ? "Return only one ready-to-paste draft message or caption, no markdown."
        : "Return: Opportunity, Why it may convert, 3 fast actions, ready-to-paste draft, and follow-up reminder. Keep it concise."
    ].join(" ");
    const user = [
      `Platform/source: ${platform}`,
      `Tone: ${tone}`,
      topic ? `User topic/instruction: ${topic}` : "",
      extra ? `Extra instruction: ${extra}` : "",
      pageText ? `Visible page context:\n${pageText}` : "",
      mode === "draft" ? "Write the best single draft for this context." : "Build the brief now."
    ].filter(Boolean).join("\n\n");
    try {
      const reply = await callOpenAiCompatibleChat(settings, [
        { role: "system", content: system },
        { role: "user", content: user }
      ], {
        maxTokens: mode === "draft" ? 260 : 520,
        temperature: 0.55
      });
      if (!reply.ok) {
        sendResponse({ ok: true, text: fallbackRevenueBrief(payload), source: "fallback", warning: reply.error });
        return;
      }
      sendResponse({ ok: true, text: reply.text, source: reply.provider || "llm", model: reply.model });
    } catch (err) {
      sendResponse({ ok: true, text: fallbackRevenueBrief(payload), source: "fallback", warning: String(err && err.message || err) });
    }
  });
}

async function ensureCodeVault() {
  await codeVaultDb.init();
  const defaults = {
    autoCapture: true,
    duplicateCheck: true,
    defaultProject: CODE_VAULT_DEFAULT_PROJECT,
    zipStructure: "by-project"
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await codeVaultDb.getSetting(key);
    if (existing === undefined) await codeVaultDb.setSetting(key, value);
  }
  await codeVaultDb.addProject(CODE_VAULT_DEFAULT_PROJECT);
}

function codeVaultSafeName(value, fallback = "file") {
  const text = String(value || fallback)
    .replace(/[<>:"|?*\u0000-\u001f]/g, "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\.+/, "")
    .trim();
  return (text || fallback).slice(0, 180);
}

function codeVaultProjectName(value) {
  return codeVaultSafeName(value || CODE_VAULT_DEFAULT_PROJECT, CODE_VAULT_DEFAULT_PROJECT)
    .replace(/[\/.]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80) || CODE_VAULT_DEFAULT_PROJECT;
}

function codeVaultHash(text) {
  let hash = 2166136261;
  const value = String(text || "");
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function codeVaultFilePath(file, structure) {
  const project = codeVaultProjectName(file.project);
  const language = codeVaultSafeName(file.language || "text", "text").replace(/[\/.]+/g, "_");
  const filename = codeVaultSafeName(file.filename || `snippet_${file.id || codeVaultHash(file.code)}.txt`, "snippet.txt");
  if (structure === "by-language") return `${language}/${filename}`;
  if (structure === "flat") return filename;
  return `${project}/${filename}`;
}

function codeVaultDownloadDataUrl(dataUrl, filename) {
  return new Promise((resolve) => {
    chrome.downloads.download({ url: dataUrl, filename, conflictAction: "uniquify", saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ ok: true, downloadId, filename });
    });
  });
}

async function handleCodeVaultMessage(message, sender) {
  await ensureCodeVault();
  const action = message.action || message.type || "";
  if (action === "ARIA_SUPER_CODE_VAULT_SAVE" || action === "SAVE_CODE") {
    const incoming = message.file || message.payload || {};
    const code = String(incoming.code || "");
    if (!code.trim()) return { ok: false, error: "No code received." };
    const hash = incoming.hash || codeVaultHash(`${incoming.project || ""}\n${incoming.filename || ""}\n${code}`);
    const duplicate = await codeVaultDb.getFileByHash(hash);
    if (duplicate) return { ok: true, duplicate: true, file: duplicate, message: `Already saved: ${duplicate.filename}` };
    const project = codeVaultProjectName(incoming.project || CODE_VAULT_DEFAULT_PROJECT);
    await codeVaultDb.addProject(project);
    const row = {
      project,
      filename: codeVaultSafeName(incoming.filename || `snippet_${Date.now()}.txt`, `snippet_${Date.now()}.txt`),
      language: codeVaultSafeName(incoming.language || "text", "text"),
      code,
      hash,
      platform: incoming.platform || "website",
      sourceUrl: incoming.sourceUrl || (sender && sender.tab && sender.tab.url) || "",
      title: incoming.title || (sender && sender.tab && sender.tab.title) || "",
      createdAt: incoming.createdAt || Date.now()
    };
    const id = await codeVaultDb.addFile(row);
    if (!id) return { ok: true, duplicate: true, message: `Already saved: ${row.filename}` };
    row.id = id;
    return { ok: true, duplicate: false, file: row, message: `Saved code: ${row.filename}` };
  }
  if (action === "ARIA_SUPER_CODE_VAULT_SAVE_MANY") {
    const files = Array.isArray(message.files) ? message.files : [];
    const results = [];
    for (const file of files) {
      results.push(await handleCodeVaultMessage({ type: "ARIA_SUPER_CODE_VAULT_SAVE", payload: file }, sender));
    }
    const saved = results.filter((item) => item && item.ok && !item.duplicate).length;
    const duplicates = results.filter((item) => item && item.duplicate).length;
    return { ok: true, saved, duplicates, total: files.length, results, message: `Code vault: saved ${saved}, duplicate ${duplicates}.` };
  }
  if (action === "ARIA_SUPER_CODE_VAULT_LIST" || action === "GET_FILES") {
    const project = message.project ? codeVaultProjectName(message.project) : "";
    const files = project ? await codeVaultDb.getFilesByProject(project) : await codeVaultDb.getAllFiles();
    files.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { ok: true, files, count: files.length };
  }
  if (action === "ARIA_SUPER_CODE_VAULT_STATS") {
    const files = await codeVaultDb.getAllFiles();
    const projects = await codeVaultDb.getProjects();
    const latest = files.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
    return { ok: true, fileCount: files.length, projectCount: projects.length, projects, latest };
  }
  if (action === "ARIA_SUPER_CODE_VAULT_DOWNLOAD_ZIP" || action === "DOWNLOAD_ZIP") {
    const project = message.project ? codeVaultProjectName(message.project) : "";
    const structure = message.structure || "by-project";
    const files = project ? await codeVaultDb.getFilesByProject(project) : await codeVaultDb.getAllFiles();
    if (!files.length) return { ok: false, error: "No code files saved yet. Click Save visible code first." };
    const zip = new JSZip();
    files.forEach((file) => zip.file(codeVaultFilePath(file, structure), file.code || ""));
    zip.file("ARIA_CODE_VAULT_README.txt", [
      "ARIA Nexus Code Vault Export",
      `Created: ${new Date().toISOString()}`,
      `Files: ${files.length}`,
      `Project: ${project || "all"}`,
      "",
      "This ZIP was generated from visible ClickUp/coding-agent code blocks captured by ARIA Nexus One Hub."
    ].join("\n"));
    const b64 = await zip.generateAsync({ type: "base64" });
    const safeProject = project || "all_projects";
    const filename = `ARIA_Code_Vault/${safeProject}_${timestamp()}.zip`;
    return await codeVaultDownloadDataUrl(`data:application/zip;base64,${b64}`, filename);
  }
  if (action === "ARIA_SUPER_CODE_VAULT_CLEAR" || action === "CLEAR_DATABASE") {
    await codeVaultDb.clearAll();
    await codeVaultDb.addProject(CODE_VAULT_DEFAULT_PROJECT);
    return { ok: true, message: "Code vault cleared." };
  }
  return { ok: false, error: `Unknown code vault action: ${action}` };
}

const RESPONSE_VAULT_ZIP_COUNT_KEY = "responseVaultZipCount";

async function ensureResponseVault() {
  await codeVaultDb.init();
  const current = await codeVaultDb.getSetting(RESPONSE_VAULT_ZIP_COUNT_KEY);
  if (current === undefined) await codeVaultDb.setSetting(RESPONSE_VAULT_ZIP_COUNT_KEY, 0);
}

function responseVaultSourceName(source, url) {
  const explicit = String(source || "").trim();
  if (explicit) return codeVaultProjectName(explicit);
  try {
    const host = new URL(url || "").hostname.toLowerCase();
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "ChatGPT";
    const href = String(url || "").toLowerCase();
    if (
      host.includes("codex.openai.com") ||
      ((host.includes("openai.com") || host.includes("chatgpt.com")) && href.includes("codex")) ||
      href.includes("/codex")
    ) return "OpenAI_Codex";
    if (host.includes("antigravity") || String(url || "").toLowerCase().includes("antigravity")) return "Antigravity";
    if (host.includes("claude.ai")) return "Claude";
    if (host.includes("gemini.google.com")) return "Gemini";
    if (host.includes("aistudio.google.com")) return "Google_AI_Studio";
    if (host.includes("grok.com")) return "Grok";
    if (host.includes("poe.com")) return "Poe";
    if (host.includes("perplexity.ai")) return "Perplexity";
    if (host.includes("app.clickup.com")) return "ClickUp";
    if (host.includes("smith.langchain.com") || host.includes("langchain.com")) return "LangChain";
    if (host.includes("cursor.com") || host.includes("cursor.sh")) return "Cursor";
    if (host.includes("v0.dev")) return "V0";
    if (host.includes("bolt.new")) return "Bolt";
    if (host.includes("lovable.dev")) return "Lovable";
    if (host.includes("notebooklm.google.com")) return "NotebookLM";
    return host.replace(/^www\./, "") || "Website";
  } catch (err) {
    return "Website";
  }
}

function responseVaultTopicName(topic, title, url) {
  const raw = String(topic || title || "").trim();
  if (raw) return codeVaultProjectName(raw);
  try {
    const parsed = new URL(url || "");
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return codeVaultProjectName(last || parsed.hostname || "response");
  } catch (err) {
    return "response";
  }
}

function responseVaultFormatExt(format) {
  const f = String(format || "txt").toLowerCase().replace(/^\./, "");
  if (["txt", "md", "json", "html"].includes(f)) return f;
  return "txt";
}

function responseVaultFileName(row, format) {
  const ext = responseVaultFormatExt(format);
  const source = codeVaultProjectName(row.source || "AI");
  const topic = codeVaultProjectName(row.topic || "response");
  const stamp = new Date(row.createdAt || Date.now()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const hash = String(row.hash || codeVaultHash(row.text || "")).slice(0, 8);
  return `${source}_${stamp}_${topic}_${hash}.${ext}`;
}

function responseVaultBody(row, format) {
  const ext = responseVaultFormatExt(format);
  const meta = {
    source: row.source || "AI",
    topic: row.topic || "",
    title: row.title || "",
    sourceUrl: row.sourceUrl || "",
    createdAt: new Date(row.createdAt || Date.now()).toISOString(),
    hash: row.hash || "",
    chars: String(row.text || "").length
  };
  const text = String(row.text || "");
  if (ext === "json") return JSON.stringify({ ...meta, text }, null, 2);
  if (ext === "html") {
    const esc = (value) => String(value || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    return [
      "<!doctype html><meta charset=\"utf-8\">",
      `<title>${esc(meta.source)} - ${esc(meta.topic)}</title>`,
      `<h1>${esc(meta.source)} response</h1>`,
      `<p><strong>Topic:</strong> ${esc(meta.topic)}<br><strong>Created:</strong> ${esc(meta.createdAt)}<br><strong>URL:</strong> ${esc(meta.sourceUrl)}</p>`,
      `<pre style="white-space:pre-wrap;font:14px/1.45 ui-monospace,Consolas,monospace">${esc(text)}</pre>`
    ].join("\n");
  }
  if (ext === "md") {
    return [
      `# ${meta.source} Response`,
      "",
      `- Topic: ${meta.topic}`,
      `- Created: ${meta.createdAt}`,
      `- URL: ${meta.sourceUrl}`,
      `- Hash: ${meta.hash}`,
      "",
      text
    ].join("\n");
  }
  return [
    `Source: ${meta.source}`,
    `Topic: ${meta.topic}`,
    `Title: ${meta.title}`,
    `URL: ${meta.sourceUrl}`,
    `Created: ${meta.createdAt}`,
    `Hash: ${meta.hash}`,
    "",
    text
  ].join("\n");
}

async function responseVaultRowsForMessage(message) {
  await ensureResponseVault();
  const all = await codeVaultDb.getAllResponses();
  const ids = Array.isArray(message.ids) ? new Set(message.ids.map((id) => Number(id))) : null;
  const selectedOnly = message.selectedOnly !== false;
  const rows = all.filter((row) => {
    if (ids && !ids.has(Number(row.id))) return false;
    if (!ids && selectedOnly && row.selected === false) return false;
    return String(row.text || "").trim();
  });
  rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return rows;
}

async function responseVaultSaveOne(incoming, sender) {
  const text = String(incoming.text || incoming.response || "").trim();
  if (!text) return { ok: false, error: "Empty response skipped." };
  const sourceUrl = incoming.sourceUrl || (sender && sender.tab && sender.tab.url) || "";
  const source = responseVaultSourceName(incoming.source, sourceUrl);
  const topic = responseVaultTopicName(incoming.topic, incoming.title || (sender && sender.tab && sender.tab.title) || "", sourceUrl);
  const hash = incoming.hash || codeVaultHash(`${source}\n${topic}\n${sourceUrl}\n${text}`);
  const duplicate = await codeVaultDb.getResponseByHash(hash);
  if (duplicate) return { ok: true, duplicate: true, response: duplicate, message: `Already saved: ${topic}` };
  const row = {
    source,
    topic,
    title: incoming.title || (sender && sender.tab && sender.tab.title) || "",
    sourceUrl,
    text,
    hash,
    selected: incoming.selected !== false,
    createdAt: incoming.createdAt || Date.now()
  };
  const id = await codeVaultDb.addResponse(row);
  if (!id) return { ok: true, duplicate: true, message: `Already saved: ${topic}` };
  row.id = id;
  return { ok: true, duplicate: false, response: row, message: `Saved response: ${topic}` };
}

async function responseVaultDownloadZip(rows, options) {
  const format = responseVaultFormatExt(options && options.format);
  const safeName = codeVaultProjectName((options && options.zipName) || `AI_Responses_${new Date().toISOString().slice(0, 10)}`);
  const zip = new JSZip();
  const manifest = {
    app: "ARIA Nexus One Hub",
    type: "AI response vault",
    createdAt: new Date().toISOString(),
    format,
    count: rows.length,
    responses: rows.map((row) => ({
      id: row.id,
      source: row.source,
      topic: row.topic,
      title: row.title,
      sourceUrl: row.sourceUrl,
      createdAt: new Date(row.createdAt || Date.now()).toISOString(),
      hash: row.hash,
      chars: String(row.text || "").length,
      filename: responseVaultFileName(row, format)
    }))
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  rows.forEach((row) => {
    zip.file(`responses/${responseVaultFileName(row, format)}`, responseVaultBody(row, format));
  });
  zip.file("README.txt", [
    "ARIA Nexus One Hub - AI Response Vault",
    `Created: ${manifest.createdAt}`,
    `Responses: ${rows.length}`,
    "",
    "Each response file includes source, timestamp, topic, URL, and text."
  ].join("\n"));
  const b64 = await zip.generateAsync({ type: "base64" });
  const count = Number(await codeVaultDb.getSetting(RESPONSE_VAULT_ZIP_COUNT_KEY) || 0) + 1;
  await codeVaultDb.setSetting(RESPONSE_VAULT_ZIP_COUNT_KEY, count);
  return codeVaultDownloadDataUrl(`data:application/zip;base64,${b64}`, `AI_Responses/${safeName}_${timestamp()}.zip`);
}

function responseVaultAgentPayload(rows, options) {
  const format = responseVaultFormatExt(options && options.format);
  return {
    app: "ARIA Nexus One Hub",
    createdAt: new Date().toISOString(),
    format,
    agents: Array.isArray(options && options.agents) ? options.agents : [],
    responses: rows.map((row) => ({
      filename: responseVaultFileName(row, format),
      source: row.source,
      topic: row.topic,
      sourceUrl: row.sourceUrl,
      createdAt: new Date(row.createdAt || Date.now()).toISOString(),
      text: row.text || ""
    }))
  };
}

async function responseVaultSendAgents(rows, options) {
  const payload = responseVaultAgentPayload(rows, options || {});
  const results = [];
  const text = JSON.stringify(payload, null, 2);
  const filename = `AI_Responses/Agent_Forwards/response_agent_payload_${timestamp()}.json`;
  const download = await codeVaultDownloadDataUrl(`data:application/json;charset=utf-8,${encodeURIComponent(text)}`, filename);
  results.push({ target: "local_agent_payload", ...download });
  const webhookUrl = String((options && options.webhookUrl) || "").trim();
  if (webhookUrl) {
    if (!webhookUrl.startsWith("https://")) {
      return { ok: false, error: "Webhook URL must start with https:// so AI responses are not sent over plain HTTP." };
    }
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text
      });
      results.push({ target: "webhook", ok: response.ok, status: response.status });
    } catch (err) {
      results.push({ target: "webhook", ok: false, error: String(err && err.message || err) });
    }
  }
  return { ok: true, results, message: `Agent payload ready. Responses: ${rows.length}.` };
}

async function handleResponseVaultMessage(message, sender) {
  await ensureResponseVault();
  const action = message.action || message.type || "";
  if (action === "ARIA_RESPONSE_VAULT_SAVE" || action === "ARIA_RESPONSE_VAULT_SAVE_ONE") {
    return responseVaultSaveOne(message.payload || message.response || {}, sender);
  }
  if (action === "ARIA_RESPONSE_VAULT_SAVE_MANY") {
    const responses = Array.isArray(message.responses) ? message.responses : [];
    const results = [];
    for (const response of responses) results.push(await responseVaultSaveOne(response, sender));
    const saved = results.filter((item) => item && item.ok && !item.duplicate).length;
    const duplicates = results.filter((item) => item && item.duplicate).length;
    return { ok: true, saved, duplicates, total: responses.length, results, message: `Response vault: saved ${saved}, duplicate ${duplicates}.` };
  }
  if (action === "ARIA_RESPONSE_VAULT_LIST") {
    const rows = await codeVaultDb.getAllResponses();
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const zipCount = Number(await codeVaultDb.getSetting(RESPONSE_VAULT_ZIP_COUNT_KEY) || 0);
    return { ok: true, responses: rows, count: rows.length, zipCount };
  }
  if (action === "ARIA_RESPONSE_VAULT_UPDATE") {
    await codeVaultDb.updateResponse(Number(message.id), message.data || {});
    return { ok: true, message: "Response updated." };
  }
  if (action === "ARIA_RESPONSE_VAULT_SELECT_ALL") {
    await codeVaultDb.setAllResponsesSelected(message.selected !== false);
    return { ok: true, message: message.selected === false ? "Deselected all responses." : "Selected all responses." };
  }
  if (action === "ARIA_RESPONSE_VAULT_DELETE") {
    await codeVaultDb.deleteResponse(Number(message.id));
    return { ok: true, message: "Response deleted." };
  }
  if (action === "ARIA_RESPONSE_VAULT_CLEAR") {
    await codeVaultDb.clearResponses();
    return { ok: true, message: "Response vault cleared." };
  }
  if (action === "ARIA_RESPONSE_VAULT_DOWNLOAD_ZIP") {
    const rows = await responseVaultRowsForMessage(message);
    if (!rows.length) return { ok: false, error: "No selected responses. Save/copy responses first." };
    return responseVaultDownloadZip(rows, message);
  }
  if (action === "ARIA_RESPONSE_VAULT_SEND_AGENTS") {
    const rows = await responseVaultRowsForMessage(message);
    if (!rows.length) return { ok: false, error: "No selected responses to send." };
    return responseVaultSendAgents(rows, message);
  }
  if (action === "ARIA_RESPONSE_VAULT_STORE_SEND") {
    const rows = await responseVaultRowsForMessage(message);
    if (!rows.length) return { ok: false, error: "No selected responses to store/send." };
    const zipReply = await responseVaultDownloadZip(rows, message);
    const agentReply = await responseVaultSendAgents(rows, message);
    const storageResults = [];
    const storages = Array.isArray(message.storages) ? message.storages : [];
    if (storages.includes("google_drive")) {
      try {
        const drive = await postDrivePayload({
          title: (message.zipName || "AI Responses") + " manifest",
          content: JSON.stringify(responseVaultAgentPayload(rows, message), null, 2),
          folder: "AI_Responses",
          source: "ARIA Response Vault"
        });
        storageResults.push({ target: "google_drive", ok: true, result: drive });
      } catch (err) {
        storageResults.push({ target: "google_drive", ok: false, error: String(err && err.message || err) });
      }
    }
    storages.filter((name) => name !== "local" && name !== "google_drive").forEach((name) => {
      storageResults.push({ target: name, ok: false, error: "Configure OAuth/webhook bridge for this provider." });
    });
    return {
      ok: true,
      zip: zipReply,
      agents: agentReply,
      storage: storageResults,
      message: `ZIP built and agent package prepared. Responses: ${rows.length}.`
    };
  }
  return { ok: false, error: `Unknown response vault action: ${action}` };
}

// ARIA v4.8.0 — Feature 9: Daily run counter + reset
function dailyDateKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function collectDailyStats(data) {
  const todayKey = `ariaDailySent:${dailyDateKey()}`;
  let lifetime = 0;
  Object.entries(data || {}).forEach(([key, value]) => {
    if (key.startsWith("ariaDailySent:")) lifetime += Number(value) || 0;
  });
  return {
    date: dailyDateKey(),
    today: Number((data || {})[todayKey]) || 0,
    lifetime
  };
}

function getDailyStats(sendResponse) {
  chrome.storage.local.get(null, (data) => {
    sendResponse({ ok: true, ...collectDailyStats(data || {}) });
  });
}

function incrementDailyCounter(sendResponse) {
  chrome.storage.local.get(null, (data) => {
    const existing = data || {};
    const key = `ariaDailySent:${dailyDateKey()}`;
    const next = (Number(existing[key]) || 0) + 1;
    chrome.storage.local.set({ [key]: next }, () => {
      sendResponse({ ok: true, ...collectDailyStats({ ...existing, [key]: next }) });
    });
  });
}

// ARIA v4.8.0 — Feature 15: Webhook notification on stop/limit
function webhookNotify(payload, sendResponse) {
  const body = payload && typeof payload === "object" ? payload : {};
  const webhookUrl = String(body.webhookUrl || "").trim();
  if (!webhookUrl) {
    sendResponse({ ok: false, error: "Webhook URL is empty." });
    return;
  }
  if (!webhookUrl.startsWith("https://")) {
    sendResponse({ ok: false, error: "Webhook URL must start with https:// so automation details are not sent over plain HTTP." });
    return;
  }
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: body.event || "aria_stop",
      reason: body.reason || "",
      runCount: Number(body.runCount) || 0,
      url: body.url || "",
      title: body.title || "",
      timestamp: body.timestamp || new Date().toISOString()
    })
  }).then((response) => {
    sendResponse({ ok: response.ok, status: response.status });
  }).catch((err) => {
    sendResponse({ ok: false, error: String(err && err.message || err) });
  });
}

function isOmniTargetUrl(url) {
  const value = String(url || "").toLowerCase();
  if (!/^(https?:|file:)\/\//.test(value)) return false;
  return [
    "chatgpt.com",
    "chat.openai.com",
    "claude.ai",
    "gemini.google.com",
    "aistudio.google.com",
    "makersuite.google.com",
    "ai.google.dev",
    "app.clickup.com",
    "manus.",
    "deepseek.com",
    "chat.mistral.ai",
    "grok.com",
    "poe.com",
    "perplexity.ai",
    "smith.langchain.com",
    "langchain.com",
    "cursor.com",
    "cursor.sh",
    "v0.dev",
    "bolt.new",
    "lovable.dev",
    "antigravity",
    "fireworks.ai",
    "huggingface.co"
  ].some((needle) => value.includes(needle));
}

function appendFusionData(message, sender, sendResponse) {
  // ARIA v4.10.0 - OMNI merge: keep latest cross-app captured responses.
  const payload = message && message.payload && typeof message.payload === "object" ? message.payload : message || {};
  const text = String(payload.text || "");
  if (!text.trim()) {
    sendResponse({ ok: false, error: "No fusion text received." });
    return;
  }
  const record = {
    text,
    source: String(payload.source || ""),
    url: String(payload.url || (sender && sender.tab && sender.tab.url) || ""),
    title: String(payload.title || (sender && sender.tab && sender.tab.title) || ""),
    tabId: sender && sender.tab ? sender.tab.id : null,
    timestamp: payload.timestamp || new Date().toISOString()
  };
  fusionMemory.push(record);
  fusionMemory = fusionMemory.slice(-50);
  chrome.storage.local.set({ [FUSION_MEMORY_KEY]: fusionMemory }, () => {
    sendResponse({ ok: true, saved: true, count: fusionMemory.length, latest: record });
  });
}

function handleOmniSyncAll(message, sender, sendResponse) {
  // ARIA v4.10.0 - OMNI merge: relay a prompt to all open AI/coding tabs only.
  const explicitText = String((message && (message.text || message.prompt || message.payload)) || "").trim();
  const lastText = fusionMemory.length ? String(fusionMemory[fusionMemory.length - 1].text || "").trim() : "";
  const text = explicitText || lastText;
  if (!text) {
    sendResponse({ ok: false, error: "No OMNI text available. Capture a response first or pass text." });
    return;
  }
  chrome.tabs.query({}, (tabs) => {
    const targets = (tabs || []).filter((tab) => {
      if (!tab || typeof tab.id !== "number") return false;
      if (sender && sender.tab && tab.id === sender.tab.id && message && message.excludeSender) return false;
      return isOmniTargetUrl(tab.url);
    });
    if (!targets.length) {
      sendResponse({ ok: false, error: "No supported AI tabs found for OMNI sync." });
      return;
    }
    let finished = 0;
    let sent = 0;
    const errors = [];
    targets.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: "ARIA_OMNI_SEND", text }, (reply) => {
        finished += 1;
        if (chrome.runtime.lastError || !reply || reply.ok === false) {
          errors.push({ tabId: tab.id, title: tab.title || "", error: chrome.runtime.lastError ? chrome.runtime.lastError.message : (reply && reply.error) || "No reply" });
        } else {
          sent += 1;
        }
        if (finished >= targets.length) {
          sendResponse({ ok: sent > 0, sent, attempted: targets.length, errors });
        }
      });
    });
  });
}

function getApiVault(sendResponse) {
  chrome.storage.local.get([API_VAULT_KEY, GROQ_SETTINGS_KEY], (data) => {
    sendResponse({
      ok: true,
      vault: data[API_VAULT_KEY] || {},
      groqSettings: data[GROQ_SETTINGS_KEY] || {}
    });
  });
}

function saveApiVault(message, sendResponse) {
  const payload = message && message.payload && typeof message.payload === "object" ? message.payload : {};
  chrome.storage.local.set({ [API_VAULT_KEY]: payload }, () => {
    sendResponse({ ok: true, saved: true });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && String(message.type || "").startsWith("ARIA_RESPONSE_VAULT_")) {
    handleResponseVaultMessage(message, sender).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    });
    return true;
  }
  if (message && (
    String(message.type || "").startsWith("ARIA_SUPER_CODE_VAULT_") ||
    ["SAVE_CODE", "GET_FILES", "DOWNLOAD_ZIP", "CLEAR_DATABASE"].includes(message.action)
  )) {
    handleCodeVaultMessage(message, sender).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_RELOAD_EXTENSION") {
    sendResponse({ ok: true, message: "Reloading ARIA Nexus One Hub..." });
    setTimeout(() => chrome.runtime.reload(), 120);
    return true;
  }
  if (message && message.type === "ARIA_FUSION_DATA") {
    appendFusionData(message, sender, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SYNC_ALL") {
    handleOmniSyncAll(message, sender, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_VAULT_GET") {
    getApiVault(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_VAULT_SAVE") {
    saveApiVault(message, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_GET_TAB_ID") {
    sendResponse({
      tabId: sender && sender.tab ? sender.tab.id : null,
      windowId: sender && sender.tab ? sender.tab.windowId : null
    });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_NATIVE_CLICK") {
    nativeClick(message, sender, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_NATIVE_ENTER") {
    nativeEnter(message, sender, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_REGISTER_TAB") {
    sendResponse(registerRunner(sender, message));
    return true;
  }
  if (message && message.type === "ARIA_SUPER_CLAIM_LEADER") {
    claimSyncLeader(sender, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_UNREGISTER_TAB") {
    sendResponse(unregisterRunner(sender));
    return true;
  }
  if (message && (message.type === "ARIA_SUPER_OFFSCREEN_TICK" || message.type === "ARIA_SUPER_OFFSCREEN_READY")) {
    pump(message.type === "ARIA_SUPER_OFFSCREEN_READY");
    sendResponse({ ok: true, runningTabs: runners.size });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_GET_RUNNERS") {
    const data = {};
    runners.forEach((runner, tabId) => { data[String(tabId)] = runnerToObject(runner); });
    sendResponse({ ok: true, runners: data, runningTabs: runners.size });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_DAILY_STATS") {
    getDailyStats(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_DAILY_INCREMENT") {
    incrementDailyCounter(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_WEBHOOK_NOTIFY") {
    webhookNotify(message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_SCREENSHOT") {
    captureTabScreenshot(sender, message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_CHAIN_START") {
    chainStart(message, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_HEALTH_CHECK") {
    healthCheck(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_COPY_TEXT_TO_CLIPBOARD") {
    writeClipboardText(message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_READ_CLIPBOARD") {
    readClipboardText(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_RELAY_CLICKUP_TO_CHATGPT") {
    relayClickUpToChatGpt(message, sender).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_DOWNLOAD_IMAGE") {
    downloadImage(sender, message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_DOWNLOAD_DIRECT_VIDEO") {
    downloadDirectVideo(sender, message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_DOWNLOAD_TEXT") {
    downloadTextFile(sender, message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_QUEUE_DRIVE_SAVE") {
    queueDriveSave(message.payload || {}, message.reason || "", sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_GET_DRIVE_QUEUE") {
    getDriveQueue(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_FLUSH_DRIVE_QUEUE") {
    flushDriveQueue(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_SHOW_DOWNLOADS") {
    chrome.downloads.showDefaultFolder();
    sendResponse({ ok: true });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_GET_GROQ_SETTINGS") {
    getGroqSettings(sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_SAVE_GROQ_SETTINGS") {
    saveGroqSettings(message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_GROQ_CAPTION") {
    groqCaption(message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_SMART_PROMPT") {
    smartPrompt(message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_REVENUE_BRIEF") {
    revenueBrief(message.payload || {}, sendResponse);
    return true;
  }
  if (message && message.type === "ARIA_SUPER_LOG_SOCIAL") {
    appendSocialLog(message.payload || {});
    sendResponse({ ok: true });
    return true;
  }
  if (message && message.type === "ARIA_SUPER_GET_SAVED_IMAGES") {
    chrome.storage.local.get([SAVED_IMAGES_KEY], (data) => {
      sendResponse({ ok: true, saved: Array.isArray(data[SAVED_IMAGES_KEY]) ? data[SAVED_IMAGES_KEY] : [] });
    });
    return true;
  }
  return false;
});

if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(setupContextMenus);
}

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(setupContextMenus);
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info || info.menuItemId !== DIRECT_VIDEO_MENU_ID) return;
    const url = info.srcUrl || info.linkUrl || info.pageUrl || "";
    if (!isDirectVideoUrl(url)) {
      chrome.storage.local.set({
        ariaSuperLastDirectVideoError: {
          url,
          message: "Not a direct video URL. Open the official export/download link first.",
          at: new Date().toISOString()
        }
      });
      return;
    }
    const sender = { tab };
    chrome.storage.local.get([OPTIONS_KEY], (data) => {
      const options = data && data[OPTIONS_KEY] ? data[OPTIONS_KEY] : {};
      downloadDirectVideo(sender, { url, folder: options.videoFolder || DEFAULT_VIDEO_FOLDER }, () => {});
    });
  });
}

setupContextMenus();

chrome.tabs.onRemoved.addListener((tabId) => {
  runners.delete(tabId);
  saveRunners();
  ensureAlarm();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!runners.has(tabId)) return;
  if (changeInfo.url && !isSupportedUrl(changeInfo.url)) {
    runners.delete(tabId);
    setTabAutoDiscardable(tabId, true);
    saveRunners();
    ensureAlarm();
    return;
  }
  const runner = runners.get(tabId);
  runner.url = tab && tab.url ? tab.url : runner.url;
  runner.title = tab && tab.title ? tab.title : runner.title;
  runner.updatedAt = now();
  runners.set(tabId, runner);
  saveRunners();
  ensureAlarm();
});

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === ALARM_NAME) {
      pump(true);
      ensureAlarm();
    }
  });
}

function restoreStoredRunners(stored) {
  const entries = Object.entries(stored || {});
  if (!entries.length || !chrome.tabs || !chrome.tabs.get) {
    ensureAlarm();
    return;
  }
  let pending = entries.length;
  let dirty = false;
  const finish = () => {
    pending -= 1;
    if (pending > 0) return;
    if (dirty) saveRunners();
    ensureAlarm();
  };
  entries.forEach(([tabIdText, runner]) => {
    const tabId = Number.parseInt(tabIdText, 10);
    if (!Number.isFinite(tabId) || !runner) {
      dirty = true;
      finish();
      return;
    }
    chrome.tabs.get(tabId, (tab) => {
      const tabUrl = tab && tab.url ? tab.url : "";
      // ARIA v4.8.0 — background fix: do not restore runners for browser/extension internals.
      if (chrome.runtime.lastError || !tab || !isSupportedUrl(tabUrl) || /^(chrome|chrome-extension|edge|about):\/\//i.test(tabUrl)) {
        dirty = true;
        finish();
        return;
      }
      runners.set(tabId, {
        ...runner,
        tabId,
        intervalMs: Math.max(1000, Number(runner.intervalMs) || 5000),
        lastTickAt: Number(runner.lastTickAt) || 0,
        failureCount: Number(runner.failureCount) || 0
      });
      setTabAutoDiscardable(tabId, false);
      finish();
    });
  });
}

chrome.storage.local.get([RUNNERS_KEY], (data) => {
  restoreStoredRunners(data && data[RUNNERS_KEY] ? data[RUNNERS_KEY] : {});
});

setTimeout(ensureAlarm, 1000);
