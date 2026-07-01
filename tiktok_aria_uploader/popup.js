function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function activeTab() {
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0])));
}

function send(message) {
  return new Promise(async (resolve) => {
    const tab = await activeTab();
    if (!tab || !/^https:\/\/(www\.)?tiktok\.com\//i.test(tab.url || "")) {
      resolve({ ok: false, error: "Open TikTok page first." });
      return;
    }
    chrome.tabs.sendMessage(tab.id, message, (reply) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(reply || { ok: true });
    });
  });
}

async function action(type, label) {
  setStatus(label + "...");
  const reply = await send({ type });
  setStatus(reply.ok ? `${label} done.` : `Error: ${reply.error || "No response. Refresh TikTok tab once."}`);
}

document.getElementById("show").onclick = () => action("ARIA_TIKTOK_SHOW", "Show panel");
document.getElementById("run").onclick = () => action("ARIA_TIKTOK_RUN", "Run helper");
document.getElementById("stop").onclick = () => action("ARIA_TIKTOK_STOP", "Stop");
document.getElementById("upload").onclick = () => action("ARIA_TIKTOK_UPLOAD_BOX", "Click upload box");
document.getElementById("caption").onclick = () => action("ARIA_TIKTOK_FILL_CAPTION", "Fill caption");
