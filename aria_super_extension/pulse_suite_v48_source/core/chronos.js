// [ARIA] V46 CHRONOS-LOOP - 24/7 Stream Monitoring
import { State } from './state.js';
import { Messaging } from './messaging.js';

export const Chronos = {
  initiate: async (urls) => {
    console.log("Initiating Chronos-Loop for URLs:", urls);
    const streamState = urls.map((url, index) => ({
      id: index,
      url: url,
      startTime: Date.now(),
      tabId: null,
      status: 'INITIATING'
    }));
    
    await State.set('stream_loop', streamState);
    
    for (const stream of streamState) {
      const tab = await chrome.tabs.create({ url: stream.url, active: false });
      stream.tabId = tab.id;
      stream.status = 'STREAMING';
    }
    
    await State.set('stream_loop', streamState);
    return streamState;
  },
  
  checkAndReload: async () => {
    const streams = await State.get('stream_loop');
    if (!streams) return;
    
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    
    for (const stream of streams) {
      if (now - stream.startTime >= ONE_HOUR) {
        console.log(`Reloading stream ${stream.id} after 1 hour...`);
        await chrome.tabs.reload(stream.tabId);
        stream.startTime = now;
      }
    }
    
    await State.set('stream_loop', streams);
  }
};
