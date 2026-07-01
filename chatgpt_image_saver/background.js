const SAVED_KEY = "ariaImageSaverSaved";
const DEFAULT_FOLDER = "Basit Social Media";

function sanitizePathPart(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[<>:"\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function normalizeFilename(filename) {
  const parts = String(filename || "").split(/[\\/]+/).filter(Boolean);
  if (!parts.length) return `${DEFAULT_FOLDER}/chatgpt_image.png`;
  return parts.map((part, index) => sanitizePathPart(part, index === parts.length - 1 ? "image.png" : DEFAULT_FOLDER)).join("/");
}

function saveRecord(record) {
  chrome.storage.local.get([SAVED_KEY], (data) => {
    const saved = Array.isArray(data[SAVED_KEY]) ? data[SAVED_KEY] : [];
    saved.unshift({
      ...record,
      savedAt: new Date().toISOString()
    });
    chrome.storage.local.set({ [SAVED_KEY]: saved.slice(0, 200) });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "ARIA_IMAGE_DOWNLOAD") return false;

  const payload = message.payload || {};
  const url = payload.dataUrl || payload.url;
  if (!url) {
    sendResponse({ ok: false, error: "No image URL/data received." });
    return true;
  }

  const filename = normalizeFilename(payload.filename);
  chrome.downloads.download(
    {
      url,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Download failed."
        });
        return;
      }
      const record = {
        downloadId,
        filename,
        sourceUrl: payload.sourceUrl || payload.url || "",
        pageUrl: sender && sender.tab ? sender.tab.url : "",
        title: sender && sender.tab ? sender.tab.title : ""
      };
      saveRecord(record);
      sendResponse({ ok: true, downloadId, filename });
    }
  );
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "ARIA_IMAGE_SHOW_DOWNLOADS") return false;
  try {
    chrome.downloads.showDefaultFolder();
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "ARIA_IMAGE_GET_SAVED") return false;
  chrome.storage.local.get([SAVED_KEY], (data) => {
    sendResponse({ ok: true, saved: Array.isArray(data[SAVED_KEY]) ? data[SAVED_KEY] : [] });
  });
  return true;
});
