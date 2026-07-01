// [ARIA] V40 OMNIPOTENCE - Neural Content Bridge
import { Registry } from './adapters/registry.js';
import { RealityBender } from './core/reality_bender.js';

console.log("[ARIA] V40 SINGULARITY CORE ACTIVE");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const adapter = Registry.getAdapter(window.location.href);
  if (!adapter) return;

  if (request.type === 'EXECUTE') {
    // Execute logic using adapter
  }
  
  if (request.type === 'MORPH_UI') {
    RealityBender.morph();
  }
  
  if (request.type === 'YOUTUBE_ENGAGE' && adapter.postComment) {
    adapter.postComment(request.strategy);
  }
  
  if (request.type === 'PULSE_INJECT' && adapter.postComment) {
    adapter.postComment(request.comment);
  }
  
  // Initialize adapter if it has an init method
  if (adapter.init) adapter.init();
});
