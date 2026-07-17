// @ts-check
import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("loads with an ok response", async ({ page }) => {
    const response = await page.goto("/");
    expect(response, "expected a navigation response").not.toBeNull();
    expect(response?.ok(), `expected 2xx status, got ${response?.status()}`).toBe(true);
  });

  test("has the AthletO title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AthletO/);
  });

  test("shows the main hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Wobble hard. Recover clean." }),
    ).toBeVisible();
  });

  test("renders all 10 product cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#products .product-card")).toHaveCount(10);
  });

  test("sampler buttons toggle aria-pressed and the visible panel", async ({ page }) => {
    await page.goto("/");
    const buttons = page.locator(".sampler-controls button[data-sample]");
    const cards = page.locator("[data-sample-card]");
    await expect(buttons).toHaveCount(10);
    await expect(cards).toHaveCount(10);

    // Initial state: first button pressed, only its panel visible.
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-sample-card]:not([hidden])")).toHaveCount(1);

    // Clicking another button moves aria-pressed and swaps the panel.
    const second = buttons.nth(1);
    const selectedKey = await second.getAttribute("data-sample");
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "false");
    const visible = page.locator("[data-sample-card]:not([hidden])");
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveAttribute("data-sample-card", selectedKey ?? "");

    // Clicking back restores the initial state.
    await buttons.first().click();
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-sample-card]:not([hidden])")).toHaveCount(1);
  });

  test("every external link opens in a new tab with noopener", async ({ page }) => {
    await page.goto("/");
    const links = await page.$$eval('a[href^="http://"], a[href^="https://"]', (anchors) =>
      anchors.map((a) => ({
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        rel: (a.getAttribute("rel") ?? "").split(/\s+/),
      })),
    );
    // 10 product cards x 4 retailer links + the footer GitHub link.
    expect(links.length).toBeGreaterThanOrEqual(41);
    const offenders = links.filter(
      (link) => link.target !== "_blank" || !link.rel.includes("noopener"),
    );
    expect(offenders, `links missing target=_blank or rel=noopener: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  test("serves a restrictive Content-Security-Policy meta tag", async ({ page }) => {
    await page.goto("/");
    const meta = page.locator('meta[http-equiv="content-security-policy" i]');
    await expect(meta).toHaveCount(1);
    const content = await meta.getAttribute("content");
    expect(content).toContain("default-src 'none'");
    // The inlined sampler script must be allowed via a hash, not unsafe-inline.
    expect(content).toMatch(/script-src [^;]*'sha256-/);
    expect(content).not.toContain("unsafe-inline");
  });

  test("renders without console errors", async ({ page }) => {
    /** @type {string[]} */
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      errors.push(String(error));
    });

    await page.goto("/", { waitUntil: "networkidle" });

    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
  });
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders the hero without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Wobble hard. Recover clean." }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "page should not scroll horizontally on a phone").toBeLessThanOrEqual(0);
  });
});
