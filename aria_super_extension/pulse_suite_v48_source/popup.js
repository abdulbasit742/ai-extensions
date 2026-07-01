// [ARIA] V48 PULSE-POST - Main Controller
import { State } from './core/state.js';
import { Messaging } from './core/messaging.js';
import { Utils } from './core/utils.js';
import { Tabs } from './ui/tabs.js';
import { PulsePost } from './core/pulse_post.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log("ARIA V48 PULSE INITIALIZED");
  
  Tabs.init(document.getElementById('app'), [
    { id: 'pulse', label: 'PULSE' },
    { id: 'bridge', label: 'BRIDGE' },
    { id: 'config', label: 'CORE' }
  ]);

  const btnPulse = document.getElementById('btnPulsePost');
  if (btnPulse) {
    btnPulse.addEventListener('click', async () => {
      const comment = document.getElementById('directComment').value;
      const statusText = document.getElementById('pulseStatus');
      
      if (!comment) {
        alert("Please enter a comment to post.");
        return;
      }
      
      try {
        statusText.innerText = "Injecting Pulse...";
        await PulsePost.inject(comment);
        statusText.innerText = "Pulse Injected Successfully!";
        setTimeout(() => statusText.innerText = "System Ready for Injection", 3000);
      } catch (e) {
        statusText.innerText = `Error: ${e.message}`;
        setTimeout(() => statusText.innerText = "System Ready for Injection", 3000);
      }
    });
  }
});
