import { test, expect } from '@playwright/test';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';

test('the Emotes tab plays a gesture without changing the journey and keeps keyboard movement', async ({
  page,
}) => {
  await ready(page);
  const before = await exported(page);
  await dismiss(page);
  await settled(page);
  const tab = page.locator('.toolbar [data-action="emotes"]');
  const panel = page.getByRole('region', { name: 'Emotes' });
  await expect(panel).toBeHidden();
  await tab.click();
  await expect(panel).toBeVisible();
  await expect(tab).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('button')).toHaveCount(14);
  for (const button of await panel.getByRole('button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // The panel is nonmodal: a gesture plays while the world keeps running.
  await panel.getByRole('button', { name: 'Wave' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(panel).toBeVisible();
  const player = page.locator('#minimap-player');
  const still = await player.getAttribute('transform');
  // Letter keys still walk after choosing a gesture.
  await page.keyboard.down('w');
  await expect.poll(() => player.getAttribute('transform')).not.toBe(still);
  await page.keyboard.up('w');
  // Escape closes the panel and returns focus to its tab; a menu also closes it.
  await panel.getByRole('button', { name: 'Bow' }).focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(tab).toBeFocused();
  await tab.click();
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(panel).toBeHidden();
  await dismiss(page);
  const after = await exported(page);
  expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
});
