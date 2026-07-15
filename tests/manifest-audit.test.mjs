import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditRepository } from '../scripts/audit-manifests.mjs';
import { detectRisks } from '../scripts/manifest-risks.mjs';

function workspace(manifest, policy = { version: 1, manifests: {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aria-audit-'));
  const extension = path.join(root, 'extension');
  fs.mkdirSync(extension);
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { root, policy };
}

const safeManifest = {
  manifest_version: 3,
  name: 'Safe helper',
  version: '1.0.0',
  permissions: ['storage'],
  host_permissions: ['https://example.com/*'],
  content_scripts: [{ matches: ['https://example.com/*'], js: ['content.js'] }],
};

function approval(risks, reviewBy = '2099-12-31') {
  return {
    version: 1,
    manifests: {
      'extension/manifest.json': {
        owner: 'extension-security-owner',
        review_by: reviewBy,
        risks: Object.fromEntries(risks.map((risk) => [risk, { reason: `Reviewed and required for the isolated ${risk} workflow.` }])),
      },
    },
  };
}

test('safe site-specific manifest passes without exceptions', () => {
  const { root, policy } = workspace(safeManifest);
  const result = auditRepository(root, policy, { today: new Date('2026-07-15T00:00:00Z') });
  assert.deepEqual(result.summary, { manifests: 1, critical: 0, high: 0, medium: 0, approved: 0 });
});

test('detects broad and privileged permissions', () => {
  const risks = detectRisks({
    permissions: ['debugger', 'clipboardRead', 'unlimitedStorage'],
    host_permissions: ['http://*/*', 'https://*/*', 'file://*/*'],
    content_scripts: [{ matches: ['http://*/*', 'https://*/*', 'file://*/*'] }],
  });
  assert.deepEqual(risks, [
    'broad-http-content-script', 'broad-http-host', 'broad-https-content-script', 'broad-https-host',
    'clipboard-read', 'file-content-script', 'file-host-access', 'privileged-debugger', 'unlimited-storage',
  ]);
});

test('unapproved debugger access fails closed', () => {
  const { root, policy } = workspace({ ...safeManifest, permissions: ['storage', 'debugger'] });
  const result = auditRepository(root, policy, { today: new Date('2026-07-15T00:00:00Z') });
  assert.equal(result.summary.critical, 1);
  assert.equal(result.findings[0].risk, 'privileged-debugger');
});

test('reviewed risk passes and remains visible', () => {
  const { root } = workspace({ ...safeManifest, permissions: ['storage', 'clipboardRead'] });
  const result = auditRepository(root, approval(['clipboard-read']), { today: new Date('2026-07-15T00:00:00Z') });
  assert.equal(result.summary.high, 0);
  assert.equal(result.summary.approved, 1);
  assert.equal(result.findings[0].code, 'approved-risk');
});

test('review date remains valid through that UTC calendar day', () => {
  const { root } = workspace({ ...safeManifest, permissions: ['storage', 'clipboardRead'] });
  const result = auditRepository(root, approval(['clipboard-read'], '2026-07-15'), { today: new Date('2026-07-15T23:59:59Z') });
  assert.equal(result.summary.high, 0);
  assert.equal(result.summary.approved, 1);
});

test('expired exception fails closed', () => {
  const { root } = workspace({ ...safeManifest, permissions: ['storage', 'clipboardRead'] });
  const result = auditRepository(root, approval(['clipboard-read'], '2026-07-14'), { today: new Date('2026-07-15T00:00:00Z') });
  assert.equal(result.summary.high, 1);
  assert.match(result.findings[0].message, /expired/);
});

test('stale permission exception is rejected', () => {
  const { root } = workspace(safeManifest);
  const result = auditRepository(root, approval(['clipboard-read']), { today: new Date('2026-07-15T00:00:00Z') });
  assert.equal(result.summary.high, 1);
  assert.equal(result.findings[0].code, 'stale-policy-risk');
});

test('duplicate permissions are rejected', () => {
  const { root, policy } = workspace({ ...safeManifest, permissions: ['storage', 'storage'] });
  const result = auditRepository(root, policy);
  assert.equal(result.summary.high, 1);
  assert.equal(result.findings[0].code, 'duplicate-entry');
});

test('unsafe extension CSP is critical', () => {
  const { root, policy } = workspace({
    ...safeManifest,
    content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'" },
  });
  const result = auditRepository(root, policy);
  assert.equal(result.summary.critical, 1);
  assert.equal(result.findings[0].risk, 'unsafe-extension-csp');
});
