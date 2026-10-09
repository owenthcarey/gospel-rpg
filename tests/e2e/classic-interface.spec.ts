import { test, expect, type Page, type Locator } from '@playwright/test';
import { ready, settled, exported, dismiss, visit } from '../helpers/connection-browser';

/** Observe the actual rendered flash during the action; CPU WebGL can outlast its 400 ms lifetime. */
async function markerDuring(page: Page, action: () => Promise<unknown>, kind: 'ground' | 'object') {
  const flash = page.locator('.world-click-feedback');
  await flash.evaluate((element) => {
    const watched = element as HTMLElement & {
      markerEvents?: string[];
      markerObserver?: MutationObserver;
    };
    watched.markerEvents = [];
    watched.markerObserver = new MutationObserver(() => {
      if (
        !watched.hidden &&
        getComputedStyle(watched).display !== 'none' &&
        watched.getBoundingClientRect().width > 0
      )
        watched.markerEvents!.push(watched.dataset.kind!);
    });
    watched.markerObserver.observe(watched, {
      attributes: true,
      attributeFilter: ['hidden', 'data-kind'],
    });
  });
  try {
    await action();
    await expect
      .poll(() =>
        flash.evaluate(
          (element) => (element as HTMLElement & { markerEvents?: string[] }).markerEvents,
        ),
      )
      .toContain(kind);
  } finally {
    await flash.evaluate((element) => {
      const watched = element as HTMLElement & {
        markerEvents?: string[];
        markerObserver?: MutationObserver;
      };
      watched.markerObserver?.disconnect();
      delete watched.markerObserver;
      delete watched.markerEvents;
    });
  }
}

async function center(target: Locator) {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Sample both visible landmarks in the same rendered layout; a hidden label is unavailable. */
async function landmarkSpan(page: Page, first: string, second: string) {
  return page.evaluate(
    (ids) => {
      const boxes = ids.map((id) => {
        const label = document.querySelector<HTMLElement>(`.world-label[data-value="${id}"]`);
        if (!label || label.hidden) return null;
        const box = label.getBoundingClientRect();
        return box.width > 0 && box.height > 0 ? box : null;
      });
      const [a, b] = boxes;
      return a && b
        ? Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2)
        : 0;
    },
    [first, second],
  );
}

async function touchContact(page: Page) {
  const session = await page.context().newCDPSession(page);
  // Babylon caches touch capacity at engine creation; Chromium's default phone emulation has one.
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  return {
    send: (
      type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
      points: { id: number; x: number; y: number }[],
    ) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points }),
    dispose: () => session.detach(),
  };
}

async function bareGround(page: Page, margin = 0) {
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const box = (await page.locator('#game-canvas').boundingBox())!;
  for (const [u, v] of [
    [0.35, 0.55],
    [0.5, 0.55],
    [0.65, 0.55],
    [0.5, 0.7],
    [0.35, 0.7],
  ]) {
    const point = { x: box.x + box.width * u!, y: box.y + box.height * v! };
    if (
      margin &&
      !(await page.evaluate(
        ({ point, margin }) =>
          Array.from({ length: Math.ceil((margin * 2) / 5) + 1 }, (_, i) => -margin + i * 5).every(
            (dx) =>
              document.elementFromPoint(point.x + dx, point.y) ===
              document.querySelector('#game-canvas'),
          ),
        { point, margin },
      ))
    )
      continue;
    await page.mouse.click(point.x, point.y, { button: 'right' });
    if (!(await menu.isVisible())) continue;
    const options = await menu.getByRole('menuitem').allTextContents();
    await menu.getByRole('menuitem', { name: 'Cancel' }).click();
    // Unpickable scenery in front may add Examine; a tap there still walks to the ground.
    const extra = options.slice(1, -1);
    if (
      options[0] === 'Walk here' &&
      options.at(-1) === 'Cancel' &&
      extra.length <= 1 &&
      extra.every((option) => option.startsWith('Examine '))
    )
      return point;
  }
  throw new Error('A visible bare-ground pick is required');
}

test('Choose Option approaches an existing person and cancels without changing the story', async ({
  page,
}) => {
  await ready(page);
  const simon = page.locator('.world-label[data-value="simon"]');
  await simon.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Talk-to Simon' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Walk here' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(simon).toBeFocused();
  await simon.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-canvas')).toBeFocused();
  await simon.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Talk-to Simon' }).click();
  await expect(page.getByRole('dialog')).toContainText('Simon');
  await settled(page);
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});

test('right drags orbit without opening an option menu and menus fit short viewports', async ({
  page,
}, info) => {
  await ready(page);
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const point = await bareGround(page);
  const bearing = () =>
    page
      .locator('.minimap-wrap')
      .evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue('--map-bearing')));
  for (const button of ['right', 'middle'] as const) {
    const before = await bearing();
    await page.mouse.move(point.x, point.y);
    await page.mouse.down({ button });
    await page.mouse.move(point.x + 72, point.y + 18, { steps: 8 });
    await page.mouse.up({ button });
    await expect.poll(async () => Math.abs((await bearing()) - before)).toBeGreaterThan(1);
    await expect(menu).toBeHidden();
  }
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(point.x + 30, point.y + 15, { steps: 5 });
  await page.mouse.move(point.x, point.y, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await expect(menu).toBeHidden();
  if (info.project.name === 'mobile-chromium')
    await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('.world-label[data-value="simon"]').click({ button: 'right' });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await menu.getByRole('menuitem', { name: 'Cancel' }).click();
  await expect(menu).toBeHidden();
  // The hover phase needs a still camera after the independent native orbit checks.
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.waitForTimeout(150);
  await page.locator('.world-label[data-value="simon"]').hover();
  await expect(page.locator('.world-action-hint')).toContainText('Talk-to Simon');
  await expect(page.locator('.world-action-hint')).toBeVisible();
  await page.locator('#game-canvas').focus();
  // Orbit is sampled by the render loop; hold the key until the camera actually moves.
  await page.keyboard.down('q');
  await expect(page.locator('.world-action-hint')).toBeHidden();
  await page.keyboard.up('q');
});

test('wheel zoom takes over a returning camera and stays quiet behind the journal', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium', 'Wheel handoff is shared by the camera input');
  await ready(page);
  const simon = page.locator('.world-label[data-value="simon"]');
  const span = () => landmarkSpan(page, 'simon', 'miriam');
  await visit(page, 'simon');
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  await page.waitForTimeout(850);
  const originalSpan = await span();
  const position = await page.locator('#minimap-player').getAttribute('transform');
  await simon.click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-conversation', 'simon');
  // Inject the real DOM wheel at the first close checkpoint, before any return frame.
  // Separate browser commands can outlast the entire 700 ms animation on software WebGL.
  await page.getByRole('button', { name: 'Leave conversation' }).evaluate(
    (button) =>
      new Promise<void>((resolve) => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
        const overlay = document.querySelector('#overlay')!;
        const observer = new MutationObserver(() => {
          if (overlay.childElementCount) return;
          observer.disconnect();
          canvas.dispatchEvent(
            new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -240 }),
          );
          resolve();
        });
        observer.observe(overlay, { childList: true });
        (button as HTMLButtonElement).click();
      }),
  );
  await page.waitForTimeout(850);
  await expect.poll(async () => (await span()) / originalSpan).toBeGreaterThan(1.08);
  const zoomedSpan = await span();
  const point = await bareGround(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 160);
  await expect.poll(async () => (await span()) / zoomedSpan).toBeLessThan(0.96);
  // Let the accepted wheel's inertia settle before checking a separate paused input.
  await page.waitForTimeout(650);
  const pausedSpan = await span();
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -360 }),
    );
  });
  await dismiss(page);
  await page.waitForTimeout(850);
  expect((await span()) / pausedSpan).toBeCloseTo(1, 2);
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', position!);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});

test('phone two-finger gestures rotate and pinch while rejecting world actions', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'mobile-chromium',
    'Native camera gestures use the phone project',
  );
  const touch = await touchContact(page);
  await ready(page);
  await page.setViewportSize({ width: 844, height: 390 });
  const simon = page.locator('.world-label[data-value="simon"]');
  await simon.click({ trial: true });
  const point = await bareGround(page, 95);
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const flash = page.locator('.world-click-feedback');
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const bearing = () =>
    page
      .locator('.minimap-wrap')
      .evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue('--map-bearing')));
  const first = { id: 1, x: point.x - 25, y: point.y };
  const second = { id: 2, x: point.x + 25, y: point.y };
  const before = await bearing();
  await touch.send('touchStart', [first]);
  await touch.send('touchStart', [first, second]);
  for (const dx of [12, 24, 36, 48]) {
    await touch.send('touchMove', [
      { ...first, x: first.x + dx },
      { ...second, x: second.x + dx },
    ]);
  }
  await touch.send('touchEnd', []);
  await expect.poll(async () => Math.abs((await bearing()) - before)).toBeGreaterThan(1);
  await expect(menu).toBeHidden();
  await expect(flash).toBeHidden();
  await expect(player).toHaveAttribute('transform', position!);
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await simon.click({ trial: true });
  // The separation of two projected landmarks increases when the camera zooms in.
  const span = () => landmarkSpan(page, 'simon', 'eliab');
  await expect
    .poll(span, { message: 'Both fixed pinch landmarks must be visible' })
    .toBeGreaterThan(0);
  const originalSpan = await span();
  await touch.send('touchStart', [first]);
  await touch.send('touchStart', [first, second]);
  for (const spread of [2, 4, 6, 8]) {
    await touch.send('touchMove', [
      { ...first, x: first.x - spread },
      { ...second, x: second.x + spread },
    ]);
  }
  await touch.send('touchEnd', []);
  await expect.poll(async () => (await span()) / originalSpan).toBeGreaterThan(1.025);
  await expect(menu).toBeHidden();
  await expect(flash).toBeHidden();
  await expect(player).toHaveAttribute('transform', position!);
  await touch.dispose();
});

test('accepted walks and object actions get distinct markers while drags and held presses stay quiet', async ({
  page,
}, info) => {
  await ready(page);
  const flash = page.locator('.world-click-feedback');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const canvas = page.locator('#game-canvas');
  const box = (await canvas.boundingBox())!;
  let ground: { x: number; y: number } | undefined;
  // Find bare ground through the shipped picking/menu path, rather than reaching into the scene.
  for (const [u, v] of [
    [0.35, 0.55],
    [0.5, 0.55],
    [0.65, 0.55],
    [0.5, 0.7],
    [0.35, 0.7],
  ]) {
    const point = { x: box.x + box.width * u!, y: box.y + box.height * v! };
    await page.mouse.click(point.x, point.y, { button: 'right' });
    if (!(await menu.isVisible())) continue;
    const options = await menu.getByRole('menuitem').allTextContents();
    await menu.getByRole('menuitem', { name: 'Cancel' }).click();
    if (options.length === 2 && options[0] === 'Walk here') {
      ground = point;
      break;
    }
  }
  expect(ground, 'a visible bare-ground pick is required').toBeDefined();
  const point = ground!;
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(flash).toBeHidden();
  await markerDuring(page, () => page.mouse.up(), 'ground');
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(flash).toBeHidden();

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 24, point.y + 10, { steps: 3 });
  await page.mouse.move(point.x, point.y, { steps: 3 });
  await page.mouse.up();
  await expect(flash).toBeHidden();

  const before = await page.locator('#minimap-player').getAttribute('transform');
  await page.mouse.down();
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await settled(page);
  await page.mouse.up();
  // Observe several rendered frames after the stale release, beyond the marker's lifetime.
  await page.waitForTimeout(600);
  await expect(flash).toBeHidden();
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', before!);

  if (info.project.name === 'mobile-chromium') {
    const nativeGround = await bareGround(page);
    await markerDuring(page, () => page.touchscreen.tap(nativeGround.x, nativeGround.y), 'ground');
    await page.keyboard.press('j');
    await page.keyboard.press('Escape');
    await settled(page);
  }
  // Accepted walks can move Simon outside a narrow phone view. Approach him through
  // the existing map before testing label releases, rather than assuming the first camera remains.
  await visit(page, 'simon');
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  await page.waitForTimeout(850);
  const simon = page.locator('.world-label[data-value="simon"]');
  await expect(simon).toBeVisible();
  const beforeLabel = await page.locator('#minimap-player').getAttribute('transform');
  const labelBox = (await simon.boundingBox())!;
  const labelPoint = {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + labelBox.height / 2,
  };
  await page.mouse.move(labelPoint.x, labelPoint.y);
  await page.mouse.down();
  await page.keyboard.press('j');
  await page.keyboard.press('Escape');
  await settled(page);
  await page.mouse.up();
  await page.waitForTimeout(600);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(flash).toBeHidden();
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', beforeLabel!);
  await simon.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Cancel' }).click();
  await expect(flash).toBeHidden();
  if (info.project.name === 'mobile-chromium') {
    const touchBox = (await simon.boundingBox())!;
    await markerDuring(
      page,
      () => page.touchscreen.tap(touchBox.x + touchBox.width / 2, touchBox.y + touchBox.height / 2),
      'object',
    );
  } else await markerDuring(page, () => simon.click(), 'object');
  await expect(page.getByRole('dialog')).toContainText('Simon');
  await settled(page);
});

test('phone holds open Choose Option without activating the release and keep intentional options usable', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Native touch holds use the phone project');
  const touch = await touchContact(page);
  await ready(page);
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const flash = page.locator('.world-click-feedback');
  const player = page.locator('#minimap-player');
  const simon = page.locator('.world-label[data-value="simon"]');
  const before = await player.getAttribute('transform');
  const hold = { id: 1, ...(await center(simon)) };
  await touch.send('touchStart', [hold]);
  await expect(menu).toBeHidden();
  await expect(menu).toBeVisible();
  await touch.send('touchEnd', []);
  // Watch rendered frames after Chrome's synthesized compatibility click and the flash lifetime.
  await page.waitForTimeout(600);
  await expect(menu).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(flash).toBeHidden();
  await expect(player).toHaveAttribute('transform', before!);
  const item = menu.getByRole('menuitem', { name: 'Talk-to Simon' });
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const cancel = await center(menu.getByRole('menuitem', { name: 'Cancel' }));
  await page.touchscreen.tap(cancel.x, cancel.y);
  await expect(menu).toBeHidden();
  await expect(simon).toBeFocused();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.waitForTimeout(150);
  // Wait for the frame-positioned world label to settle after the camera aspect changes.
  await simon.click({ trial: true });
  await touch.send('touchStart', [{ id: 1, ...(await center(simon)) }]);
  await expect(menu).toBeVisible();
  await touch.send('touchEnd', []);
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(836);
  expect(box.y + box.height).toBeLessThanOrEqual(382);
  const talk = await center(menu.getByRole('menuitem', { name: 'Talk-to Simon' }));
  await page.touchscreen.tap(talk.x, talk.y);
  await expect(menu).toBeHidden();
  await expect(page.getByRole('dialog')).toContainText('Simon');
  await settled(page);
  await touch.dispose();
});

test('phone ground holds wait for an explicit Walk here option', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Native touch holds use the phone project');
  const touch = await touchContact(page);
  await ready(page);
  const point = await bareGround(page);
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const flash = page.locator('.world-click-feedback');
  const before = await page.locator('#minimap-player').getAttribute('transform');
  await touch.send('touchStart', [{ id: 1, ...point }]);
  await expect(menu).toBeVisible();
  await touch.send('touchEnd', []);
  await page.waitForTimeout(600);
  await expect(menu).toBeVisible();
  await expect(flash).toBeHidden();
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', before!);
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await expect(menu.getByRole('menuitem', { name: 'Walk here' })).toBeFocused();
  const walk = await center(menu.getByRole('menuitem', { name: 'Walk here' }));
  await markerDuring(page, () => page.touchscreen.tap(walk.x, walk.y), 'ground');
  await expect(menu).toBeHidden();
  await touch.dispose();
});

test('phone holds reject drags, mixed-surface pinches, cancellation and paused releases', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Native touch holds use the phone project');
  const touch = await touchContact(page);
  await ready(page);
  const point = await bareGround(page);
  const simon = page.locator('.world-label[data-value="simon"]');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const flash = page.locator('.world-click-feedback');
  const player = page.locator('#minimap-player');
  const before = await player.getAttribute('transform');
  const quiet = async () => {
    await page.waitForTimeout(650);
    await expect(menu).toBeHidden();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(flash).toBeHidden();
    await expect(player).toHaveAttribute('transform', before!);
  };
  const first = { id: 1, ...point };
  await touch.send('touchStart', [first]);
  await touch.send('touchMove', [{ ...first, x: first.x + 26 }]);
  await touch.send('touchMove', [first]);
  await page.waitForTimeout(550);
  await touch.send('touchEnd', []);
  await quiet();

  for (const secondTarget of [simon, page.locator('.toolbar [data-action="journal"]')]) {
    const second = { id: 2, ...(await center(secondTarget)) };
    await touch.send('touchStart', [first]);
    await touch.send('touchStart', [first, second]);
    // Releasing the first contact must not let the second become a fresh tap or hold.
    await touch.send('touchEnd', [second]);
    await page.waitForTimeout(550);
    await touch.send('touchEnd', []);
    await quiet();
  }
  const label = { id: 1, ...(await center(simon)) };
  const second = { id: 2, ...point };
  await touch.send('touchStart', [label]);
  await touch.send('touchStart', [label, second]);
  await touch.send('touchEnd', [second]);
  await touch.send('touchEnd', []);
  await quiet();
  await touch.send('touchStart', [label]);
  await touch.send('touchCancel', []);
  await quiet();
  await touch.send('touchStart', [label]);
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await settled(page);
  await touch.send('touchEnd', []);
  await quiet();
  // After the rejected sequence ends, an ordinary short touch still uses the default action.
  const tap = await center(simon);
  await page.touchscreen.tap(tap.x, tap.y);
  await expect(page.getByRole('dialog')).toContainText('Simon');
  await settled(page);
  await touch.dispose();
});
