// [ARIA] V48 PULSE-POST - Direct Injection
import { Messaging } from './messaging.js';

export const PulsePost = {
  inject: async (comment) => {
    console.log(`Initiating Pulse-Post Injection: ${comment}`);
    
    // Target the active tab for instant injection
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url.includes('youtube.com')) {
      await Messaging.sendToTab(tabs[0].id, {
        type: 'PULSE_INJECT',
        comment: comment
      });
      return { status: "INJECTED" };
    } else {
      throw new Error("Active tab is not a YouTube video.");
    }
  }
};
