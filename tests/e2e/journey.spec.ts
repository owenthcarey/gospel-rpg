import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { ready, exported, readableContrast } from '../helpers/connection-browser';

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

test('satchel examination supports keyboard selection without changing carried supplies', async ({
  page,
}) => {
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v3-carrying-bread.json', 'utf8')),
  ).state;
  state.inventory.unshift('net');
  state.journal.push('net');
  await ready(page, state);
  const before = await exported(page);
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.locator('.toolbar [data-action="inventory"]').click();
  const slots = page.getByRole('list', { name: 'Satchel spaces' });
  await expect(slots.getByRole('listitem')).toHaveCount(4);
  await expect(page.locator('.satchel-capacity')).toContainText('2 / 4 spaces used');
  const net = page.getByRole('button', { name: 'Examine Mended fishing net', exact: true });
  const bread = page.getByRole('button', { name: 'Examine Barley loaves', exact: true });
  await net.focus();
  await net.press('ArrowRight');
  await expect(bread).toBeFocused();
  await expect(bread).toHaveAttribute('aria-pressed', 'true');
  await expect(net).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Item inspection' })).toContainText(
    'A small bundle of fresh bread from Miriam, wrapped in linen.',
  );
  await bread.press('ArrowRight');
  await expect(net).toBeFocused();
  await expect(page.getByRole('region', { name: 'Item inspection' })).toContainText(
    'Flax cord, carefully knotted.',
  );
  await bread.click();
  await expect(bread).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      slots
        .locator('.satchel-sprite')
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth === 64),
        ),
    )
    .toBe(true);
  await readableContrast(page, '.satchel-slot h3');
  await readableContrast(page, '.satchel-inspection p');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  const after = await exported(page);
  expect(after.inventory).toEqual(before.inventory);
  expect(after.quest).toEqual(before.quest);
  expect(after.journal).toEqual(before.journal);
  expect(after.episode).toEqual(before.episode);
  expect(after.campaign).toEqual(before.campaign);
});

test('carried supplies keep their own next stop when another story is selected', async ({
  page,
}, info) => {
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v8-supply-on-the-road.json', 'utf8')),
  ).state;
  state.tracking = 'roof';
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.locator('.toolbar [data-action="inventory"]').click();
  const next = page.getByRole('button', { name: 'Find the next stop', exact: true });
  await expect(page.locator('.carried-next-step')).toContainText('Room under the olives');
  await expect(page.locator('.carried-next-step')).toContainText(
    'Place what you carry at the chosen resting place.',
  );
  await expect(next).toHaveAttribute('data-value', 'rest-shade');
  for (const layout of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(layout);
    await next.focus();
    await expect(next).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    const bounds = (await next.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await readableContrast(page, '.carried-next-step p');
  await page.screenshot({ path: info.outputPath('satchel-item-next-stop.png'), scale: 'css' });
  await next.press('Enter');
  await expect(page.locator('#travel-status')).toContainText('The olive shade');
  const after = await exported(page);
  expect(after.connection.route?.target).toBe('rest-shade');
  expect(after.campaign.carrying).toBe('rest-screen');
  expect(after.galilee).toEqual(state.galilee);
  expect(after.tracking).toBe('roof');
});

test('a traveler completes the chapter, saves, reloads, and exports', async ({ page }, info) => {
  // Includes real-time walking, two restarts, and save round-trips on software WebGL.
  test.slow();
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
  await choice(page, 'Stay a moment and listen');
  await expect(page.locator('#quest-card')).toContainText('COMPLETE');
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Memories', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'An invitation to trust' })).toBeVisible();
  await expect(page.locator('.content-note').last()).toContainText('original');
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
  await page.getByRole('button', { name: 'Memories', exact: true }).click();
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
  test.slow();
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
    await page.getByRole('button', { name: 'Stories', exact: true }).click();
    await page.getByRole('combobox', { name: 'Filter journal by story' }).selectOption('village');
    await expect(page.locator('.village-summary')).toContainText('An ordinary morning');
    await page.getByRole('button', { name: /Find the next memory/ }).click();
    await expect(page.locator('.dialogue-box')).toBeVisible();
    await choice(page, 'Remember this');
    await page.locator('.toolbar [data-action="journal"]').click();
    await page.getByRole('button', { name: 'Stories', exact: true }).click();
    await page.getByRole('combobox', { name: 'Filter journal by story' }).selectOption('village');
    await expect(page.locator('.discovery-card').filter({ hasText: place })).toContainText(
      'Remembered',
    );
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter journal by story' }).selectOption('village');
  await page.getByRole('button', { name: 'Return to Ezra', exact: true }).click();
  await expect(page.locator('.dialogue-box')).toBeVisible();
  await choice(page, 'The quiet beneath the olives');
  await choice(page, 'Sit with Ezra');
  await choice(page, 'Remember this morning');
  await expect(page.locator('#toast')).toContainText('Village story complete');
  await expect(page.locator('#quest-card')).toContainText('0 / 5');
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter journal by story' }).selectOption('village');
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
