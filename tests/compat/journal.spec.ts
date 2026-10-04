import { devices, test } from '@playwright/test';
import { trackingAtReadingBoundary } from '../helpers/journal-browser';

test('native WebKit touch keeps a newly tracked Journal row visible above its save notice', async ({
  browser,
  browserName,
  baseURL,
}, info) => {
  test.skip(browserName !== 'webkit', 'Firefox does not support the narrow mobile touch context.');
  const context = await browser.newContext({
    ...devices['iPhone SE'],
    baseURL,
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await trackingAtReadingBoundary(await context.newPage(), true, browserName, info);
  } finally {
    await context.close();
  }
});
