ARIA Universal Site Auto Sender PRO
===================================

Use this one extension for normal http/https websites when you want ARIA to
send a repeated prompt/text inside a specific page without touching other tabs.

Install once:

1. Open Edge or Chrome extensions page:
   edge://extensions
   or
   chrome://extensions

2. Turn on Developer mode.

3. Click "Load unpacked".

4. Easiest: dashboard par "Prepare Universal extension folder" click karein.
   It opens:
   Desktop/ARIA_Universal_Extension

   Select that exact folder. manifest.json must be directly inside it.

Portable / any PC / serverless:

- Version 2.1.1 can run without ARIA server.
- Open any normal website tab, click extension icon, set Text/Seconds, then
  click Run This Tab.
- If ARIA server is not reachable, popup will say extension-only mode and it
  will still run inside that tab.
- Running tabs get a background/offscreen wake helper so switching tabs is less
  likely to pause the automation.
- It supports http://, https://, localhost/LAN pages, and file:// pages.
- For file:// pages, open the extension card and enable "Allow access to file URLs".
- Browser security blocks chrome://, edge://, Chrome Web Store, extension pages,
  and some locked browser/system pages. No extension can automate those directly.

Optional ARIA server mode:

- If ARIA runs on the same PC, Server URL should be:
  http://127.0.0.1:5050
- If ARIA runs on another PC, click the extension icon and set Server URL to
  that PC's ARIA server URL, for example:
  http://192.168.1.20:5050
- The popup saves Server URL in browser storage.
- The prepared folder also includes config.js with local/LAN candidates.

Best way to run:

1. Open the target website tab.
2. Click the ARIA Universal extension icon.
3. Set:
   - Seconds: minimum wait between sends.
   - Method: Auto, Button, or Enter.
   - Text: use {n} for 1, 2, 3... or "." for dot.
4. Click "Run This Tab".

What PRO mode does:

- Remembers the exact page/chat link when you press Run.
- Keeps a separate counter per browser tab session.
- New tab/page/chat starts from 0, then sends 1, 2, 3...
- Refresh/reload keeps the current tab count, but a newly opened tab starts
  from 0.
- If the same target is open in two tabs, only one tab can send.
- Waits until the page looks stable and not responding/loading before sending.
- Tries send/submit/search buttons first in Auto mode, then Enter fallback.
- Has a draggable floating panel inside the page with Run, Stop, Reset #.
- Does not run on chrome://, edge://, extension pages, or unmatched tabs.

Dashboard mode:

You can also use the ARIA dashboard Universal Site Automation panel:

1. Set target URL or title keyword.
2. Set text, e.g. {n}, ".", "continue", etc.
3. Click Start Universal automation.

If panel does not appear:

- Reload this extension card on edge://extensions or chrome://extensions.
- Refresh the target website tab.
- Check the Server URL in the popup.
