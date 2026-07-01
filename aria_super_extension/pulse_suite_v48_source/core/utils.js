// [ARIA] V40 OMNIPOTENCE - Utilities
export const Utils = {
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),
  generateId: () => `ARIA-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  formatTimestamp: () => new Date().toLocaleTimeString()
};
