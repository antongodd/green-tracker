import { defineConfig } from '@playwright/test';

// The review panel's screenshots (not a test): the built app on its own local server, with made-up
// data, on an iPhone-sized screen. Run from the repo root:
//   npm run build && PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test -c .claude/review-panel/capture.config.ts
// Pictures and each screen's words land in .playwright/review/ (not committed).
const port = 8790;

export default defineConfig({
  testDir: '.',
  testMatch: 'capture*.spec.ts',
  outputDir: '../../.playwright/review-results',
  timeout: 600_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
  },
  webServer: [
    { command: `E2E_PORT=${port} node test/e2e/server.mjs`, cwd: '../..', url: `http://localhost:${port}/api/health`, reuseExistingServer: false, timeout: 90_000 },
  ],
});
