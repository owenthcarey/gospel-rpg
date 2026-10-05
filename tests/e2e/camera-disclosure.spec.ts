import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { settled } from '../helpers/connection-browser';

const fixture = 'tests/fixtures/saves/v7-road-investigation.json';
const commands = ['rotate-left', 'reset-camera', 'rotate-right', 'zoom-in', 'zoom-out'];
const control = (page: Page, action: string) =>
  page.locator(`.camera-controls [data-action="${action}"]`);
const bearing = (page: Page) =>
  page
    .locator('.minimap-wrap')
    .evaluate((node) => parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing')));
const turn = (from: number, to: number) => ((to - from + 540) % 360) - 180;

async function activate(button: Locator, touch: boolean) {
  if (touch) await button.tap();
  else await button.click();
}

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Native Tab did not reach ' + (await target.getAttribute('aria-label')));
}

// Keep every save as an actual download; the original fixture is imported without reserialization.
async function exportState(page: Page, touch: boolean) {
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  if (await close.isVisible()) await activate(close, touch);
  await activate(page.getByRole('button', { name: 'Settings and saves', exact: true }), touch);
  const download = page.waitForEvent('download');
  await activate(page.getByRole('button', { name: 'Export', exact: true }), touch);
  const state = parseSave(
    JSON.parse(await readFile((await (await download).path())!, 'utf8')),
  ).state;
  await activate(close, touch);
  return state;
}

async function visibleCommands(page: Page) {
  return page
    .locator('.camera-command-buttons button')
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => (node as HTMLElement).dataset.action),
    );
}

async function reachableControls(page: Page) {
  const read = () =>
    page.locator('.camera-controls button').evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            action: (node as HTMLElement).dataset.action,
            width: box.width,
            height: box.height,
            inside:
              box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
            exposed:
              document
                .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
                ?.closest('button') === node,
          };
        }),
    );
  // The existing reservation pass settles world names after a HUD resize.
  await expect.poll(async () => (await read()).every((button) => button.exposed)).toBe(true);
  const controls = await read();
  expect(controls.length).toBeGreaterThan(0);
  for (const button of controls) {
    expect(button.width, button.action).toBeGreaterThanOrEqual(44);
    expect(button.height, button.action).toBeGreaterThanOrEqual(44);
    expect(button.inside, button.action).toBe(true);
    expect(button.exposed, button.action).toBe(true);
  }
}

async function readableGuidance(page: Page) {
  const result = await page.locator('.quest-card').evaluate((card) => {
    const guidance = card.querySelector('.current-objective')!;
    const box = card.getBoundingClientRect();
    const words: boolean[] = [];
    const walker = document.createTreeWalker(guidance, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index!);
        range.setEnd(node, match.index! + match[0].length);
        const word = range.getBoundingClientRect();
        words.push(
          word.left >= box.left &&
            word.right <= box.right &&
            word.top >= box.top &&
            word.bottom <= box.bottom,
        );
      }
    return { text: guidance.textContent, words };
  });
  expect(result.words.length).toBeGreaterThan(0);
  expect(result.words.every(Boolean)).toBe(true);
  return result.text;
}

// These are the actual rendered world-name projections, not a private camera or game hook.
async function projections(page: Page) {
  return page.locator('.world-label').evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const match = (node as HTMLElement).style.transform.match(
        /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/,
      );
      return match
        ? [{ id: (node as HTMLElement).dataset.value, x: Number(match[1]), y: Number(match[2]) }]
        : [];
    }),
  );
}

async function projectionDelta(page: Page, before: Awaited<ReturnType<typeof projections>>) {
  const after = await projections(page);
  return Math.max(
    0,
    ...before.map((point) => {
      const next = after.find((other) => other.id === point.id);
      return next ? Math.hypot(point.x - next.x, point.y - next.y) : 0;
    }),
  );
}

for (const textSize of ['standard', 'large'] as const) {
  test(`Camera disclosure keeps native commands, focus and recovery with ${textSize} text`, async ({
    page,
    isMobile,
  }) => {
    const errors: string[] = [];
    const onError = (error: Error) => errors.push(error.message);
    page.on('pageerror', onError);
    try {
      await page.setViewportSize({ width: 320, height: 568 });
      const original = parseSave(JSON.parse(await readFile(fixture, 'utf8'))).state;
      await page.goto('/');
      const settings = page.getByRole('button', { name: 'Saves & settings', exact: true });
      await tabTo(page, settings);
      await activate(settings, isMobile);
      await page.locator('[data-setting="quality"]').selectOption('low');
      await page.locator('[data-setting="textSize"]').selectOption(textSize);
      await page.locator('[data-setting="reducedMotion"]').check();
      await page.locator('#import-save').setInputFiles(fixture);
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilean-road');
      await settled(page);
      const before = await exportState(page, isMobile);
      expect({ ...before, playTime: original.playTime }).toEqual(original);
      await expect(page.locator('#toast')).toBeHidden();

      const toggle = control(page, 'camera-toggle');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toHaveAttribute('aria-controls', 'camera-command-buttons');
      expect(await visibleCommands(page)).toEqual([]);
      await reachableControls(page);
      const guidance = await readableGuidance(page);
      await activate(toggle, isMobile);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(await visibleCommands(page)).toEqual(commands);
      await reachableControls(page);
      expect(await readableGuidance(page)).toBe(guidance);

      await activate(control(page, 'reset-camera'), isMobile);
      await expect.poll(() => bearing(page)).toBeCloseTo((-0.45 * 180) / Math.PI, 2);
      const start = await bearing(page);
      await activate(control(page, 'rotate-left'), isMobile);
      await expect
        .poll(async () => turn(start, await bearing(page)))
        .toBeCloseTo((0.9 * 0.3 * 180) / Math.PI, 2);
      await activate(control(page, 'rotate-right'), isMobile);
      await expect.poll(async () => turn(start, await bearing(page))).toBeCloseTo(0, 2);
      const unzoomed = await projections(page);
      expect(unzoomed.length).toBeGreaterThan(0);
      await activate(control(page, 'zoom-in'), isMobile);
      await expect.poll(() => projectionDelta(page, unzoomed)).toBeGreaterThan(1);
      const zoomed = await projections(page);
      await activate(control(page, 'zoom-out'), isMobile);
      await expect.poll(() => projectionDelta(page, zoomed)).toBeGreaterThan(1);
      await activate(control(page, 'reset-camera'), isMobile);

      await tabTo(page, control(page, 'zoom-out'));
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(await visibleCommands(page)).toEqual([]);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.setViewportSize({ width: 320, height: 740 });
      await expect(toggle).toBeHidden();
      await expect(control(page, 'reset-camera')).toBeFocused();
      expect(await visibleCommands(page)).toEqual(commands);
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(control(page, 'reset-camera')).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
      await page.setViewportSize({ width: 568, height: 320 });
      await expect(toggle).toBeHidden();
      await expect(control(page, 'reset-camera')).toBeFocused();
      expect(await visibleCommands(page)).toEqual(commands);
      await reachableControls(page);
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(control(page, 'reset-camera')).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();

      const extension = await page
        .locator('#game-canvas')
        .evaluateHandle((node) =>
          ((node as HTMLCanvasElement).getContext('webgl2') ??
            (node as HTMLCanvasElement).getContext('webgl'))!.getExtension('WEBGL_lose_context'),
        );
      let lost = false,
        primary: unknown,
        cleanup: unknown;
      try {
        expect(await extension.evaluate((value) => !!value)).toBe(true);
        await extension.evaluate((value) => value!.loseContext());
        lost = true;
        await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'true');
        expect(
          await page
            .locator('#game-canvas')
            .evaluate((node) =>
              ((node as HTMLCanvasElement).getContext('webgl2') ??
                (node as HTMLCanvasElement).getContext('webgl'))!.isContextLost(),
            ),
        ).toBe(true);
        await expect(toggle).toBeHidden();
        for (const action of commands) await expect(control(page, action)).toBeDisabled();
        if (textSize === 'large') await page.setViewportSize({ width: 320, height: 740 });
      } catch (error) {
        primary = error;
      } finally {
        try {
          if (lost) await extension.evaluate((value) => value!.restoreContext());
        } catch (error) {
          cleanup = error;
        } finally {
          try {
            await extension.dispose();
          } catch (error) {
            cleanup ??= error;
          }
        }
      }
      if (primary) throw primary;
      if (cleanup) throw cleanup;
      await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
      expect(
        await page
          .locator('#game-canvas')
          .evaluate((node) =>
            ((node as HTMLCanvasElement).getContext('webgl2') ??
              (node as HTMLCanvasElement).getContext('webgl'))!.isContextLost(),
          ),
      ).toBe(false);
      await expect(
        control(page, textSize === 'large' ? 'reset-camera' : 'camera-toggle'),
      ).toBeFocused();
      if (textSize === 'large') {
        await page.setViewportSize({ width: 320, height: 568 });
        await expect(control(page, 'reset-camera')).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      } else await activate(toggle, isMobile);
      for (const action of commands) await expect(control(page, action)).toBeEnabled();
      await activate(control(page, 'rotate-right'), isMobile);
      await expect
        .poll(async () => turn(start, await bearing(page)))
        .toBeCloseTo((-0.9 * 0.3 * 180) / Math.PI, 2);
      await reachableControls(page);
      const after = await exportState(page, isMobile);
      expect({ ...after, playTime: before.playTime }).toEqual(before);
      expect(errors).toEqual([]);
    } finally {
      page.off('pageerror', onError);
    }
  });
}
