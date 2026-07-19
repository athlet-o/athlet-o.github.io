# Maintenance notes — athlet-o.github.io

Verified 2026-07-18.

## P1 — Astro "high" advisory needs a major upgrade

- **`npm audit`:** 2 findings — 1 **high** (Astro advisory group: XSS via
  `define:vars` / spread props / slot name, server-island replay, host-header SSRF) on
  `astro ^5.x`; 1 low (bundled esbuild dev-server file read, dev-only/Windows-only).
- **Real exposure is limited:** this is a fully static, prerendered site with no SSR
  and no server islands, so the exploited paths aren't in the shipped output. But it is
  the one finding flagged "high".
- **Fix:** schedule a deliberate `astro@7` major upgrade (`npm i astro@^7`), then
  re-run `npm run build` + both test suites and fix any breaking-change fallout. Do
  **not** `npm audit fix --force` blindly — it jumps the major and can break the build.

## Edge-only security headers (cannot be set here)

- The build emits a hash-based CSP via `<meta http-equiv>` (`astro.config.mjs`
  `experimental.csp`), including the allowances for the Cloudflare Web Analytics beacon
  (`static.cloudflareinsights.com` script + `'self' cloudflareinsights.com` connect).
- `frame-ancestors` and HSTS **cannot** be expressed in a meta CSP and are not settable
  on GitHub Pages. Set them at the **Cloudflare edge** (Transform Rules / response
  headers): `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors 'none'`,
  and a redundant response-header CSP.

## Test/CI notes

- Playwright (`test:e2e`) and Puppeteer (`test:puppeteer`) both build `dist/` and serve
  it via `astro preview`, so CSP-dependent assertions run against production output.
  The live post-deploy job (`e2e-live`) filters console/network checks to same-origin,
  so the edge-injected Cloudflare beacon can't cause false failures.
- `deploy` is gated on the `test` job; all GitHub Actions are SHA-pinned.
