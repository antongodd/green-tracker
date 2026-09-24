import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'domain', include: ['test/domain/**/*.test.ts'] } },
      {
        // Runs the real Worker in workerd (wrangler dev) against a fresh local D1.
        test: {
          name: 'api',
          include: ['test/api/**/*.test.ts'],
          globalSetup: ['test/api/globalSetup.ts'],
          testTimeout: 30_000,
          hookTimeout: 90_000,
        },
      },
    ],
  },
});
