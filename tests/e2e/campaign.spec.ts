import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { readyShore, onLake, play } from '../helpers/journey';
import { SCENE_IDS } from '../../src/game/episode/types';
import { ROOF_SCENES } from '../../src/game/campaign/types';
import { makeSave } from '../../src/persistence/schema';
import { action, district } from '../helpers/campaign';

async function ready(page: Page, buffer?: Buffer): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  if (buffer)
    await page
      .locator('#import-save')
      .setInputFiles({ name: 'journey.json', mimeType: 'application/json', buffer });
  else
    await page
      .locator('#import-save')
      .setInputFiles('tests/fixtures/saves/v4-complete-episode.json');
  await expect(page.locator('#hud')).toBeVisible();
}
async function close(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
}
async function visit(page: Page, id: string): Promise<void> {
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator('.map-destinations [data-value="' + id + '"]').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}
async function doAction(page: Page, id: string): Promise<void> {
  await page.locator('[data-action="campaign-action"][data-value="' + id + '"]').click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function door(page: Page, id: string, region: string): Promise<void> {
  await visit(page, id);
  await page.locator('[data-action="journey"][data-value="' + id + '"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region);
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function exported(page: Page): Promise<ReturnType<typeof makeSave>> {
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return JSON.parse((await readFile((await (await download).path())!)).toString());
}
async function oneScene(page: Page, id: string): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', id);
  await page.locator('.scene-continue').click();
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-checkpoint', id);
}

test('a v4 traveler walks into Chapter II, resumes every scene and completes the aftermath', async ({
  page,
}, info) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator('#quest-card')).toContainText('Through the Roof');
  await door(page, 'to-lanes', 'capernaum-lanes');
  await page.screenshot({ path: info.outputPath('district.png') });
  await door(page, 'to-house', 'gathering-house');
  await page.screenshot({ path: info.outputPath('house.png') });
  await visit(page, 'house-viewpoint');
  await doAction(page, 'roof-enter');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'roof-account');
  await page.getByRole('button', { name: 'Read transcript', exact: true }).click();
  await expect(page.locator('.transcript-beat')).toHaveCount(8);
  await expect(page.getByRole('dialog')).toContainText('Luke 5:17–26');
  await close(page);
  await expect(page.locator('.scene-continue')).toBeFocused();
  for (const id of ROOF_SCENES) {
    if (id === 'roof') {
      await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
      await page.screenshot({ path: info.outputPath('roof.png') });
      await page.getByRole('button', { name: 'Return to the house', exact: true }).click();
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'gathering-house');
      await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
      await page.reload();
      await page.getByRole('button', { name: 'Continue your journey' }).click();
      await visit(page, 'house-viewpoint');
      await doAction(page, 'roof-enter');
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'roof');
    }
    if (id === 'rise' || id === 'amazement')
      await page.screenshot({ path: info.outputPath(id + '.png') });
    await oneScene(page, id);
  }
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'gathering-house');
  await visit(page, 'house-viewpoint');
  await doAction(page, 'after-house');
  await close(page);
  await door(page, 'house-exit', 'capernaum-lanes');
  await visit(page, 'ruth');
  await doAction(page, 'after-ruth');
  await close(page);
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'hannah');
  await doAction(page, 'after-hannah');
  await close(page);
  await page.screenshot({ path: info.outputPath('bakehouse.png') });
  await door(page, 'bakehouse-exit', 'capernaum-lanes');
  await door(page, 'to-house', 'gathering-house');
  await visit(page, 'house-viewpoint');
  await page.locator('[data-action="roof-reflect"][data-value="welcome"]').click();
  await expect(page.locator('#quest-card')).toContainText('COMPLETE');
  const save = await exported(page);
  expect(save.version).toBe(5);
  expect(save.state.campaign.roof.stage).toBe('complete');
  expect(save.state.campaign.roof.reflection).toBe('welcome');
  expect(save.state.episode.stage).toBe('complete');
  expect(save.state.campaign.walk.stage).toBe('not-started');
  expect(save.state.campaign.table.stage).toBe('not-started');
  await close(page);
  await page.keyboard.press('F3');
  await expect(
    page
      .locator('.diagnostics-table tr')
      .filter({ has: page.getByRole('rowheader', { name: 'scenes', exact: true }) })
      .getByRole('cell'),
  ).toHaveText('1');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('bread and water remain portable across interiors, reload, and large reading size', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await ready(page, Buffer.from(JSON.stringify(makeSave(district()))));
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'hannah');
  await doAction(page, 'table-accept');
  await doAction(page, 'table-courtyard');
  await close(page);
  await visit(page, 'jug-shelf');
  await doAction(page, 'take-jug');
  await close(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'empty-jug');
  await door(page, 'bakehouse-exit', 'capernaum-lanes');
  await visit(page, 'water-point');
  await doAction(page, 'fill-jug');
  await close(page);
  let save = await exported(page);
  expect(save.state.campaign.carrying).toBe('water-jug');
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await close(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'water-jug');
  await visit(page, 'courtyard-table');
  await doAction(page, 'place-water-courtyard');
  await close(page);
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'bread-shelf');
  await doAction(page, 'take-bread');
  await close(page);
  await door(page, 'bakehouse-exit', 'capernaum-lanes');
  await visit(page, 'courtyard-table');
  await doAction(page, 'place-bread-courtyard');
  await close(page);
  await page.screenshot({ path: info.outputPath('prepared-table.png') });
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'hannah');
  await doAction(page, 'table-finish');
  await close(page);
  save = await exported(page);
  expect(save.state.campaign.table).toEqual({
    stage: 'complete',
    location: 'courtyard',
    delivered: ['water', 'bread'],
  });
  expect(save.state.campaign.carrying).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const route of ['outer', 'passage'] as const)
  test(`Amos walks the ${route} route, waits through menus, and resumes from an exported checkpoint`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    let s = action(action(district(), 'walk-accept'), 'walk-' + route);
    if (route === 'passage') {
      s = action(s, 'borrow-handle');
      s = action(s, 'open-passage');
    }
    s = action(s, 'walk-start');
    await ready(page, Buffer.from(JSON.stringify(makeSave(s))));
    const total = route === 'outer' ? 5 : 4;
    for (let step = 0; step < total; step++) {
      await page.locator('.toolbar [data-action="map"]').click();
      await page.locator('.map-destinations [data-value="amos-waypoint"]').click();
      if (step < total - 1)
        await expect(page.locator('#quest-card')).toContainText(`${step + 2} / ${total}`, {
          timeout: 60000,
        });
      else
        await expect(page.locator('#quest-card')).toContainText('final moment', { timeout: 60000 });
      if (step === 1) {
        const save = await exported(page);
        expect(save.state.campaign.walk.stage).toBe('walking');
        await page.screenshot({ path: info.outputPath('companion-save.png') });
        await page.locator('#import-save').setInputFiles({
          name: 'walk.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(save)),
        });
      }
    }
    await visit(page, 'amos');
    await doAction(page, 'walk-finish');
    await close(page);
    const save = await exported(page);
    expect(save.state.campaign.walk.stage).toBe('complete');
    expect(save.state.campaign.walk.route).toBe(route);
    expect(save.state.campaign.walk.position).toEqual({ x: 4, z: 5 });
  });

test('a failed neighborhood load can be retried and summary preserves the roof account', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Failure injection is shared.');
  test.setTimeout(180_000);
  await ready(page);
  await visit(page, 'to-lanes');
  await page.route('**/room_wall.glb', (route) => route.abort('failed'));
  await page.locator('[data-action="journey"]').click();
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await page.unroute('**/room_wall.glb');
  await page.locator('[data-action="journey"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum-lanes');
  await door(page, 'to-house', 'gathering-house');
  await visit(page, 'house-viewpoint');
  await doAction(page, 'roof-enter');
  await page.getByRole('button', { name: 'Finish with a summary', exact: true }).click();
  await page.getByRole('button', { name: 'Return to the aftermath', exact: true }).click();
  const save = await exported(page);
  expect(save.state.campaign.roof.stage).toBe('aftermath');
  expect(save.state.journal.filter((id) => id.startsWith('roof-scene-'))).toHaveLength(8);
});

test('new regions stay within rendering budgets and keep one settled scene', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const records: Record<string, Record<string, string>> = {};
  const renderingErrors: string[] = [];
  page.on('pageerror', (error) => renderingErrors.push(error.message));
  page.on('console', (message) => {
    if (message.text().includes('Setting receiveShadows on an instanced mesh'))
      renderingErrors.push(message.text());
  });
  await ready(page, Buffer.from(JSON.stringify(makeSave(district()))));
  for (const region of [
    'capernaum',
    'lake-gennesaret',
    'capernaum-lanes',
    'gathering-house',
    'bakehouse',
    'roof-account',
  ] as const) {
    let s = district();
    if (region === 'roof-account') s = action(s, 'roof-enter');
    else {
      s.region = region;
      s.position = { x: 0, z: -3 };
    }
    if (region === 'roof-account') s.campaign.roof.checkpoint = 'house';
    if (region === 'capernaum') s = readyShore();
    if (region === 'lake-gennesaret')
      s = play(
        SCENE_IDS.slice(0, 6).map((checkpoint) => ({ type: 'advance-scene', checkpoint })),
        onLake(),
      );
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await page.locator('#import-save').setInputFiles({
      name: 'region.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(makeSave(s))),
    });
    for (const quality of ['high', 'low']) {
      await page.getByRole('button', { name: 'Settings and saves' }).click();
      await page.locator('[data-setting="quality"]').selectOption(quality);
      await close(page);
      const cadence = await page.evaluate(async () => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
        const gl = canvas.getContext('webgl2')!;
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debug
          ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : 'Unavailable';
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const values: number[] = [];
        let previous = 0;
        await new Promise<void>((resolve) => {
          const sample = (now: number) => {
            if (previous) values.push(now - previous);
            previous = now;
            if (values.length >= 120) resolve();
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        values.sort((a, b) => a - b);
        return {
          renderer,
          median: values[60]!.toFixed(1),
          p95: values[114]!.toFixed(1),
          viewport: innerWidth + '×' + innerHeight,
        };
      });
      const viewport = page.viewportSize()!;
      expect(cadence.viewport).toBe(viewport.width + '×' + viewport.height);
      await page.keyboard.press('F3');
      const rows = await page
        .locator('.diagnostics-table tr')
        .evaluateAll((elements) =>
          Object.fromEntries(
            elements.map((e) => [
              e.querySelector('th')!.textContent!,
              e.querySelector('td')!.textContent!,
            ]),
          ),
        );
      records[region + '-' + quality] = { ...rows, ...cadence };
      expect(Number(rows.scenes)).toBe(1);
      if (!['capernaum', 'lake-gennesaret'].includes(region))
        expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
      await close(page);
      await page.screenshot({
        path: info.outputPath(region + '-' + quality + '.png'),
        timeout: 60_000,
      });
    }
    if (info.project.name === 'mobile-chromium' && region === 'roof-account') {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.screenshot({ path: info.outputPath('roof-landscape.png') });
      await expect(page.locator('.scene-continue')).toBeVisible();
      const bounds = await page.locator('.scene-continue').boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
      for (const action of ['transcript', 'scene-summary', 'scene-leave', 'scene-pause']) {
        const button = page.locator('#scene-controls [data-action="' + action + '"]');
        await expect(button).toBeVisible();
        const r = await button.boundingBox();
        expect(r!.y + r!.height).toBeLessThanOrEqual(390);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
  }
  expect(renderingErrors).toEqual([]);
  await writeFile(info.outputPath('render-metrics.json'), JSON.stringify(records, null, 2));
  await info.attach('render-metrics', {
    path: info.outputPath('render-metrics.json'),
    contentType: 'application/json',
  });
});

test('the borrowed handle opens the passage and an indoor table accepts bread first', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'mobile-chromium',
    'Alternate action order is also covered by unit tests on the shared reducer.',
  );
  test.setTimeout(240_000);
  await ready(page, Buffer.from(JSON.stringify(makeSave(district()))));
  await visit(page, 'amos');
  await doAction(page, 'walk-accept');
  await doAction(page, 'walk-passage');
  await close(page);
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'tool-shelf');
  await doAction(page, 'borrow-handle');
  await close(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'cart-handle');
  await door(page, 'bakehouse-exit', 'capernaum-lanes');
  await visit(page, 'passage');
  await doAction(page, 'open-passage');
  await close(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', '');
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'hannah');
  await doAction(page, 'table-accept');
  await doAction(page, 'table-bakehouse');
  await close(page);
  await visit(page, 'bread-shelf');
  await doAction(page, 'take-bread');
  await close(page);
  await visit(page, 'bakehouse-table');
  await doAction(page, 'place-bread-bakehouse');
  await close(page);
  await visit(page, 'jug-shelf');
  await doAction(page, 'take-jug');
  await close(page);
  await door(page, 'bakehouse-exit', 'capernaum-lanes');
  await visit(page, 'water-point');
  await doAction(page, 'fill-jug');
  await close(page);
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'bakehouse-table');
  await doAction(page, 'place-water-bakehouse');
  await close(page);
  await visit(page, 'hannah');
  await doAction(page, 'table-finish');
  await close(page);
  await page.screenshot({ path: info.outputPath('indoor-table.png') });
  const save = await exported(page);
  expect(save.state.campaign.walk.gateOpen).toBe(true);
  expect(save.state.campaign.table).toEqual({
    stage: 'complete',
    location: 'bakehouse',
    delivered: ['bread', 'water'],
  });
});
