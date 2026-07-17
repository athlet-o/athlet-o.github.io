// @ts-check
import { defineConfig, devices } from "@playwright/test";

// When E2E_BASE_URL is set (e.g. the live GitHub Pages deployment) the tests
// run against that URL; otherwise Playwright spawns the Astro dev server.
// Note: https://athlet-o.github.io redirects to the custom domain
// https://athleto.store, so specs must not assert on the final URL.
const port = Number(process.env.E2E_PORT ?? 4321);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
