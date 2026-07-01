const SERVER_BASE_KEY = "ariaUniversalServerBase";
const DEFAULT_SERVER = "http://127.0.0.1:5050";

const els = {
  server: document.getElementById("server"),
  seconds: document.getElementById("seconds"),
  mode: document.getElementById("mode"),
  text: document.getElementById("text"),
  out: document.getElementById("out")
};

function normalizeServer(value) {
  let base = String(value || DEFAULT_SERVER).trim();
  if (!/^https?:\/\//i.test(base)) base = "http://" + base;
  return base.replace(/\/+$/, "").replace(/\/api\/universal$/i, "").replace(/\/api$/i, "");
}

function setStatus(text) {
  els.out.textContent = text;
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));
}

function storageSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

async function load() {
  const data = await storageGet([SERVER_BASE_KEY, "ariaUniversalPopupOptions"]);
  els.server.value = data[SERVER_BASE_KEY] || DEFAULT_SERVER;
  const options = data.ariaUniversalPopupOptions || {};
  els.seconds.value = options.seconds || "5";
  els.mode.value = options.mode || "auto";
  els.text.value = options.text || "{n}";
}

async function save() {
  const serverBase = normalizeServer(els.server.value);
  els.server.value = serverBase;
  await storageSet({
    [SERVER_BASE_KEY]: serverBase,
    ariaUniversalPopupOptions: {
      seconds: els.seconds.value || "5",
      mode: els.mode.value || "auto",
      text: els.text.value || "{n}"
    }
  });
  return serverBase;
}

function api(path) {
  return normalizeServer(els.server.value) + "/api/universal" + path;
}

async function postJson(path, body) {
  const response = await fetch(api(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function getJson(path) {
  const response = await fetch(api(path), { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function queryActiveTab() {
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0])));
}

function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(reply || { ok: false, error: "No reply from tab" });
      }
    });
  });
}

function canRunOn(tab) {
  return tab && /^(https?:|file:)\/\//i.test(tab.url || "");
}

async function start() {
  const tab = await queryActiveTab();
  if (!canRunOn(tab)) {
    setStatus("Open a normal website tab first. Chrome/Edge internal pages cannot run extensions.");
    return;
  }
  const serverBase = await save();
  const seconds = Math.max(1, Number.parseInt(els.seconds.value || "5", 10) || 5);
  const payload = {
    running: true,
    interval_ms: seconds * 1000,
    send_text: els.text.value || "{n}",
    send_mode: els.mode.value || "auto",
    target_url: tab.url,
    title_keyword: tab.title || "",
    message: "Started from Universal popup."
  };
  setStatus("Starting current tab...");
  let serverNote = "Serverless mode";
  try {
    await postJson("/extension-state", payload);
    serverNote = "Server synced";
  } catch (err) {
    serverNote = "Server not reachable, running extension-only";
  }
  const reply = await sendToTab(tab.id, {
    type: "ARIA_UNIVERSAL_START",
    serverBase,
    intervalMs: seconds * 1000,
    sendText: payload.send_text,
    sendMode: payload.send_mode
  });
  setStatus(reply.ok
    ? `Running on this tab.\n${serverNote}\nNext: ${reply.nextSendText || ""}\nSent: ${reply.runCount || 0}\nScope: ${reply.counterScope || ""}`
    : `Dashboard armed, but current tab did not answer.\nRefresh the target page once.\n${reply.error || ""}`);
}

async function stop() {
  await save();
  setStatus("Stopping...");
  try {
    await postJson("/extension-state", { running: false, message: "Stopped from Universal popup." });
  } catch (err) {}
  const tab = await queryActiveTab();
  if (tab && tab.id) await sendToTab(tab.id, { type: "ARIA_UNIVERSAL_STOP" });
  setStatus("Stopped this tab.");
}

async function status() {
  await save();
  let server = { extension: {}, serverless: true };
  try {
    server = await getJson("/status");
  } catch (err) {
    server = { extension: { message: "Server not reachable. Extension-only mode still works." } };
  }
  const tab = await queryActiveTab();
  let page = null;
  if (tab && tab.id && canRunOn(tab)) page = await sendToTab(tab.id, { type: "ARIA_UNIVERSAL_STATUS" });
  const ext = server.extension || {};
  setStatus(
    `Server switch: ${ext.running ? "ON" : "OFF"}\n` +
    `Server target: ${ext.target_url || "(none)"}\n` +
    `Server active: ${ext.active_instance_title || "(waiting)"}\n` +
    `Page connected: ${page && page.ok ? "YES" : "NO"}\n` +
    `Page sent: ${(page && page.runCount) || 0}\n` +
    `Page next: ${(page && page.nextSendText) || ""}\n` +
    `${(page && page.lastMessage) || ext.message || ""}`
  );
}

async function reset() {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) return setStatus("No active tab.");
  const reply = await sendToTab(tab.id, { type: "ARIA_UNIVERSAL_RESET", nextNumber: 1 });
  setStatus(reply.ok ? `Counter reset.\nNext: ${reply.nextSendText}\nSent: ${reply.runCount}` : "Open the target tab first.");
}

document.getElementById("start").addEventListener("click", () => start().catch((err) => setStatus("Start failed: " + err.message)));
document.getElementById("stop").addEventListener("click", () => stop().catch((err) => setStatus("Stop failed: " + err.message)));
document.getElementById("status").addEventListener("click", () => status().catch((err) => setStatus("Status failed: " + err.message)));
document.getElementById("reset").addEventListener("click", () => reset().catch((err) => setStatus("Reset failed: " + err.message)));
document.getElementById("dashboard").addEventListener("click", async () => {
  const server = await save();
  chrome.tabs.create({ url: server + "/" });
});

load().then(() => status().catch(() => setStatus("Ready. Set server URL if needed, then Run This Tab.")));
