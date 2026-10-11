import { defineConfig } from '@playwright/test';

const port = 8788;
/** A second server with Smokes off, as on the live site (D46): smokes-off.spec.ts uses it. */
export const LIVE_PORT = 8789;

export default defineConfig({
  testDir: 'test/e2e',
  outputDir: '.playwright/results',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    // iPhone-sized (390 × 844, the design width). Chromium stands in for Safari here (D10).
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    // Kept for failed tests only (uploaded by CI).
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  webServer: [
    // Smokes on, as on the dev site.
    { command: `E2E_PORT=${port} E2E_SMOKES=on node test/e2e/server.mjs`, url: `http://localhost:${port}/api/health`, reuseExistingServer: false, timeout: 90_000 },
    // Smokes off, as on the live site (D46).
    { command: `E2E_PORT=${LIVE_PORT} E2E_SMOKES=off node test/e2e/server.mjs`, url: `http://localhost:${LIVE_PORT}/api/health`, reuseExistingServer: false, timeout: 90_000 },
  ],
});
