import { test, expect } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';

test('WASD takes over a label approach while the focused label keeps its normal activation keys', async ({
  page,
}) => {
  await ready(page);
  const simon = page.locator('.world-label[data-value="simon"]');
  const player = page.locator('#minimap-player');
  await simon.click();
  await settled(page);
  await expect(simon).toBeFocused();
  await expect(page.locator('.minimap-destination')).toBeVisible();
  const position = await player.getAttribute('transform');
  await page.keyboard.down('w');
  try {
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await expect(player).not.toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('w');
  }
  await expect(simon).toBeFocused();
  await expect(page.getByRole('dialog')).toBeHidden();
  await simon.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await expect(menu.getByRole('menuitem', { name: 'Talk-to Simon', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Walk here', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(simon).toBeFocused();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});
