import { test, expect, type Page } from '@playwright/test';
import { ready, dismiss, exported, readableContrast } from '../helpers/connection-browser';
import { arrangedShelter, chosenShelter } from '../helpers/galilee';

async function phoneControls(page: Page) {
  const controls = await page
    .locator(
      '.toolbar button, .camera-controls button, .minimap-compass, .minimap-open, .control-hints button',
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return {
          name: element.getAttribute('aria-label') ?? element.getAttribute('title'),
          x,
          y,
          width,
          height,
          viewport: { width: innerWidth, height: innerHeight },
        };
      }),
    );
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.x).toBeGreaterThanOrEqual(0);
    expect(control.y).toBeGreaterThanOrEqual(0);
    expect(control.x + control.width).toBeLessThanOrEqual(control.viewport.width);
    expect(control.y + control.height).toBeLessThanOrEqual(control.viewport.height);
  }
  for (let i = 0; i < controls.length; i++) {
    for (const other of controls.slice(i + 1)) {
      const control = controls[i]!;
      const overlap =
        control.x < other.x + other.width &&
        control.x + control.width > other.x &&
        control.y < other.y + other.height &&
        control.y + control.height > other.y;
      expect(overlap, `${control.name} overlaps ${other.name}`).toBe(false);
    }
  }
}

test('low graphics stays sharp on phones after resize and restores the desktop pixel budget', async ({
  page,
}, info) => {
  await ready(page);
  const width = () =>
    page.locator('#game-canvas').evaluate((el) => (el as HTMLCanvasElement).width);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(width).toBe(390);
  await phoneControls(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(width)
    .toBe(info.project.name === 'mobile-chromium' ? 844 : Math.floor(844 / 1.5));
  await phoneControls(page);
  await page.setViewportSize({ width: 844, height: 300 });
  await expect
    .poll(width)
    .toBe(info.project.name === 'mobile-chromium' ? 844 : Math.floor(844 / 1.5));
  await phoneControls(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(width).toBe(info.project.name === 'mobile-chromium' ? 1440 : 960);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(width).toBe(320);
  await phoneControls(page);
});

test('long objectives and nearby work stay separate in short landscapes', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const quest = page.locator('.quest-card');
  const objective = quest.locator('.current-objective');
  const original = await objective.textContent();
  const separate = async () => {
    const rectangles = await page
      .locator('.topbar, .quest-card, .bottom-center, .minimap-wrap')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { name: node.className, x, y, width, height };
        }),
      );
    const viewport = page.viewportSize()!;
    for (const rect of rectangles) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    }
    for (let i = 0; i < rectangles.length; i++) {
      const first = rectangles[i]!;
      for (const other of rectangles.slice(i + 1)) {
        const overlap =
          first.x < other.x + other.width &&
          first.x + first.width > other.x &&
          first.y < other.y + other.height &&
          first.y + first.height > other.y;
        expect(overlap, `${first.name} overlaps ${other.name}`).toBe(false);
      }
    }
  };
  for (const size of [
    { width: 480, height: 320 },
    { width: 520, height: 300 },
    { width: 568, height: 320 },
    { width: 667, height: 375 },
    { width: 690, height: 300 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await separate();
    await phoneControls(page);
    const follow = quest.getByRole('button', { name: 'Follow the path', exact: true });
    await expect(follow).toBeInViewport();
    const followBox = (await follow.boundingBox())!;
    const cardBox = (await quest.boundingBox())!;
    expect(followBox.width).toBeGreaterThanOrEqual(44);
    expect(followBox.height).toBeGreaterThanOrEqual(44);
    expect(followBox.y + followBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
    expect((await quest.locator('.objective-toggle').boundingBox())!.height).toBeGreaterThanOrEqual(
      44,
    );
    await page.screenshot({
      path: info.outputPath(`long-objective-${size.width}.png`),
      scale: 'css',
    });
    const collapsed = (await objective.boundingBox())!.height;
    await quest.getByRole('button', { name: 'Show steps', exact: true }).click();
    await expect(objective).toHaveText(original!);
    if (size.height <= 420)
      expect((await objective.boundingBox())!.height).toBeGreaterThan(collapsed);
    await separate();
    await quest.getByRole('button', { name: 'Hide steps', exact: true }).click();
    await expect(follow).toBeInViewport();
    const tray = page.locator('#action-tray');
    for (const action of await tray.getByRole('button').all()) {
      await action.scrollIntoViewIfNeeded();
      const button = (await action.boundingBox())!;
      const surface = (await tray.boundingBox())!;
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.y).toBeGreaterThanOrEqual(surface.y);
      expect(button.y + button.height).toBeLessThanOrEqual(surface.y + surface.height);
      await expect(action).toBeInViewport({ ratio: 1 });
    }
    await tray.evaluate((element) => (element.scrollTop = 0));
  }
  const saved = await exported(page);
  expect(saved.galilee).toEqual(state.galilee);
  expect(saved.position).toEqual(state.position);
});

test('landscape feedback makes room for actions and returns to the overlay for menus', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  for (const size of [
    { width: 480, height: 320 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    const save = await exported(page);
    expect(save.galilee).toEqual(state.galilee);
    expect(save.position).toEqual(state.position);
    // Feedback must stay outside the inert HUD while its menu is open.
    await expect(page.locator('#toast')).toBeVisible();
    expect(await page.locator('#toast').evaluate((notice) => !!notice.closest('[inert]'))).toBe(
      false,
    );
    await dismiss(page);
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(page.locator('.hud-actions > #toast')).toHaveCount(size.height <= 420 ? 1 : 0);
    const bounds = await toast.evaluate((notice) => {
      const rect = notice.getBoundingClientRect();
      const overlaps = [
        ...document.querySelectorAll(
          '.topbar,.quest-card,.minimap-wrap,.minimap-compass,#action-tray,.control-hints,#travel-status:not([hidden])',
        ),
      ]
        .filter((node) => (node as HTMLElement).offsetHeight > 0)
        .filter((node) => {
          const control = node.getBoundingClientRect();
          return (
            rect.left < control.right &&
            rect.right > control.left &&
            rect.top < control.bottom &&
            rect.bottom > control.top
          );
        })
        .map((node) => node.id || node.className);
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, overlaps };
    });
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(size.width);
    expect(bounds.bottom).toBeLessThanOrEqual(size.height);
    expect(bounds.overlaps).toEqual([]);
    if (size.width < 700 || size.height <= 540 || info.project.name === 'mobile-chromium')
      await phoneControls(page);
    await page.screenshot({ path: info.outputPath(`feedback-${size.width}.png`), scale: 'css' });
    const tray = page.locator('#action-tray');
    const lastAction = tray.getByRole('button').last();
    await lastAction.scrollIntoViewIfNeeded();
    const action = (await lastAction.boundingBox())!;
    const surface = (await tray.boundingBox())!;
    expect(action.y).toBeGreaterThanOrEqual(surface.y);
    expect(action.y + action.height).toBeLessThanOrEqual(surface.y + surface.height);
    await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
    await expect(page.locator('#toast')).toBeHidden();
    await expect(page.locator('.message-list li').first()).toContainText(
      'Journey exported. Keep the file somewhere safe.',
    );
    await dismiss(page);
    await expect(toast).toBeHidden();
  }
});

test('saved routes keep touch controls and nearby work reachable in compact landscapes', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  state.connection.route = { target: 'spring-source' };
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const resume = page.getByRole('button', { name: 'Resume route', exact: true });
  await expect(resume).toBeEnabled();
  const touch =
    info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : undefined;
  for (const size of [
    { width: 480, height: 320 },
    { width: 520, height: 300 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const saved = await exported(page);
    expect(saved.connection.route).toEqual(state.connection.route);
    expect(saved.galilee).toEqual(state.galilee);
    expect(saved.position).toEqual(state.position);
    await dismiss(page);
    await expect(page.locator('#toast')).toBeVisible();
    await phoneControls(page);
    const column = page.locator('.bottom-center');
    const box = (await column.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    const actions = page.locator('.hud-actions');
    const cue = page.locator('.action-scroll-cue');
    await actions.evaluate((element) => (element.scrollTop = 0));
    if (size.height <= 420) {
      await expect(cue).toBeVisible();
      await expect(cue).toContainText('↓');
      await readableContrast(page, '.action-scroll-cue');
    } else await expect(cue).toBeHidden();
    if (touch && size.width === 480) {
      const surface = (await actions.boundingBox())!;
      const point = {
        id: 1,
        x: surface.x + surface.width / 2,
        y: surface.y + surface.height * 0.85,
      };
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      for (let step = 1; step <= 8; step++) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ ...point, y: point.y - step * surface.height * 0.06 }],
        });
        await page.waitForTimeout(20);
      }
      // A deliberate scroll ends at rest, rather than flinging through the next inspection.
      await page.waitForTimeout(80);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => actions.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(resume).toBeEnabled();
    }
    const candidates = page.locator('#travel-status button:not([hidden]), #action-tray button');
    for (const button of await candidates.all()) {
      await button.scrollIntoViewIfNeeded();
      const target = (await button.boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    if (size.height <= 420) await expect(cue).toContainText('↑');
    await actions.evaluate((element) => (element.scrollTop = 0));
    await page.screenshot({ path: info.outputPath(`saved-route-${size.width}.png`), scale: 'css' });
    await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
    await expect(page.locator('.message-list')).toContainText('Journey exported');
    await dismiss(page);
    await expect(page.locator('#toast')).toBeHidden();
    await resume.scrollIntoViewIfNeeded();
    await expect(resume).toBeInViewport({ ratio: 1 });
  }
  await touch?.detach();
});
