ARIA ChatGPT Image Saver
========================

Purpose
-------
This extension works without ARIA server / localhost.
Open ChatGPT, enter an image prompt, and generated images are saved through the browser downloads system.

Important browser rule
----------------------
Chrome/Edge extensions cannot write directly to C:\Users\...\Pictures\Basit Social Media without a native helper.
For portable, serverless mode this extension saves to:

  Downloads\Basit Social Media\

You can move/sync that folder to your social media posting system.

Install
-------
1. Open edge://extensions or chrome://extensions
2. Turn Developer mode ON
3. Click Load unpacked
4. Select this folder, not the ZIP:
   chatgpt_image_saver_READY_LOAD_THIS_FOLDER
5. Open https://chatgpt.com/
6. Click the ARIA Image Saver extension icon.

Use
---
1. Type image prompt.
2. Click Generate.
3. Wait for ChatGPT image generation.
4. Images auto-save when they appear.
5. Click Open Downloads to see Downloads\Basit Social Media.

Buttons
-------
Generate      - sends an image prompt to ChatGPT.
Save visible  - scans the current ChatGPT page and saves visible generated images.
Show panel    - opens the floating panel inside ChatGPT.
Open Downloads - opens the browser Downloads folder.

Portable
--------
This extension can be loaded on any PC with Chrome or Edge.
It does not require ARIA dashboard, Flask, Python, or localhost.
