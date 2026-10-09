import { test, expect } from '@playwright/test';
import { exported, ready, settled } from '../helpers/connection-browser';

test('right-clicking the compass offers Look North, East, South and West', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The compass menu belongs to the desktop pointer');
  await ready(page);
  await settled(page);
  const before = await exported(page);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  // The camera eases round, so the minimap bearing is polled until it settles.
  const wrap = page.locator('.minimap-wrap');
  const bearing = async () => {
    const value = await wrap.evaluate((node) =>
      parseFloat(getComputedStyle(node).getPropertyValue('--map-bearing')),
    );
    return Math.round(((value % 360) + 360) % 360);
  };
  const compass = page.locator('.minimap-compass');
  for (const [direction, expected] of [
    ['East', 270],
    ['South', 180],
    ['West', 90],
    ['North', 0],
  ] as const) {
    await compass.click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Choose Option' });
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Look North',
      'Look East',
      'Look South',
      'Look West',
      'Cancel',
    ]);
    await menu.getByRole('menuitem', { name: 'Look ' + direction }).click();
    await expect(menu).toHaveCount(0);
    await expect.poll(bearing, { timeout: 10_000 }).toBe(expected);
  }
  // Escape closes the menu and returns focus to the compass.
  await compass.click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Choose Option' })).toHaveCount(0);
  await expect(compass).toBeFocused();
  const after = await exported(page);
  expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
});
