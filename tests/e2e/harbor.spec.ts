import { renderingCadence } from '../helpers/rendering';
import { test, expect, type Page } from '@playwright/test';
import { ready, visit, dismiss, settled, exported } from '../helpers/connection-browser';
import { preparedHarbor, clearHarbor, harborAction } from '../helpers/harbor';
import { newGame } from '../../src/game/types';
import { completedJourney, homeAt } from '../helpers/connection';
import { writeFile } from 'node:fs/promises';

async function act(page: Page, id: string) {
  await page.locator(`#overlay [data-action="harbor-action"][data-value^="${id}|"]`).click();
  await settled(page);
}
test('an early traveler reopens the northern landing, recovers failed tests and remembers patient work', async ({
  page,
}, info) => {
  // The hosted run took 210 seconds; keep margin for slower software-rendering hosts.
  test.setTimeout(process.env.CI ? 360_000 : 240_000);
  await ready(page);
  await visit(page, 'eliab');
  await act(page, 'accept');
  await visit(page, 'harbor-entrance');
  await act(page, 'observe-passage');
  await expect(page.locator('.work-panel')).toContainText('working landing');
  await visit(page, 'harbor-water');
  await act(page, 'observe-water');
  await visit(page, 'harbor-entrance');
  await act(page, 'test');
  await expect(page.locator('.work-panel')).toContainText('loose rope');
  await act(page, 'clear');
  await visit(page, 'harbor-plank');
  await act(page, 'plank-north');
  await act(page, 'turn');
  await visit(page, 'harbor-entrance');
  await act(page, 'test');
  await expect(page.locator('.harbor-test-result')).toContainText('net cargo blocks');
  await visit(page, 'harbor-nets');
  await act(page, 'cargo-nets');
  await visit(page, 'harbor-entrance');
  await act(page, 'test');
  await expect(page.locator('.harbor-test-result')).toContainText('north passage is clear');
  await page.screenshot({ path: info.outputPath('north-passage-tested.png') });
  await visit(page, 'eliab');
  await act(page, 'remember-patience');
  const state = await exported(page);
  expect(state.harbor).toMatchObject({ stage: 'complete', plank: 'north', ending: 'patience' });
  expect(state.episode).toEqual(newGame().episode);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey', exact: true }).click();
  await settled(page);
  await visit(page, 'eliab');
  await expect(page.getByRole('dialog')).toContainText('patience');
});

test('southern work survives export and reload, supports keyboard inspection and graduated hints', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  let s = preparedHarbor();
  s = harborAction(s, 'clear');
  s = harborAction(s, 'plank-south');
  await ready(page, s);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await dismiss(page);
  await visit(page, 'harbor-plank');
  await page.locator('.work-hints summary').click();
  await page.getByRole('button', { name: 'Show a more specific hint' }).click();
  await settled(page);
  await page.locator('[data-work-id="turn"]').focus();
  // The hint's re-render restores focus a frame later; it must not take back a control the
  // traveler has focused since.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await expect(page.locator('[data-work-id="turn"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await settled(page);
  const save = await exported(page);
  expect(save.harbor).toMatchObject({ plank: 'south', turn: 0, hint: 1, tested: false });
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey', exact: true }).click();
  await settled(page);
  await visit(page, 'harbor-jars');
  await act(page, 'cargo-jars');
  await page.locator('[data-action="work-inspect"]').click();
  await expect(page.getByRole('dialog')).toContainText('ORIGINAL NARRATION');
  await page.locator('[data-action="work-open"]').click();
  await visit(page, 'harbor-entrance');
  await act(page, 'test');
  await expect(page.locator('.harbor-test-result')).toContainText('south passage is clear');
  if (info.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      844,
    );
    await expect(page.locator('[data-action="work-inspect"]')).toBeInViewport();
    await expect(page.locator('[data-action="work-frame"]')).toBeInViewport();
    await page.screenshot({ path: info.outputPath('south-short-landscape.png') });
  }
  await visit(page, 'eliab');
  await act(page, 'remember-room');
  expect((await exported(page)).harbor.ending).toBe('room');
});

test('all four village spaces retain visible additions and remain inside High and Low render budgets', async ({
  page,
}, info) => {
  // Eight 120-frame software-rendering samples nearly consume five minutes in CI.
  test.setTimeout(process.env.CI ? 450_000 : 300_000);
  const records: Record<string, unknown> = {};
  for (const region of ['capernaum', 'capernaum-lanes', 'gathering-house', 'bakehouse'] as const) {
    const s = harborAction(
      clearHarbor('north', preparedHarbor(homeAt(completedJourney(), 'shore'))),
      'remember-patience',
    );
    s.region = region;
    s.position =
      region === 'capernaum'
        ? { x: 0, z: -10 }
        : region === 'capernaum-lanes'
          ? { x: 0, z: 4 }
          : { x: 0, z: -2 };
    if (region !== 'capernaum') s.campaign.visited[region] = { ...s.position };
    await ready(page, s);
    for (const quality of ['high', 'low']) {
      await page.getByRole('button', { name: 'Settings and saves' }).click();
      await page.locator('[data-setting="quality"]').selectOption(quality);
      await page.locator('[data-setting="reducedMotion"]').check();
      await dismiss(page);
      const cadence = await renderingCadence(page);
      await page.locator('#game-canvas').press('F3');
      await expect(page.locator('.diagnostics-table')).toBeVisible();
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
      expect(Number(rows.scenes)).toBe(1);
      expect(Number(rows.drawCalls)).toBeGreaterThan(0);
      expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
      const asset =
        region === 'capernaum'
          ? 'crossing_plank'
          : region === 'capernaum-lanes'
            ? 'door_awning'
            : region === 'bakehouse'
              ? 'bread_board'
              : 'stone_threshold';
      const cells = page.locator(`.asset-diagnostics [data-asset="${asset}"] td`);
      expect(Number(await cells.nth(2).textContent())).toBeGreaterThan(0);
      records[region + '-' + quality] = { ...rows, cadence, physicalDevice: false };
      await dismiss(page);
      await page.screenshot({ path: info.outputPath(region + '-' + quality + '.png') });
    }
  }
  await writeFile(info.outputPath('capernaum-rendering.json'), JSON.stringify(records, null, 2));
});
