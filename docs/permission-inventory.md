# Permission inventory

The manifest audit separates narrow site access from capabilities that deserve recurring review.

## Narrow extensions

- `chatgpt_word_copier`, `clickup_aria_sender`, `notebooklm_aria_helper`, `tiktok_aria_uploader`, and `x_giveaway_assistant` use named product and localhost origins only.
- `chatgpt_aria_sender` additionally keeps reviewed clipboard-read access for its opt-in watch workflow.
- `social_publisher_assistant` uses named social domains and reviewed clipboard-read access.

The previous `http://*/*` grant was removed from the ChatGPT sender, ClickUp sender, social publisher, and TikTok uploader because their content scripts are site-specific and their local bridge origins are already explicit.

## Reviewed broad capabilities

| Manifest | Capability | Why it remains | Review owner/date |
| --- | --- | --- | --- |
| `aria_super_extension/manifest.json` | Universal HTTP/HTTPS/file content scripts and hosts | The master extension intentionally supports user-selected sites and local file pages | ARIA extension maintainer / 2026-10-15 |
| `aria_super_extension/manifest.json` | `debugger` | Explicit user-triggered native-input fallback on the approved active tab | ARIA extension maintainer / 2026-10-15 |
| `aria_super_extension/manifest.json` | Clipboard read and unlimited local storage | Opt-in clipboard watch and user-created local archives | ARIA extension maintainer / 2026-10-15 |
| `chatgpt_image_saver/manifest.json` | Broad HTTPS host access | Generated image assets may use changing CDN origins | ARIA extension maintainer / 2026-10-15 |
| `universal_aria_sender/manifest.json` | Universal HTTP/HTTPS/file access | This helper’s explicit product purpose is arbitrary user-selected pages | ARIA extension maintainer / 2026-10-15 |
| `video_capture_assistant/manifest.json` | Universal HTTP/HTTPS access | Detects direct user-owned video elements on user-selected pages | ARIA extension maintainer / 2026-10-15 |

## Review procedure

1. Run `npm run audit:manifests`.
2. Confirm the permission is still used by a visible, documented feature.
3. Prefer a narrower host pattern or optional permission if the workflow permits it.
4. Update the reason only after reviewing the relevant code path.
5. Extend `review_by` for a short period; do not use permanent exceptions.
6. Remove stale exceptions immediately. The auditor intentionally fails when an approved risk disappears from its manifest.
