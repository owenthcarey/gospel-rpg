import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { obstacles, isLand, props } from '../../src/content/region';
import { distance, WalkGrid } from '../../src/game/pathfinding';
import { clearLine } from '../../src/game/navigation';
import type { Point } from '../../src/game/types';
import { parseSave } from '../../src/persistence/schema';
import { dismiss, exported, ready } from '../helpers/connection-browser';
import { observeRadarCrossing } from '../helpers/navigation-crossing-browser';
import { observeRadarWalk } from '../helpers/navigation-walk-browser';

const grid = new WalkGrid(obstacles, isLand);

async function tapWorld(page: Page, point: Point, touch: boolean) {
  const screen = await page.locator('.minimap svg').evaluate((node, target) => {
    const svg = node as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = (target.x + 24) * 4;
    point.y = (24 - target.z) * 4;
    const screen = point.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  }, point);
  if (touch) await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
}

async function radarPoint(page: Page, selector = '#minimap-player'): Promise<Point> {
  const transform = (await page.locator(selector).getAttribute('transform'))!;
  const [, x, y] = transform.match(/translate\(([^,]+),([^)]*)\)/)!;
  return { x: Number(x) / 4 - 24, z: 24 - Number(y) / 4 };
}

async function arrive(page: Page, point: Point, touch: boolean) {
  const observer = await observeRadarWalk(page, { min: -24, max: 24 });
  await tapWorld(page, point, touch);
  const walk = await observer.completed;
  expect(distance(walk.endpoint, point)).toBeLessThan(0.05);
  expect(distance(walk.arrived, point)).toBeLessThan(0.05);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  expect(distance(await radarPoint(page), point)).toBeLessThan(0.05);
  return walk;
}

for (const [quality, reducedMotion] of [
  ['high', false],
  ['low', true],
] as const)
  test(`shore walking goes around solid crates and resolves blocked clicks (${quality}, reduced motion ${reducedMotion})`, async ({
    page,
    isMobile,
  }, info) => {
    await ready(page);
    const before = await exported(page);
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.locator('[data-setting="reducedMotion"]').setChecked(reducedMotion);
    await dismiss(page);
    const initialWalk = await arrive(page, { x: 7, z: -2 }, isMobile);

    // Pause through the real journal at the same shoreline crossing that previously
    // put the traveler's legs inside the imported wooden crate.
    const crate = props.find((p) => p.asset === 'crate' && p.x === 7.2)!;
    const footprint = obstacles.find((o) => o.x === crate.x && o.z === crate.z)!;
    const observer = await observeRadarCrossing(page, { min: -24, max: 24 }, crate.z);
    await tapWorld(page, { x: 7, z: 2 }, isMobile);
    const crossing = await observer.completed;
    const { samples } = crossing;
    expect(samples.length).toBeGreaterThan(1);
    for (const [i, point] of samples.entries()) {
      expect(grid.walkable(point)).toBe(true);
      if (i) expect(clearLine(grid, samples[i - 1]!, point)).toBe(true);
    }
    expect(crossing.before.z).toBeLessThan(crate.z);
    expect(crossing.after.z).toBeGreaterThanOrEqual(crate.z);
    expect(grid.walkable(crossing.crossing)).toBe(true);
    expect(crossing.crossing.x).toBeGreaterThan(footprint.x + footprint.width / 2);
    await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
    await expect(page.locator('.minimap-destination')).toBeHidden();
    const passing = await radarPoint(page);
    expect(grid.walkable(passing)).toBe(true);
    if (Math.abs(passing.z - footprint.z) <= footprint.depth / 2)
      expect(passing.x).toBeGreaterThan(footprint.x + footprint.width / 2);
    await page.screenshot({
      path: info.outputPath('traveler-beside-shore-crate.png'),
      style: '#ui,#loading{visibility:hidden!important}',
      scale: 'css',
    });
    await dismiss(page);
    const resumedWalk = await arrive(page, { x: 7, z: 2 }, isMobile);
    const returnWalk = await arrive(page, { x: 7, z: -2 }, isMobile);

    // Clicking the wooden prop keeps the flag on the reachable endpoint and clears
    // it when the traveler gets there, rather than promising a blocked center.
    const blockedWalk = await observeRadarWalk(page, { min: -24, max: 24 });
    await tapWorld(page, crate, isMobile);
    const blocked = await blockedWalk.completed;
    const { endpoint, arrived } = blocked;
    expect(grid.walkable(endpoint)).toBe(true);
    expect(distance(arrived, endpoint)).toBeLessThan(0.05);
    await expect(page.locator('.minimap-destination')).toBeHidden();
    expect(distance(await radarPoint(page), endpoint)).toBeLessThan(0.05);

    await tapWorld(page, { x: -4, z: 8 }, isMobile);
    await expect(page.locator('.minimap-destination')).toBeVisible();
    await page.locator('.toolbar [data-action="journal"]').click();
    await expect(page.locator('.minimap-destination')).toBeHidden();
    const stopped = await radarPoint(page);
    await page.waitForTimeout(350);
    expect(await radarPoint(page)).toEqual(stopped);
    const after = await exported(page);
    expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
    await writeFile(
      info.outputPath('shore-route.json'),
      JSON.stringify(
        {
          quality,
          reducedMotion,
          samples,
          crossing,
          passing,
          endpoint,
          stopped,
          walks: [initialWalk, resumedWalk, returnWalk, blocked],
        },
        null,
        2,
      ),
    );
  });

test('an old crate-crossing save restores nearby with its earned stories and no stale route', async ({
  page,
  isMobile,
}) => {
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v11-capernaum-crate-crossing.json', 'utf8')),
  ).state;
  expect(grid.walkable(state.position)).toBe(false);
  await ready(page, state);
  const restored = await exported(page);
  expect(grid.walkable(restored.position)).toBe(true);
  expect(distance(restored.position, state.position)).toBeLessThan(2);
  expect({ ...restored, position: state.position, playTime: state.playTime }).toEqual(state);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  await dismiss(page);
  const standing = await radarPoint(page);
  await page.waitForTimeout(350);
  expect(await radarPoint(page)).toEqual(standing);
  await arrive(page, { x: 7, z: 2 }, isMobile);
  const after = await exported(page);
  expect({ ...after, position: state.position, playTime: state.playTime }).toEqual(state);
});
