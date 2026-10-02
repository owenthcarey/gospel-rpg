import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { dismiss, exported, importState, ready, settled } from '../helpers/connection-browser';
import { dock, sail } from '../helpers/lake';
import { worldPixels } from '../helpers/rendering';
import { parseSave } from '../../src/persistence/schema';
import { newGame } from '../../src/game/types';

test('cold quality changes keep native draws valid and preserve the journey after region visits', async ({
  page,
}, info) => {
  // This uninterrupted pass compiles all fourteen regions, then switches both qualities.
  // The CI trace reaches only six High visits in the ordinary three-minute case budget.
  test.setTimeout(10 * 60_000);
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning' && /GL_INVALID_|WebGL.*error/i.test(message.text()))
      warnings.push(message.text());
  });
  const initial = newGame();
  await ready(page, initial);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  const original = await exported(page);
  await page.locator('[data-setting="quality"]').selectOption('high');
  const states = [initial, dock(sail(), 'reed-landing')];
  for (const fixture of [
    'v6-living-capernaum.json',
    'v7-beyond-capernaum.json',
    'v6-interrupted-repair.json',
    'v7-road-investigation.json',
    'v8-living-galilee-complete.json',
    'v7-road-complete.json',
    'v9-afloat.json',
    'v9-cove-berthed.json',
    'v4-interrupted-lake.json',
    'v5-interrupted-roof.json',
    'v7-nain-checkpoint.json',
    'v9-storm-waking.json',
  ])
    states.push(
      parseSave(JSON.parse(await readFile(`tests/fixtures/saves/${fixture}`, 'utf8'))).state,
    );
  const records: {
    phase: string;
    region: string | null;
    quality: string | null;
    pixels: Awaited<ReturnType<typeof worldPixels>>;
  }[] = [];
  const record = async (phase: string) => {
    const pixels = await worldPixels(page);
    const region = await page.locator('#game-canvas').getAttribute('data-region');
    const quality = await page.locator('html').getAttribute('data-quality');
    records.push({ phase, region, quality, pixels });
    await writeFile(
      info.outputPath('quality-settings.json'),
      JSON.stringify({ records, errors, warnings }, null, 2),
    );
    expect(pixels.error, phase + ' native WebGL error').toBe(0);
    expect(pixels.lost).toBe(false);
    expect(pixels.opaque).toBeGreaterThan(0.95);
    expect(pixels.colors).toBeGreaterThan(20);
  };
  // Visit each shipped implementation at High before its first Low compilation.
  for (const state of states) {
    await dismiss(page);
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await importState(page, state);
    await expect(page.locator('.chapter-card')).toHaveCount(0);
    const before = await exported(page);
    await dismiss(page);
    await record('high visit');
    await page.locator('#game-canvas').press('F3');
    await expect(page.locator('.diagnostics-table')).toBeVisible();
    const scenes = page.locator('.diagnostics-table tr').filter({ hasText: /^scenes/ });
    await expect(scenes.locator('td')).toHaveText('1');
    const after = await exported(page);
    expect({ ...after, playTime: before.playTime }).toEqual(before);
  }
  // Keep the shipped setting/import handoff: the old scene can still paint while replacement loads.
  await dismiss(page);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await expect(page.locator('[data-setting="quality"]')).toHaveValue('low');
  await importState(page, initial);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const low = await exported(page);
  expect({ ...low, playTime: original.playTime }).toEqual(original);
  await dismiss(page);
  await record('cold low return');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="quality"]').selectOption('high');
  await settled(page);
  await dismiss(page);
  await record('high restored');
  const after = await exported(page);
  expect({ ...after, playTime: original.playTime }).toEqual(original);
  await expect(page.locator('[data-setting="quality"]')).toHaveValue('high');
  await expect(page.locator('[data-setting="reducedMotion"]')).toBeChecked();
  await dismiss(page);
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});
