setInterval(() => {
  try {
    chrome.runtime.sendMessage({ type: "ARIA_OFFSCREEN_TICK", sentAt: Date.now() });
  } catch (err) {}
}, 1000);

try {
  chrome.runtime.sendMessage({ type: "ARIA_OFFSCREEN_READY", sentAt: Date.now() });
} catch (err) {}
