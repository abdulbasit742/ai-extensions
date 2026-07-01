const DEFAULT_SERVER = "http://127.0.0.1:5050";

function byId(id) {
  return document.getElementById(id);
}

function setOut(text) {
  byId("out").textContent = text;
}

async function api(path, payload = null) {
  const base = (byId("server").value || DEFAULT_SERVER).replace(/\/$/, "");
  const options = payload
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : { method: "GET" };
  const response = await fetch(base + path, options);
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || "Request failed");
  }
  return data;
}

async function refresh() {
  try {
    const data = await api("/api/social/state");
    let keyLine = "";
    try {
      const settings = await api("/api/social/settings");
      keyLine = settings.groq_api_key_set
        ? `Groq key: ${settings.groq_api_key_masked}\n`
        : "Groq key: missing\n";
    } catch (err) {
      keyLine = "";
    }
    setOut(
      keyLine +
      `Folder: ${data.image_folder || ""}\n` +
      `Images: ${data.image_count || 0}\n` +
      `Last image: ${data.last_image || "(none)"}\n` +
      `Sheet CSV: ${data.sheet_file || "(none)"}\n` +
      `Caption source: ${data.last_caption_source || "(none)"}\n` +
      `Last: ${data.last_message || ""}\n\n` +
      `${data.last_caption || ""}`
    );
  } catch (err) {
    setOut("Server not reachable: " + err.message);
  }
}

async function saveKey() {
  const key = byId("groqKey").value.trim();
  if (!key) {
    setOut("Paste your Groq key first. It starts with gsk_ and stays on this PC.");
    return;
  }
  try {
    const data = await api("/api/social/settings", { groq_api_key: key });
    byId("groqKey").value = "";
    setOut(`Groq key saved locally: ${data.groq_api_key_masked}\nNow click Prepare draft again.`);
  } catch (err) {
    setOut("Could not save Groq key: " + err.message);
  }
}

async function prepare() {
  setOut("Preparing caption with Groq...");
  try {
    const data = await api("/api/social/prepare", {
      platform: byId("platform").value,
      tone: byId("tone").value,
      extra: byId("extra").value
    });
    setOut(
      `Draft ready for ${data.last_platform}.\n` +
      `Image: ${data.last_image}\n` +
      `Caption copied: ${data.copied ? "yes" : "no"}\n\n` +
      `${data.last_caption || ""}`
    );
  } catch (err) {
    setOut("Prepare failed: " + err.message);
  }
}

async function openFolder() {
  const data = await api("/api/social/open-folder", {});
  setOut(data.message || "Folder opened.");
}

async function openSheet() {
  const data = await api("/api/social/open-sheet", {});
  setOut(data.last_message || "Sheet opened.");
}

async function openPlatform(platform) {
  const data = await api("/api/social/open-platform", { platform });
  setOut(data.message || "Opened.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSupportedPage(url) {
  return /^https:\/\/(www\.)?(facebook|instagram|linkedin)\.com\//i.test(url || "") ||
    /^https:\/\/(x|twitter)\.com\//i.test(url || "");
}

function actionLabel(type) {
  return {
    ARIA_SOCIAL_FILL: "Fill caption",
    ARIA_SOCIAL_UPLOAD: "Auto upload",
    ARIA_SOCIAL_CAMPAIGN_DRAFT: "Fill campaign draft",
    ARIA_SOCIAL_AUTO_POST: "Auto Post",
    ARIA_SOCIAL_FILL_COMMENT: "Fill comment draft",
    ARIA_SOCIAL_HIGHLIGHT_ACTIONS: "Highlight actions"
  }[type] || "Page action";
}

async function sendPageMessage(tabId, type) {
  return chrome.tabs.sendMessage(tabId, { type });
}

async function injectPageHelper(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    throw new Error("Scripting permission missing. Reload this extension from edge://extensions.");
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
  await sleep(650);
}

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setOut("No active tab found.");
    return;
  }
  if (!isSupportedPage(tab.url)) {
    setOut("Open Facebook, Instagram, LinkedIn, or X tab first, then click this button again.");
    return;
  }
  try {
    let response;
    try {
      response = await sendPageMessage(tab.id, type);
    } catch (err) {
      const message = String(err && err.message || err);
      if (!message.includes("Receiving end") && !message.includes("Could not establish connection")) {
        throw err;
      }
      setOut("Page helper not connected. Injecting ARIA helper into this tab...");
      await injectPageHelper(tab.id);
      response = await sendPageMessage(tab.id, type);
    }
    setOut(response && response.ok
      ? `${actionLabel(type)} sent to this ${tab.url.includes("instagram") ? "Instagram" : tab.url.includes("linkedin") ? "LinkedIn" : tab.url.includes("x.com") || tab.url.includes("twitter") ? "X" : "Facebook"} tab.`
      : "Page action failed: " + (response?.error || "unknown"));
  } catch (err) {
    setOut("Could not run on this page. Refresh Facebook/Instagram/LinkedIn/X once, then try again. " + err.message);
  }
}

byId("prepare").addEventListener("click", prepare);
byId("saveKey").addEventListener("click", saveKey);
byId("fill").addEventListener("click", () => sendToActiveTab("ARIA_SOCIAL_FILL"));
byId("upload").addEventListener("click", () => sendToActiveTab("ARIA_SOCIAL_UPLOAD"));
byId("campaign").addEventListener("click", () => sendToActiveTab("ARIA_SOCIAL_CAMPAIGN_DRAFT"));
byId("autopost").addEventListener("click", () => sendToActiveTab("ARIA_SOCIAL_AUTO_POST"));
byId("comment").addEventListener("click", () => sendToActiveTab("ARIA_SOCIAL_FILL_COMMENT"));
byId("highlight").addEventListener("click", () => sendToActiveTab("ARIA_SOCIAL_HIGHLIGHT_ACTIONS"));
byId("folder").addEventListener("click", openFolder);
byId("sheet").addEventListener("click", openSheet);
byId("fb").addEventListener("click", () => openPlatform("facebook"));
byId("ig").addEventListener("click", () => openPlatform("instagram"));
byId("li").addEventListener("click", () => openPlatform("linkedin"));
byId("xopen").addEventListener("click", () => openPlatform("x"));
byId("status").addEventListener("click", refresh);
refresh();
