# Athlet-O website agent instructions

## Website, security, and release invariants

- Keep product claims, download links, API/app references, screenshots, pricing or capability statements, and legal/privacy content aligned with the current Athlet-O repositories and releases.
- Preserve the restrictive hash-based Content Security Policy emitted by Astro. GitHub Pages cannot provide all required headers; keep the documented division between meta CSP and Cloudflare edge headers explicit and tested.
- Never reintroduce `unsafe-inline`, unreviewed third-party scripts, user-controlled unsafe HTML, host-header assumptions, or vulnerable SSR/server-island behavior into this static site.
- Keep `.env` and `.env.*` out of Git while retaining only reviewed example configuration. Never expose credentials, tokens, private athlete data, or production telemetry in source, built output, tests, logs, or browser artifacts.
- Browser tests must validate the built/previewed site through independent Playwright and Puppeteer paths, including CSP behavior, accessibility, links, responsive layout, console/page errors, and deployment-critical flows.
- GitHub Pages must deploy the exact reviewed and tested commit with pinned Actions, minimal permissions, bounded concurrency, and explicit provenance.

## Instruction discovery

Resolve `$PWD`, walk upward through every parent directory to the filesystem root, read every readable lowercase `agents.md` on that ancestor chain, and apply them root-to-leaf. Do not search siblings. Deduplicate resolved paths/inodes, avoid symlink cycles, and report unreadable files.

## Synchronize with the remote

Before editing, inspect `git status`, current branch, configured remotes, and the default branch. Run `git fetch --all --prune` and create the feature branch from the latest remote default branch, not a stale local branch. Fetch again before pushing and incorporate upstream changes according to repository policy. Never discard remote commits, force-push, rewrite shared history, bypass review, or bypass required CI.

## Resolve Git conflicts semantically

Resolve conflicts by understanding and combining both sides' intent. Do not mechanically choose `ours`, `theirs`, current, or incoming changes. Produce the conceptually correct result while preserving accurate product content, CSP and edge-header responsibilities, dependency security, secret exclusions, Playwright/Puppeteer coverage, accessibility, Pages provenance, tests, documentation, configuration, and public URLs. Regenerate built output and lockfiles from the merged source rather than selecting one side's generated files. If intentions are incompatible, make the smallest explicit design decision and document it in the pull request.

After resolving:

1. Reread every affected file from the top, not only conflict hunks.
2. Run dependency audit, Astro checks/build, both browser suites, CSP assertions, accessibility/link tests, and workflow validation.
3. Search the entire worktree for conflict markers:

   ```sh
   grep -RInE '^(<<<<<<<|=======|>>>>>>>)' --exclude-dir=.git .
   ```

4. If any marker or suspicious partial resolution remains, repeat semantic resolution from the top and rerun validation.

A conflict is resolved only when the site is conceptually coherent, secure, and verified, not merely accepted by Git.
