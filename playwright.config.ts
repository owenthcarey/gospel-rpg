import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  // GitHub's CPU-rendered WebGL needs longer to walk the same real game paths.
  timeout: ci ? 180_000 : 90_000,
  expect: { timeout: ci ? 60_000 : 20_000 },
  // Leave time for report generation and upload before the workflow's job deadline.
  globalTimeout: ci ? 15 * 60_000 : 0,
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: 1,
  reporter: ci ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
    actionTimeout: ci ? 60_000 : 20_000,
    navigationTimeout: 60_000,
    launchOptions: {
      args: [
        '--enable-unsafe-swiftshader',
        // Reproduce GitHub's software WebGL renderer on a GPU-equipped host.
        ...(process.env.PLAYWRIGHT_SWIFTSHADER === '1' ? ['--use-angle=swiftshader'] : []),
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // CI downloads the exact production build that passed the build job.
    command: (ci ? '' : 'npm run build && ') + 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !ci,
    timeout: 60_000,
  },
});
