const RUNNERS = new Map();
const ALARM = "aria-gpt-word-copier-pump";

function now() {
  return Date.now();
}

function isChatgptUrl(url) {
  try {
    const host = new URL(url || "").host;
    return host === "chatgpt.com" || host === "chat.openai.com";
  } catch (err) {
    return false;
  }
}

function runnerObject(runner) {
  return {
    tabId: runner.tabId,
    intervalMs: runner.intervalMs,
    lastTickAt: runner.lastTickAt || 0,
    title: runner.title || "",
    url: runner.url || ""
  };
}

function ensureAlarm() {
  if (!chrome.alarms) return;
  if (RUNNERS.size) {
    chrome.alarms.create(ALARM, { periodInMinutes: 0.25 });
  } else {
    chrome.alarms.clear(ALARM);
  }
}

function register(sender, message) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (!tab || tab.id === undefined || !isChatgptUrl(tab.url || message.url)) {
    return { ok: false, error: "ChatGPT tab not found." };
  }
  const runner = {
    tabId: tab.id,
    intervalMs: Math.max(1000, Number(message.intervalMs) || 5000),
    lastTickAt: 0,
    title: message.title || tab.title || "",
    url: message.url || tab.url || ""
  };
  RUNNERS.set(tab.id, runner);
  try {
    chrome.tabs.update(tab.id, { autoDiscardable: false });
  } catch (err) {}
  ensureAlarm();
  pump(true);
  return { ok: true, tabId: tab.id, runningTabs: RUNNERS.size };
}

function unregister(sender) {
  const tab = sender && sender.tab ? sender.tab : null;
  if (tab && tab.id !== undefined) {
    RUNNERS.delete(tab.id);
    try {
      chrome.tabs.update(tab.id, { autoDiscardable: true });
    } catch (err) {}
  }
  ensureAlarm();
  return { ok: true, runningTabs: RUNNERS.size };
}

function sendTick(tabId, runner, force) {
  chrome.tabs.sendMessage(tabId, { type: "ARIA_GPT_WORD_TICK", force: Boolean(force), sentAt: now() }, (reply) => {
    if (chrome.runtime.lastError || !reply || !reply.ok || reply.running === false) {
      if (reply && reply.running === false) {
        RUNNERS.delete(tabId);
      }
      ensureAlarm();
      return;
    }
    const next = RUNNERS.get(tabId);
    if (!next) return;
    next.intervalMs = Math.max(1000, Number(reply.intervalMs) || next.intervalMs || 5000);
    next.url = reply.url || next.url;
    next.title = reply.title || next.title;
    RUNNERS.set(tabId, next);
  });
}

function pump(force = false) {
  const t = now();
  RUNNERS.forEach((runner, tabId) => {
    const intervalMs = Math.max(1000, Number(runner.intervalMs) || 5000);
    const wakeEvery = Math.min(intervalMs, 5000);
    if (!force && runner.lastTickAt && t - runner.lastTickAt < wakeEvery) return;
    runner.lastTickAt = t;
    RUNNERS.set(tabId, runner);
    sendTick(tabId, runner, force);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "ARIA_GPT_WORD_REGISTER") {
    sendResponse(register(sender, message));
    return true;
  }
  if (message && message.type === "ARIA_GPT_WORD_UNREGISTER") {
    sendResponse(unregister(sender));
    return true;
  }
  if (message && message.type === "ARIA_GPT_WORD_STATUS") {
    const data = {};
    RUNNERS.forEach((runner, tabId) => {
      data[String(tabId)] = runnerObject(runner);
    });
    sendResponse({ ok: true, runningTabs: RUNNERS.size, runners: data });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  RUNNERS.delete(tabId);
  ensureAlarm();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (RUNNERS.has(tabId) && changeInfo.url && !isChatgptUrl(changeInfo.url)) {
    RUNNERS.delete(tabId);
    ensureAlarm();
  }
});

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === ALARM) pump(true);
  });
}

setInterval(() => pump(false), 1000);
