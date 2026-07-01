function tick(type) {
  try {
    chrome.runtime.sendMessage({ type }, () => {});
  } catch (err) {}
}

tick("ARIA_SUPER_OFFSCREEN_READY");
setInterval(() => tick("ARIA_SUPER_OFFSCREEN_TICK"), 1000);

async function writeClipboard(text) {
  const value = String(text || "");
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (err) {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    area.style.top = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

// ARIA v4.9.0 — Feature 13: Clipboard Watch Mode
async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    return "";
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;
  if (message.type === "ARIA_SUPER_OFFSCREEN_WRITE_CLIPBOARD") {
    writeClipboard(message.text)
      .then((ok) => sendResponse(ok ? { ok: true } : { ok: false, error: "Clipboard write failed." }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }
  if (message.type === "ARIA_SUPER_OFFSCREEN_READ_CLIPBOARD") {
    readClipboard()
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err), text: "" }));
    return true;
  }
  return false;
});
