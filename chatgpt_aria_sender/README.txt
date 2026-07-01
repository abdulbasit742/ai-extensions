ARIA ChatGPT Auto Sender
========================

Install once:

1. Open Edge or Chrome extensions page:
   edge://extensions
   or
   chrome://extensions

2. Turn on Developer mode.

3. Click "Load unpacked".

4. Easiest: dashboard par "Prepare Desktop extension folder" click karein.
   It will open:
   Desktop/ARIA_ChatGPT_Extension

   Load unpacked mein isi folder ko select karein. Iske andar manifest.json
   direct hona chahiye.

If you use the ZIP instead, extract it first and select the extracted folder
that has manifest.json directly inside it.

Any Chrome / Edge / profile:

- Extension browser ke andar install hoti hai. Isliye jis Chrome profile,
  Edge profile, ya doosre PC par use karna ho, wahan ek dafa Load unpacked
  karna zaroori hai.
- Easy setup ke liye ARIA project folder se run karein:
  open-extension-setup-any-chrome.bat
- Load unpacked mein ye ready folder select karein:
  Desktop/ARIA_ChatGPT_Extension
- Folder ke andar manifest.json direct nazar aana chahiye. Agar folder empty
  dikhe, ek level upar/neeche check karein aur wahi folder select karein
  jahan manifest.json direct ho.

Portable use on any PC:

- Start ARIA on that PC first.
- If ARIA is running on the same PC, keep Server URL as:
  http://127.0.0.1:5050
- If ARIA is running on another PC on your LAN, put that PC's dashboard URL
  in the extension popup, for example:
  http://192.168.1.20:5050
- The popup saves this Server URL, so the content script also uses it.
- If Chrome shows a Squid/proxy "Access Denied" page for 192.168.*,
  your proxy is blocking local LAN access. Use 127.0.0.1 on the same PC,
  or double-click open-aria-dashboard-no-proxy.bat from the ARIA project
  folder. For a custom LAN URL, run open-aria-chrome-no-proxy.ps1.
- Do not guess the LAN IP. Use the exact LAN server URL shown on the ARIA
  dashboard.

After that:

1. Open ChatGPT in a tab.
2. Keep ARIA dashboard running at http://127.0.0.1:5050
3. Click "Start ChatGPT automation" on the dashboard.

You can also click the ARIA ChatGPT extension icon in the browser toolbar:

  Run This Tab = start/resume automation on the current ChatGPT tab
  Stop         = stop automation immediately
  Status       = check ARIA server + current tab connection
  Dashboard    = open http://127.0.0.1:5050
  Save Settings = save number/dot/custom mode
  Reset Counter = set the next number back to your chosen value

The floating "ARIA ChatGPT Sender" panel inside ChatGPT also works:

  Run  = start/resume automation on the current ChatGPT tab
  Stop = stop automation immediately
  Reset # = reset the page counter to 1
  Drag the title bar to move it anywhere. Use the _ button to minimize it.

The extension runs inside ChatGPT only. It does not type in ClickUp, YouTube,
Gmail, X, or other tabs. If multiple ChatGPT tabs are open, ARIA lets only one
matching tab send at a time.

Counter and duplicate-tab behavior:

- Each ChatGPT browser tab has its own counter, even when two tabs show the
  same conversation link. A new tab starts from 0, then sends 1, 2, 3...
  after you press Run.
- When you press Run from the ChatGPT floating panel or extension popup, ARIA
  remembers that exact chat link as the active target.
- If you open the same ChatGPT conversation in two tabs, only one tab can send.
  The other tab will show that another matching ChatGPT tab is already active.
- If you start in a new draft and ChatGPT later changes the URL to /c/..., ARIA
  carries that draft counter into the new conversation automatically.

Current behavior:

- ARIA waits until ChatGPT stops responding and the page stays stable.
- Then it sends whatever mode you selected:
  number mode: 1, 2, 3, 4...
  dot mode: .
  custom mode: your custom text
- The number counter is saved per browser tab session. Refresh/reload keeps the
  current tab count, but a newly opened tab starts from 0.
- The generated config.js contains local/LAN ARIA server addresses, so the
  extension can work from another Chrome/Edge profile or another LAN PC.

Generated images:

The extension also watches ChatGPT for large generated images and saves them
through ARIA into:

  Pictures/Basit Social Media

If you update this extension, reload it on edge://extensions and refresh the
ChatGPT tab once.
