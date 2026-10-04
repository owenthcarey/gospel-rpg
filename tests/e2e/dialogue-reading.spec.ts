import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { dialogueFor } from '../../src/content/story';
import { exported, settled } from '../helpers/connection-browser';
import {
  capture,
  geometry,
  nativeResize,
  painted,
  readCurrentQuestion,
  selectNativeControl,
  visitSimon,
} from '../helpers/dialogue-reading-browser';

const fixture = 'tests/fixtures/saves/v1-arrival.json';
type Reading = Awaited<ReturnType<typeof geometry>>;
const views = [
  { name: 'wide conversation', width: 844, height: 390, large: false },
  { name: 'narrow conversation and shorter resize', width: 568, height: 320, large: false },
  { name: 'short conversation', width: 390, height: 320, large: false },
  {
    name: 'Large conversation and constrained touch fallback',
    width: 390,
    height: 320,
    large: true,
  },
];

for (const view of views) {
  test(`${view.name} retains native full reading and selected controls`, async ({
    page,
    isMobile,
  }, info) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    const bytes = await readFile(fixture);
    const original = parseSave(JSON.parse(bytes.toString('utf8'))).state;
    await page.goto('/');
    await page.getByRole('button', { name: 'Saves & settings', exact: true }).click();
    await page.locator('[data-setting="quality"]').selectOption('low');
    await page.locator('[data-setting="reducedMotion"]').check();
    await page.locator('[data-setting="textSize"]').selectOption(view.large ? 'large' : 'standard');
    await page.locator('#import-save').setInputFiles(fixture);
    await settled(page);
    const imported = await exported(page);
    expect({ ...imported, playTime: original.playTime }).toEqual(original);
    await visitSimon(page, isMobile);
    await page.keyboard.press('Escape');
    await settled(page);
    const before = await exported(page);
    expect({ ...before, position: original.position, playTime: original.playTime }).toEqual(
      original,
    );
    expect(Math.hypot(before.position.x - 5, before.position.z - 1)).toBeLessThan(2.35);
    expect(before.connection.route).toBeNull();
    const served = await page.evaluate(() => ({
      scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(
        (node) => node.src,
      ),
      styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
        (node) => node.href,
      ),
    }));
    const assetNames = {
      js: served.scripts.map((url) => new URL(url).pathname.split('/').at(-1)),
      css: served.styles.map((url) => new URL(url).pathname.split('/').at(-1)),
    };
    expect(assetNames.js).toHaveLength(1);
    expect(assetNames.css).toHaveLength(1);
    expect(assetNames.js[0]).toMatch(/^index-[\w-]+\.js$/);
    expect(assetNames.css[0]).toMatch(/^index-[\w-]+\.css$/);
    if (process.env.DIALOGUE_READING_EXPECTED_JS)
      expect(assetNames.js).toEqual([process.env.DIALOGUE_READING_EXPECTED_JS]);
    if (process.env.DIALOGUE_READING_EXPECTED_CSS)
      expect(assetNames.css).toEqual([process.env.DIALOGUE_READING_EXPECTED_CSS]);
    await writeFile(
      info.outputPath('fixture-and-native-approach.json'),
      JSON.stringify(
        {
          fixture,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          original,
          imported,
          before,
          view,
          isMobile,
          served,
          expectedAssets: {
            js: process.env.DIALOGUE_READING_EXPECTED_JS ?? null,
            css: process.env.DIALOGUE_READING_EXPECTED_CSS ?? null,
          },
          proof:
            'Compiled runtime, original fixture and native input; no candidate code or overlay behavior injected',
        },
        null,
        2,
      ),
    );
    await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
    const readings: Awaited<ReturnType<typeof readCurrentQuestion>>[] = [];
    const resizedControls: Reading[] = [];
    let initial: Reading | undefined;
    let largeWrapped: Reading | undefined;
    const authored = dialogueFor('simon', before);
    try {
      await visitSimon(page, isMobile);
      await page
        .locator('.dialogue-box')
        .evaluate((node) =>
          Promise.all(node.getAnimations().map((animation) => animation.finished)),
        );
      await capture(page, info, 'native-opening-before-reveal');
      await page.keyboard.press('Shift');
      await painted(page);
      initial = await capture(page, info, 'settled-opening');
      readings.push(await readCurrentQuestion(page, info, 'original-viewport', isMobile));
      if (view.width === 568) {
        resizedControls.push(await nativeResize(page, info, '568-to390-later-choice', 390, 320));
        readings.push(await readCurrentQuestion(page, info, 'after390-resize', isMobile));
      }
      if (view.large && isMobile) {
        resizedControls.push(await nativeResize(page, info, 'large320-later-choice', 320, 320));
        await selectNativeControl(page, 'choice', '0');
        largeWrapped = await capture(page, info, 'large-native-wrapped-answer');
        readings.push(await readCurrentQuestion(page, info, 'large320-reading', true, true));
      }
      // Exercise the actual Pause/Resume presentation action without selecting
      // an authored answer. Captures retain real camera/layout pixels for review.
      await selectNativeControl(page, 'conversation-pause', null);
      await page.keyboard.press('Enter');
      await settled(page);
      await expect(page.locator('.conversation-motion')).toHaveAttribute('aria-pressed', 'true');
      await capture(page, info, 'native-pause-layout');
      await page.keyboard.press('Enter');
      await settled(page);
      await expect(page.locator('.conversation-motion')).toHaveAttribute('aria-pressed', 'false');
      await capture(page, info, 'native-resume-layout');
      const oldSurface = await page.locator('.dialogue-box').elementHandle();
      try {
        await page.keyboard.press('Escape');
        await settled(page);
        await expect(page.locator('#game-canvas')).toBeFocused();
        await expect(page.locator('#ui')).not.toHaveClass(/conversing/);
        await expect(page.locator('#overlay')).toBeEmpty();
        await visitSimon(page, isMobile);
        await page.keyboard.press('Shift');
        await painted(page);
        const reopened = await capture(page, info, 'reopened-compiled-dialogue');
        expect(await oldSurface!.evaluate((node) => node.isConnected)).toBe(false);
        expect(reopened.focus).toMatchObject({
          action: 'choice',
          value: '0',
          withinDialogue: true,
        });
        expect(reopened.firstAnswer!.visible).toBe(true);
        await writeFile(
          info.outputPath('compiled-lifecycle.json'),
          JSON.stringify(
            {
              oldSurfaceDisconnected: true,
              nativeEscapeRestoredCanvas: true,
              replacementFocus: reopened.focus,
              replacementGeometry: reopened,
              noOverlayInjection: true,
              observedCamera: 'Actual full viewport captures; no private camera state injected',
            },
            null,
            2,
          ),
        );
      } finally {
        await oldSurface?.dispose();
      }
    } finally {
      await page.keyboard.press('Escape');
      await settled(page);
      await expect(page.locator('.dialogue-box')).toHaveCount(0);
      await expect(page.locator('#game-canvas')).toBeFocused();
      await expect(page.locator('#ui')).not.toHaveClass(/conversing/);
      await expect(page.locator('#overlay')).toBeEmpty();
      const after = await exported(page);
      expect({ ...after, playTime: before.playTime }).toEqual(before);
      await writeFile(
        info.outputPath('unchanged-reading-journey.json'),
        JSON.stringify(
          {
            before,
            after,
            onlyElapsedTimeAllowed: true,
            compiledRuntime: true,
          },
          null,
          2,
        ),
      );
    }
    expect(initial?.focus).toMatchObject({ action: 'choice', value: '0', withinDialogue: true });
    for (const resized of resizedControls) {
      const selected = resized.controls.find(
        (control) =>
          control.action === resized.focus.action && control.value === resized.focus.value,
      )!;
      expect(selected.visible).toBe(true);
      expect(selected.rect.width).toBeGreaterThanOrEqual(isMobile ? 43.99 : 31.99);
      expect(selected.rect.height).toBeGreaterThanOrEqual(isMobile ? 43.99 : 41.99);
      expect(selected.labelWords.map((word) => word.word)).toEqual(
        authored.choices[1]!.label.match(/\S+/g),
      );
      expect(selected.labelWords.every((word) => word.visible)).toBe(true);
    }
    for (const reading of readings) {
      expect(reading.snapshots.every((snapshot) => snapshot.questionText === authored.text)).toBe(
        true,
      );
      expect(reading.coveredWordIndices.length).toBe(reading.totalWords);
      expect(reading.allControlsReached).toBe(true);
      if (reading.overflowingRegion && isMobile)
        expect(reading.mandatoryRegionSwipes).toBeGreaterThanOrEqual(1);
      else expect(reading.mandatoryRegionSwipes).toBe(0);
      if (reading.expectedOuterReading) {
        expect(reading.initial.compact).toBe(false);
        expect(reading.initial.questionRegion).toEqual({
          role: null,
          tabindex: null,
          label: null,
          cap: '',
        });
        expect(reading.overflowingRegion).toBe(false);
        expect(reading.initial.scroll.cardMax).toBeGreaterThan(0);
        expect(reading.mandatoryOuterSwipes).toBeGreaterThanOrEqual(1);
      }
      for (const snapshot of reading.selectedControls) {
        const control = snapshot.controls.find(
          (control) =>
            control.action === snapshot.focus.action && control.value === snapshot.focus.value,
        )!;
        expect(control.visible).toBe(true);
        expect(control.rect.width).toBeGreaterThanOrEqual(isMobile ? 43.99 : 31.99);
        expect(control.rect.height).toBeGreaterThanOrEqual(
          isMobile ? 43.99 : control.action === 'choice' ? 41.99 : 31.99,
        );
        if (control.action === 'choice') {
          expect(control.labelWords.map((word) => word.word)).toEqual(
            authored.choices[Number(control.value)]!.label.match(/\S+/g),
          );
          expect(control.labelWords.every((word) => word.visible)).toBe(true);
        }
      }
    }
    if (largeWrapped) {
      expect(largeWrapped.compact).toBe(false);
      expect(largeWrapped.firstAnswer!.rect.height).toBeGreaterThan(44);
      const lines = new Set(
        largeWrapped.firstAnswer!.labelWords.flatMap((word) => word.rects.map((r) => r.top)),
      );
      expect(lines.size).toBeGreaterThan(1);
      expect(largeWrapped.questionRegion).toEqual({
        role: null,
        tabindex: null,
        label: null,
        cap: '',
      });
    }
    expect.soft(initial?.headerVisible, 'Opening retains actual speaker and controls').toBe(true);
    expect
      .soft(initial?.questionBeginningVisible, 'Opening shows actual question beginning')
      .toBe(true);
    expect
      .soft(initial?.firstAnswer?.visible, 'Opening shows full focused first answer')
      .toBe(true);
    expect(initial!.box.height).toBeLessThanOrEqual(initial!.maximumCardHeight + 0.01);
  });
}
