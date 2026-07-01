ARIA Extensions Pro Pack
========================

Install any extension:
1. Open edge://extensions or chrome://extensions.
2. Turn Developer mode ON.
3. Click Load unpacked.
4. Select the extension folder directly. manifest.json must be inside the selected folder.

Recommended folders:
- ChatGPT auto sender: chatgpt_aria_sender
- ClickUp auto sender: clickup_aria_sender
- ChatGPT image saver: chatgpt_image_saver
- Universal website sender: universal_aria_sender
- X giveaway safe assistant: x_giveaway_assistant
- TikTok upload safe assistant: tiktok_aria_uploader
- NotebookLM video helper: notebooklm_aria_helper

Serverless / portable:
- ChatGPT sender, ClickUp sender, ChatGPT image saver, X assistant, and Universal sender can run without the ARIA Flask server.
- Universal sender v2.1 runs inside the active website tab if no server is reachable.
- TikTok and NotebookLM helpers can show their panels, but queue/video file workflows need ARIA server routes if you want local file coordination.

Safety:
- X/TikTok public actions remain user-confirmed. The helpers can draft, highlight, guide, and fill text, but final public posting/liking/reposting/comment submission should be confirmed by you.

Best workflow:
1. Install only the extensions you need.
2. Refresh target tabs once after loading/reloading an extension.
3. For multi-tab automation, click Run This Tab on every tab you want running.
4. Stop is tab-local where supported; it should not stop other running tabs.
