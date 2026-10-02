import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { distance, WalkGrid } from '../../src/game/pathfinding';
import { clearLine } from '../../src/game/navigation';
import type { Point } from '../../src/game/types';
import { parseSave } from '../../src/persistence/schema';
import { dismiss, exported, ready } from '../helpers/connection-browser';
import { observeRadarCrossing } from '../helpers/navigation-crossing-browser';

const fixture = async (name: string) =>
  parseSave(JSON.parse(await readFile(`tests/fixtures/saves/${name}`, 'utf8'))).state;
const layout = campaignLayout('capernaum-lanes')!;
const crate = layout.decor.find((p) => p.asset === 'crate')!;
const from = { x: crate.x, z: crate.z - 2 };
const target = { x: crate.x, z: crate.z + 2 };

async function tapWorld(page: Page, target: Point, touch: boolean) {
  const screen = await page.locator('.minimap svg').evaluate(
    (node, { target, bounds }) => {
      const svg = node as SVGSVGElement;
      const point = svg.createSVGPoint();
      const scale = 192 / (bounds.max - bounds.min);
      point.x = (target.x - bounds.min) * scale;
      point.y = (bounds.max - target.z) * scale;
      const result = point.matrixTransform(svg.getScreenCTM()!);
      return { x: result.x, y: result.y };
    },
    { target, bounds: layout.bounds },
  );
  if (touch) await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
}

async function radarPoint(page: Page, selector = '#minimap-player'): Promise<Point> {
  const transform = (await page.locator(selector).getAttribute('transform'))!;
  const [, x, y] = transform.match(/translate\(([^,]+),([^)]*)\)/)!;
  const scale = 192 / (layout.bounds.max - layout.bounds.min);
  return { x: Number(x) / scale + layout.bounds.min, z: layout.bounds.max - Number(y) / scale };
}

async function arrive(page: Page, point: Point, touch: boolean) {
  await tapWorld(page, point, touch);
  await expect(page.locator('.minimap-destination')).toBeVisible();
  await expect(page.locator('.minimap-destination')).toBeHidden({ timeout: 60_000 });
  expect(distance(await radarPoint(page), point)).toBeLessThan(0.05);
}

for (const [quality, reducedMotion] of [
  ['high', false],
  ['low', true],
] as const)
  test(`earned lane walking clears the crate and resolves blocked taps (${quality}, reduced motion ${reducedMotion})`, async ({
    page,
    isMobile,
  }, info) => {
    const state = await fixture('v6-living-capernaum.json');
    const grid = new WalkGrid(
      layoutObstacles(state),
      layout.terrain,
      layout.bounds.min,
      layout.bounds.max,
    );
    await ready(page, state);
    const before = await exported(page);
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.locator('[data-setting="reducedMotion"]').setChecked(reducedMotion);
    await dismiss(page);
    await arrive(page, from, isMobile);

    // Freeze at the same real crossing that put the traveler inside the old crate.
    const observer = await observeRadarCrossing(page, layout.bounds, crate.z);
    await tapWorld(page, target, isMobile);
    const crossing = await observer.completed;
    const { samples } = crossing;
    expect(samples.length).toBeGreaterThan(1);
    for (const [i, point] of samples.entries()) {
      expect(grid.walkable(point)).toBe(true);
      if (i) expect(clearLine(grid, samples[i - 1]!, point)).toBe(true);
    }
    const footprint = layoutObstacles(state).find((o) => o.x === crate.x && o.z === crate.z)!;
    expect(crossing.before.z).toBeLessThan(crate.z);
    expect(crossing.after.z).toBeGreaterThanOrEqual(crate.z);
    expect(grid.walkable(crossing.crossing)).toBe(true);
    expect(crossing.crossing.x).toBeLessThan(footprint.x - footprint.width / 2);
    await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
    await expect(page.locator('.minimap-destination')).toBeHidden();
    const passing = await radarPoint(page);
    expect(grid.walkable(passing)).toBe(true);
    if (Math.abs(passing.z - footprint.z) <= footprint.depth / 2)
      expect(passing.x).toBeLessThan(footprint.x - footprint.width / 2);
    await page.screenshot({
      path: info.outputPath('traveler-beside-outer-lane-crate.png'),
      style: '#ui,#loading{visibility:hidden!important}',
      scale: 'css',
    });
    await dismiss(page);
    await arrive(page, target, isMobile);
    await arrive(page, from, isMobile);
    await tapWorld(page, crate, isMobile);
    await expect(page.locator('.minimap-destination')).toBeVisible();
    const endpoint = await radarPoint(page, '.minimap-destination');
    expect(grid.walkable(endpoint)).toBe(true);
    await expect(page.locator('.minimap-destination')).toBeHidden({ timeout: 60_000 });
    expect(distance(await radarPoint(page), endpoint)).toBeLessThan(0.05);

    await tapWorld(page, { x: 8, z: -6 }, isMobile);
    await expect(page.locator('.minimap-destination')).toBeVisible();
    await page.locator('.toolbar [data-action="journal"]').click();
    await expect(page.locator('.minimap-destination')).toBeHidden();
    const stopped = await radarPoint(page);
    await page.waitForTimeout(350);
    expect(await radarPoint(page)).toEqual(stopped);
    const after = await exported(page);
    expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
    await writeFile(
      info.outputPath('lane-route-state.json'),
      JSON.stringify(
        { quality, reducedMotion, samples, crossing, passing, endpoint, stopped, before, after },
        null,
        2,
      ),
    );
  });

test('a genuine old lane crossing restores safely and retains its earned stories while escaping', async ({
  page,
  isMobile,
}, info) => {
  const state = await fixture('v11-lanes-crate-crossing.json');
  const grid = new WalkGrid(
    layoutObstacles(state),
    layout.terrain,
    layout.bounds.min,
    layout.bounds.max,
  );
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
  await arrive(page, target, isMobile);
  const after = await exported(page);
  expect({ ...after, position: state.position, playTime: state.playTime }).toEqual(state);
  await writeFile(
    info.outputPath('restored-crossing-state.json'),
    JSON.stringify({ state, restored, after }, null, 2),
  );
});
