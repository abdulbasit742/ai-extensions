// [ARIA] V45 OMNI-SYNAPSE - Ultra-Low Latency Communication
import { Messaging } from './messaging.js';

export const Synapse = {
  fire: async (target, signal) => {
    console.log(`Firing synapse to ${target} with signal: ${signal}`);
    const start = performance.now();
    
    await Messaging.sendToTab(target, {
      type: 'SYNAPSE_SIGNAL',
      signal: signal,
      timestamp: Date.now()
    });
    
    const end = performance.now();
    return (end - start).toFixed(2);
  },
  
  mesh: async (signal) => {
    console.log("Firing synaptic mesh broadcast...");
    await Messaging.broadcast({
      type: 'SYNAPSE_MESH',
      signal: signal
    });
  }
};
