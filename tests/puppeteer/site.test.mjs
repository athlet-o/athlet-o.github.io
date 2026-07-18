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

// Open a fresh page already navigated to the home route. Used by tests that
// mutate DOM state (sampler toggles) or need listeners attached before load,
// so the shared `page` above stays pristine for the read-only checks.
async function freshHomePage() {
  const fresh = await browser.newPage();
  await fresh.goto(`${baseUrl}/`, { waitUntil: "networkidle2" });
  return fresh;
}

test("external links point at expected hosts with noopener + noreferrer", async () => {
  const allowedHosts = new Set([
    "www.amazon.com",
    "www.wholefoodsmarket.com",
    "www.target.com",
    "www.walmart.com",
    "github.com",
  ]);
  const links = await page.$$eval('a[href^="http://"], a[href^="https://"]', (anchors) =>
    anchors.map((a) => ({
      href: a.href,
      host: new URL(a.href).host,
      target: a.getAttribute("target"),
      noopener: a.relList.contains("noopener"),
      noreferrer: a.relList.contains("noreferrer"),
    })),
  );
  // 10 cards x 4 retailer links + the footer GitHub link.
  assert.ok(links.length >= 41, `expected >=41 external links, got ${links.length}`);
  const offenders = links.filter(
    (link) =>
      !allowedHosts.has(link.host) ||
      link.target !== "_blank" ||
      !link.noopener ||
      !link.noreferrer,
  );
  assert.deepEqual(offenders, [], `unexpected external links: ${JSON.stringify(offenders)}`);
});

test("product SVGs render with fill colors derived from product data", async () => {
  // Each card renders a cup + a packet SVG.
  const svgCount = await page.$$eval(
    ".product-card.athlet .product-visual svg",
    (svgs) => svgs.length,
  );
  assert.equal(svgCount, 2, "expected a cup and a packet SVG in the athlet card");

  // The per-product visual background custom property comes from product.visualBg.
  const visualBg = await page.$eval(".product-card.athlet .product-visual", (el) =>
    getComputedStyle(el).getPropertyValue("--visual-bg").trim(),
  );
  assert.equal(visualBg, "#e9fff0");

  // The sample card accent comes from product.cup.accent.
  const sampleColor = await page.$eval(".sample-card.athlet[data-sample-card]", (el) =>
    getComputedStyle(el).getPropertyValue("--sample-color").trim(),
  );
  assert.equal(sampleColor, "#168943");

  // The cup label's accent bar carries the accent hex directly as an attribute.
  const hasAccentRect = await page.$$eval(".product-card.athlet svg rect", (rects) =>
    rects.some((r) => r.getAttribute("fill") === "#168943"),
  );
  assert.ok(hasAccentRect, "expected an accent-filled rect derived from cup.accent");
});

test("home page loads with no console errors and no failed asset responses", async () => {
  const consoleErrors = [];
  const badResponses = [];
  const failedRequests = [];
  const fresh = await browser.newPage();
  fresh.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  fresh.on("pageerror", (error) => consoleErrors.push(String(error)));
  fresh.on("response", (response) => {
    const url = response.url();
    // Only same-origin assets; the Cloudflare beacon is edge-only and absent here.
    if (url.startsWith(baseUrl) && response.status() >= 400) {
      badResponses.push(`${response.status()} ${url}`);
    }
  });
  fresh.on("requestfailed", (request) => {
    if (request.url().startsWith(baseUrl)) {
      failedRequests.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
    }
  });

  await fresh.goto(`${baseUrl}/`, { waitUntil: "networkidle2" });
  await fresh.close();

  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join("\n")}`);
  assert.deepEqual(badResponses, [], `4xx/5xx responses: ${badResponses.join("\n")}`);
  assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join("\n")}`);
});

test("the only inline script is the sampler, allowed by the CSP hash", async () => {
  const cspErrors = [];
  const fresh = await browser.newPage();
  fresh.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /content security policy|refused to (execute|load)/i.test(text)) {
      cspErrors.push(text);
    }
  });
  await fresh.goto(`${baseUrl}/`, { waitUntil: "networkidle2" });

  // Collect inline scripts (no src, non-empty body). In the preview/built
  // output the sampler is the ONLY inline script; on the live domain the
  // Cloudflare edge may add its own, so only pin the exact count off-live.
  const inlineScripts = await fresh.$$eval("script", (scripts) =>
    scripts
      .filter((s) => !s.src && (s.textContent ?? "").trim().length > 0)
      .map((s) => s.textContent ?? ""),
  );
  if (!externalBaseUrl) {
    assert.equal(inlineScripts.length, 1, "expected exactly one inline script on the built output");
  }
  const samplerScripts = inlineScripts.filter((body) => /data-sample/.test(body));
  assert.equal(samplerScripts.length, 1, "expected exactly one inline sampler script");

  // If the CSP hash did not match, Chromium would refuse to run the script and
  // this toggle would never fire. Its success is the regression guard.
  await fresh.click('.sampler-controls button[data-sample="recover"]');
  const pressedKey = await fresh.$eval(
    '.sampler-controls button[aria-pressed="true"]',
    (b) => b.getAttribute("data-sample"),
  );
  assert.equal(pressedKey, "recover", "sampler script must run (proves CSP allowed it)");
  const visibleCards = await fresh.$$eval(
    "[data-sample-card]:not([hidden])",
    (cards) => cards.map((c) => c.getAttribute("data-sample-card")),
  );
  assert.deepEqual(visibleCards, ["recover"], "exactly one panel visible after toggle");

  await fresh.close();
  assert.deepEqual(cspErrors, [], `CSP violations reported: ${cspErrors.join("\n")}`);
});

test("sampler multi-toggle keeps exactly one panel and aria-pressed button", async () => {
  const fresh = await freshHomePage();

  const readState = () =>
    fresh.evaluate(() => ({
      pressed: [...document.querySelectorAll("[data-sample]")]
        .filter((b) => b.getAttribute("aria-pressed") === "true")
        .map((b) => b.getAttribute("data-sample")),
      visible: [...document.querySelectorAll("[data-sample-card]:not([hidden])")].map((c) =>
        c.getAttribute("data-sample-card"),
      ),
    }));

  // Initial state: first cup pressed, its panel shown.
  assert.deepEqual(await readState(), { pressed: ["athlet"], visible: ["athlet"] });

  // Click A -> B -> back to A; each step leaves exactly one pressed + visible.
  await fresh.click('.sampler-controls button[data-sample="fiber"]');
  assert.deepEqual(await readState(), { pressed: ["fiber"], visible: ["fiber"] });

  await fresh.click('.sampler-controls button[data-sample="electro"]');
  assert.deepEqual(await readState(), { pressed: ["electro"], visible: ["electro"] });

  await fresh.click('.sampler-controls button[data-sample="fiber"]');
  assert.deepEqual(await readState(), { pressed: ["fiber"], visible: ["fiber"] });

  await fresh.close();
});

test("CSP meta forbids unsafe-inline and locks the base URI and forms", async () => {
  const content = await page.$eval(
    'meta[http-equiv="content-security-policy" i]',
    (meta) => meta.getAttribute("content") ?? "",
  );
  assert.ok(content.includes("default-src 'none'"), `unexpected CSP: ${content}`);
  assert.ok(content.includes("base-uri 'none'"), "expected base-uri 'none'");
  assert.match(content, /form-action\s+'none'/, "expected form-action directive");
  assert.match(content, /script-src [^;]*https:\/\/static\.cloudflareinsights\.com/);
  assert.ok(
    content.includes("connect-src 'self' https://cloudflareinsights.com"),
    "expected Cloudflare RUM endpoint in connect-src",
  );
  assert.ok(!content.includes("unsafe-inline"), "CSP must not allow unsafe-inline");
  assert.ok(!content.includes("unsafe-eval"), "CSP must not allow unsafe-eval");
});
