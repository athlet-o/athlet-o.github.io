// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages origin with the production custom domain (no base path).
export default defineConfig({
  site: "https://athleto.store",
  experimental: {
    // Emit a <meta http-equiv="Content-Security-Policy"> at build time with
    // SHA-256 hashes for the inlined scripts/styles. GitHub Pages cannot set
    // response headers, so the meta tag is the only place to carry the CSP.
    // Note: frame-ancestors and HSTS cannot be expressed in a meta CSP and
    // must be set at the Cloudflare edge (see README).
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'none'",
        "img-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "upgrade-insecure-requests",
        // Cloudflare Web Analytics beacon posts its RUM payload here.
        "connect-src https://cloudflareinsights.com",
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
