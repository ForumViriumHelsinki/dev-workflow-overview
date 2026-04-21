import { defineConfig, devices } from "@playwright/test";

// Minimal config for the live-mode smoke suite. Spec files live under
// tests/playwright/. Unit tests stay with vitest.
//
// CI should drive this via `just playwright:live-mode` (not yet wired);
// local runs assume the dev server + port-forward + podinfo fixtures
// are already up (see tests/playwright/live-mode.spec.ts header).
export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 60_000,
  retries: 0,
  reporter: [["line"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
