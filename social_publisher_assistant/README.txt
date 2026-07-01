ARIA Social Publisher Assistant
===============================

What it does
------------
- Reads next image from your ARIA social media folder through the local ARIA server.
- Uses Groq to create a caption.
- Copies the caption to clipboard.
- Shows a floating panel on Facebook, Instagram, LinkedIn, and X pages.
- If the page helper is missing, the popup injects it into the current Facebook/Instagram tab automatically.
- Fills the visible caption/text box when you click Fill caption.
- Auto upload can open the site file picker and ARIA desktop helper pastes the current image path.
- Auto Post tries to fill caption, select the image, then click visible Post/Share buttons.
- Every prepared draft is logged to a Google Sheets compatible CSV inside the image folder.
- Engagement helpers can fill a comment/reply draft and highlight Like/Repost/Share buttons. They do not silently perform cross-account public actions.

Safety rule
-----------
Auto Post only runs when you explicitly click the Auto Post button.
If Facebook/Instagram/LinkedIn/X shows login, CAPTCHA, crop/permission, or a changed UI, it stops and tells you what to do.

Install
-------
1. Open chrome://extensions or edge://extensions.
2. Turn Developer mode ON.
3. Click Load unpacked.
4. Select this folder, the one that directly contains manifest.json.
5. After updating/reloading the extension, refresh the Facebook/Instagram tab once.

Default image folders
---------------------
- C:\Users\<you>\Pictures\Basit Social Media
- If missing, ARIA uses project data\Basit Social Media.

Dashboard
---------
Open http://127.0.0.1:5050/#social
