import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { obstacles, isLand } from '../../src/content/region';
import { passageObstacles } from '../../src/content/connection/presentation';
import { cargoPosition, storedJarObstacles } from '../../src/game/harbor/arrangement';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { clearLine } from '../../src/game/navigation';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';
import { observeRadarWalk } from '../helpers/navigation-walk-browser';
import type { Point } from '../../src/game/types';

const fixture = async (name: string) =>
  parseSave(JSON.parse(await readFile('tests/fixtures/saves/' + name, 'utf8'))).state;
async function radarPoint(page: Page, selector = '#minimap-player'): Promise<Point> {
  const transform = (await page.locator(selector).getAttribute('transform'))!;
  const [, x, y] = transform.match(/translate\(([^,]+),([^)]*)\)/)!;
  return { x: Number(x) / 4 - 24, z: 24 - Number(y) / 4 };
}
async function tapWorld(page: Page, target: Point, touch: boolean) {
  const screen = await page.locator('.minimap svg').evaluate((node, target) => {
    const svg = node as SVGSVGElement,
      point = svg.createSVGPoint();
    point.x = (target.x + 24) * 4;
    point.y = (24 - target.z) * 4;
    const result = point.matrixTransform(svg.getScreenCTM()!);
    return { x: result.x, y: result.y };
  }, target);
  if (touch) await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
}
async function arrive(page: Page, point: Point, touch: boolean) {
  const walk = await observeRadarWalk(page, { min: -24, max: 24 });
  await tapWorld(page, point, touch);
  const observed = await walk.completed;
  expect(distance(observed.endpoint, point)).toBeLessThan(0.05);
  expect(distance(observed.arrived, observed.endpoint)).toBeLessThan(0.05);
  expect(distance(await radarPoint(page), observed.arrived)).toBeLessThan(0.05);
  return observed;
}

for (const [quality, reducedMotion] of [
  ['high', false],
  ['low', true],
] as const) {
  test(`stored-jar clicks and manual walking keep the traveler outside pottery (${quality}, reduced motion ${reducedMotion})`, async ({
    page,
    isMobile,
  }, info) => {
    const state = await fixture('v11-landing-south.json'),
      terrain = new WalkGrid(
        [...obstacles, ...storedJarObstacles(state), ...passageObstacles(state)],
        isLand,
      );
    const jar = cargoPosition(state.harbor, 'jars'),
      footprint = storedJarObstacles(state)[0]!;
    await ready(page, state);
    const before = await exported(page);
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.locator('[data-setting="reducedMotion"]').setChecked(reducedMotion);
    await dismiss(page);
    await arrive(page, { x: 5, z: -18 }, isMobile);
    const blockedWalk = await observeRadarWalk(page, { min: -24, max: 24 });
    await tapWorld(page, jar, isMobile);
    const blocked = await blockedWalk.completed;
    const endpoint = blocked.endpoint;
    expect(terrain.walkable(endpoint)).toBe(true);
    expect(terrain.walkable(jar)).toBe(false);
    expect(endpoint.z).toBeLessThan(footprint.z - footprint.depth / 2);
    expect(distance(blocked.arrived, endpoint)).toBeLessThan(0.05);
    expect(distance(await radarPoint(page), endpoint)).toBeLessThan(0.05);
    const manualFrom = { x: 5, z: -18 };
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
    for (let i = 0; i < 4; i++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    // Acknowledged observation includes the initial position and every rendered update.
    // The retained handle survives Journal replacing the radar's player SVG node.
    const manual = await page.evaluateHandle(() => {
      const read = (): Point | null => {
        const match = document
          .querySelector('#minimap-player')
          ?.getAttribute('transform')
          ?.match(/translate\(([^,]+),([^)]*)\)/);
        return match ? { x: Number(match[1]) / 4 - 24, z: 24 - Number(match[2]) / 4 } : null;
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
        await page.keyboard.down('w');
        await page.waitForTimeout(2_000);
      } finally {
        await page.keyboard.up('w');
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
      expect(point.z).toBeLessThan(footprint.z - footprint.depth / 2);
    }
    const stopped = await radarPoint(page);
    expect(stopped.z).toBeGreaterThan(manualFrom.z);
    expect(stopped.z).toBeLessThan(footprint.z - footprint.depth / 2);
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await page.waitForTimeout(350);
    expect(await radarPoint(page)).toEqual(stopped);
    await page.screenshot({
      path: info.outputPath('traveler-clear-of-stored-jar.png'),
      style: '#ui,#loading{visibility:hidden!important}',
      scale: 'css',
    });
    await dismiss(page);
    await arrive(page, { x: 6, z: -16 }, isMobile);
    const after = await exported(page);
    expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
    await writeFile(
      info.outputPath('stored-jar-clearance-state.json'),
      JSON.stringify(
        {
          quality,
          reducedMotion,
          jar,
          blocked,
          endpoint,
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

  test(`the genuine native stored-jar crossing restores and escapes safely (${quality}, reduced motion ${reducedMotion})`, async ({
    page,
    isMobile,
  }, info) => {
    const name = 'v11-stored-jar-crossing-' + quality + '.json',
      state = await fixture(name),
      terrain = new WalkGrid(
        [...obstacles, ...storedJarObstacles(state), ...passageObstacles(state)],
        isLand,
      );
    expect(terrain.walkable(state.position)).toBe(false);
    await page.goto('/');
    await page.getByRole('button', { name: 'Saves & settings', exact: true }).click();
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.locator('[data-setting="reducedMotion"]').setChecked(reducedMotion);
    // Import the genuine native crossing fixture directly; only JSON whitespace was normalized.
    await page.locator('#import-save').setInputFiles('tests/fixtures/saves/' + name);
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
    await settled(page);
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
      path: info.outputPath('restored-stored-jar-crossing.png'),
      style: '#ui,#loading{visibility:hidden!important}',
      scale: 'css',
    });
    await arrive(page, { x: 4, z: -17 }, isMobile);
    const after = await exported(page);
    expect({ ...after, position: state.position, playTime: state.playTime }).toEqual(state);
    await writeFile(
      info.outputPath('stored-jar-recovery-state.json'),
      JSON.stringify({ quality, reducedMotion, fixture: name, state, restored, after }, null, 2),
    );
  });
}
