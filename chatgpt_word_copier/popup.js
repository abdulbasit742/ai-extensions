const OPTIONS_KEY = "ariaGptWordCopierOptions";
const DEFAULTS = {
  server: "http://127.0.0.1:5050",
  startNumber: 1,
  endNumber: 50,
  intervalSeconds: 8,
  saveMode: "code",
  prefix: ""
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  $("status").textContent = String(text || "");
}

function readOptions() {
  return {
    server: $("server").value.trim() || DEFAULTS.server,
    startNumber: Math.max(1, parseInt($("startNumber").value || "1", 10) || 1),
    endNumber: Math.max(1, parseInt($("endNumber").value || "50", 10) || 50),
    intervalSeconds: Math.max(2, parseInt($("interval").value || "8", 10) || 8),
    saveMode: $("saveMode").value || "code",
    prefix: $("prefix").value.trim()
  };
}

function applyOptions(options) {
  $("server").value = options.server || DEFAULTS.server;
  $("startNumber").value = options.startNumber || 1;
  $("endNumber").value = options.endNumber || 50;
  $("interval").value = options.intervalSeconds || 8;
  $("saveMode").value = options.saveMode || "code";
  $("prefix").value = options.prefix || "";
}

function storageGet() {
  return new Promise((resolve) => chrome.storage.local.get([OPTIONS_KEY], (data) => resolve(data[OPTIONS_KEY] || DEFAULTS)));
}

function storageSet(options) {
  return new Promise((resolve) => chrome.storage.local.set({ [OPTIONS_KEY]: options }, resolve));
}

function activeTab() {
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0])));
}

function sendToActive(message) {
  return activeTab().then((tab) => new Promise((resolve) => {
    if (!tab || !tab.id) {
      resolve({ ok: false, error: "No active tab." });
      return;
    }
    chrome.tabs.sendMessage(tab.id, message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(reply || { ok: true });
    });
  }));
}

async function refreshStatus() {
  const reply = await sendToActive({ type: "ARIA_GPT_WORD_STATUS_PAGE" });
  setStatus(JSON.stringify(reply, null, 2));
}

document.addEventListener("DOMContentLoaded", async () => {
  applyOptions(await storageGet());
  refreshStatus();
});

$("run").onclick = async () => {
  const options = readOptions();
  await storageSet(options);
  const reply = await sendToActive({ type: "ARIA_GPT_WORD_START", options });
  setStatus(JSON.stringify(reply, null, 2));
};

$("stop").onclick = async () => {
  const reply = await sendToActive({ type: "ARIA_GPT_WORD_STOP" });
  setStatus(JSON.stringify(reply, null, 2));
};

$("saveLatest").onclick = async () => {
  const options = readOptions();
  await storageSet(options);
  const reply = await sendToActive({ type: "ARIA_GPT_WORD_SAVE_LATEST", options });
  setStatus(JSON.stringify(reply, null, 2));
};

$("openWord").onclick = async () => {
  const options = readOptions();
  try {
    const res = await fetch(options.server.replace(/\/+$/, "") + "/api/gpt-word/open-document", { method: "POST" });
    setStatus(JSON.stringify(await res.json(), null, 2));
  } catch (err) {
    setStatus("Could not reach ARIA server: " + err.message);
  }
};

$("openFolder").onclick = async () => {
  const options = readOptions();
  try {
    const res = await fetch(options.server.replace(/\/+$/, "") + "/api/gpt-word/open-folder", { method: "POST" });
    setStatus(JSON.stringify(await res.json(), null, 2));
  } catch (err) {
    setStatus("Could not reach ARIA server: " + err.message);
  }
};

$("statusBtn").onclick = refreshStatus;
