ARIA ClickUp Auto Sender
========================

Install once:

1. Open Edge or Chrome extensions page:
   edge://extensions
   or
   chrome://extensions

2. Turn on Developer mode.

3. Click "Load unpacked".

4. Select this folder:
   browser_extension/clickup_aria_sender

Any Chrome / Edge / profile:

- Extension browser ke andar install hoti hai. Isliye jis Chrome profile,
  Edge profile, ya doosre PC par use karna ho, wahan ek dafa Load unpacked
  karna zaroori hai.
- Easy setup ke liye ARIA project folder se run karein:
  open-extension-setup-any-chrome.bat
- Load unpacked mein ye ready folder select karein:
  Desktop/ARIA_ClickUp_Extension
- Folder ke andar manifest.json direct nazar aana chahiye. Agar folder empty
  dikhe, ek level upar/neeche check karein aur wahi folder select karein
  jahan manifest.json direct ho.

If you update the extension files later:

1. Open edge://extensions or chrome://extensions.
2. Find "ARIA ClickUp Auto Sender".
3. Click the Reload button on that extension card.
4. Refresh the ClickUp AI tab once.

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

1. Open your ClickUp AI tab.
2. Keep ARIA dashboard running at http://127.0.0.1:5050
3. Make sure the dashboard ClickUp URL box has your exact conversation link.
4. Click "Start ClickUp automation" on the dashboard.

You can also click the ARIA ClickUp extension icon in the browser toolbar:

  Run This Tab = start/resume automation on the current ClickUp tab
  Stop         = stop automation immediately
  Status       = check ARIA server + current tab connection
  Dashboard    = open http://127.0.0.1:5050
  Save Settings = save number/dot/custom mode
  Reset Counter = set the next number back to your chosen value

The floating "ARIA ClickUp Sender" panel inside ClickUp also works:

  Run  = start/resume automation on the current ClickUp tab
  Stop = stop automation immediately
  Reset # = reset the page counter to 1
  Drag the title bar to move it anywhere. Use the _ button to minimize it.

The extension runs inside ClickUp only. It does not type in YouTube, Gmail, X,
or other tabs. If multiple ClickUp tabs are open, ARIA locks to the saved
conversation URL and lets only one matching tab send at a time.

Counter and duplicate-tab behavior:

- Each ClickUp browser tab has its own counter, even when two tabs show the
  same conversationId. A new ClickUp AI tab starts from 0, then sends 1, 2, 3...
  after you press Run.
- When you press Run from the ClickUp floating panel or extension popup, ARIA
  remembers that exact conversation link as the active target.
- If you open the same ClickUp conversation in two tabs, only one tab can send.
  The other tab will show that another matching ClickUp tab is already active.
- If you start in a draft and ClickUp later adds a conversationId to the URL,
  ARIA carries that draft counter into the new conversation automatically.

Current behavior:

- ARIA waits until ClickUp stops responding and the page stays stable.
- Then it sends whatever mode you selected:
  number mode: 1, 2, 3, 4...
  dot mode: .
  custom mode: your custom text
- The number counter is saved per browser tab session. Refresh/reload keeps the
  current tab count, but a newly opened tab starts from 0.
- The generated config.js contains local/LAN ARIA server addresses, so the
  extension can work from another Chrome/Edge profile or another LAN PC.

If the panel says "Waiting" for too long, update to version 1.1.0 or newer,
reload the extension, refresh the ClickUp tab, then press Start again.
