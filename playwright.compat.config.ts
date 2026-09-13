import { defineConfig, devices } from '@playwright/test';

/** Small real-WebGL compatibility gate, separate from Chromium's complete journey matrix. */
export default defineConfig({
  testDir: './tests/compat',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results-compat',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true },
  },
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'npm run preview -- --port 4175 --strictPort'
      : 'npm run build -- --outDir .compat-dist && npm run preview -- --port 4175 --strictPort --outDir .compat-dist',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
