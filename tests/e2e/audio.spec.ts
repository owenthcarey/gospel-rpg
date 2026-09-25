import { test, expect, type Page } from '@playwright/test';
import { makeSave } from '../../src/persistence/schema';
import { stormStart } from '../helpers/lake';
import { transition } from '../../src/game/quest';

declare global {
  interface Window {
    __audioProbe: {
      contexts: AudioContext[];
      analyser?: AnalyserNode;
      activeSources: number;
      startedSources: number;
    };
  }
}
async function probe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__audioProbe = { contexts: [], activeSources: 0, startedSources: 0 };
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.__audioProbe.contexts.push(this);
      }
      createDynamicsCompressor(): DynamicsCompressorNode {
        const compressor = super.createDynamicsCompressor();
        const analyser = this.createAnalyser();
        analyser.fftSize = 2048;
        compressor.connect(analyser);
        window.__audioProbe.analyser = analyser;
        return compressor;
      }
      createOscillator(): OscillatorNode {
        const node = super.createOscillator();
        window.__audioProbe.activeSources++;
        window.__audioProbe.startedSources++;
        node.addEventListener('ended', () => window.__audioProbe.activeSources--, { once: true });
        return node;
      }
    };
  });
}
const level = (page: Page) =>
  page.evaluate(() => {
    const analyser = window.__audioProbe.analyser;
    if (!analyser) return 0;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  });
const state = (page: Page) =>
  page.evaluate(() => window.__audioProbe.contexts[0]?.state ?? 'locked');

/** Retain short bursts on the audio thread, even while software WebGL blocks page.evaluate. */
async function capturePeak(page: Page) {
  const meter = await page.evaluateHandle(async () => {
    const analyser = window.__audioProbe.analyser!;
    const context = analyser.context as AudioContext;
    const module = URL.createObjectURL(
      new Blob(
        [
          `class PeakMeter extends AudioWorkletProcessor {
            constructor() {
              super();
              this.peak = 0;
              this.port.onmessage = () => this.port.postMessage(this.peak);
            }
            process(inputs) {
              let sum = 0, count = 0;
              for (const channel of inputs[0]) {
                for (const value of channel) sum += value * value;
                count += channel.length;
              }
              if (count) this.peak = Math.max(this.peak, Math.sqrt(sum / count));
              return true;
            }
          }
          registerProcessor('test-peak-meter', PeakMeter);`,
        ],
        { type: 'text/javascript' },
      ),
    );
    try {
      await context.audioWorklet.addModule(module);
    } finally {
      URL.revokeObjectURL(module);
    }
    const node = new AudioWorkletNode(context, 'test-peak-meter');
    // Its output remains silent: this branch measures the mix without doubling playback.
    analyser.connect(node).connect(context.destination);
    return node;
  });
  return {
    read: () =>
      meter.evaluate(
        (node) =>
          new Promise<number>((resolve) => {
            node.port.onmessage = ({ data }) => resolve(data);
            node.port.postMessage('read');
          }),
      ),
    dispose: async () => {
      await meter.evaluate((node) => {
        window.__audioProbe.analyser!.disconnect(node);
        node.disconnect();
        node.port.close();
      });
      await meter.dispose();
    },
  };
}

async function slider(page: Page, name: string, value: number): Promise<void> {
  await page.getByRole('slider', { name, exact: true }).fill(String(value));
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}

test('audio waits for a gesture, mixes independent channels, suspends in background, and preserves mute', async ({
  page,
}, info) => {
  // The CI trace reached the final unmute at 178 seconds; retain the full audio probe.
  if (process.env.CI) test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await probe(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Begin your journey' })).toBeVisible();
  expect(await state(page)).toBe('locked');
  await page.getByRole('button', { name: 'Begin your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect.poll(() => state(page)).toBe('running');
  await expect.poll(() => level(page)).toBeGreaterThan(0.0002);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await expect(page.locator('.soundtrack-note')).toContainText('First Light on the Water');
  await slider(page, 'Music volume', 0);
  await slider(page, 'Ambience volume', 0);
  await slider(page, 'Effects volume', 0);
  await expect.poll(() => level(page)).toBeLessThan(0.0001);
  await slider(page, 'Music volume', 0.65);
  await expect.poll(() => level(page)).toBeGreaterThan(0.0003);
  await slider(page, 'Music volume', 0);
  await slider(page, 'Ambience volume', 0.8);
  await expect.poll(() => level(page)).toBeGreaterThan(0.0002);
  await slider(page, 'Master volume', 0);
  await expect.poll(() => level(page)).toBeLessThan(0.0001);
  await slider(page, 'Master volume', 0.5);
  await slider(page, 'Music volume', 0.65);
  await page.screenshot({ path: info.outputPath('audio-settings.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => state(page)).toBe('suspended');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => state(page)).toBe('running');
  expect(await page.evaluate(() => window.__audioProbe.contexts.length)).toBe(1);
  await page.locator('[data-setting="sound"]').uncheck();
  await expect.poll(() => state(page)).toBe('suspended');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  expect(await state(page)).toBe('locked');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await expect(page.locator('[data-setting="sound"]')).not.toBeChecked();
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue('0.65');
  await page.locator('[data-setting="sound"]').check();
  await expect.poll(() => state(page)).toBe('running');
  await expect.poll(() => level(page)).toBeGreaterThan(0.0002);
  expect(errors).toEqual([]);
});

test('storm-to-calm transitions retain one context and retire old voices', async ({ page }) => {
  await probe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  let storm = stormStart();
  storm = transition(storm, { type: 'storm-next', checkpoint: 'evening' });
  storm = transition(storm, { type: 'storm-next', checkpoint: 'boats' });
  expect(storm.lake.chapter.checkpoint).toBe('storm');
  await page.locator('#import-save').setInputFiles({
    name: 'storm.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(storm))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'storm-account');
  // The file chooser is browser-controlled; a subsequent trusted click also retries audio unlock.
  await page.keyboard.press('Escape');
  await expect(page.locator('.soundtrack-note')).toContainText('When the Wind Gathers');
  await expect.poll(() => state(page)).toBe('running');
  await expect.poll(() => level(page)).toBeGreaterThan(0.0002);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.locator('[data-action="storm-next"]').click();
  await page.locator('[data-action="storm-next"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', 'command');
  await page.keyboard.press('Escape');
  await expect(page.locator('.soundtrack-note')).toContainText('And There Was a Great Calm');
  await expect.poll(() => page.evaluate(() => window.__audioProbe.activeSources)).toBeLessThan(50);
  expect(await page.evaluate(() => window.__audioProbe.contexts.length)).toBe(1);
  await expect.poll(() => level(page)).toBeGreaterThan(0.0002);
});

test('walking produces effects with music and ambience silenced', async ({ page }) => {
  await probe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await slider(page, 'Music volume', 0);
  await slider(page, 'Ambience volume', 0);
  await slider(page, 'Effects volume', 1);
  await slider(page, 'Master volume', 1);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect.poll(() => level(page)).toBeLessThan(0.0001);
  const peak = await capturePeak(page);
  try {
    expect(await peak.read()).toBeLessThan(0.0001);
    const position = await page.locator('#minimap-player').getAttribute('transform');
    await page.keyboard.down('s');
    await expect(page.locator('#minimap-player')).not.toHaveAttribute('transform', position!);
    await expect.poll(() => peak.read()).toBeGreaterThan(0.0003);
  } finally {
    await page.keyboard.up('s');
    await peak.dispose();
  }
  await expect.poll(() => level(page)).toBeLessThan(0.0001);
});

test('unavailable Web Audio never blocks beginning or settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error('Audio unavailable');
      }
    } as unknown as typeof AudioContext;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="sound"]').uncheck();
  await page.locator('[data-setting="sound"]').check();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.locator('#quest-card')).toBeVisible();
  expect(errors).toEqual([]);
});
