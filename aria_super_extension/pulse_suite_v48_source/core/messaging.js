// [ARIA] V40 OMNIPOTENCE - Messaging Bridge
export const Messaging = {
  sendToTab: async (tabId, message) => {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
      console.error("Messaging Error:", e);
      return null;
    }
  },
  broadcast: async (message) => {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}));
  }
};
