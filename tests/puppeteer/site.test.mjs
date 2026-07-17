// Puppeteer smoke tests, run with `npm run test:puppeteer`.
//
// Mirrors playwright.config.mjs: when E2E_BASE_URL is set the tests run
// against that URL (e.g. the live GitHub Pages deployment); otherwise an
// Astro dev server is spawned on a dedicated port and shut down afterwards.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
    server = spawn(
      "npm",
      ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: repoRoot,
        stdio: "ignore",
        detached: true,
      },
    );
    await waitForServer(`${baseUrl}/`);
  }

  browser = await puppeteer.launch();
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
