import { test, expect, type Page } from '@playwright/test';
import { ready, exported } from '../helpers/connection-browser';
import { worldPixels } from '../helpers/rendering';
import { writeFile } from 'node:fs/promises';

// The cold open plays only on a first journey outside automation. These cases opt back in by
// hiding `navigator.webdriver`, the one condition the game uses to skip it for test runs.
async function asPlayer(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Title cards leave on a wall-clock timer, so record each one as it is inserted rather than
    // racing a slow software renderer to inspect it.
    const cards: { text: string; pointerEvents: string }[] = [];
    (window as unknown as { __cards: typeof cards }).__cards = cards;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof HTMLElement && node.classList.contains('chapter-card'))
            cards.push({
              text: node.textContent ?? '',
              pointerEvents: getComputedStyle(node).pointerEvents,
            });
    }).observe(document, { childList: true, subtree: true });
  });
}
const shownCards = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __cards: { text: string; pointerEvents: string }[] }).__cards,
  );
const settled = (page: Page) =>
  expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');

/** Count frames that submit real indexed geometry through the public WebGL context. */
async function welcomeDrawing(page: Page) {
  return page.locator('#game-canvas').evaluate(async (node) => {
    const gl = (node as HTMLCanvasElement).getContext('webgl2')!;
    const draw = gl.drawElements;
    let submissions = 0;
    gl.drawElements = function (...args) {
      submissions++;
      draw.call(gl, ...args);
    };
    const started = performance.now();
    let frames = 0;
    let painted = 0;
    let previous = 0;
    try {
      await new Promise<void>((resolve) => {
        const sample = () => {
          frames++;
          if (submissions !== previous) painted++;
          previous = submissions;
          if (performance.now() - started >= 2000) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      return { frames, painted, submissions, elapsedMs: performance.now() - started };
    } finally {
      gl.drawElements = draw;
    }
  });
}

test('welcome retains the focused control through orientation changes and preserves the saved journey', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('.welcome-saves')).toHaveCSS('opacity', '1');
  const layouts = [
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 844, height: 300 },
    { width: 607, height: 740 },
    { width: 320, height: 568 },
  ];
  const focusedVisible = () =>
    page.locator('.welcome-card').evaluate((card) => {
      const active = document.activeElement as HTMLElement;
      const bounds = card.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      const style = getComputedStyle(card);
      const border = parseFloat(style.borderTopWidth);
      return {
        action: active.dataset.action,
        control: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        card: { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right },
        visible:
          card.contains(active) &&
          rect.height >= 44 &&
          rect.top >= bounds.top + border + 3 &&
          rect.bottom <= bounds.bottom - border - 3 &&
          rect.left >= bounds.left + border + 3 &&
          rect.right <= bounds.right - border - 3 &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight,
      };
    });
  const checkLayouts = async (action: 'begin' | 'continue') => {
    const primary = page.locator(`.welcome-card [data-action="${action}"]`);
    await expect(primary).toBeFocused();
    for (const layout of layouts) {
      await page.setViewportSize(layout);
      await writeFile(
        info.outputPath(`welcome-${action}-${layout.width}x${layout.height}.json`),
        JSON.stringify(await focusedVisible(), null, 2),
      );
      await expect.poll(async () => (await focusedVisible()).visible).toBe(true);
      await expect(primary).toBeFocused();
      if (action === 'begin' && layout.width >= 480 && layout.height <= 420) {
        const menu = await page.locator('.welcome-card').evaluate((card) => {
          const bounds = card.getBoundingClientRect();
          const nodes = ['.welcome-brand', '.primary-button', '.welcome-saves'].map((selector) => {
            const node = card.querySelector<HTMLElement>(selector)!;
            const rect = node.getBoundingClientRect();
            return {
              selector,
              top: rect.top,
              bottom: rect.bottom,
              height: rect.height,
              visible: rect.top >= bounds.top + 8 && rect.bottom <= bounds.bottom - 8,
            };
          });
          return {
            nodes,
            textSize: parseFloat(getComputedStyle(card.querySelector('.welcome-copy')!).fontSize),
          };
        });
        await writeFile(
          info.outputPath(`welcome-menu-${layout.width}x${layout.height}.json`),
          JSON.stringify(menu, null, 2),
        );
        expect(menu.textSize).toBeGreaterThanOrEqual(13);
        for (const node of menu.nodes) {
          expect(node.visible, node.selector).toBe(true);
          if (node.selector !== '.welcome-brand') expect(node.height).toBeGreaterThanOrEqual(44);
        }
      }
      await page.screenshot({
        path: info.outputPath(`welcome-${action}-${layout.width}x${layout.height}.png`),
        scale: 'css',
      });
    }
  };
  await checkLayouts('begin');
  await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await settled(page);
  const remembered = await exported(page);
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.reload();
  await expect(page.locator('.welcome-saves')).toHaveCSS('opacity', '1');
  await checkLayouts('continue');
  const recap = page.locator('.welcome-recap summary');
  await page.keyboard.press('Shift+Tab');
  await expect(recap).toBeFocused();
  await page.setViewportSize({ width: 568, height: 320 });
  await expect.poll(async () => (await focusedVisible()).visible).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.welcome-recap details')).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 844, height: 300 });
  await expect(recap).toBeFocused();
  await expect.poll(async () => (await focusedVisible()).visible).toBe(true);
  await page.keyboard.press('Shift+Tab');
  const saves = page.getByRole('button', { name: 'Saves & settings' });
  await expect(saves).toBeFocused();
  await page.setViewportSize({ width: 607, height: 740 });
  await expect.poll(async () => (await focusedVisible()).visible).toBe(true);
  await expect(saves).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(recap).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.welcome-card [data-action="continue"]')).toBeFocused();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => (await focusedVisible()).visible).toBe(true);
  await page.getByRole('button', { name: 'Continue your journey', exact: true }).click();
  await settled(page);
  const resumed = await exported(page);
  expect({ ...resumed, playTime: 0 }).toEqual({ ...remembered, playTime: 0 });
});

test('a still welcome view leaves rendering time for controls and resumes its live backdrop', async ({
  page,
}, info) => {
  const models: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.glb')) models.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-title', 'true');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  const animated = await welcomeDrawing(page);
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  const still = await welcomeDrawing(page);
  await writeFile(
    info.outputPath('welcome-drawing.json'),
    JSON.stringify({ animated, still }, null, 2),
  );
  expect(still.painted).toBeGreaterThanOrEqual(2);
  expect(still.painted).toBeLessThanOrEqual(Math.ceil(still.elapsedMs / 100) + 1);
  expect(animated.painted).toBeGreaterThan(still.painted * 2);
  // The still canvas continues repainting after orientation and panel-size changes.
  await page.setViewportSize({ width: 568, height: 320 });
  const resized = await welcomeDrawing(page);
  expect(resized.painted).toBeGreaterThanOrEqual(2);
  expect(resized.painted).toBeLessThanOrEqual(Math.ceil(resized.elapsedMs / 100) + 1);
  await page.screenshot({ path: info.outputPath('opening-still-landscape.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="reducedMotion"]').uncheck();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  const resumed = await welcomeDrawing(page);
  expect(resumed.painted).toBeGreaterThan(resized.painted * 2);
  const pixels = await worldPixels(page);
  expect(pixels.lost).toBe(false);
  expect(pixels.error).toBe(0);
  expect(pixels.opaque).toBeGreaterThan(0.95);
  expect(pixels.colors).toBeGreaterThan(20);
  expect(pixels.colored).toBeGreaterThan(0.5);
  expect(models).toEqual([]);
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-region', /.+/);
});

test('a first journey opens with a skippable cold open, then a veiled arrival and a title card', async ({
  page,
}, info) => {
  await asPlayer(page);
  const models: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.glb')) models.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-title', 'true');
  await expect(page.locator('.welcome-card')).toHaveCSS('opacity', '1');
  await expect(page.locator('.welcome-saves')).toHaveCSS('opacity', '1');
  const pixels = await worldPixels(page);
  expect(pixels.lost).toBe(false);
  expect(pixels.error).toBe(0);
  expect(pixels.opaque).toBeGreaterThan(0.95);
  expect(pixels.colors).toBeGreaterThan(20);
  expect(pixels.colored).toBeGreaterThan(0.5);
  await writeFile(info.outputPath('welcome-pixels.json'), JSON.stringify(pixels, null, 2));
  await page.screenshot({ path: info.outputPath('opening-welcome.png'), scale: 'css' });
  expect(models).toEqual([]);
  // Like the other journeys, this flow runs at Low so software-rendered CI can keep pace.
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
  const opening = page.getByRole('dialog', { name: 'Opening' });
  await expect(opening).toBeVisible();
  await expect(opening.locator('.cold-open-provenance')).toContainText('Original narration');
  await expect(page.locator('.cold-open-skip')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.cold-open-continue')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.cold-open-skip')).toBeFocused();
  await page.locator('.cold-open-continue').click();
  await page.locator('.cold-open-skip').click();
  await expect(opening).toHaveCount(0);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await settled(page);
  // The title card announces the place but never intercepts the world or HUD.
  await expect
    .poll(() => shownCards(page))
    .toContainEqual({ text: expect.stringContaining('Capernaum'), pointerEvents: 'none' });
  await expect(page.locator('.veil')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-title');
  await page.locator('#game-canvas').press('F3');
  await expect(
    page.locator('.diagnostics-table tr').filter({ hasText: 'Scenes' }).locator('td'),
  ).toHaveText('1');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  // Returning players continue straight into their journey.
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('.cold-open')).toHaveCount(0);
});

test('chapter title announcements stay connected and polite without moving keyboard focus', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const arrivals: { text: string; connected: boolean; focused: string | undefined }[] = [];
    (window as unknown as { __announcedArrivals: typeof arrivals }).__announcedArrivals = arrivals;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement) || !node.classList.contains('chapter-card')) continue;
          const live = document.querySelector<HTMLElement>(
            '#ui > .chapter-card-live[role="status"][aria-live="polite"]',
          );
          arrivals.push({
            text: live?.textContent ?? '',
            connected: live?.isConnected ?? false,
            focused: (document.activeElement as HTMLElement | null)?.id,
          });
        }
    }).observe(document, { childList: true, subtree: true });
  });
  await ready(page);
  // Record entry rather than racing the title's wall-clock fade on slow software WebGL.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __announcedArrivals: { text: string; connected: boolean; focused?: string }[];
            }
          ).__announcedArrivals,
      ),
    )
    .toContainEqual({
      text: expect.stringContaining('Capernaum'),
      connected: true,
      focused: 'game-canvas',
    });
  const live = page.locator('#ui > .chapter-card-live');
  await expect(live).toHaveCount(1);
  await expect(live).toHaveAttribute('role', 'status');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toContainText('Capernaum');
  const journal = page.locator('.toolbar [data-action="journal"]');
  await journal.focus();
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(journal).toBeFocused();
  // Removing the noninteractive title leaves its live announcement connected to the UI.
  await expect(live).toContainText('Capernaum');
  await expect(live).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Settings replays the opening; Escape leaves it and reduced motion shows still cards', async ({
  page,
}) => {
  await asPlayer(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('[data-action="replay-opening"]').click();
  const opening = page.getByRole('dialog', { name: 'Opening' });
  await expect(opening).toBeVisible();
  await expect(page.locator('.cold-open')).toHaveClass(/is-reduced/);
  await page.keyboard.press('Escape');
  await expect(opening).toHaveCount(0);
  // Watching the opening does not start or change a journey.
  await expect(page.getByRole('button', { name: 'Begin your journey', exact: true })).toBeVisible();
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-region', /.+/);
});
