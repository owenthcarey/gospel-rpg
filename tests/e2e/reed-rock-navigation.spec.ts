import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { reedRockFootprints } from '../../src/content/lake/layouts';
import { passageObstacles } from '../../src/content/connection/presentation';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { clearLine } from '../../src/game/navigation';
import { dismiss, exported, settled } from '../helpers/connection-browser';
import { observeRadarWalk } from '../helpers/navigation-walk-browser';
import type { Point } from '../../src/game/types';

const bounds = { min: -16, max: 16 };
const fixture = async (name: string) =>
  parseSave(JSON.parse(await readFile('tests/fixtures/saves/' + name, 'utf8'))).state;
async function radarPoint(page: Page): Promise<Point> {
  const transform = (await page.locator('#minimap-player').getAttribute('transform'))!;
  const [, x, y] = transform.match(/translate\(([^,]+),([^)]*)\)/)!;
  return { x: Number(x) / 6 - 16, z: 16 - Number(y) / 6 };
}
async function tapWorld(page: Page, target: Point, touch: boolean) {
  const screen = await page.locator('.minimap svg').evaluate((node, target) => {
    const svg = node as SVGSVGElement,
      point = svg.createSVGPoint();
    point.x = (target.x + 16) * 6;
    point.y = (16 - target.z) * 6;
    const result = point.matrixTransform(svg.getScreenCTM()!);
    return { x: result.x, y: result.y };
  }, target);
  if (touch) await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
}
async function arrive(page: Page, target: Point, touch: boolean) {
  const walk = await observeRadarWalk(page, bounds);
  await tapWorld(page, target, touch);
  const observed = await walk.completed;
  expect(distance(observed.endpoint, target)).toBeLessThan(0.05);
  expect(distance(observed.arrived, observed.endpoint)).toBeLessThan(0.05);
  expect(distance(await radarPoint(page), observed.arrived)).toBeLessThan(0.05);
  return observed;
}
async function importNative(page: Page, name: string, quality: string, reducedMotion: boolean) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings', exact: true }).click();
  await page.locator('[data-setting="quality"]').selectOption(quality);
  await page.locator('[data-setting="reducedMotion"]').setChecked(reducedMotion);
  // A genuine native export; only repository JSON whitespace was normalized.
  await page.locator('#import-save').setInputFiles('tests/fixtures/saves/' + name);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'reed-landing');
  await settled(page);
}

for (const [quality, reducedMotion] of [
  ['high', false],
  ['low', true],
] as const) {
  test(`reed-landing rock clicks and manual walking keep the traveler outside stone (${quality}, reduced motion ${reducedMotion})`, async ({
    page,
    isMobile,
  }, info) => {
    const name = 'v11-reed-rock-crossing-' + quality + '.json',
      state = await fixture(name),
      layout = campaignLayout(state.region)!,
      terrain = new WalkGrid(
        [...layoutObstacles(state), ...passageObstacles(state)],
        layout.terrain,
        bounds.min,
        bounds.max,
      ),
      footprint = reedRockFootprints()[0]!;
    await importNative(page, name, quality, reducedMotion);
    const before = await exported(page);
    expect({ ...before, position: state.position, playTime: state.playTime }).toEqual(state);
    await dismiss(page);
    // Cross from the left side to the right by the actual unobstructed shore route.
    await arrive(page, { x: 6, z: 12 }, isMobile);
    await arrive(page, { x: 10, z: 12 }, isMobile);
    const blockedWalk = await observeRadarWalk(page, bounds);
    await tapWorld(page, state.position, isMobile);
    const blocked = await blockedWalk.completed;
    expect(terrain.walkable(state.position)).toBe(false);
    expect(terrain.walkable(blocked.endpoint)).toBe(true);
    expect(distance(blocked.arrived, blocked.endpoint)).toBeLessThan(0.05);
    expect(distance(await radarPoint(page), blocked.endpoint)).toBeLessThan(0.05);
    expect(
      Math.abs(blocked.endpoint.x - footprint.x) >= footprint.width / 2 ||
        Math.abs(blocked.endpoint.z - footprint.z) >= footprint.depth / 2,
    ).toBe(true);
    const manualFrom = { x: 10, z: 12 };
    await arrive(page, manualFrom, isMobile);
    await page.getByRole('button', { name: 'Face north', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('.minimap-wrap')
          .evaluate((element) =>
            Math.abs(parseFloat((element as HTMLElement).style.getPropertyValue('--map-bearing'))),
          ),
      )
      .toBeLessThan(0.04);
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    // Acknowledged retained observation survives Journal replacing the radar SVG.
    const manual = await page.evaluateHandle(() => {
      const read = (): Point | null => {
        const match = document
          .querySelector('#minimap-player')
          ?.getAttribute('transform')
          ?.match(/translate\(([^,]+),([^)]*)\)/);
        return match ? { x: Number(match[1]) / 6 - 16, z: 16 - Number(match[2]) / 6 } : null;
      };
      const retained = { samples: [read()!], cleanup: () => observer.disconnect() };
      const observer = new MutationObserver(() => {
        const point = read();
        if (point) retained.samples.push(point);
      });
      observer.observe(document.querySelector('#ui')!, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['transform'],
      });
      return retained;
    });
    let samples: Point[];
    try {
      await page.locator('#game-canvas').focus();
      try {
        await page.keyboard.down('a');
        await page.waitForTimeout(2_000);
      } finally {
        await page.keyboard.up('a');
      }
      await page.locator('.toolbar [data-action="journal"]').click();
      samples = await manual.evaluate((value) => value.samples);
    } finally {
      await manual.evaluate((value) => value.cleanup());
      await manual.dispose();
    }
    expect(samples.length).toBeGreaterThan(1);
    for (const [i, point] of samples.entries()) {
      expect(terrain.walkable(point)).toBe(true);
      if (i) expect(clearLine(terrain, samples[i - 1]!, point)).toBe(true);
      expect(point.x).toBeGreaterThan(footprint.x + footprint.width / 2);
    }
    const stopped = await radarPoint(page);
    expect(stopped.x).toBeLessThan(manualFrom.x);
    expect(stopped.x).toBeGreaterThan(footprint.x + footprint.width / 2);
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await page.waitForTimeout(350);
    expect(await radarPoint(page)).toEqual(stopped);
    await page.screenshot({
      path: info.outputPath('traveler-clear-of-reed-rock.png'),
      style: '#ui,#loading{visibility:hidden!important}',
      scale: 'css',
    });
    await dismiss(page);
    await arrive(page, { x: 11, z: 12 }, isMobile);
    const after = await exported(page);
    expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
    await writeFile(
      info.outputPath('reed-rock-clearance-state.json'),
      JSON.stringify(
        {
          quality,
          reducedMotion,
          fixture: name,
          blocked,
          footprint,
          manualFrom,
          samples,
          stopped,
          before,
          after,
        },
        null,
        2,
      ),
    );
  });

  test(`the genuine native reed-rock crossing restores and escapes safely (${quality}, reduced motion ${reducedMotion})`, async ({
    page,
    isMobile,
  }, info) => {
    const name = 'v11-reed-rock-crossing-' + quality + '.json',
      state = await fixture(name),
      layout = campaignLayout(state.region)!,
      terrain = new WalkGrid(
        [...layoutObstacles(state), ...passageObstacles(state)],
        layout.terrain,
        bounds.min,
        bounds.max,
      );
    expect(terrain.walkable(state.position)).toBe(false);
    await importNative(page, name, quality, reducedMotion);
    const restored = await exported(page);
    expect(terrain.walkable(restored.position)).toBe(true);
    expect(distance(restored.position, state.position)).toBeLessThan(2);
    expect({ ...restored, position: state.position, playTime: state.playTime }).toEqual(state);
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await dismiss(page);
    const standing = await radarPoint(page);
    await page.waitForTimeout(350);
    expect(await radarPoint(page)).toEqual(standing);
    await page.screenshot({
      path: info.outputPath('restored-reed-rock-crossing.png'),
      style: '#ui,#loading{visibility:hidden!important}',
      scale: 'css',
    });
    await arrive(page, { x: 10, z: 12 }, isMobile);
    const after = await exported(page);
    expect({ ...after, position: state.position, playTime: state.playTime }).toEqual(state);
    await writeFile(
      info.outputPath('reed-rock-recovery-state.json'),
      JSON.stringify({ quality, reducedMotion, fixture: name, state, restored, after }, null, 2),
    );
  });
}
