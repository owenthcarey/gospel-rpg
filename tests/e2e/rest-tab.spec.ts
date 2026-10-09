import { test, expect } from '@playwright/test';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';

test('the Rest tab saves the journey and returns to the title, ready to continue', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await settled(page);
  const tab = page.locator('.toolbar [data-action="logout-panel"]');
  if (isMobile) {
    // The classic logout door belongs to the desktop frame's tab row.
    await dismiss(page);
    await expect(tab).toBeHidden();
    return;
  }
  // Walk a little so the rested journey differs from a fresh one.
  await dismiss(page);
  await page.locator('#game-canvas').focus();
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  await settled(page);
  const panel = page.getByRole('region', { name: 'Rest' });
  await tab.click();
  await expect(panel).toBeVisible();
  await expect(tab).toHaveAttribute('aria-expanded', 'true');
  // Escape closes it without resting.
  await panel.getByRole('button', { name: 'Rest for now' }).focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(tab).toBeFocused();
  await tab.click();
  const before = await exported(page);
  await dismiss(page);
  await tab.click();
  await Promise.all([
    page.waitForEvent('load'),
    panel.getByRole('button', { name: 'Rest for now' }).click(),
  ]);
  const resume = page.getByRole('button', { name: 'Continue your journey' });
  await expect(resume).toBeVisible();
  await resume.click();
  await settled(page);
  const after = await exported(page);
  expect(after.position).toEqual(before.position);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
});
