import { defineConfig } from '@playwright/test';

const port = 8788;

export default defineConfig({
  testDir: 'test/e2e',
  outputDir: '.playwright/results',
  timeout: 60_000,
  // D75: on CI a failed test gets one more try. A real break fails both; one that passes on the second try is
  // listed as flaky in the log, to be fixed in the next change.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
    // iPhone-sized (390 × 844, the design width). Chromium stands in for Safari here (D10).
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    // D97: accounts made by the tests skip Getting started (a header only the test servers listen to), so every
    // spec meets the app as it was. onboarding.spec.ts sends none, and gets what a real new account gets.
    extraHTTPHeaders: { 'x-gt-tour': 'off' },
    // Kept for failed tests only (uploaded by CI).
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  webServer: [
    { command: `E2E_PORT=${port} node test/e2e/server.mjs`, url: `http://localhost:${port}/api/health`, reuseExistingServer: false, timeout: 90_000 },
  ],
});
