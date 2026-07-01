const DEFAULT_SERVER_BASE = "http://127.0.0.1:5050";
const SERVER_BASE_KEY = "ariaServerBase";
const OPTIONS_KEY = "ariaChatgptSenderOptions";
const DEFAULT_INTERVAL_SECONDS = 5;

const statusEl = document.getElementById("status");
const intervalEl = document.getElementById("interval");
const serverEl = document.getElementById("server");
const sendModeEl = document.getElementById("sendMode");
const customTextEl = document.getElementById("customText");
const nextNumberEl = document.getElementById("nextNumber");

function setStatus(message) {
  statusEl.textContent = message;
}

function intervalMs() {
  const seconds = Math.max(1, Number.parseInt(intervalEl.value || String(DEFAULT_INTERVAL_SECONDS), 10) || DEFAULT_INTERVAL_SECONDS);
  intervalEl.value = String(seconds);
  return seconds * 1000;
}

function sanitizeOptions(raw) {
  const options = {
    sendMode: (raw && raw.sendMode) || "number",
    customText: (raw && raw.customText) || ".",
    intervalMs: Math.max(1000, Number.parseInt(raw && raw.intervalMs, 10) || DEFAULT_INTERVAL_SECONDS * 1000)
  };
  if (!["number", "dot", "custom"].includes(options.sendMode)) {
    options.sendMode = "number";
  }
  options.customText = String(options.customText || ".").slice(0, 400);
  return options;
}

function currentOptions() {
  return sanitizeOptions({
    sendMode: sendModeEl.value,
    customText: customTextEl.value,
    intervalMs: intervalMs()
  });
}

function saveOptions() {
  const options = currentOptions();
  sendModeEl.value = options.sendMode;
  customTextEl.value = options.customText;
  intervalEl.value = String(Math.round(options.intervalMs / 1000));
  chrome.storage.local.set({ [OPTIONS_KEY]: options });
  return options;
}

function loadOptions() {
  return new Promise((resolve) => {
    chrome.storage.local.get([OPTIONS_KEY], (data) => {
      const options = sanitizeOptions(data && data[OPTIONS_KEY]);
      sendModeEl.value = options.sendMode;
      customTextEl.value = options.customText;
      intervalEl.value = String(Math.round(options.intervalMs / 1000));
      resolve(options);
    });
  });
}

function normalizeServerBase(value) {
  let base = String(value || DEFAULT_SERVER_BASE).trim();
  if (!base) base = DEFAULT_SERVER_BASE;
  if (!/^https?:\/\//i.test(base)) base = "http://" + base;
  base = base.replace(/\/+$/, "");
  base = base.replace(/\/api\/chatgpt$/i, "").replace(/\/api$/i, "");
  return base;
}

function dashboardUrl() {
  return normalizeServerBase(serverEl.value) + "/";
}

function apiBase() {
  return normalizeServerBase(serverEl.value) + "/api/chatgpt";
}

function saveServerBase() {
  const base = normalizeServerBase(serverEl.value);
  serverEl.value = base;
  chrome.storage.local.set({ [SERVER_BASE_KEY]: base });
  return base;
}

function loadServerBase() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SERVER_BASE_KEY], (data) => {
      serverEl.value = normalizeServerBase((data && data[SERVER_BASE_KEY]) || DEFAULT_SERVER_BASE);
      resolve(serverEl.value);
    });
  });
}

function isChatGPT(tab) {
  try {
    const host = new URL(tab.url || "").host;
    return host === "chatgpt.com" || host === "chat.openai.com";
  } catch (err) {
    return false;
  }
}

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0]));
  });
}

async function postJson(path, body) {
  saveServerBase();
  const response = await fetch(apiBase() + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) throw new Error(`ARIA server ${response.status}`);
  return response.json();
}

async function getJson(path) {
  saveServerBase();
  const response = await fetch(apiBase() + path, { cache: "no-store" });
  if (!response.ok) throw new Error(`ARIA server ${response.status}`);
  return response.json();
}

function sendToActiveTab(message) {
  return new Promise(async (resolve) => {
    const tab = await queryActiveTab();
    if (!tab || !tab.id) return resolve({ ok: false, error: "No active tab." });
    chrome.tabs.sendMessage(tab.id, message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(reply || { ok: true });
      }
    });
  });
}

async function start() {
  const tab = await queryActiveTab();
  if (!tab || !isChatGPT(tab)) {
    setStatus("Open the ChatGPT tab first, then click this extension again.");
    return;
  }

  const ms = intervalMs();
  const options = saveOptions();
  setStatus("Starting on this ChatGPT tab...");
  const reply = await sendToActiveTab({ type: "ARIA_START", intervalMs: ms, options });
  setStatus(reply.ok
    ? `Running on this tab only.\nBackground wake: ${reply.backgroundScheduler ? "ON" : "starting"}\nMode: ${reply.sendMode || options.sendMode}\nNext: ${reply.nextSendText || ""}\nSent count: ${reply.runCount || 0}\nImages saved this page: ${reply.imageSaveCount || 0}\n${reply.lastMessage || ""}`
    : `Could not reach this ChatGPT tab.\nRefresh the ChatGPT tab once if panel is not visible.\n${reply.error || ""}`);
}

async function stop() {
  setStatus("Stopping...");
  const reply = await sendToActiveTab({ type: "ARIA_STOP" });
  setStatus(reply.ok ? "Stopped this tab only." : "Current tab did not answer.");
}

async function refresh() {
  try {
    const server = await getJson("/status");
    const tab = await queryActiveTab();
    let page = null;
    if (tab && isChatGPT(tab)) {
      page = await sendToActiveTab({ type: "ARIA_STATUS" });
    }
    setStatus(
      `Server: ${server.extension && server.extension.running ? "ON" : "OFF"}\n` +
      `Target: ${(server.extension && server.extension.target_url) || "(none)"}\n` +
      `Active page: ${page && page.ok ? "connected" : "not connected"}\n` +
      `Background wake: ${page && page.backgroundScheduler ? "ON" : "local/idle"}\n` +
      `Mode: ${(page && page.sendMode) || sendModeEl.value}\n` +
      `Next: ${(page && page.nextSendText) || ""}\n` +
      `Sent count: ${(page && page.runCount) || 0}\n` +
      `Images saved: ${(server.images && server.images.count) || 0}\n` +
      `${(page && page.lastMessage) || (server.extension && server.extension.message) || ""}`
    );
  } catch (err) {
    setStatus(`ARIA server not reachable.\nStart ARIA dashboard first, then set Server URL.\nCurrent: ${dashboardUrl()}`);
  }
}

async function saveSettings() {
  const options = saveOptions();
  const reply = await sendToActiveTab({ type: "ARIA_OPTIONS", options });
  setStatus(reply.ok
    ? `Settings saved.\nMode: ${reply.sendMode}\nNext: ${reply.nextSendText}`
    : "Settings saved for next run. Open ChatGPT tab to apply immediately.");
}

async function resetCounter() {
  const nextNumber = Math.max(1, Number.parseInt(nextNumberEl.value || "1", 10) || 1);
  nextNumberEl.value = String(nextNumber);
  const reply = await sendToActiveTab({ type: "ARIA_RESET_COUNTER", nextNumber });
  setStatus(reply.ok
    ? `Counter reset.\nNext: ${reply.nextSendText}\nSent count: ${reply.runCount}`
    : "Open ChatGPT tab first, then reset counter.");
}

document.getElementById("start").addEventListener("click", () => start().catch((err) => setStatus(`Start failed: ${err.message}`)));
document.getElementById("stop").addEventListener("click", () => stop().catch((err) => setStatus(`Stop failed: ${err.message}`)));
document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("save").addEventListener("click", () => saveSettings().catch((err) => setStatus(`Save failed: ${err.message}`)));
document.getElementById("reset").addEventListener("click", () => resetCounter().catch((err) => setStatus(`Reset failed: ${err.message}`)));
document.getElementById("dashboard").addEventListener("click", () => {
  saveServerBase();
  chrome.tabs.create({ url: dashboardUrl() });
});

document.querySelectorAll("[data-seconds]").forEach((button) => {
  button.addEventListener("click", () => {
    intervalEl.value = button.getAttribute("data-seconds") || String(DEFAULT_INTERVAL_SECONDS);
    saveSettings().catch(() => {});
  });
});

intervalEl.addEventListener("change", () => saveSettings().catch(() => {}));
sendModeEl.addEventListener("change", () => saveOptions());
customTextEl.addEventListener("input", () => saveOptions());

Promise.all([loadServerBase(), loadOptions()]).then(refresh);
