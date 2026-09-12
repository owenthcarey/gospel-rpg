import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseSave, makeSave } from '../../src/persistence/schema';
import { transition } from '../../src/game/quest';
import { dock, stormStart } from '../helpers/lake';

test('direct Gospel continuation retries a failed load and retains the berthed boat, supply and waiting companion', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const fixture = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v9-afloat-with-supply.json', 'utf8')),
  ).state;
  let state = stormStart(dock(fixture, 'sheltered-cove'));
  for (const checkpoint of ['evening', 'boats', 'storm'] as const)
    state = transition(state, { type: 'storm-next', checkpoint });
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.glb')) requested.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('#import-save').setInputFiles({
    name: 'storm.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(state))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'waking');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue your journey' })).toBeVisible();
  requested.length = 0;
  await page.route('**/boat_cushion.glb', (r) => r.abort('failed'));
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.getByRole('button', { name: 'Continue your journey' })).toBeVisible();
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-region');
  expect(requested.some((url) => /\/(house|room_wall|reed_screen)\.glb$/.test(url))).toBe(false);
  await page.unroute('**/boat_cushion.glb');
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'storm-account');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'waking');
  await page.locator('[data-action="scene-summary"]').click();
  await page.locator('[data-action="storm-summary"][data-value="waking"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'sheltered-cove');
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const saved = parseSave(
    JSON.parse(await readFile((await (await download).path())!, 'utf8')),
  ).state;
  expect(saved.lake.chapter.stage).toBe('aftermath');
  expect(saved.lake.boat).toEqual(state.lake.boat);
  expect(saved.campaign.carrying).toBe('rest-screen');
  expect(saved.road.company).toEqual(fixture.road.company);
  expect(saved.journal.filter((id) => id.startsWith('storm-scene-'))).toHaveLength(7);
});
