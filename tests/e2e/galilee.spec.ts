import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { makeSave, parseSave } from '../../src/persistence/schema';
import { roadStart } from '../helpers/road';
import { gateway } from '../helpers/campaign';
import {
  chosenShelter,
  preparedSpring,
  connectSpring,
  arrangedShelter,
  galileeAction,
} from '../helpers/galilee';
import { traceWater } from '../../src/game/galilee/channel';
import { renderingCadence } from '../helpers/rendering';

async function ready(page: Page, state = roadStart()) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('#import-save').setInputFiles({
    name: 'galilee.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(state))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', state.region);
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function dismiss(page: Page) {
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  if (await close.isVisible()) await close.click();
}
async function visit(page: Page, id: string) {
  await dismiss(page);
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator(`.map-destinations [data-value="${id}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function act(page: Page, id: string, type = 'galilee-action') {
  await page.locator(`#overlay [data-action="${type}"][data-value="${id}"]`).click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function exported(page: Page) {
  await dismiss(page);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return parseSave(JSON.parse(await readFile((await (await download).path())!, 'utf8')));
}
async function rotate(page: Page, id: string, count: number) {
  await visit(page, 'channel-' + id);
  for (let i = 0; i < count; i++) {
    await page.locator('[data-action="galilee-turn"]').click();
    await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  }
}

// Desktop and touch take different equally valid routes and reflections.
test('restore the spring through inspection, failed flow, rotation, hints and a lasting memory', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const north = info.project.name === 'chromium';
  await ready(page);
  await visit(page, 'spring-source');
  await act(page, 'spring-start');
  await act(page, 'spring-note-source');
  await expect(page.locator('[data-value="spring-clear-inlet"]')).toBeDisabled();
  await visit(page, 'spring-basins');
  await act(page, 'spring-note-basins');
  await visit(page, 'spring-tools');
  await act(page, 'spring-borrow');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'channel-scoop');
  const order = north ? ['inlet', 'silt'] : ['silt', 'inlet'];
  for (const id of order) {
    await visit(page, id === 'inlet' ? 'spring-source' : 'channel-entry');
    await act(page, 'spring-clear-' + id);
  }
  await visit(page, 'spring-tools');
  await act(page, 'spring-return');
  await visit(page, 'spring-source');
  await act(page, 'spring-test');
  await expect(page.locator('.work-result')).toContainText('entry');
  await page.locator('.work-hints summary').click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Show a more specific hint' }).click();
  }
  await expect(page.locator('.work-hints p')).toBeVisible();
  await expect(page.locator('.work-hints')).toContainText('east / west');
  await page.screenshot({ path: info.outputPath('channel-plan.png') });
  await exported(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await rotate(page, 'entry', 1);
  await rotate(page, 'turn', north ? 3 : 2);
  await rotate(page, north ? 'north' : 'south', north ? 1 : 2);
  await visit(page, 'spring-source');
  await act(page, 'spring-test');
  await expect(page.locator('.work-result')).toContainText(north ? 'north basin' : 'south basin');
  await act(page, 'spring-finish-' + (north ? 'patience' : 'sharing'));
  const save = await exported(page);
  expect(save.state.galilee.spring.stage).toBe('complete');
  expect(save.state.galilee.spring.hint).toBe(3);
  expect(traceWater(save.state.galilee.spring.turns).outlet).toBe(north ? 'north' : 'south');
  expect(save.state.campaign.carrying).toBeNull();
  await dismiss(page);
  await visit(page, 'tamar');
  await expect(page.getByRole('dialog')).toContainText('water');
  expect(errors).toEqual([]);
});

test('prepare either resting place, recover supplies across travel, correct its approach and welcome company', async ({
  page,
}, info) => {
  test.setTimeout(360_000);
  const site = info.project.name === 'chromium' ? 'shade' : 'breeze';
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, gateway(roadStart(), 'to-farm'));
  await visit(page, 'leah');
  await act(page, 'shelter-start');
  for (const id of ['shade', 'breeze']) {
    await visit(page, 'rest-' + id);
    await act(page, 'shelter-inspect-' + id);
  }
  await visit(page, 'rest-' + site);
  await act(page, 'shelter-choose-' + site);
  await visit(page, 'rest-supplies');
  await act(page, 'shelter-take-mat');
  await visit(page, 'rest-' + site);
  await act(page, 'shelter-place-' + site + '-mat');
  await visit(page, 'rest-' + site);
  await act(page, 'shelter-recover-' + site + '-mat');
  await visit(page, 'farm-exit');
  await act(page, 'farm-exit', 'journey');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilean-road');
  const interrupted = await exported(page);
  expect(interrupted.state.campaign.carrying).toBe('rest-mat');
  expect(interrupted.state.galilee.shelter.placed).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await page.locator('.toolbar [data-action="inventory"]').click();
  await expect(page.getByRole('dialog')).toContainText('return');
  await visit(page, 'to-farm');
  await act(page, 'to-farm', 'journey');
  await visit(page, 'rest-supplies');
  await act(page, 'shelter-return-mat');
  for (const supply of site === 'shade' ? ['screen', 'water', 'mat'] : ['water', 'mat', 'screen']) {
    await visit(page, 'rest-supplies');
    await act(page, 'shelter-take-' + supply);
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'rest-' + supply);
    await visit(page, 'rest-' + site);
    await expect(page.locator('.rest-socket')).toContainText([/mat/, /water/, /screen/]);
    await act(page, 'shelter-place-' + site + '-' + supply);
  }
  await visit(page, 'rest-' + site);
  await act(page, 'shelter-check-' + site);
  await expect(page.locator('.work-result')).toContainText('southern');
  await page.screenshot({ path: info.outputPath('blocked-approach.png') });
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-action="galilee-screen"]').click();
    await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  }
  await act(page, 'shelter-check-' + site);
  await expect(page.locator('.work-result')).toContainText('approach is open');
  await visit(page, 'leah');
  await act(page, 'shelter-finish-' + (site === 'shade' ? 'welcome' : 'care'));
  const save = await exported(page);
  expect(save.state.galilee.shelter).toMatchObject({ stage: 'complete', site, screen: 0 });
  expect(save.state.road.company).toEqual(roadStart().road.company);
  await dismiss(page);
  await page.screenshot({ path: info.outputPath('welcome-at-the-farm.png') });
  expect(errors).toEqual([]);
});

test('welcome does not request models; failed direct continuation keeps its save and supports retry', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.glb')) requests.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Begin your journey' })).toBeVisible();
  expect(requests).toEqual([]);
  await ready(page, chosenShelter());
  const saved = await exported(page);
  requests.length = 0;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue your journey' })).toBeVisible();
  expect(requests).toEqual([]);
  await page.route('**/leah.glb', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.getByRole('button', { name: 'Continue your journey' })).toBeVisible();
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-region');
  expect(requests.some((url) => /\/(boat|palm|market)\.glb$/.test(url))).toBe(false);
  await page.unroute('**/leah.glb');
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'roadside-farm');
  const after = await exported(page);
  expect(after.state.galilee).toEqual(saved.state.galilee);
  expect(after.state.journal).toEqual(saved.state.journal);
});

test('restrained guidance retains destinations, explicit cancellation and accessible plans on a small screen', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await ready(page, preparedSpring());
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="guidance"]').selectOption('explore');
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator('.map-destinations [data-value="to-nain"]').click();
  await expect(page.locator('#travel-status')).toContainText('Approaching');
  await page.getByRole('button', { name: 'Cancel walk' }).click();
  await expect(page.locator('#travel-status')).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeFocused();
  const save = await exported(page);
  expect(save.state.galilee.spring).toEqual(preparedSpring().galilee.spring);
  await visit(page, 'channel-entry');
  await expect(page.locator('.channel-plan svg')).toHaveAttribute('aria-label', /Source west/);
  await expect(page.locator('.channel-directions li')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('large-plan-portrait.png') });
  if (info.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('[data-action="galilee-turn"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-action="galilee-turn"]')).toBeInViewport();
    await page.screenshot({ path: info.outputPath('large-plan-landscape.png') });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await expect(page.locator('[data-setting="guidance"]')).toHaveValue('explore');
});

for (const place of ['spring', 'shelter'] as const)
  test(`completed ${place} restores its visible arrangement within both rendering budgets`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const state =
      place === 'spring'
        ? galileeAction(connectSpring(), 'spring-finish-sharing')
        : galileeAction(arrangedShelter(), 'shelter-finish-welcome');
    await ready(page, state);
    const records: Record<string, unknown> = {};
    for (const quality of ['high', 'low']) {
      await page.getByRole('button', { name: 'Settings and saves' }).click();
      await page.locator('[data-setting="quality"]').selectOption(quality);
      await dismiss(page);
      const cadence = await renderingCadence(page);
      await page.locator('#game-canvas').press('F3');
      const rows = await page
        .locator('.diagnostics-table tr')
        .evaluateAll((rows) =>
          Object.fromEntries(
            rows.map((r) => [
              r.querySelector('th')!.textContent,
              r.querySelector('td')!.textContent,
            ]),
          ),
        );
      const assets = await page
        .locator('.asset-diagnostics tr[data-asset]')
        .evaluateAll((rows) =>
          Object.fromEntries(
            rows.map((r) => [
              r.getAttribute('data-asset')!,
              [...r.querySelectorAll('td')].map((c) => Number(c.textContent)),
            ]),
          ),
        );
      expect(Number(rows.scenes)).toBe(1);
      expect(Number(rows.drawCalls)).toBeGreaterThan(0);
      expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
      for (const asset of place === 'spring'
        ? ['channel_straight', 'channel_bend', 'water_basin', 'supply_rack']
        : ['leah', 'resting_mat', 'reed_screen', 'jug', 'supply_rack']) {
        expect(assets[asset]?.[1], asset + ' enabled').toBeGreaterThan(0);
        expect(assets[asset]?.[2], asset + ' drawn').toBeGreaterThan(0);
      }
      records[quality] = { ...rows, cadence, assets, physicalDevice: false };
      await dismiss(page);
      await page.screenshot({ path: info.outputPath(place + '-' + quality + '.png') });
    }
    await writeFile(
      info.outputPath('galilee-render-metrics.json'),
      JSON.stringify(records, null, 2),
    );
  });

test('a farm supply survives Gospel reading and returns to its rack without changing a waiting companion', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const waiting = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v7-companion-waiting.json', 'utf8')),
  ).state;
  let state = galileeAction(chosenShelter(waiting), 'shelter-take-screen');
  state = gateway(state, 'farm-exit');
  await ready(page, state);
  await visit(page, 'to-nain');
  await act(page, 'to-nain', 'journey');
  await visit(page, 'nain-viewpoint');
  await act(page, 'nain-enter', 'road-action');
  await page.locator('.scene-continue').click();
  await page.locator('[data-action="scene-pause"]').click();
  const during = await exported(page);
  expect(during.state.campaign.carrying).toBe('rest-screen');
  expect(during.state.road.company).toEqual(waiting.road.company);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'procession');
  await page.locator('[data-action="scene-leave"]').click();
  await visit(page, 'nain-exit');
  await act(page, 'nain-exit', 'journey');
  const stillWaiting = await exported(page);
  expect(stillWaiting.state.road.company).toEqual(waiting.road.company);
  await visit(page, 'to-farm');
  await act(page, 'to-farm', 'journey');
  await visit(page, 'rest-supplies');
  await act(page, 'shelter-return-screen');
  const returned = await exported(page);
  expect(returned.state.campaign.carrying).toBeNull();
  expect(returned.state.road.chapter.checkpoint).toBe('procession');
  // Rejoining his region legitimately resumes movement; the task does not reset his route.
  expect(returned.state.road.company).toMatchObject({
    region: waiting.road.company.region,
    route: waiting.road.company.route,
    step: waiting.road.company.step,
  });
  expect(returned.state.galilee.shelter.placed).toEqual([]);
});
