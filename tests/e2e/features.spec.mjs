// @ts-check
import { expect, test } from "@playwright/test";

// The ten product sub-names, in the order they appear in the products array
// in src/pages/index.astro. Kept here so the tests fail loudly if a card is
// dropped, reordered, or renamed.
const SUBS = [
  "daily",
  "pre-game",
  "recover",
  "immune",
  "probiotic",
  "prebiotic",
  "protein",
  "fiber",
  "electrolytes",
  "b-vitamins",
];

test.describe("product lineup", () => {
  test("every card renders its sub-name and flavor tagline", async ({ page }) => {
    await page.goto("/");

    // All ten cards, each with a sub-name label and a per-cup calorie chip.
    const cards = page.locator("#products .product-card");
    await expect(cards).toHaveCount(10);
    await expect(page.locator("#products .product-sub")).toHaveCount(10);
    await expect(page.locator("#products .cal-chip")).toHaveCount(10);

    // The sub-names appear in the documented order.
    // innerText reflects CSS text-transform (uppercase), so compare lowercased.
    const subs = await page.locator("#products .product-sub").allInnerTexts();
    expect(subs.map((s) => s.trim().toLowerCase())).toEqual(SUBS);

    // Spot-check two cards for the flavor text driven by the products array.
    await expect(page.locator(".product-card.athlet .tagline")).toContainText("lime-citrus");
    await expect(page.locator(".product-card.recover .tagline")).toContainText("Berry-orange");
    // Calorie chip text comes straight from product.calories.
    await expect(page.locator(".product-card.athlet .cal-chip")).toHaveText("80 cal");
  });
});

test.describe("sampler accessibility", () => {
  test("keyboard activation toggles the visible panel", async ({ page }) => {
    await page.goto("/");
    const buttons = page.locator(".sampler-controls button[data-sample]");

    // Focus the third button and activate it with Enter.
    const third = buttons.nth(2);
    const thirdKey = await third.getAttribute("data-sample");
    await third.focus();
    await expect(third).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(third).toHaveAttribute("aria-pressed", "true");
    let visible = page.locator("[data-sample-card]:not([hidden])");
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveAttribute("data-sample-card", thirdKey ?? "");

    // Space activates a different button; exactly one panel stays visible.
    const fifth = buttons.nth(4);
    const fifthKey = await fifth.getAttribute("data-sample");
    await fifth.focus();
    await page.keyboard.press(" ");
    await expect(fifth).toHaveAttribute("aria-pressed", "true");
    await expect(third).toHaveAttribute("aria-pressed", "false");
    visible = page.locator("[data-sample-card]:not([hidden])");
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveAttribute("data-sample-card", fifthKey ?? "");
  });
});

test.describe("responsive layout", () => {
  for (const { name, width, height } of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`hero is visible without horizontal overflow at ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { level: 1, name: "Wobble hard. Recover clean." }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `page should not scroll horizontally at ${width}x${height}`,
      ).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("document head", () => {
  test("exposes a canonical link and an SVG favicon", async ({ page }) => {
    await page.goto("/");

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    expect(await canonical.getAttribute("href")).toBe("https://athleto.store/");

    const icon = page.locator('link[rel="icon"]');
    await expect(icon).toHaveCount(1);
    expect(await icon.getAttribute("href")).toBe("/favicon.svg");
    expect(await icon.getAttribute("type")).toBe("image/svg+xml");
  });
});

test.describe("landmarks and a11y smoke", () => {
  test("has one h1, main/footer landmarks, and named controls", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);

    // Every raster image (if any) must carry alt text.
    const imagesMissingAlt = await page.$$eval("img", (imgs) =>
      imgs.filter((img) => !img.hasAttribute("alt")).length,
    );
    expect(imagesMissingAlt, "all <img> elements need alt text").toBe(0);

    // Meaningful SVGs (role="img") must be labelled; decorative ones are hidden.
    const unlabelledSvgs = await page.$$eval('svg[role="img"]', (svgs) =>
      svgs.filter((svg) => !(svg.getAttribute("aria-label") ?? "").trim()).length,
    );
    expect(unlabelledSvgs, 'svg[role="img"] must have a non-empty aria-label').toBe(0);

    // Every button exposes an accessible name (its visible text).
    const namelessButtons = await page.$$eval("button", (buttons) =>
      buttons
        .filter((b) => !((b.getAttribute("aria-label") ?? b.textContent) ?? "").trim())
        .map((b) => b.outerHTML),
    );
    expect(namelessButtons, "buttons must have accessible names").toEqual([]);
  });
});

test.describe("content security policy", () => {
  test("meta CSP is restrictive and hash-based, never unsafe-inline", async ({ page }) => {
    await page.goto("/");
    const content = await page
      .locator('meta[http-equiv="content-security-policy" i]')
      .getAttribute("content");
    expect(content, "expected a CSP meta tag").not.toBeNull();
    const csp = content ?? "";

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action");
    expect(csp).toContain("upgrade-insecure-requests");
    // The inline sampler script is allowed by a sha256 hash, never a blanket
    // unsafe-inline, and the Cloudflare beacon host is whitelisted.
    expect(csp).toMatch(/script-src [^;]*'sha256-/);
    expect(csp).toMatch(/script-src [^;]*https:\/\/static\.cloudflareinsights\.com/);
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
});
