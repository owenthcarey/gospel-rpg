import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function start(page: Page) {
  await page.goto('/');
  // Exercise the real quality control for consistent software-rendered CI runs.
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
  await expect(page.locator('#hud')).toBeVisible();
}
async function travel(page: Page, id: string) {
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator(`[data-action="travel"][data-value="${id}"]`).click();
  await expect(page.locator('.dialogue-box')).toBeVisible();
}
async function choice(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
}

test('a traveler completes the chapter, saves, reloads, and exports', async ({ page }, info) => {
  // Includes real-time walking, two restarts, and save round-trips on software WebGL.
  test.setTimeout(180_000);
  test.skip(
    info.project.name === 'mobile-chromium',
    'The desktop journey covers the full quest; mobile has its own interaction pass.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await travel(page, 'simon');
  await choice(page, 'Of course');
  await choice(page, 'I’ll bring the net');
  await expect(page.locator('#quest-card')).toContainText('1 / 5');
  await travel(page, 'nets');
  await choice(page, 'Take the mended net');
  await travel(page, 'miriam');
  await choice(page, 'Take the bread for Simon');
  await page.locator('.toolbar [data-action="inventory"]').click();
  await expect(page.getByRole('heading', { name: 'Mended fishing net' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Barley loaves' })).toBeVisible();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await travel(page, 'simon');
  await choice(page, 'Give Simon');
  await travel(page, 'jesus');
  await choice(page, 'Listen');
  await expect(page.locator('.dialogue-source')).toContainText('Scripture · WEB');
  await choice(page, 'Carry these words');
  await expect(page.locator('#quest-card')).toContainText('COMPLETE');
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.getByRole('heading', { name: 'An invitation to trust' })).toBeVisible();
  await expect(page.locator('.content-note')).toContainText('original');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-action="save-slot"][data-value="slot-1"]').click();
  await expect(page.locator('#toast')).toContainText('saved');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^the-way-journey-.*\.json$/);
  const exported = await readFile((await download.path())!);
  expect(JSON.parse(exported.toString()).state.quest).toBe('complete');
  await page.getByRole('button', { name: 'Start a new journey…' }).click();
  await page.getByRole('button', { name: 'Begin a new journey', exact: true }).click();
  await expect(page.locator('#quest-card')).toContainText('0 / 5');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-action="load-slot"][data-value="slot-1"]').click();
  await expect(page.locator('#quest-card')).toContainText('COMPLETE');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page
    .locator('#import-save')
    .setInputFiles({ name: 'journey.json', mimeType: 'application/json', buffer: exported });
  await expect(page.locator('#toast')).toContainText('imported journey');
  await expect(page.locator('#quest-card')).toContainText('COMPLETE');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#quest-card')).toContainText('COMPLETE');
  await travel(page, 'shore');
  await choice(page, 'Remember this');
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.getByRole('heading', { name: 'One lake, many names' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('menus, touch navigation, settings, and invalid imports stay usable', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('#import-save').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.locator('#toast')).toContainText('newer version');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await travel(page, 'simon');
  await choice(page, 'Of course');
  await choice(page, 'I’ll bring the net');
  await page.locator('.toolbar [data-action="map"]').click();
  await expect(page.getByRole('heading', { name: 'Capernaum', exact: true })).toBeVisible();
  // A visible edge of the menu must receive hits ahead of the HUD behind it.
  expect(
    await page.locator('.panel').evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return Boolean(document.elementFromPoint(rect.left + 12, rect.top + 100)?.closest('.panel'));
    }),
  ).toBe(true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#quest-card')).toContainText('1 / 5');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await expect(page.locator('[data-setting="quality"]')).toHaveValue('low');
  await expect(page.locator('[data-setting="reducedMotion"]')).toBeChecked();
});

test('ground clicks, keyboard movement, and menu focus work together', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Keyboard desktop coverage.');
  await start(page);
  const position = page.locator('#minimap-player');
  const beforeClick = await position.getAttribute('transform');
  await page.locator('#game-canvas').click({ position: { x: 830, y: 530 } });
  await expect(position).not.toHaveAttribute('transform', beforeClick!);
  // Opening a modal stops the walking path before checking keyboard movement.
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  const beforeKey = await position.getAttribute('transform');
  await page.keyboard.down('d');
  await expect(position).not.toHaveAttribute('transform', beforeKey!);
  await page.keyboard.up('d');
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  const inDialog = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"]')),
  );
  expect(inDialog).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'A moment of rest' })).toBeVisible();
});

test('Ezra remembers earlier discoveries and the village story survives a reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await travel(page, 'well');
  await choice(page, 'Remember this');
  await travel(page, 'ezra');
  await choice(page, 'What should I look for');
  await choice(page, 'I’ll bring back a few memories');
  for (const place of ['Olive grove', 'Sea of Galilee']) {
    await page.locator('.toolbar [data-action="journal"]').click();
    await expect(page.locator('.village-summary')).toContainText('An ordinary morning');
    await page.getByRole('button', { name: /Find the next memory/ }).click();
    await expect(page.locator('.dialogue-box')).toBeVisible();
    await choice(page, 'Remember this');
    await page.locator('.toolbar [data-action="journal"]').click();
    await expect(page.locator('.discovery-card').filter({ hasText: place })).toContainText(
      'Remembered',
    );
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Return to Ezra', exact: true }).click();
  await expect(page.locator('.dialogue-box')).toBeVisible();
  await choice(page, 'The quiet beneath the olives');
  await choice(page, 'Sit with Ezra');
  await choice(page, 'Remember this morning');
  await expect(page.locator('#toast')).toContainText('Village story complete');
  await expect(page.locator('#quest-card')).toContainText('0 / 5');
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(
    page.getByRole('heading', { name: 'A place among neighbors', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.discovery-card.remembered')).toHaveCount(3);
  await expect(
    page.locator('.village-summary [data-action="travel"][data-value="ezra"]'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  expect(errors).toEqual([]);
});
