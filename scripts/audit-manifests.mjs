#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { RISK_CATALOG, detectRisks, validateManifestShape } from './manifest-risks.mjs';

const LEVEL = { info: 0, medium: 1, high: 2, critical: 3 };
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.cache']);

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name === 'manifest.json') output.push(full);
  }
  return output;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function validatePolicy(policy, policyPath) {
  if (!policy || policy.version !== 1 || typeof policy.manifests !== 'object' || Array.isArray(policy.manifests)) {
    throw new Error(`${policyPath} must contain version 1 and a manifests object.`);
  }
}

function approvalStatus(entry, riskId, today) {
  const approval = entry?.risks?.[riskId];
  if (!approval) return { approved: false, reason: 'not approved' };
  if (typeof approval.reason !== 'string' || approval.reason.trim().length < 20) return { approved: false, reason: 'reason must contain at least 20 characters' };
  if (typeof entry.owner !== 'string' || !entry.owner.trim()) return { approved: false, reason: 'owner is required' };
  if (typeof entry.review_by !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.review_by)) return { approved: false, reason: 'review_by must use YYYY-MM-DD' };
  const reviewDate = new Date(`${entry.review_by}T00:00:00Z`);
  if (Number.isNaN(reviewDate.getTime())) return { approved: false, reason: 'review_by is invalid' };
  if (reviewDate < today) return { approved: false, reason: `approval expired on ${entry.review_by}` };
  return { approved: true };
}

export function auditRepository(root, policy, { today = new Date() } = {}) {
  const findings = [];
  const observed = new Map();
  const manifests = walk(root).sort();

  for (const file of manifests) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    let manifest;
    try {
      manifest = readJson(file, relative);
    } catch (error) {
      findings.push({ severity: 'critical', code: 'invalid-json', path: relative, message: error.message });
      continue;
    }
    validateManifestShape(manifest, relative, findings);
    const risks = detectRisks(manifest);
    observed.set(relative, new Set(risks));
    for (const riskId of risks) {
      const catalog = RISK_CATALOG[riskId];
      const approval = approvalStatus(policy.manifests[relative], riskId, today);
      if (!approval.approved && LEVEL[catalog.severity] >= LEVEL.high) {
        findings.push({ severity: catalog.severity, code: 'unapproved-risk', path: relative, risk: riskId, message: `${catalog.description} (${approval.reason})` });
      } else {
        findings.push({ severity: approval.approved ? 'info' : catalog.severity, code: approval.approved ? 'approved-risk' : 'risk', path: relative, risk: riskId, message: catalog.description });
      }
    }
  }

  const manifestSet = new Set(manifests.map((file) => path.relative(root, file).split(path.sep).join('/')));
  for (const [manifestPath, entry] of Object.entries(policy.manifests)) {
    if (!manifestSet.has(manifestPath)) {
      findings.push({ severity: 'high', code: 'stale-policy-path', path: manifestPath, message: 'Policy references a manifest that does not exist.' });
      continue;
    }
    const observedRisks = observed.get(manifestPath) ?? new Set();
    for (const riskId of Object.keys(entry?.risks ?? {})) {
      if (!RISK_CATALOG[riskId]) findings.push({ severity: 'high', code: 'unknown-policy-risk', path: manifestPath, risk: riskId, message: 'Policy references an unknown risk ID.' });
      else if (!observedRisks.has(riskId)) findings.push({ severity: 'high', code: 'stale-policy-risk', path: manifestPath, risk: riskId, message: 'Approved risk is no longer present; remove the stale exception.' });
    }
  }

  findings.sort((a, b) => (LEVEL[b.severity] - LEVEL[a.severity]) || a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return {
    summary: {
      manifests: manifests.length,
      critical: findings.filter((item) => item.severity === 'critical').length,
      high: findings.filter((item) => item.severity === 'high').length,
      medium: findings.filter((item) => item.severity === 'medium').length,
      approved: findings.filter((item) => item.code === 'approved-risk').length,
    },
    findings,
  };
}

function parseArgs(argv) {
  const options = { root: '.', policy: 'extension-policy.json', format: 'text', output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') options.root = argv[++index];
    else if (arg === '--policy') options.policy = argv[++index];
    else if (arg === '--format') options.format = argv[++index];
    else if (arg === '--output') options.output = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['text', 'json'].includes(options.format)) throw new Error('--format must be text or json');
  return options;
}

function render(result, format) {
  if (format === 'json') return JSON.stringify(result, null, 2);
  const lines = [`ARIA manifest audit: ${result.summary.manifests} manifests, ${result.summary.critical} critical, ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.approved} approved risks.`];
  for (const item of result.findings) lines.push(`- ${item.severity.toUpperCase()} ${item.code} ${item.path}${item.risk ? ` [${item.risk}]` : ''}: ${item.message}`);
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const root = path.resolve(options.root);
    const policy = readJson(path.resolve(options.policy), options.policy);
    validatePolicy(policy, options.policy);
    const result = auditRepository(root, policy);
    const report = `${render(result, options.format)}\n`;
    if (options.output) {
      fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
      fs.writeFileSync(path.resolve(options.output), report);
    } else process.stdout.write(report);
    return result.summary.critical || result.summary.high ? 1 : 0;
  } catch (error) {
    console.error(`Manifest audit error: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
