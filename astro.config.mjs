// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages origin with the production custom domain (no base path).
export default defineConfig({
  site: "https://athleto.store",
  // Emit a <meta http-equiv="Content-Security-Policy"> at build time with
  // SHA-256 hashes for the inlined scripts/styles. GitHub Pages cannot set
  // response headers, so the meta tag is the only place to carry the CSP.
  // Note: frame-ancestors and HSTS cannot be expressed in a meta CSP and
  // must be set at the Cloudflare edge (see README and athleto-infra).
  //
  // CSP graduated from `experimental.csp` to the stable `security.csp` in
  // Astro 7 (unchanged shape). The exact directive set is asserted by the
  // Playwright and Puppeteer suites, so a silent regression here fails CI.
  security: {
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'none'",
        "img-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "upgrade-insecure-requests",
        // Cloudflare Web Analytics beacon posts its RUM payload either to the
        // zone's own proxied /cdn-cgi/rum path ('self') or directly to
        // cloudflareinsights.com, depending on beacon version.
        "connect-src 'self' https://cloudflareinsights.com",
      ],
      scriptDirective: {
        // static.cloudflareinsights.com: the analytics beacon Cloudflare
        // injects at the edge on athleto.store; absent on Pages/preview.
        resources: ["'self'", "https://static.cloudflareinsights.com"],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },
});
