import { defineConfig } from "@playwright/test";

// Expects the API on :4000 started against the TEST database (see README). The web server is started here unless E2E_NO_SERVER is set.
export default defineConfig({
  testDir: "./e2e", timeout: 60_000, workers: 1, retries: process.env.CI ? 1 : 0, reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  webServer: process.env.E2E_NO_SERVER ? undefined : { command: process.env.CI ? "npm run start" : "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
