// [ARIA] V40 OMNIPOTENCE - Global State Manager
export const State = {
  get: async (key) => {
    const data = await chrome.storage.local.get(key);
    return data[key];
  },
  set: async (key, value) => {
    await chrome.storage.local.set({ [key]: value });
  },
  clear: async () => {
    await chrome.storage.local.clear();
  }
};
