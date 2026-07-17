// Puppeteer smoke tests, run with `npm run test:puppeteer`.
//
// Mirrors playwright.config.mjs: when E2E_BASE_URL is set the tests run
// against that URL (e.g. the live GitHub Pages deployment); otherwise the
// site is built and the production output is served with `astro preview` on
// a dedicated port and shut down afterwards.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { dirname } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const port = Number(process.env.E2E_PUPPETEER_PORT ?? 4332);
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseUrl = (externalBaseUrl ?? `http://127.0.0.1:${port}`).replace(/\/+$/, "");

/** @type {import('node:child_process').ChildProcess | undefined} */
let server;
/** @type {import('puppeteer').Browser} */
let browser;
/** @type {import('puppeteer').Page} */
let page;
/** @type {import('puppeteer').HTTPResponse | null} */
let homeResponse = null;

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Dev server at ${url} did not become ready: ${lastError}`);
}

before(async () => {
  if (!externalBaseUrl) {
    // Build first so `astro preview` serves the production output (including
    // the build-time CSP meta tag from astro.config.mjs `experimental.csp`).
    execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
    server = spawn(
      "npm",
      ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: repoRoot,
        stdio: "ignore",
        detached: true,
      },
    );
    await waitForServer(`${baseUrl}/`);
  }

  browser = await puppeteer.launch({
    // GitHub ubuntu-24 runners restrict unprivileged user namespaces (AppArmor),
    // which breaks Chrome's sandbox; disable it in CI only.
    args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
  });
  page = await browser.newPage();
  homeResponse = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle2" });
});

after(async () => {
  await browser?.close();
  if (server?.pid) {
    // npm spawns astro as a child process; kill the whole process group.
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
});

test("home page loads with an ok response", () => {
  assert.ok(homeResponse, "expected a navigation response for the home page");
  assert.ok(homeResponse.ok(), `expected 2xx status, got ${homeResponse.status()}`);
});

test("home page has a non-empty title", async () => {
  const title = await page.title();
  assert.ok(title.trim().length > 0, "expected document title to be non-empty");
});

test("home page shows the main hero heading", async () => {
  const headingText = await page.$eval("h1", (heading) => heading.textContent ?? "");
  assert.equal(headingText.trim(), "Wobble hard. Recover clean.");
});

test("home page renders all 10 product cards", async () => {
  const count = await page.$$eval("#products .product-card", (cards) => cards.length);
  assert.equal(count, 10);
});

test("home page carries the Content-Security-Policy meta tag", async () => {
  const content = await page.$eval(
    'meta[http-equiv="content-security-policy" i]',
    (meta) => meta.getAttribute("content") ?? "",
  );
  assert.ok(content.includes("default-src 'none'"), `unexpected CSP: ${content}`);
  assert.match(content, /script-src [^;]*'sha256-/, "inline script must be hash-allowed");
});

test("external links open in a new tab with noopener", async () => {
  const offenders = await page.$$eval(
    'a[href^="http://"], a[href^="https://"]',
    (anchors) =>
      anchors
        .filter((a) => a.getAttribute("target") !== "_blank" || !a.relList.contains("noopener"))
        .map((a) => a.getAttribute("href")),
  );
  assert.deepEqual(offenders, [], `links missing target=_blank or rel=noopener: ${offenders}`);
});
