import { test, expect } from '@playwright/test';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';

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

test('the run orb and map orb answer a right-click with their own action', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Orb menus belong to the desktop pointer');
  await ready(page);
  await settled(page);
  await dismiss(page);
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const run = page.locator('.run-orb');
  const pressed = await run.getAttribute('aria-pressed');
  await run.click({ button: 'right' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Toggle Run', 'Cancel']);
  await menu.getByRole('menuitem', { name: 'Toggle Run' }).click();
  await expect(run).not.toHaveAttribute('aria-pressed', pressed!);
  await page.locator('.minimap-open').click({ button: 'right' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Local Map', 'Cancel']);
  await menu.getByRole('menuitem', { name: 'Local Map' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
