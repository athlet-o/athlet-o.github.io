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
