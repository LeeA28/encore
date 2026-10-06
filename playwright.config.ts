// Settings for the browser tests (npm run test:e2e), which drive a real browser through Encore.
// They start their own dev server on port 3100, and replace Encore's calls to its API routes with
// fake responses (see e2e/fixtures.ts), so no real keys, accounts, or outside services are needed.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000, // the first page load compiles the app, which can be slow
  retries: process.env.CI ? 1 : 0, // on GitHub, retry once, in case of a slow machine
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry", // a step-by-step recording of failed tests, for debugging
    // Use a specific browser if one is set (for running where Playwright can't download its own)
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } }, // a phone-sized, touch-screen browser
  ],
  webServer: {
    command: "npx next dev --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // A guest-only setup: without Supabase settings, Encore runs entirely in the browser
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
