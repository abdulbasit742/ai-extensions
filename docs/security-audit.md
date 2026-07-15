# Permission-governance security audit

Date: 2026-07-15

## Findings addressed

1. Four site-specific helpers requested `http://*/*` even though their content scripts run only on ChatGPT, ClickUp, supported social sites, or TikTok and their localhost bridge origins were already declared. The redundant grant was removed.
2. The repository had eleven Manifest V3 extensions but no root manifest validation, tests, or CI.
3. Privileged permissions such as `debugger`, clipboard read, universal hosts, file URLs, and unlimited storage had no machine-readable owner or review deadline.
4. Permission exceptions could silently become permanent or stale.

## Controls added

- Dependency-free recursive manifest parser and schema checks.
- Critical/high risk classification for debugger, native messaging, management, clipboard read, universal hosts/content scripts, file access, unsafe CSP, and wildcard external connections.
- `extension-policy.json` with owner, reason, and expiring `review_by` date.
- Fail-closed behavior for unapproved, expired, unknown, or stale exceptions.
- Regression tests for safe, broad, expired, stale, duplicate, and unsafe-CSP cases.
- Node 20/22 least-privilege CI.

## Verification evidence

- 8/8 focused unit tests passed.
- All 11 current manifests parsed successfully.
- Full suite audit: 0 critical, 0 high, 0 medium; 22 reviewed risks remained visible.
- `npm ci` and `npm run check` passed with no runtime dependencies.

## Residual risks

- The master and universal helpers intentionally inject into arbitrary pages; a content-script defect can therefore have wide impact.
- `debugger` is highly privileged even when user-triggered. Its fallback code requires recurring manual review.
- Clipboard read can capture unrelated content if an opt-in watch workflow is misunderstood or left enabled.
- Localhost bridges enlarge the trust boundary to software listening on the declared ports.
- The auditor validates manifests and policy, not the complete behavior of every large content/background script.

Install the narrowest helper, keep public actions user-confirmed, and do not extend review dates without code-path inspection.
