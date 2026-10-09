import { test, expect } from '@playwright/test';
import { ready } from '../helpers/connection-browser';

test('a newly carried item flashes the Satchel tab until it is opened', async ({ page }) => {
  await ready(page);
  const travel = async (id: string) => {
    await page.locator('.toolbar [data-action="map"]').click();
    await page.locator(`[data-action="travel"][data-value="${id}"]`).click();
    await expect(page.locator('.dialogue-box')).toBeVisible();
  };
  const satchel = page.locator('.toolbar [data-action="inventory"]');
  await travel('simon');
  await page.getByRole('button', { name: /Of course/ }).click();
  await page.getByRole('button', { name: /I’ll bring the net/ }).click();
  await expect(satchel).not.toHaveClass(/tab-flash/);
  await travel('nets');
  await page.getByRole('button', { name: /Take the mended net/ }).click();
  await expect(satchel).toHaveClass(/tab-flash/);
  await satchel.click();
  await expect(page.getByRole('heading', { name: 'Mended fishing net' })).toBeVisible();
  await expect(satchel).not.toHaveClass(/tab-flash/);
});
