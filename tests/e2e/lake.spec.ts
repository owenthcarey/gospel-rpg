import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { makeSave, parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { lakeStart, sail, dock, coveStart, stormStart } from '../helpers/lake';
import { STORM_SCENES } from '../../src/game/lake/types';
import { requiredRegionAssets } from '../../src/content/render-contract';
import { renderingCadence } from '../helpers/rendering';

async function dismiss(page: Page) {
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  if (await close.isVisible()) await close.click();
}
async function importState(page: Page, state: GameState) {
  await page.locator('#import-save').setInputFiles({
    name: 'lake.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(state))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', state.region);
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function ready(page: Page, state = lakeStart()) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await importState(page, state);
}
async function visit(page: Page, id: string) {
  await dismiss(page);
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator(`.map-destinations [data-value="${id}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 45_000 });
}
async function act(page: Page, id: string, type = 'lake-action') {
  await page.locator(`#overlay [data-action="${type}"][data-value="${id}"]`).click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function passage(page: Page, id: string, region: string) {
  await visit(page, id);
  await act(page, id, 'journey');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region);
}
async function exported(page: Page) {
  await dismiss(page);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return parseSave(JSON.parse(await readFile((await (await download).path())!, 'utf8')));
}

test('sail to both shores, compare landmarks in either order, retry, save hints and return with either memory', async ({
  page,
}, info) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator('.quest-eyebrow')).toContainText('CHAPTER IV');
  await visit(page, 'joel');
  await act(page, 'accept');
  await passage(page, 'board-capernaum', 'galilee-water');
  await passage(page, 'dock-reed-landing', 'reed-landing');
  await visit(page, 'reed-shore');
  await act(page, 'reed-shore');
  await passage(page, 'board-reed-landing', 'galilee-water');
  const order =
    info.project.name === 'chromium' ? ['reeds', 'split-rock'] : ['split-rock', 'reeds'];
  for (const id of order) {
    await visit(page, 'lake-' + id);
    await act(page, 'evidence-' + id);
  }
  await dismiss(page);
  await page.getByRole('button', { name: 'Review the clues' }).click();
  await expect(page.getByRole('heading', { name: 'Joel’s recollection' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Read Through the Roof transcript' })).toHaveCount(
    0,
  );
  const contrast = await page.locator('.crossing-evidence').evaluate((el) => {
    const luminance = (rgb: string) =>
      rgb
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const ratio = (a: string, b: string) =>
      (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    const heading = getComputedStyle(el.querySelector('h3')!);
    const button = getComputedStyle(el.querySelector('.secondary-button')!);
    return {
      heading: ratio(heading.color, getComputedStyle(el).backgroundColor),
      button: ratio(button.color, button.backgroundColor),
    };
  });
  expect(contrast.heading).toBeGreaterThan(4.5);
  expect(contrast.button).toBeGreaterThan(4.5);
  await page.screenshot({ path: info.outputPath('crossing-recollection.png') });
  await act(page, 'exposed', 'lake-interpret');
  await expect(page.locator('.crossing-feedback')).toContainText('headland');
  await page.locator('.crossing-hints summary').click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Show a more specific hint' }).click();
    await expect(page.locator('.crossing-hints summary')).toBeFocused();
    await expect(page.locator('.crossing-hints summary')).toBeInViewport();
    await expect(page.locator('.crossing-hints p').first()).toBeInViewport();
  }
  await page.screenshot({ path: info.outputPath('crossing-evidence.png') });
  const evidence = await exported(page);
  expect(evidence.state.lake.trail).toMatchObject({
    evidence: order,
    interpretation: 'exposed',
    hint: 3,
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await page.locator('[data-journal-filter]').selectOption('crossing');
  await act(page, 'sheltered', 'lake-interpret');
  await passage(page, 'dock-sheltered-cove', 'sheltered-cove');
  await visit(page, 'cove-shore');
  await act(page, 'arrive');
  await passage(page, 'board-sheltered-cove', 'galilee-water');
  await passage(page, 'dock-capernaum', 'capernaum');
  await visit(page, 'joel');
  const ending = info.project.name === 'chromium' ? 'attention' : 'welcome';
  await act(page, ending, 'lake-ending');
  const done = await exported(page);
  expect(done.state.lake.trail).toMatchObject({ stage: 'complete', ending, hint: 3 });
  expect(done.state.lake.chapter.stage).toBe('exploring');
  expect(done.state.lake.boat).toMatchObject({ mode: 'ashore', berth: 'capernaum' });
  expect(errors).toEqual([]);
});

test('steering, cancelled routes and menus preserve actual afloat position, heading and carried supplies across reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const fixture = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v9-afloat-with-supply.json', 'utf8')),
  );
  await ready(page, fixture.state);
  const before = await exported(page);
  await dismiss(page);
  await page.locator('#game-canvas').focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowUp');
  const moved = await exported(page);
  expect(moved.state.position).not.toEqual(before.state.position);
  expect(moved.state.lake.boat.position).toEqual(moved.state.position);
  expect(moved.state.campaign.carrying).toBe('rest-screen');
  expect(moved.state.road.company).toEqual(fixture.state.road.company);
  await dismiss(page);
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator('.map-destinations [data-value="dock-sheltered-cove"]').click();
  await expect(page.locator('#travel-status')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel walk' }).click();
  const stopped = await exported(page);
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.waitForTimeout(400);
  const paused = await exported(page);
  expect(paused.state.position).toEqual(stopped.state.position);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  const restored = await exported(page);
  expect(restored.state.lake.boat).toEqual(stopped.state.lake.boat);
  expect(restored.state.road.company).toEqual(fixture.state.road.company);
  await passage(page, 'dock-capernaum', 'capernaum');
  const returned = await exported(page);
  expect(returned.state.campaign.carrying).toBe('rest-screen');
});

test('Peace, be still supports all seven scenes, descriptions, pause, leave, reload, transcript and reflection independently', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, coveStart());
  await visit(page, 'storm-viewpoint');
  await act(page, 'enter');
  await page.locator('#scene-controls [data-action="transcript"]').click();
  await expect(page.locator('.transcript-scene')).toHaveCount(7);
  await expect(page.getByRole('dialog')).toContainText('even the wind and the sea obey him');
  await expect(page.locator('a[href="https://ebible.org/engwebp/MRK04.htm"]')).toBeVisible();
  await dismiss(page);
  await expect(page.locator('.scene-continue')).toBeFocused();
  for (const checkpoint of STORM_SCENES) {
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', checkpoint);
    await page.locator('.scene-observation summary').click();
    await expect(page.locator('.scene-observation')).toHaveAttribute('open', '');
    if (checkpoint === 'storm') {
      await page.locator('[data-action="scene-pause"]').click();
      const time = await page.locator('#game-canvas').getAttribute('data-storm-time');
      await page.waitForTimeout(300);
      expect(await page.locator('#game-canvas').getAttribute('data-storm-time')).toBe(time);
      await page.screenshot({ path: info.outputPath('storm-paused.png') });
      await page.locator('[data-action="scene-leave"]').click();
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'sheltered-cove');
      await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
      await page.reload();
      await page.getByRole('button', { name: 'Continue your journey' }).click();
      await visit(page, 'storm-viewpoint');
      await act(page, 'enter');
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', checkpoint);
    }
    if (checkpoint === 'waking' || checkpoint === 'command' || checkpoint === 'calm')
      await page.screenshot({ path: info.outputPath('storm-' + checkpoint + '.png') });
    await page.locator('.scene-continue').click();
  }
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'sheltered-cove');
  for (const [id, target] of [
    ['landing', 'cove-shore'],
    ['lookout', 'cove-lookout'],
    ['neighbor', 'dalia'],
  ]) {
    await visit(page, target!);
    await act(page, 'after-' + id);
  }
  await visit(page, 'storm-viewpoint');
  const reflection = info.project.name === 'chromium' ? 'stillness' : 'trust';
  await act(page, reflection, 'storm-reflect');
  const save = await exported(page);
  expect(save.state.lake.chapter).toMatchObject({ stage: 'complete', reflection });
  expect(save.state.lake.trail.stage).toBe('not-started');
  expect(save.state.lake.boat).toMatchObject({ mode: 'ashore', berth: 'sheltered-cove' });
  expect(errors).toEqual([]);
});

test('failed boarding and Gospel loads retain the prior scene and save; retry and summary finish safely', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Transactional loader is shared.');
  test.setTimeout(180_000);
  await ready(page);
  await visit(page, 'board-capernaum');
  await page.route('**/split_rock.glb', (r) => r.abort('failed'));
  await act(page, 'board-capernaum', 'journey');
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  const failed = await exported(page);
  expect(failed.state.lake.boat.mode).toBe('ashore');
  await page.unroute('**/split_rock.glb');
  await passage(page, 'board-capernaum', 'galilee-water');
  await passage(page, 'dock-sheltered-cove', 'sheltered-cove');
  await visit(page, 'storm-viewpoint');
  await page.route('**/boat_cushion.glb', (r) => r.abort('failed'));
  await act(page, 'enter');
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'sheltered-cove');
  await page.unroute('**/boat_cushion.glb');
  await act(page, 'enter');
  await page.locator('[data-action="scene-summary"]').click();
  await act(page, 'evening', 'storm-summary');
  const after = await exported(page);
  expect(after.state.lake.chapter.stage).toBe('aftermath');
  expect(after.state.journal.filter((id) => id.startsWith('storm-scene-'))).toHaveLength(7);
});

for (const region of ['galilee-water', 'reed-landing', 'sheltered-cove', 'storm-account'] as const)
  test(`${region} draws essential models at both qualities, fits small screens and settles to one scene`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const states = [sail(), dock(sail(), 'reed-landing'), coveStart(), stormStart()];
    const state = states.find((s) => s.region === region)!;
    // Place the water reference between the island and eastern reeds so both
    // landmarks fit the narrower phone view as well as the desktop view.
    if (region === 'galilee-water') {
      state.position = { x: 7, z: -4 };
      state.lake.boat.position = { ...state.position };
    }
    await ready(page, state);
    const records: Record<string, unknown> = {};
    for (const quality of ['high', 'low']) {
      await page.getByRole('button', { name: 'Settings and saves' }).click();
      await page.locator('[data-setting="quality"]').selectOption(quality);
      await page.locator('[data-setting="textSize"]').selectOption('large');
      await page.locator('[data-setting="reducedMotion"]').check();
      await dismiss(page);
      const cadence = await renderingCadence(page);
      await page.locator('#game-canvas').press('F3');
      const rows = await page
        .locator('.diagnostics-table tr')
        .evaluateAll((rows) =>
          Object.fromEntries(
            rows.map((r) => [
              r.querySelector('th')!.textContent!,
              r.querySelector('td')!.textContent!,
            ]),
          ),
        );
      const assets = await page
        .locator('.asset-diagnostics tbody tr')
        .evaluateAll((rows) =>
          Object.fromEntries(
            rows.map((r) => [
              r.getAttribute('data-asset')!,
              [...r.querySelectorAll('td')].map((c) => Number(c.textContent)),
            ]),
          ),
        );
      for (const id of requiredRegionAssets[region]) {
        expect(assets[id]?.[1], region + '/' + id + ' enabled').toBeGreaterThan(0);
        expect(assets[id]?.[2], region + '/' + id + ' drawn').toBeGreaterThan(0);
      }
      expect(Number(rows.scenes)).toBe(1);
      expect(Number(rows.drawCalls)).toBeGreaterThan(0);
      expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
      records[quality] = { ...rows, cadence, assets, physicalDevice: false };
      await dismiss(page);
      await page.screenshot({ path: info.outputPath(region + '-' + quality + '.png') });
    }
    if (info.project.name === 'mobile-chromium') {
      await page.setViewportSize({ width: 844, height: 390 });
      if (region === 'storm-account')
        for (const action of [
          'storm-next',
          'transcript',
          'scene-summary',
          'scene-leave',
          'scene-pause',
        ]) {
          const button = page.locator('#scene-controls [data-action="' + action + '"]');
          const box = await button.boundingBox();
          expect(box!.y + box!.height).toBeLessThanOrEqual(390);
        }
      await page.screenshot({ path: info.outputPath(region + '-landscape.png') });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await writeFile(info.outputPath('lake-render-metrics.json'), JSON.stringify(records, null, 2));
    expect(errors).toEqual([]);
  });
