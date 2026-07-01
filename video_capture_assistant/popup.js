function out(text) {
  document.getElementById("out").textContent = text;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab found.");
  if (!/^https?:\/\//i.test(tab.url || "")) throw new Error("Open a normal website tab first.");
  return tab;
}

async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["config.js", "content.js"] });
  await new Promise((resolve) => setTimeout(resolve, 550));
}

async function send(type) {
  const tab = await activeTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (err) {
    const msg = String(err && err.message || err);
    if (!msg.includes("Receiving end") && !msg.includes("Could not establish connection")) throw err;
    out("Injecting ARIA helper into this tab...");
    await inject(tab.id);
    return await chrome.tabs.sendMessage(tab.id, { type });
  }
}

async function run(type, label) {
  try {
    out(label + "...");
    const response = await send(type);
    out(response && response.ok ? (response.message || label + " started.") : "Failed: " + (response?.error || "unknown"));
  } catch (err) {
    out("Error: " + (err && err.message ? err.message : err));
  }
}

document.getElementById("show").addEventListener("click", () => run("ARIA_VIDEO_SHOW", "Showing panel"));
document.getElementById("save").addEventListener("click", () => run("ARIA_VIDEO_SAVE_CURRENT", "Saving current video"));
document.getElementById("record").addEventListener("click", () => run("ARIA_VIDEO_RECORD_CURRENT", "Recording current player"));
document.getElementById("queue").addEventListener("click", () => run("ARIA_VIDEO_QUEUE_VISIBLE", "Queueing visible videos"));
