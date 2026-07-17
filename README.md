# athlet-o.github.io

Athlet-O marketing site — performance gelatin cups ("Wobble hard. Recover clean.").

Static [Astro](https://astro.build) site deployed from the
[`athlet-o.github.io`](https://github.com/athlet-o/athlet-o.github.io) repository
via `.github/workflows/deploy.yml` on every push to `main`. The production site
is <https://athleto.store>.

## Hosting and DNS

- GitHub Pages is the static-site origin (`athlet-o.github.io`).
- Cloudflare is the authoritative DNS provider and HTTPS proxy for
  `athleto.store`.
- Squarespace is the domain registrar and delegates the zone to the Cloudflare
  nameservers assigned to it.
- `public/CNAME` keeps the Pages custom domain in the deployed artifact.

Do not point the apex at Squarespace website records. When moving the domain,
change the nameservers at Squarespace to the exact pair assigned by Cloudflare,
then manage the apex and `www` records in Cloudflare.

## Security headers

GitHub Pages cannot set custom response headers, so the Content-Security-Policy
is delivered as a `<meta http-equiv="Content-Security-Policy">` tag, generated
at build time by Astro's `experimental.csp` feature (configured in
`astro.config.mjs`, which hashes the one inlined script). A referrer policy is
set via `<meta name="referrer">` in `src/layouts/Base.astro`.

A meta CSP cannot express `frame-ancestors`, `report-uri`, or `sandbox`, and
HSTS is a response header only. Set these at the Cloudflare edge for
`athleto.store` (e.g. a response-header transform rule or a worker):

- `X-Frame-Options: DENY` and/or a header CSP with `frame-ancestors 'none'`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

Note the meta CSP only applies on the custom domain and the
`athlet-o.github.io` origin alike (it ships in the HTML), but the two headers
above must come from Cloudflare and therefore only cover `athleto.store`.

The page content is ported from the cluster-served `/jello` product concept page
(`web-home-rs` in the ORESoftware `k8s-cluster` repo). The Rust backend for
Athlet-O stays in the cluster; this repo is only the public marketing site.

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # static build to dist/
npm run preview  # serve the built site
```
