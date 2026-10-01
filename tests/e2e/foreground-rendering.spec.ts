import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { dismiss, exported, ready } from '../helpers/connection-browser';
import { parseSave } from '../../src/persistence/schema';
import { newGame } from '../../src/game/types';

/** Observe completed geometry frames through WebGL, without accessing game or engine internals. */
async function drawingProbe(page: Page) {
  return page.locator('#game-canvas').evaluateHandle((node) => {
    const gl = (node as HTMLCanvasElement).getContext('webgl2')!;
    const draw = gl.drawElements;
    const hidden = Object.getOwnPropertyDescriptor(document, 'hidden');
    let background = false;
    let armed: 'visibility' | 'focus' | undefined;
    let pending = false;
    let frames = 0;
    let resizes = 0;
    let suspended = false;
    let sample = true;
    let pixels = { colors: 0, opaque: 0, colored: 0, error: 0 };
    const resized = () => resizes++;
    window.addEventListener('resize', resized);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => background });
    gl.drawElements = function (...args) {
      draw.call(gl, ...args);
      if (pending) return;
      pending = true;
      // The whole synchronous scene render finishes before this reads its framebuffer.
      queueMicrotask(() => {
        pending = false;
        frames++;
        if (sample) {
          sample = false;
          const width = gl.drawingBufferWidth;
          const height = gl.drawingBufferHeight;
          const rgba = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
          const colors = new Set<number>();
          let opaque = 0;
          let colored = 0;
          for (let i = 0; i < rgba.length; i += 4) {
            if (rgba[i + 3]! > 0) opaque++;
            if (rgba[i] !== rgba[i + 1] || rgba[i + 1] !== rgba[i + 2]) colored++;
            colors.add(((rgba[i]! >> 4) << 8) | ((rgba[i + 1]! >> 4) << 4) | (rgba[i + 2]! >> 4));
          }
          pixels = {
            colors: colors.size,
            opaque: opaque / (width * height),
            colored: colored / (width * height),
            error: gl.getError(),
          };
        }
        if (armed) {
          background = armed === 'visibility';
          window.dispatchEvent(new Event('blur'));
          if (background) document.dispatchEvent(new Event('visibilitychange'));
          armed = undefined;
          suspended = true;
        }
      });
    };
    return {
      arm(mode: 'visibility' | 'focus') {
        armed = mode;
        suspended = false;
      },
      resume() {
        background = false;
        sample = true;
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      },
      resumeFocus() {
        sample = true;
        window.dispatchEvent(new Event('focus'));
      },
      sample() {
        sample = true;
      },
      read() {
        return { frames, resizes, suspended, pixels };
      },
      dispose() {
        gl.drawElements = draw;
        window.removeEventListener('resize', resized);
        if (hidden) Object.defineProperty(document, 'hidden', hidden);
        else delete (document as unknown as { hidden?: boolean }).hidden;
      },
    };
  });
}

const cases = [
  { name: 'welcome', fixture: undefined },
  { name: 'exploration', fixture: undefined },
  { name: 'lake-gennesaret', fixture: 'v4-interrupted-lake.json' },
  { name: 'roof-account', fixture: 'v5-interrupted-roof.json' },
  { name: 'nain-account', fixture: 'v7-nain-checkpoint.json' },
  { name: 'storm-account', fixture: 'v9-storm-waking.json' },
] as const;

for (const scenario of cases)
  test(`${scenario.name} repaints promptly after background return, window focus and resize`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    // Install before navigation so existing frame clocks keep the same time origin.
    await page.clock.install();
    if (scenario.name === 'welcome') {
      await page.goto('/');
      await page.getByRole('button', { name: 'Saves & settings' }).click();
      await page.locator('[data-setting="quality"]').selectOption('low');
      await page.locator('[data-setting="reducedMotion"]').check();
      await dismiss(page);
      await expect(page.locator('.welcome-saves')).toHaveCSS('opacity', '1');
    } else {
      const state = scenario.fixture
        ? parseSave(JSON.parse(await readFile(`tests/fixtures/saves/${scenario.fixture}`, 'utf8')))
            .state
        : newGame();
      await ready(page, state);
      await page.getByRole('button', { name: 'Settings and saves' }).click();
      await page.locator('[data-setting="reducedMotion"]').check();
      await expect(page.locator('.chapter-card')).toHaveCount(0);
    }
    const saved = scenario.name === 'welcome' ? undefined : await exported(page);
    const focus =
      scenario.name === 'welcome'
        ? page.getByRole('button', { name: 'Begin your journey', exact: true })
        : page.getByRole('button', { name: 'Export', exact: true });
    await focus.focus();
    // Allow the browser round trip to finish before the selected pause time, then settle
    // the initial jump before measuring either suspension. A one-millisecond lead races IPC.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.clock.runFor(4000);
    const probe = await drawingProbe(page);
    const evidence: unknown[] = [];
    try {
      for (const mode of ['visibility', 'focus'] as const) {
        // Suspend directly after a render, when cadence is waiting to measure its cost.
        await probe.evaluate((value, mode) => value.arm(mode), mode);
        await page.clock.runFor(1200);
        const before = await probe.evaluate((value) => value.read());
        expect(before.suspended).toBe(true);
        expect(before.frames).toBeGreaterThan(0);
        await page.clock.fastForward(60_000);
        expect((await probe.evaluate((value) => value.read())).frames).toBe(before.frames);
        if (mode === 'visibility') await probe.evaluate((value) => value.resume());
        else await probe.evaluate((value) => value.resumeFocus());
        await page.clock.runFor(48);
        const returned = await probe.evaluate((value) => value.read());
        expect(returned.frames - before.frames).toBe(1);
        expect(returned.pixels.error).toBe(0);
        expect(returned.pixels.colors).toBeGreaterThan(20);
        expect(returned.pixels.opaque).toBeGreaterThan(0.95);
        expect(returned.pixels.colored).toBeGreaterThan(0.5);
        await expect(focus).toBeFocused();
        const start = returned.frames;
        await page.clock.runFor(1000);
        const quiet = await probe.evaluate((value) => value.read());
        expect(quiet.frames - start).toBeGreaterThan(3);
        expect(quiet.frames - start).toBeLessThanOrEqual(10);
        evidence.push({ mode, before, returned, quiet });
      }
      const beforeResize = await probe.evaluate((value) => value.read());
      await probe.evaluate((value) => value.sample());
      await page.setViewportSize({ width: 568, height: 320 });
      // setViewportSize can return before the browser delivers its native resize event.
      await expect
        .poll(async () => (await probe.evaluate((value) => value.read())).resizes)
        .toBeGreaterThan(beforeResize.resizes);
      await page.clock.runFor(48);
      const resized = await probe.evaluate((value) => value.read());
      expect(resized.frames).toBeGreaterThan(beforeResize.frames);
      expect(resized.pixels.error).toBe(0);
      expect(resized.pixels.colors).toBeGreaterThan(20);
      expect(resized.pixels.opaque).toBeGreaterThan(0.95);
      await expect(focus).toBeFocused();
      evidence.push({ beforeResize, resized });
      await page.screenshot({ path: info.outputPath('foreground-resized.png'), scale: 'css' });
      await page.screenshot({
        path: info.outputPath('foreground-world.png'),
        scale: 'css',
        style: '#ui{visibility:hidden}',
      });
    } finally {
      await probe.evaluate((value) => value.dispose());
      await probe.dispose();
      await page.clock.resume();
    }
    if (saved) {
      const after = await exported(page);
      expect({ ...after, playTime: saved.playTime }).toEqual(saved);
    }
    expect(errors).toEqual([]);
    await writeFile(
      info.outputPath('foreground-rendering.json'),
      JSON.stringify(evidence, null, 2),
    );
  });
