import { devices, test } from '@playwright/test';
import { graphicsQuestNotice, pointerQuestNotice } from '../helpers/quest-notice-browser';

test('native WebKit BODY-focused touch keeps an expanded quest clear of floating feedback', async ({
  browser,
  browserName,
  baseURL,
}, info) => {
  test.skip(browserName !== 'webkit', 'Firefox does not support the narrow mobile touch context.');
  const context = await browser.newContext({
    ...devices['iPhone SE'],
    baseURL,
    viewport: { width: 320, height: 548 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await pointerQuestNotice(await context.newPage(), true, browserName, info);
  } finally {
    await context.close();
  }
});

test('native WebKit touch tracks a story during graphics interruption without covering its inverse shortcut', async ({
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
    await graphicsQuestNotice(await context.newPage(), info, true, browserName);
  } finally {
    await context.close();
  }
});
