import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { dismiss, exported, settled } from '../helpers/connection-browser';

const fixture = 'tests/fixtures/saves/v7-beyond-capernaum.json';
const local = '.map-tabs [data-action="local-map"]';
const journey = '.map-tabs [data-action="journey-map"]';

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function mapPosition(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const reading = document.querySelector('.panel-body');
    const bounds = active instanceof HTMLElement ? active.getBoundingClientRect() : null;
    const body = reading?.getBoundingClientRect();
    return {
      action: active instanceof HTMLElement ? (active.dataset.action ?? null) : null,
      name:
        active instanceof HTMLElement
          ? (active.getAttribute('aria-label') ?? active.textContent?.trim())
          : null,
      selected: document
        .querySelector('.map-tabs [aria-pressed="true"]')
        ?.getAttribute('data-action'),
      visible:
        !!bounds &&
        !!body &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.left >= body.left - 0.01 &&
        bounds.right <= body.right + 0.01 &&
        bounds.top >= body.top - 0.01 &&
        bounds.bottom <= body.bottom + 0.01 &&
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight,
    };
  });
}

async function originalMap(page: Page, isMobile: boolean, info: TestInfo) {
  const bytes = await readFile(fixture);
  const original = parseSave(JSON.parse(bytes.toString('utf8'))).state;
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings', exact: true }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('[data-setting="textSize"]').selectOption(isMobile ? 'large' : 'standard');
  await page.locator('#import-save').setInputFiles(fixture);
  await settled(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const before = await exported(page);
  expect({ ...before, playTime: original.playTime }).toEqual(original);
  await dismiss(page);
  const button = page.locator('.toolbar [data-action="map"]');
  if (isMobile) await button.tap();
  else await button.click();
  await painted(page);
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await writeFile(
    info.outputPath('original-map-journey.json'),
    JSON.stringify(
      {
        fixture,
        fixtureSha256: createHash('sha256').update(bytes).digest('hex'),
        original,
        before,
        viewport: page.viewportSize(),
        textSize: isMobile ? 'large' : 'standard',
        initialCloseFocus: true,
        served: await page.evaluate(() => ({
          scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(
            (node) => node.src,
          ),
          styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
            (node) => node.href,
          ),
        })),
      },
      null,
      2,
    ),
  );
  // Reach the view control through ordinary keyboard navigation from the opening Close.
  await page.keyboard.press('Tab');
  await expect(page.locator(local)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator(journey)).toBeFocused();
  return before;
}

async function unchangedJourney(page: Page, before: GameState, info: TestInfo) {
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
  await writeFile(
    info.outputPath('unchanged-map-journey.json'),
    JSON.stringify({ before, after }, null, 2),
  );
}

test('keyboard map switching keeps the activated view and the next reading control', async ({
  page,
  isMobile,
}, info) => {
  const before = await originalMap(page, isMobile, info);
  const oldPanel = (await page.locator('.panel').elementHandle())!;
  const oldSurface = (
    await page.locator('#overlay').evaluateHandle((node) => node.firstElementChild!)
  ).asElement()!;
  await page.keyboard.press('Enter');
  await painted(page);
  const forward = await mapPosition(page);
  expect(forward).toMatchObject({ action: 'journey-map', selected: 'journey-map', visible: true });
  expect(await oldPanel.evaluate((node) => node.isConnected)).toBe(false);
  expect(await oldSurface.evaluate((node) => node.isConnected)).toBe(false);
  await page.screenshot({ path: info.outputPath('selected-journey-view.png'), scale: 'css' });

  // Native Shift+Tab returns directly to the other view, without moving through the destinations.
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(local)).toBeFocused();
  const journeyPanel = (await page.locator('.panel').elementHandle())!;
  await page.keyboard.press('Enter');
  await painted(page);
  const backward = await mapPosition(page);
  expect(backward).toMatchObject({ action: 'local-map', selected: 'local-map', visible: true });
  expect(await journeyPanel.evaluate((node) => node.isConnected)).toBe(false);
  await page.screenshot({ path: info.outputPath('selected-local-view.png'), scale: 'css' });
  await page.keyboard.press('Tab');
  await expect(page.locator(journey)).toBeFocused();
  await writeFile(
    info.outputPath('native-map-switches.json'),
    JSON.stringify(
      { forward, backward, nextTab: await mapPosition(page), syntheticRace: false },
      null,
      2,
    ),
  );
  await unchangedJourney(page, before, info);
});

async function beforePaintRace(page: Page, mode: 'focus' | 'replace') {
  return page.evaluateHandle((mode) => {
    const overlay = document.querySelector('#overlay')!;
    const previousPanel = overlay.querySelector('.panel')!;
    const previousSurface = overlay.firstElementChild!;
    let intermediatePanel: Element | null = null;
    let intermediateSurface: Element | null = null;
    let observation: {
      mode: string;
      activeBefore: string | undefined;
      actionAfter: string | undefined;
      previousPanelDisconnected: boolean;
      previousSurfaceDisconnected: boolean;
    } | null = null;
    const observer = new MutationObserver(() => {
      const panel = overlay.querySelector('.panel');
      const surface = overlay.firstElementChild;
      if (
        panel === previousPanel ||
        !overlay.querySelector('.map-tabs [data-action="journey-map"][aria-pressed="true"]')
      )
        return;
      const control = overlay.querySelector<HTMLButtonElement>(
        '.map-tabs [data-action="local-map"]',
      );
      if (!control) return;
      observer.disconnect();
      intermediatePanel = panel;
      intermediateSurface = surface;
      const activeBefore = document.activeElement?.tagName;
      // Explicit deterministic ordering fixtures, not claims of native focus/click gestures:
      // choose a later control, or invoke its real action to supersede this map before RAF.
      if (mode === 'focus') control.focus({ preventScroll: true });
      else control.click();
      observation = {
        mode,
        activeBefore,
        actionAfter:
          document.activeElement instanceof HTMLElement
            ? document.activeElement.dataset.action
            : undefined,
        previousPanelDisconnected: !previousPanel.isConnected,
        previousSurfaceDisconnected: !previousSurface.isConnected,
      };
    });
    observer.observe(overlay, { childList: true });
    return {
      observation: () =>
        observation && {
          ...observation,
          // The real action queue replaces this panel in a later microtask.
          intermediatePanelDisconnected: !!intermediatePanel && !intermediatePanel.isConnected,
          intermediateSurfaceDisconnected:
            !!intermediateSurface && !intermediateSurface.isConnected,
        },
      dispose: () => observer.disconnect(),
    };
  }, mode);
}

test('map refresh respects a later view control chosen before paint (deterministic race)', async ({
  page,
  isMobile,
}, info) => {
  const before = await originalMap(page, isMobile, info);
  const race = await beforePaintRace(page, 'focus');
  try {
    await page.keyboard.press('Enter');
    await painted(page);
    const observation = await race.evaluate((race) => race.observation());
    expect(observation).toMatchObject({
      mode: 'focus',
      actionAfter: 'local-map',
      previousPanelDisconnected: true,
      previousSurfaceDisconnected: true,
    });
    const laterChoice = await mapPosition(page);
    expect(laterChoice).toMatchObject({
      action: 'local-map',
      selected: 'journey-map',
      visible: true,
    });
    await page.screenshot({ path: info.outputPath('later-view-choice.png'), scale: 'css' });
    await writeFile(
      info.outputPath('before-paint-focus-race.json'),
      JSON.stringify({ observation, laterChoice, syntheticRace: true }, null, 2),
    );
    // The retained control remains usable through a genuine native keyboard activation.
    await page.keyboard.press('Enter');
    await painted(page);
    expect(await mapPosition(page)).toMatchObject({
      action: 'local-map',
      selected: 'local-map',
      visible: true,
    });
    await unchangedJourney(page, before, info);
  } finally {
    try {
      await race.evaluate((race) => race.dispose());
    } finally {
      await race.dispose();
    }
  }
});

test('a superseded map switch respects its replacement panel (deterministic race)', async ({
  page,
  isMobile,
}, info) => {
  const before = await originalMap(page, isMobile, info);
  const race = await beforePaintRace(page, 'replace');
  try {
    await page.keyboard.press('Enter');
    await painted(page);
    const observation = await race.evaluate((race) => race.observation());
    expect(observation).toMatchObject({
      mode: 'replace',
      activeBefore: 'BODY',
      previousPanelDisconnected: true,
      previousSurfaceDisconnected: true,
      intermediatePanelDisconnected: true,
      intermediateSurfaceDisconnected: true,
    });
    await expect(page.locator(local)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
    const replacement = await mapPosition(page);
    await page.screenshot({ path: info.outputPath('replacement-local-panel.png'), scale: 'css' });
    await page.keyboard.press('Tab');
    await expect(page.locator(local)).toBeFocused();
    expect(await mapPosition(page)).toMatchObject({
      action: 'local-map',
      selected: 'local-map',
      visible: true,
    });
    await writeFile(
      info.outputPath('before-paint-replacement-race.json'),
      JSON.stringify({ observation, replacement, syntheticRace: true }, null, 2),
    );
    await unchangedJourney(page, before, info);
  } finally {
    try {
      await race.evaluate((race) => race.dispose());
    } finally {
      await race.dispose();
    }
  }
});
