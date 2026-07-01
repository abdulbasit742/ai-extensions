// [ARIA] V43 TEMPORAL-MEMORY - State Time-Travel
import { State } from './state.js';

export const TemporalMemory = {
  savePoint: async (stateName, data) => {
    const history = await State.get('temporal_history') || [];
    history.push({
      name: stateName,
      data: data,
      timestamp: Date.now()
    });
    await State.set('temporal_history', history);
  },
  
  travelTo: async (index) => {
    const history = await State.get('temporal_history');
    if (history && history[index]) {
      console.log(`Traveling to temporal state: ${history[index].name}`);
      return history[index].data;
    }
    return null;
  }
};
