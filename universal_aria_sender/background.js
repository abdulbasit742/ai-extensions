const RUNNERS_KEY = "ariaUniversalTabRunners";
const ALARM_NAME = "aria-universal-runner-watchdog";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const runners = new Map();
let offscreenCreating = null;

function now() {
  return Date.now();
}

function isNormalWebUrl(url) {
  return /^(https?:|file:)\/\//i.test(String(url || ""));
}

function runnerToObject(runner) {
  return {
    tabId: runner.tabId,
    windowId: runner.windowId,
    intervalMs: runner.intervalMs,
    lastTickAt: runner.lastTickAt || 0,
    url: runner.url || "",
    title: runner.title || "",
    scopeId: runner.scopeId || "",
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
        console.warn("[ARIA Universal Background] discard setting failed", chrome.runtime.lastError.message);
      }
    });
  } catch (err) {
    console.warn("[ARIA Universal Background] discard setting failed", err);
  }
}

async function ensureOffscreenDocument() {
  try {
    if (!chrome.offscreen || runners.size === 0) return;
    if (offscreenCreating) {
      await offscreenCreating;
      return;
    }
    const hasDocument = await chrome.offscreen.hasDocument();
    if (hasDocument) return;
    offscreenCreating = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["WORKERS"],
      justification: "Keep ARIA universal tab runners awake while user works in other tabs."
    });
    await offscreenCreating;
  } catch (err) {
    console.warn("[ARIA Universal Background] offscreen unavailable", err);
  } finally {
    offscreenCreating = null;
  }
}

function ensureAlarm() {
  if (chrome.alarms) {
    if (runners.size > 0) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
    else chrome.alarms.clear(ALARM_NAME);
  }
  ensureOffscreenDocument();
}

function registerRunner(sender, message) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || tab.id === undefined || tab.id === null || !isNormalWebUrl(tab.url || message.url)) {
    return { ok: false, error: "No normal website tab found for registration." };
  }
  const intervalMs = Math.max(1000, Number(message.intervalMs) || 5000);
  const existing = runners.get(tab.id) || {};
  const runner = {
    ...existing,
    tabId: tab.id,
    windowId: tab.windowId,
    intervalMs,
    lastTickAt: 0,
    url: message.url || tab.url || existing.url || "",
    title: message.title || tab.title || existing.title || "",
    scopeId: message.scopeId || existing.scopeId || "",
    failureCount: 0,
    updatedAt: now()
  };
  runners.set(tab.id, runner);
  setTabAutoDiscardable(tab.id, false);
  saveRunners();
  ensureAlarm();
  pump(true);
  return { ok: true, tabId: tab.id, runner: runnerToObject(runner), runningTabs: runners.size };
}

function unregisterRunner(sender) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || tab.id === undefined || tab.id === null) {
    return { ok: false, error: "No tab found for unregister." };
  }
  runners.delete(tab.id);
  setTabAutoDiscardable(tab.id, true);
  saveRunners();
  ensureAlarm();
  return { ok: true, tabId: tab.id, runningTabs: runners.size };
}

function sendWakeTick(tabId, runner, force) {
  chrome.tabs.sendMessage(tabId, { type: "ARIA_UNIVERSAL_BACKGROUND_TICK", sentAt: now(), force: Boolean(force) }, (reply) => {
    const next = runners.get(tabId);
    if (!next) return;
    if (chrome.runtime.lastError || !reply || !reply.ok) {
      next.failureCount = (next.failureCount || 0) + 1;
      next.updatedAt = now();
      if (next.failureCount >= 20) {
        runners.delete(tabId);
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
      setTabAutoDiscardable(tabId, true);
      saveRunners();
      ensureAlarm();
      return;
    }
    next.failureCount = 0;
    next.url = reply.url || next.url;
    next.title = reply.title || next.title;
    next.scopeId = reply.counterScope || next.scopeId;
    next.intervalMs = Math.max(1000, Number(reply.intervalMs) || next.intervalMs || 5000);
    next.updatedAt = now();
    runners.set(tabId, next);
    saveRunners();
    ensureAlarm();
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ARIA_GET_TAB_ID") {
    sendResponse({
      tabId: sender && sender.tab ? sender.tab.id : null,
      windowId: sender && sender.tab ? sender.tab.windowId : null
    });
    return true;
  }
  if (message && message.type === "ARIA_UNIVERSAL_REGISTER_TAB") {
    sendResponse(registerRunner(sender, message));
    return true;
  }
  if (message && message.type === "ARIA_UNIVERSAL_UNREGISTER_TAB") {
    sendResponse(unregisterRunner(sender));
    return true;
  }
  if (message && (message.type === "ARIA_OFFSCREEN_TICK" || message.type === "ARIA_OFFSCREEN_READY")) {
    pump(message.type === "ARIA_OFFSCREEN_READY");
    sendResponse({ ok: true, runningTabs: runners.size });
    return true;
  }
  if (message && message.type === "ARIA_UNIVERSAL_GET_RUNNERS") {
    const data = {};
    runners.forEach((runner, tabId) => { data[String(tabId)] = runnerToObject(runner); });
    sendResponse({ ok: true, runners: data, runningTabs: runners.size });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  runners.delete(tabId);
  saveRunners();
  ensureAlarm();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!runners.has(tabId)) return;
  if (changeInfo.url && !isNormalWebUrl(changeInfo.url)) {
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

chrome.storage.local.get([RUNNERS_KEY], (data) => {
  const stored = data && data[RUNNERS_KEY] ? data[RUNNERS_KEY] : {};
  Object.keys(stored).forEach((tabIdText) => {
    const runner = stored[tabIdText];
    const tabId = Number.parseInt(tabIdText, 10);
    if (!Number.isFinite(tabId) || !runner) return;
    runners.set(tabId, {
      ...runner,
      tabId,
      intervalMs: Math.max(1000, Number(runner.intervalMs) || 5000),
      lastTickAt: Number(runner.lastTickAt) || 0,
      failureCount: Number(runner.failureCount) || 0
    });
    setTabAutoDiscardable(tabId, false);
  });
  ensureAlarm();
});

setInterval(() => pump(false), 1000);
setTimeout(ensureAlarm, 1000);
