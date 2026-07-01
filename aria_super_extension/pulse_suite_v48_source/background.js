// [ARIA] V46 CHRONOS-LOOP - Background Persistent Loop
import { State } from './core/state.js';
import { Logger } from './core/logger.js';
import { Chronos } from './core/chronos.js';

chrome.runtime.onInstalled.addListener(() => {
  Logger.log("CHRONOS CORE ONLINE", "SYSTEM");
  State.set('config', { version: '1.4.6', status: 'CHRONOS' });
  
  // Set a 1-minute alarm to check for reloads
  chrome.alarms.create('chronos_heartbeat', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'chronos_heartbeat') {
    Chronos.checkAndReload();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STOP_ALL_STREAMS') {
    State.set('stream_loop', null);
    chrome.alarms.clear('chronos_heartbeat');
    sendResponse({ status: 'STOPPED' });
  }
  return true;
});
