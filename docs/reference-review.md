# Browser-extension reference review

Reviewed on 2026-07-15.

## GoogleChrome/chrome-extensions-samples

The official sample repository separates single-API examples from full-featured extensions and keeps Manifest V2 material explicitly archived. Adopted: Manifest V3 as a hard requirement, capability-focused review, and treating permissions as part of the extension’s public design. Not copied: sample implementation code.

## bitwarden/clients

Bitwarden maintains its browser extension as a first-class, multi-browser application with dedicated build workflows and contributor documentation. Adopted: automated browser-extension verification, explicit security ownership, and reviewable manifests instead of an untested collection of unpacked folders. Not copied: product code, cryptography, Angular architecture, or build system.

## wxt-dev/wxt

WXT emphasizes structured extension entry points, cross-browser builds, TypeScript, automated publishing, and bundle analysis. Adopted: a root-level control plane that validates every extension consistently. Not adopted: framework migration, generated manifests, remote import bundling, or automated publishing, because ARIA is currently a plain-JavaScript unpacked suite and publishing is a side effect.

## Selected improvement

The highest-value low-risk improvement was permission governance rather than a framework rewrite: remove demonstrably redundant broad HTTP grants, inventory remaining privileged access, require expiring justifications, and block permission regressions in CI.
