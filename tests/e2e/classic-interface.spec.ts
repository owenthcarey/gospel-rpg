import { test, expect } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';

test('Choose Option approaches an existing person and cancels without changing the story', async ({
  page,
}) => {
  await ready(page);
  const simon = page.locator('.world-label[data-value="simon"]');
  await simon.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Talk-to Simon' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Walk here' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(simon).toBeFocused();
  await simon.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-canvas')).toBeFocused();
  await simon.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Talk-to Simon' }).click();
  await expect(page.getByRole('dialog')).toContainText('Simon');
  await settled(page);
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});

test('right drags orbit without opening an option menu and menus fit short viewports', async ({
  page,
}, info) => {
  await ready(page);
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await page.mouse.move(270, 320);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(300, 335, { steps: 5 });
  await page.mouse.move(270, 320, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await expect(menu).toBeHidden();
  if (info.project.name === 'mobile-chromium')
    await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('.world-label[data-value="simon"]').click({ button: 'right' });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await menu.getByRole('menuitem', { name: 'Cancel' }).click();
  await expect(menu).toBeHidden();
  await page.locator('.world-label[data-value="simon"]').hover();
  await expect(page.locator('.world-action-hint')).toContainText('Talk-to Simon');
  await expect(page.locator('.world-action-hint')).toBeVisible();
  await page.locator('#game-canvas').focus();
  // Orbit is sampled by the render loop; hold the key until the camera actually moves.
  await page.keyboard.down('q');
  await expect(page.locator('.world-action-hint')).toBeHidden();
  await page.keyboard.up('q');
});
