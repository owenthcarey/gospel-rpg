import { defineConfig, devices } from '@playwright/test';

/** Presentation review captures; not part of the regression suite. */
export default defineConfig({
  testDir: './tools/capture',
  timeout: 20 * 60_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: 'list',
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4175',
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
