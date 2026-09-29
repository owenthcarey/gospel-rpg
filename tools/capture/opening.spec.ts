import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Reviews the first-run flow that automation normally skips: title, cold open, veil and arrival.
const output = resolve('artifacts/rfc011/captures', process.env.CAPTURE_LABEL ?? 'current');

test('capture the opening', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => false }),
  );
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-title', 'true');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(output, 'opening-01-title.png') });
  await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
  await expect(page.locator('.cold-open')).toBeVisible();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: resolve(output, 'opening-02-card.png') });
  await page.locator('.cold-open-continue').click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: resolve(output, 'opening-03-card.png') });
  await page.locator('.cold-open-skip').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(output, 'opening-04-veil.png') });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(output, 'opening-05-arrival.png') });
  await page.waitForTimeout(4200);
  await page.screenshot({ path: resolve(output, 'opening-06-settled.png') });
});
