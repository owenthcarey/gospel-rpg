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

test('accepted walks and object actions get distinct markers while drags and held presses stay quiet', async ({
  page,
}, info) => {
  await ready(page);
  const flash = page.locator('.world-click-feedback');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  let ground: { x: number; y: number } | undefined;
  // Find bare ground through the shipped picking/menu path, rather than reaching into the scene.
  for (const [u, v] of [
    [0.35, 0.55],
    [0.5, 0.55],
    [0.65, 0.55],
    [0.5, 0.7],
    [0.35, 0.7],
  ]) {
    const point = { x: box.x + box.width * u!, y: box.y + box.height * v! };
    await page.mouse.click(point.x, point.y, { button: 'right' });
    if (!(await menu.isVisible())) continue;
    const options = await menu.getByRole('menuitem').allTextContents();
    await menu.getByRole('menuitem', { name: 'Cancel' }).click();
    if (options.length === 2 && options[0] === 'Walk here') {
      ground = point;
      break;
    }
  }
  expect(ground, 'a visible bare-ground pick is required').toBeDefined();
  const point = ground!;
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(flash).toBeHidden();
  await page.mouse.up();
  await expect(flash).toHaveAttribute('data-kind', 'ground');
  await expect(flash).toBeVisible();
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(flash).toBeHidden();

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 24, point.y + 10, { steps: 3 });
  await page.mouse.move(point.x, point.y, { steps: 3 });
  await page.mouse.up();
  await expect(flash).toBeHidden();

  const before = await page.locator('#minimap-player').getAttribute('transform');
  await page.mouse.down();
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await settled(page);
  await page.mouse.up();
  // Observe several rendered frames after the stale release, beyond the marker's lifetime.
  await page.waitForTimeout(600);
  await expect(flash).toBeHidden();
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', before!);

  const simon = page.locator('.world-label[data-value="simon"]');
  const labelBox = (await simon.boundingBox())!;
  const labelPoint = {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + labelBox.height / 2,
  };
  await page.mouse.move(labelPoint.x, labelPoint.y);
  await page.mouse.down();
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await settled(page);
  await page.mouse.up();
  await page.waitForTimeout(600);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(flash).toBeHidden();
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', before!);
  if (info.project.name === 'mobile-chromium') {
    await page.touchscreen.tap(point.x, point.y);
    await expect(flash).toHaveAttribute('data-kind', 'ground');
    await expect(flash).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('Escape');
    await settled(page);
  }
  await simon.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Cancel' }).click();
  await expect(flash).toBeHidden();
  if (info.project.name === 'mobile-chromium') {
    const touchBox = (await simon.boundingBox())!;
    await page.touchscreen.tap(touchBox.x + touchBox.width / 2, touchBox.y + touchBox.height / 2);
  } else await simon.click();
  await expect(flash).toHaveAttribute('data-kind', 'object');
  await expect(page.getByRole('dialog')).toContainText('Simon');
  await settled(page);
});
