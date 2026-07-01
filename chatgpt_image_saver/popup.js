const OPTIONS_KEY = "ariaImageSaverOptions";
const DEFAULTS = {
  folderName: "Basit Social Media",
  filenamePrefix: "chatgpt_image",
  autoSave: true
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  $("status").textContent = text;
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(value) {
  return new Promise((resolve) => chrome.storage.local.set(value, resolve));
}

async function activeChatTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) {
    throw new Error("Open ChatGPT tab first, then click this extension.");
  }
  return tab;
}

function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(reply || { ok: false, error: "No response from page." });
    });
  });
}

function sendRuntime(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (reply) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(reply || { ok: false });
    });
  });
}

function currentOptions() {
  return {
    folderName: $("folder").value.trim() || DEFAULTS.folderName,
    filenamePrefix: $("prefix").value.trim() || DEFAULTS.filenamePrefix,
    autoSave: true
  };
}

async function saveOptions() {
  const options = currentOptions();
  await storageSet({ [OPTIONS_KEY]: options });
  try {
    const tab = await activeChatTab();
    await sendToTab(tab.id, { type: "ARIA_IMAGE_OPTIONS", options });
  } catch (_err) {
    // Saving global options still helps the next ChatGPT tab.
  }
  return options;
}

async function loadOptions() {
  const data = await storageGet([OPTIONS_KEY]);
  const options = { ...DEFAULTS, ...(data[OPTIONS_KEY] || {}) };
  $("folder").value = options.folderName;
  $("prefix").value = options.filenamePrefix;
}

async function runOnChat(message) {
  const tab = await activeChatTab();
  await saveOptions();
  return sendToTab(tab.id, message);
}

$("generate").addEventListener("click", async () => {
  try {
    setStatus("Sending image prompt...");
    const reply = await runOnChat({ type: "ARIA_IMAGE_GENERATE", prompt: $("prompt").value });
    setStatus(reply.ok ? "Prompt sent. Images will auto-save when ready." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

$("save").addEventListener("click", async () => {
  try {
    setStatus("Checking visible images...");
    const reply = await runOnChat({ type: "ARIA_IMAGE_SAVE_VISIBLE" });
    setStatus(reply.ok ? `Saved ${reply.saved || 0} new image(s). Found ${reply.found || 0}.` : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

$("panel").addEventListener("click", async () => {
  try {
    const reply = await runOnChat({ type: "ARIA_IMAGE_SHOW_PANEL" });
    setStatus(reply.ok ? "Panel shown inside ChatGPT." : `Error: ${reply.error}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

$("downloads").addEventListener("click", async () => {
  const reply = await sendRuntime({ type: "ARIA_IMAGE_SHOW_DOWNLOADS" });
  setStatus(reply.ok ? "Downloads folder opened." : `Error: ${reply.error}`);
});

$("folder").addEventListener("change", () => saveOptions().catch(() => {}));
$("prefix").addEventListener("change", () => saveOptions().catch(() => {}));

loadOptions().then(async () => {
  try {
    const tab = await activeChatTab();
    const reply = await sendToTab(tab.id, { type: "ARIA_IMAGE_STATUS" });
    if (reply.ok) setStatus(`${reply.status}\nSaved this page: ${reply.savedCount || 0}`);
  } catch (err) {
    setStatus(err.message);
  }
});
