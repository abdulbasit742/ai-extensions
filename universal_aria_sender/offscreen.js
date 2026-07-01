function tick(type) {
  try {
    chrome.runtime.sendMessage({ type }, () => {});
  } catch (err) {}
}

tick("ARIA_OFFSCREEN_READY");
setInterval(() => tick("ARIA_OFFSCREEN_TICK"), 1000);
