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
