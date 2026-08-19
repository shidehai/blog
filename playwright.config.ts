import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "4321";
if (!/^\d+$/u.test(e2ePort)) throw new Error("E2E_PORT must be numeric");
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

if (!process.env.NO_PROXY && !process.env.no_proxy) {
  process.env.NO_PROXY = "127.0.0.1,localhost,::1";
  process.env.no_proxy = "127.0.0.1,localhost,::1";
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: e2eOrigin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start",
    env: {
      ...process.env,
      CONTENT_SOURCE: "fixture",
      DIRECTUS_PREVIEW_TOKEN: "test-preview-token-at-least-24-chars",
      DIRECTUS_URL: "http://127.0.0.1:8055",
      NO_PROXY: "127.0.0.1,localhost,::1",
      PORT: e2ePort,
      PREVIEW_TRUSTED_HEADER: "test-preview-header-at-least-24-chars",
      SITE_URL: e2eOrigin,
      no_proxy: "127.0.0.1,localhost,::1",
    },
    reuseExistingServer: false,
    timeout: 30_000,
    url: `${e2eOrigin}/healthz`,
  },
});
