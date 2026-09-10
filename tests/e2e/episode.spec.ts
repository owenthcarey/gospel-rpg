import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { SCENE_IDS } from '../../src/game/episode/types';

async function importPrelude(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('#import-save').setInputFiles('tests/fixtures/saves/v3-complete-village.json');
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#quest-card')).toContainText('Into the Deep');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-world-stage', 'not-started');
}
async function travel(page: Page, id: string): Promise<void> {
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator('.map-destinations [data-value="' + id + '"]').click();
  await expect(page.locator('.dialogue-box')).toBeVisible();
}
async function choose(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(label) }).click();
}
async function prepare(page: Page): Promise<void> {
  await travel(page, 'simon');
  await choose(page, 'I’ll help make room');
  await travel(page, 'supply-basket');
  await expect(page.locator('#action-tray')).toBeHidden();
  await choose(page, 'Carry the empty basket');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'empty-basket');
  await page.locator('.toolbar [data-action="inventory"]').click();
  await expect(page.getByRole('heading', { name: 'Empty basket', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Walk to the landing', exact: true }).click();
  await expect(page.locator('.dialogue-box')).toBeVisible();
  await choose(page, 'Set the basket at the landing');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', '');
  await travel(page, 'mooring');
  await choose(page, 'Coil the loose mooring rope');
  await travel(page, 'gathering');
  await choose(page, 'Make room in the gathering');
  await travel(page, 'viewpoint');
}
async function enterLake(page: Page): Promise<void> {
  await choose(page, 'Witness the account on the lake');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'lake-gennesaret');
  await expect(page.locator('#scene-controls')).toBeVisible();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'gathering');
}
async function exportCurrent(page: Page): Promise<Buffer> {
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const file = await download;
  return readFile((await file.path())!);
}

test('a migrated traveler completes preparation, every lake scene and a remembered aftermath', async ({
  page,
}, info) => {
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await importPrelude(page);
  await prepare(page);
  await enterLake(page);
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume motion', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Read all scenes', exact: true }).click();
  await expect(page.locator('.transcript-beat')).toHaveCount(10);
  await expect(page.locator('.transcript')).toContainText(
    'they left everything, and followed him.',
  );
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.locator('.scene-continue')).toBeFocused();
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
  for (const checkpoint of SCENE_IDS) {
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', checkpoint);
    if (checkpoint === 'lowering') {
      await page.screenshot({ path: test.info().outputPath('lake-' + info.project.name + '.png') });
      await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
      await page.reload();
      await page.getByRole('button', { name: 'Continue your journey' }).click();
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', checkpoint);
    }
    await page.locator('.scene-continue[data-value="' + checkpoint + '"]').click();
    // Wait for the durable transition before requesting the next one.
    if (checkpoint !== 'return')
      await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-checkpoint', checkpoint);
  }
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-world-stage', 'aftermath');
  await page.locator('.toolbar [data-action="map"]').click();
  await expect(page.locator('.map-destinations [data-value="simon"]')).toHaveCount(0);
  await expect(page.locator('.map-destinations [data-value="jesus"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await travel(page, 'landing');
  await choose(page, 'Set a filled basket');
  await travel(page, 'miriam');
  await choose(page, 'Thank Miriam');
  await travel(page, 'ezra');
  await choose(page, 'Carry Ezra’s question');
  await travel(page, 'viewpoint');
  await choose(page, 'The other boat');
  await choose(page, 'Carry this memory with me');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-world-stage', 'complete');
  await expect(page.locator('#quest-card')).toContainText('Through the Roof');
  const exported = await exportCurrent(page);
  const save = JSON.parse(exported.toString());
  expect(save.version).toBe(8);
  expect(save.state.episode.reflection).toBe('community');
  expect(save.state.villageStory).toBe('complete');
  expect(save.state.journal).toContain('scene-return');
  expect(save.state.journal).toContain('episode-complete');
  await page.locator('[data-action="save-slot"][data-value="slot-2"]').click();
  await expect(page.locator('#toast')).toContainText('saved');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-world-stage', 'complete');
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.locator('.saved-reflection')).toContainText('The other boat');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test('scene exit, resume, summary and reduced motion keep the same checkpoint', async ({
  page,
}) => {
  test.slow();
  await importPrelude(page);
  await prepare(page);
  await enterLake(page);
  await page.locator('.scene-continue').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'teaching');
  await page.getByRole('button', { name: 'Return to village', exact: true }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await travel(page, 'viewpoint');
  await choose(page, 'Resume the account');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'teaching');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Finish with summary', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('left everything and followed him');
  await page.getByRole('button', { name: 'Return to the aftermath', exact: true }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-world-stage', 'aftermath');
  const exported = await exportCurrent(page);
  expect(
    JSON.parse(exported.toString()).state.journal.filter((id: string) => id.startsWith('scene-')),
  ).toHaveLength(10);
});

test('a failed lake asset load leaves the shoreline playable and permits retry', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'mobile-chromium',
    'One network fault injection covers the shared loader.',
  );
  test.slow();
  await importPrelude(page);
  await prepare(page);
  await page.route('**/net_cast.glb', (route) => route.abort('failed'));
  await choose(page, 'Witness the account');
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('.dialogue-box')).toBeVisible();
  await page.unroute('**/net_cast.glb');
  await enterLake(page);
});

test('story tracking persists and phone objectives remain compact and readable', async ({
  page,
}) => {
  await importPrelude(page);
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Track village story', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.locator('#quest-card')).toContainText('An ordinary morning');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#quest-card')).toContainText('An ordinary morning');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await expect(page.locator('#quest-card')).toBeVisible();
  const viewport = page.viewportSize()!;
  if (viewport.width < 640) {
    await expect(page.locator('#quest-card .quest-details').first()).toBeHidden();
    await expect
      .poll(() =>
        page
          .locator('.current-objective')
          .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
      )
      .toBeGreaterThanOrEqual(14);
    const card = await page.locator('#quest-card').boundingBox();
    expect(card!.height).toBeLessThan(215);
  }
});

test('v4 import and manual restoration replace regions without accumulating scenes', async ({
  page,
}, info) => {
  test.slow();
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('#import-save').setInputFiles('tests/fixtures/saves/v4-interrupted-lake.json');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'lowering');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-action="save-slot"][data-value="slot-2"]').click();
  await expect(page.locator('#toast')).toContainText('saved');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  for (const checkpoint of ['lowering', 'abundance', 'partners', 'astonishment', 'calling']) {
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', checkpoint);
    await page.screenshot({ path: info.outputPath(checkpoint + '-' + info.project.name + '.png') });
    await page.locator('.scene-continue[data-value="' + checkpoint + '"]').click();
  }
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('#import-save').setInputFiles('tests/fixtures/saves/v4-complete-episode.json');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.keyboard.press('F3');
  await expect(
    page
      .locator('.diagnostics-table tr')
      .filter({ has: page.getByRole('rowheader', { name: 'scenes', exact: true }) })
      .getByRole('cell'),
  ).toHaveText('1');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-action="load-slot"][data-value="slot-2"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'lake-gennesaret');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'lowering');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.keyboard.press('F3');
  await expect(
    page
      .locator('.diagnostics-table tr')
      .filter({ has: page.getByRole('rowheader', { name: 'scenes', exact: true }) })
      .getByRole('cell'),
  ).toHaveText('1');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'lowering');
});

test('unavailable browser storage stays explicit and still allows portable export', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Storage failure behavior is shared.');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('Unavailable', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.storage-warning')).toContainText('storage is unavailable');
  await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
  const exported = await exportCurrent(page);
  expect(JSON.parse(exported.toString()).version).toBe(8);
  await expect(page.locator('.settings-note')).toContainText('last only this session');
});

test('the shoreline preparation tray works with keyboard and touch without a reading panel', async ({
  page,
}, info) => {
  await importPrelude(page);
  await travel(page, 'simon');
  await choose(page, 'I’ll help make room');
  for (const [target, action] of [
    ['supply-basket', 'take-basket'],
    ['landing', 'place-basket'],
    ['mooring', 'secure-mooring'],
    ['gathering', 'join-gathering'],
  ]) {
    await travel(page, target!);
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    const button = page.locator('#action-tray [data-value="episode:' + action + '"]');
    await expect(button).toBeVisible();
    if (info.project.name === 'chromium') {
      await button.focus();
      await page.keyboard.press('Enter');
    } else await button.tap();
    await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button).toHaveCount(0);
  }
  await expect(page.locator('#quest-card')).toContainText('viewpoint');
  const save = JSON.parse((await exportCurrent(page)).toString());
  expect(save.state.episode.preparations).toEqual(['basket', 'mooring', 'gathering']);
  expect(save.state.episode.carrying).toBeNull();
});
