# Repository Agent Guidance

These instructions apply to the entire `abdulbasit742/ai-extensions` repository.

## Architecture

- The repository contains eleven independent Chrome/Edge Manifest V3 extensions.
- Prefer the smallest site-specific helper over expanding a universal extension.
- `scripts/audit-manifests.mjs` and `extension-policy.json` form the root permission-governance control plane.
- Do not migrate all extensions to a framework or merge helpers without a concrete compatibility plan.

## Required workflow

1. Read the target `manifest.json`, content/background scripts, nearby docs, and the permission inventory.
2. Treat every new permission, host pattern, content-script match, externally-connectable entry, or CSP change as a security-sensitive API change.
3. Narrow permissions whenever possible. Never add a broad policy exception merely to make CI pass.
4. High-impact exceptions require an owner, a detailed reason, and a near-term `review_by` date.
5. Keep public posting, messaging, uploads, account changes, and paid provider calls visible and user-confirmed.
6. Never commit API keys, browser sessions, account lists, local bridge tokens, generated archives, or private user data.

## Verification

```bash
npm ci --ignore-scripts
npm run check
node scripts/audit-manifests.mjs --format json --output reports/manifest-audit.json
```

For runtime changes, also load the affected unpacked extension and manually verify disabled/error/success states on only the intended site. Do not claim browser verification unless it was actually performed.
