# ARIA AI Extensions

ARIA is a Chrome/Edge Manifest V3 browser-automation suite. The main `aria_super_extension/` combines AI chat workflows, response capture, local desktop bridges, prompt queues, social drafting, and universal site controls. Smaller helper extensions provide narrower workflows when full universal access is unnecessary.

## Choose the narrowest extension

| Extension | Intended scope |
| --- | --- |
| `aria_super_extension/` | Full ARIA hub, including explicitly reviewed universal and file-page automation |
| `chatgpt_aria_sender/` | ChatGPT sender and opt-in clipboard workflow |
| `chatgpt_image_saver/` | ChatGPT image generation and user-requested downloads |
| `chatgpt_word_copier/` | ChatGPT response capture through the localhost Word bridge |
| `clickup_aria_sender/` | ClickUp-only sender |
| `notebooklm_aria_helper/` | NotebookLM video workflow helper |
| `social_publisher_assistant/` | Draft/fill assistance for Facebook, Instagram, LinkedIn, and X |
| `tiktok_aria_uploader/` | TikTok upload guidance with manual final-post confirmation |
| `universal_aria_sender/` | Deliberately broad sender for user-selected sites and file pages |
| `video_capture_assistant/` | Direct user-owned video detection across user-selected sites |
| `x_giveaway_assistant/` | X/Twitter drafting and visible action guidance |

Prefer a site-specific helper whenever it satisfies the workflow. The ChatGPT, ClickUp, social, and TikTok helpers no longer request redundant access to every HTTP website; localhost bridge origins are declared explicitly.

## Load in Chrome or Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose one extension folder, usually the narrowest helper that meets the task.
5. For `file://` automation, Chrome still requires the user to enable **Allow access to file URLs** on the extension details page.

Public posting, liking, reposting, commenting, sending messages, and other external side effects must remain visible and user-confirmed.

## Permission governance

Every `manifest.json` is checked by a dependency-free auditor. High-impact permissions or broad host/content-script access must have a named owner, a detailed reason, and a future review date in [`extension-policy.json`](extension-policy.json). Missing, expired, unknown, or stale exceptions fail the audit.

```bash
npm ci --ignore-scripts
npm run check
npm run audit:manifests
node scripts/audit-manifests.mjs --format json --output reports/manifest-audit.json
```

The current permission inventory and review rules are documented in [`docs/permission-inventory.md`](docs/permission-inventory.md). Broad access remains only in the master, universal sender, video capture helper, and the image-saver CDN workflow, plus explicit clipboard-read workflows.

## Security and privacy

- Keep API keys, browser session exports, local bridge tokens, account lists, generated archives, and user data out of Git.
- Install only extensions you understand and need.
- Treat the `debugger`, clipboard-read, universal host, and file-page capabilities as privileged.
- Review `extension-policy.json` before its `review_by` dates; remove exceptions when the capability is no longer required.
- Do not add remote executable code or weaken the extension content security policy.

This repository provides automation tooling, not authorization to access accounts, content, files, or services without the user’s permission.
