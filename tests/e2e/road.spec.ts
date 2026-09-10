import { renderingCadence } from '../helpers/rendering';
import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { roadStart, completedRoof, roadAction, roadAt } from '../helpers/road';
import { gateway, action } from '../helpers/campaign';
import { transition } from '../../src/game/quest';
import { makeSave, parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { COMPANY_PATHS } from '../../src/content/road/routes';
import { NAIN_SCENES } from '../../src/game/road/types';
import { requiredRegionAssets } from '../../src/content/render-contract';

async function ready(page: Page, state = roadStart()) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await importState(page, state);
}
async function importState(page: Page, state: GameState) {
  await page.locator('#import-save').setInputFiles({
    name: 'road.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(state))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', state.region);
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function close(page: Page) {
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
}
async function visit(page: Page, id: string) {
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator(`.map-destinations [data-value="${id}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function act(page: Page, id: string, type = 'road-action') {
  await page.locator(`[data-action="${type}"][data-value="${id}"]`).click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function door(page: Page, id: string, region: string) {
  await visit(page, id);
  await act(page, id, 'journey');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region);
}
async function exported(page: Page) {
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return parseSave(JSON.parse(await readFile((await (await download).path())!, 'utf8')));
}

test('the road opens after Chapter II; Tamar’s investigation supports observation, retry, hints, reload and both memories', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mobile = info.project.name === 'mobile-chromium';
  await ready(page, completedRoof());
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.locator('.journal-summary')).toContainText('The prelude is complete');
  await expect(page.locator('.road-stories')).toContainText('At the gate');
  await close(page);
  await door(page, 'house-exit', 'capernaum-lanes');
  await door(page, 'to-road', 'galilean-road');
  await visit(page, 'tamar');
  await act(page, 'trail-accept');
  await close(page);
  const order = mobile ? ['terrace', 'spring'] : ['spring', 'terrace'];
  for (const id of order) {
    await visit(page, 'road-' + id);
    await expect(page.locator('.marker-study svg')).toHaveAttribute('aria-label', /stone/);
    await page.screenshot({ path: info.outputPath('inspection-' + id + '.png') });
    await act(page, id, 'road-evidence');
    await close(page);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await visit(page, 'tamar');
  await act(page, 'ridge', 'road-interpret');
  await expect(page.locator('.route-interpretation')).toContainText(
    'exposed ridge has no resting shelter',
  );
  await act(page, 'shelter', 'road-interpret');
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Show a more specific hint' }).click();
  await expect(page.locator('.road-hint')).toContainText('Hint 3 of 3');
  await close(page);
  await door(page, 'to-farm', 'roadside-farm');
  await visit(page, 'farm-landmark');
  await act(page, 'trail-arrive');
  await close(page);
  await page.screenshot({ path: info.outputPath('farm.png') });
  await door(page, 'farm-exit', 'galilean-road');
  await visit(page, 'tamar');
  const ending = mobile ? 'company' : 'observation';
  await act(page, ending, 'road-ending');
  const save = await exported(page);
  expect(save.state.road.trail).toMatchObject({
    stage: 'complete',
    evidence: order,
    ending,
    hint: 3,
  });
  expect(save.state.road.company.stage).toBe('not-started');
  expect(save.state.road.chapter.stage).toBe('exploring');
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await close(page);
  await page.locator('.toolbar [data-action="map"]').click();
  await page.getByRole('button', { name: 'Journey map', exact: true }).click();
  await expect(page.locator('.journey-destinations')).toContainText('The roadside farm');
  await page.screenshot({ path: info.outputPath('journey-map.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

for (const route of ['shade', 'terrace'] as const)
  test(`Neri walks the ${route} route across farm, road and Nain with menus, alternate exits and portable saves`, async ({
    page,
  }, info) => {
    test.setTimeout(420_000);
    let s = roadStart();
    if (route === 'shade') {
      // Carry a legacy object throughout the new regions.
      for (const id of ['table-accept', 'table-courtyard', 'take-jug', 'fill-jug'])
        s = action(s, id);
      s = gateway(s, 'to-road');
    }
    s = gateway(s, 'to-farm');
    await ready(page, s);
    await visit(page, 'neri');
    await act(page, 'company-accept');
    await act(page, route, 'road-route');
    await act(page, 'company-start');
    const path = COMPANY_PATHS[route];
    for (let step = 0; step < path.length; step++) {
      const node = path[step]!;
      await page.locator('.toolbar [data-action="map"]').click();
      await page.locator('.map-destinations [data-value="neri-meeting"]').click();
      if (node.exit) {
        await expect
          .poll(
            async () => {
              const point = JSON.parse(
                (await page.locator('#game-canvas').getAttribute('data-road-companion')) || '{}',
              );
              return Math.hypot(point.x - node.x, point.z - node.z);
            },
            { timeout: 60_000 },
          )
          .toBeLessThanOrEqual(1.2);
        await expect(page.locator('#toast')).toContainText('Stay near Neri', { timeout: 60_000 });
        await door(page, node.exit, node.exit === 'farm-exit' ? 'galilean-road' : 'nain-gate');
        await expect(page.locator('#quest-card')).toContainText(
          `Stop ${step + 2} / ${path.length}`,
        );
      } else if (step === path.length - 1)
        await expect(page.locator('#quest-card')).toContainText('final moment', {
          timeout: 60_000,
        });
      else
        await expect(page.locator('#quest-card')).toContainText(
          `Stop ${step + 2} / ${path.length}`,
          { timeout: 60_000 },
        );
      if (step === 0) {
        const save = await exported(page);
        const position = save.state.road.company.position;
        await page.locator('[data-setting="reducedMotion"]').check();
        // Menus pause actual movement, including after changing animation preferences.
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export', exact: true }).click();
        const again = parseSave(
          JSON.parse(await readFile((await (await download).path())!, 'utf8')),
        );
        expect(again.state.road.company.position).toEqual(position);
        await importState(page, save.state);
      }
      if (step === 1) {
        await door(page, 'road-to-lanes', 'capernaum-lanes');
        const save = await exported(page);
        expect(save.state.road.company.region).toBe('galilean-road');
        await page.screenshot({ path: info.outputPath('companion-waiting-save.png') });
        await importState(page, save.state);
        await door(page, 'to-road', 'galilean-road');
        await page.locator('.toolbar [data-action="journal"]').click();
        await expect(page.locator('.company-overview')).toContainText('The Galilean road');
        await page.locator('.company-overview [data-value="neri"]').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await close(page);
      }
    }
    await visit(page, 'neri');
    await act(page, 'company-finish');
    await close(page);
    const save = await exported(page);
    expect(save.state.road.company.stage).toBe('complete');
    expect(save.state.road.company.route).toBe(route);
    if (route === 'shade') expect(save.state.campaign.carrying).toBe('water-jug');
    await close(page);
    await page.screenshot({ path: info.outputPath('neri-resting.png') });
    if (route === 'shade') {
      await page.locator('.toolbar [data-action="inventory"]').click();
      await expect(page.getByRole('dialog')).toContainText('return');
      await close(page);
      await door(page, 'nain-exit', 'galilean-road');
      await door(page, 'road-to-lanes', 'capernaum-lanes');
      await door(page, 'to-bakehouse', 'bakehouse');
      const returned = await exported(page);
      expect(returned.state.campaign.carrying).toBe('water-jug');
      expect(returned.state.road.company).toEqual(save.state.road.company);
    }
  });

test('At the gate supports every scene, pause, transcript, leave, reload and a final reflection without optional errands', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, gateway(roadStart(), 'to-nain'));
  await visit(page, 'nain-viewpoint');
  await act(page, 'nain-enter');
  await page.locator('#scene-controls [data-action="transcript"]').click();
  await expect(page.locator('.transcript-beat')).toHaveCount(6);
  await expect(page.getByRole('dialog')).toContainText('God has visited his people');
  await expect(page.locator('a[href="https://ebible.org/engwebp/LUK07.htm"]')).toBeVisible();
  await close(page);
  await expect(page.locator('.scene-continue')).toBeFocused();
  for (const id of NAIN_SCENES) {
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', id);
    if (id === 'command') {
      await page.locator('[data-action="scene-pause"]').click();
      await page.screenshot({ path: info.outputPath('nain-command.png') });
      await page.locator('[data-action="scene-leave"]').click();
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'nain-gate');
      await page.reload();
      await page.getByRole('button', { name: 'Continue your journey' }).click();
      await visit(page, 'nain-viewpoint');
      await act(page, 'nain-enter');
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', id);
    }
    if (id === 'restored') {
      const time = async () => {
        const pose = (await page.locator('#game-canvas').getAttribute('data-nain-time')) ?? '';
        return pose.startsWith('restored:') ? Number(pose.split(':')[1]) : 0;
      };
      await expect.poll(time, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
      await page.locator('[data-action="scene-pause"]').click();
      await page.screenshot({ path: info.outputPath('nain-sitting-up.png') });
      await page.locator('[data-action="scene-pause"]').click();
      await expect.poll(time, { timeout: 60_000 }).toBeGreaterThanOrEqual(2.6);
    }
    if (id === 'restored' || id === 'wonder')
      await page.screenshot({ path: info.outputPath('nain-' + id + '.png') });
    await page.locator('.scene-continue').click();
  }
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'nain-gate');
  for (const [place, id] of [
    ['nain-viewpoint', 'nain-after-gate'],
    ['nain-courtyard', 'nain-after-courtyard'],
    ['adina', 'nain-after-neighbor'],
  ] as const) {
    await visit(page, place);
    await act(page, id);
    await close(page);
  }
  await visit(page, 'nain-viewpoint');
  await act(page, 'restoration', 'nain-reflect');
  const save = await exported(page);
  expect(save.state.road.chapter).toMatchObject({ stage: 'complete', reflection: 'restoration' });
  expect(save.state.road.trail.stage).toBe('not-started');
  expect(save.state.road.company.stage).toBe('not-started');
  expect(errors).toEqual([]);
});

test('an imported waiting companion stays put through Gospel reading, reload and a return to find him', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const fixture = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v7-companion-waiting.json', 'utf8')),
  );
  await ready(page, fixture.state);
  await door(page, 'to-nain', 'nain-gate');
  await visit(page, 'nain-viewpoint');
  await act(page, 'nain-enter');
  await page.locator('.scene-continue').click();
  await page.locator('[data-action="scene-pause"]').click();
  const during = await exported(page);
  expect(during.state.road.company).toEqual(fixture.state.road.company);
  await importState(page, during.state);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'procession');
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.locator('.company-overview [data-value="neri"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await act(page, 'nain-exit', 'journey');
  await door(page, 'to-farm', 'roadside-farm');
  await visit(page, 'neri');
  await expect(page.getByRole('dialog')).toContainText('I will wait here');
  await close(page);
  const resumed = await exported(page);
  expect(resumed.state.road.company.region).toBe('roadside-farm');
  expect(resumed.state.road.company.step).toBe(fixture.state.road.company.step);
  expect(resumed.state.road.chapter.checkpoint).toBe('procession');
});

test('failed Nain assets preserve the prior scene and autosave; summary keeps the full account', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'The transactional failure path is shared.');
  test.setTimeout(180_000);
  await ready(page, gateway(roadStart(), 'to-nain'));
  await visit(page, 'nain-viewpoint');
  await page.route('**/procession_frame.glb', (route) => route.abort('failed'));
  await act(page, 'nain-enter');
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'nain-gate');
  await page.unroute('**/procession_frame.glb');
  await act(page, 'nain-enter');
  await page.locator('[data-action="scene-summary"]').click();
  await act(page, 'approach', 'nain-summary');
  const save = await exported(page);
  expect(save.state.journal.filter((id) => id.startsWith('nain-scene-'))).toHaveLength(6);
  expect(save.state.road.chapter.stage).toBe('aftermath');
});

for (const region of ['galilean-road', 'roadside-farm', 'nain-gate', 'nain-account'] as const)
  test(`new region ${region} draws essential objects at both qualities and settles to one scene`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const records: Record<string, unknown> = {};
    let nain = roadAction(gateway(roadStart(), 'to-nain'), 'nain-enter');
    for (const checkpoint of NAIN_SCENES.slice(0, 3))
      nain = transition(nain, { type: 'nain-next', checkpoint });
    const states = [
      roadStart(),
      gateway(roadStart(), 'to-farm'),
      roadAt(gateway(roadStart(), 'to-nain'), 'nain-viewpoint'),
      nain,
    ];
    await ready(page);
    for (const state of states.filter((s) => s.region === region)) {
      await page.getByRole('button', { name: 'Settings and saves' }).click();
      await importState(page, state);
      for (const quality of ['high', 'low']) {
        await page.getByRole('button', { name: 'Settings and saves' }).click();
        await page.locator('[data-setting="quality"]').selectOption(quality);
        await page.locator('[data-setting="textSize"]').selectOption('large');
        await close(page);
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
        for (const id of requiredRegionAssets[state.region]) {
          expect(assets[id]?.[1], `${state.region}/${quality}/${id}`).toBeGreaterThan(0);
          expect(assets[id]?.[2], `${id} submits geometry`).toBeGreaterThan(0);
        }
        expect(Number(rows.scenes)).toBe(1);
        expect(Number(rows.drawCalls)).toBeGreaterThan(0);
        expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
        records[state.region + '-' + quality] = {
          ...rows,
          cadence,
          assets,
          viewport: page.viewportSize(),
          physicalDevice: false,
        };
        await close(page);
        await page.screenshot({ path: info.outputPath(state.region + '-' + quality + '.png') });
      }
    }
    if (region === 'nain-account' && info.project.name === 'mobile-chromium') {
      await page.setViewportSize({ width: 844, height: 390 });
      for (const action of [
        'nain-next',
        'transcript',
        'scene-summary',
        'scene-leave',
        'scene-pause',
      ]) {
        const button = page.locator('#scene-controls [data-action="' + action + '"]');
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(390);
      }
      await page.screenshot({ path: info.outputPath('nain-landscape.png') });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await writeFile(info.outputPath('road-render-metrics.json'), JSON.stringify(records, null, 2));
    expect(errors).toEqual([]);
  });
