export const RISK_CATALOG = Object.freeze({
  'privileged-debugger': { severity: 'critical', description: 'Chrome debugger access can inspect or control tabs.' },
  'native-messaging': { severity: 'critical', description: 'Native messaging crosses the browser sandbox.' },
  'extension-management': { severity: 'critical', description: 'Management permission can inspect or alter extensions.' },
  'clipboard-read': { severity: 'high', description: 'Clipboard read can expose unrelated user data.' },
  'unlimited-storage': { severity: 'medium', description: 'Unlimited storage increases retained-data impact.' },
  'broad-http-host': { severity: 'high', description: 'Host access covers every insecure HTTP origin.' },
  'broad-https-host': { severity: 'high', description: 'Host access covers every HTTPS origin.' },
  'file-host-access': { severity: 'high', description: 'Host access covers local file URLs.' },
  'broad-http-content-script': { severity: 'high', description: 'A content script runs on every HTTP page.' },
  'broad-https-content-script': { severity: 'high', description: 'A content script runs on every HTTPS page.' },
  'file-content-script': { severity: 'high', description: 'A content script runs on local file pages.' },
  'unsafe-extension-csp': { severity: 'critical', description: 'Extension CSP permits unsafe evaluation or remote script execution.' },
  'wildcard-external-connectable': { severity: 'critical', description: 'Any website may connect to the extension.' },
});

function broadPattern(pattern, scheme) {
  return pattern === '<all_urls>' || pattern === `${scheme}://*/*`;
}

export function detectRisks(manifest) {
  const permissions = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
  const hosts = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  const matches = (Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [])
    .flatMap((script) => Array.isArray(script?.matches) ? script.matches : []);
  const risks = new Set();

  if (permissions.has('debugger')) risks.add('privileged-debugger');
  if (permissions.has('nativeMessaging')) risks.add('native-messaging');
  if (permissions.has('management')) risks.add('extension-management');
  if (permissions.has('clipboardRead')) risks.add('clipboard-read');
  if (permissions.has('unlimitedStorage')) risks.add('unlimited-storage');
  if (hosts.some((item) => broadPattern(item, 'http'))) risks.add('broad-http-host');
  if (hosts.some((item) => broadPattern(item, 'https'))) risks.add('broad-https-host');
  if (hosts.some((item) => item === '<all_urls>' || item === 'file://*/*')) risks.add('file-host-access');
  if (matches.some((item) => broadPattern(item, 'http'))) risks.add('broad-http-content-script');
  if (matches.some((item) => broadPattern(item, 'https'))) risks.add('broad-https-content-script');
  if (matches.some((item) => item === '<all_urls>' || item === 'file://*/*')) risks.add('file-content-script');

  const csp = typeof manifest.content_security_policy === 'string'
    ? manifest.content_security_policy
    : manifest.content_security_policy?.extension_pages;
  if (typeof csp === 'string' && (/unsafe-eval/i.test(csp) || /script-src[^;]*https?:/i.test(csp))) {
    risks.add('unsafe-extension-csp');
  }
  const externalMatches = manifest.externally_connectable?.matches;
  if (Array.isArray(externalMatches) && externalMatches.some((item) => item === '<all_urls>' || /^https?:\/\/\*\/\*$/.test(item))) {
    risks.add('wildcard-external-connectable');
  }
  return [...risks].sort();
}

function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}

function arrayOfStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateManifestShape(manifest, manifestPath, findings) {
  const add = (severity, code, message) => findings.push({ severity, code, path: manifestPath, message });
  if (manifest.manifest_version !== 3) add('critical', 'manifest-version', 'Manifest must use version 3.');
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) add('high', 'missing-name', 'Manifest name is required.');
  if (typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) add('high', 'invalid-version', 'Version must be a dotted numeric string.');
  for (const key of ['permissions', 'optional_permissions', 'host_permissions', 'optional_host_permissions']) {
    if (manifest[key] !== undefined && !arrayOfStrings(manifest[key])) add('high', 'invalid-array', `${key} must be an array of strings.`);
    if (arrayOfStrings(manifest[key])) {
      for (const duplicate of [...new Set(duplicates(manifest[key]))]) add('high', 'duplicate-entry', `${key} repeats ${duplicate}.`);
    }
  }
  if (Array.isArray(manifest.content_scripts)) {
    manifest.content_scripts.forEach((script, index) => {
      if (!arrayOfStrings(script?.matches) || !script.matches.length) add('high', 'invalid-content-script', `content_scripts[${index}].matches must be a non-empty string array.`);
      if (!arrayOfStrings(script?.js) || !script.js.length) add('high', 'invalid-content-script', `content_scripts[${index}].js must be a non-empty string array.`);
    });
  }
}
