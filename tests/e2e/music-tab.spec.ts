import { test, expect } from '@playwright/test';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';

test('the Music tab replays heard scores beside the world without opening Settings', async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'the-way:music-unlocked',
      JSON.stringify(['first-light', 'lantern-lanes']),
    ),
  );
  await ready(page);
  await settled(page);
  const before = await exported(page);
  await dismiss(page);
  const tab = page.locator('.toolbar [data-action="music"]');
  if (isMobile) {
    // Phones keep the music list inside Settings; their top bar has no room for a sixth tab.
    await expect(tab).toBeHidden();
    return;
  }
  const panel = page.getByRole('region', { name: 'Music' });
  await expect(panel).toBeHidden();
  await tab.click();
  await expect(panel).toBeVisible();
  await expect(tab).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.locator('.music-now')).toHaveText('Playing: First Light on the Water');
  // Heard scores are buttons; scores still ahead are plain red names.
  const tracks = panel.locator('.music-track');
  await expect(tracks).toHaveCount(2);
  await expect(panel.locator('.music-list li.unheard')).toHaveCount(7);
  await tracks.nth(1).click();
  await expect(panel.locator('.music-now')).toHaveText('Playing: Lanterns in the Lanes');
  await expect(tracks.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Return to area music' }).click();
  await expect(panel.locator('.music-now')).toHaveText('Playing: First Light on the Water');
  await expect(panel.getByRole('button', { name: 'Return to area music' })).toHaveCount(0);
  // Escape closes the panel and returns focus; opening Emotes or a menu also closes it.
  await tracks.first().focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(tab).toBeFocused();
  await tab.click();
  await page.locator('.toolbar [data-action="emotes"]').click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('region', { name: 'Emotes' })).toBeVisible();
  await tab.click();
  await expect(page.getByRole('region', { name: 'Emotes' })).toBeHidden();
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(panel).toBeHidden();
  await dismiss(page);
  const after = await exported(page);
  expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
});
