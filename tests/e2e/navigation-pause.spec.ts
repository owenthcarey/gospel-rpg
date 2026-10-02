import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';

const status = '#travel-status';
const resume = status + ' [data-action="route-resume"]';
const cancel = status + ' [data-action="cancel-navigation"]';
const flag = '.minimap-destination';

async function savedRoute(page: Page, narrow: boolean) {
  if (narrow) await page.setViewportSize({ width: 320, height: 568 });
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v3-complete-village.json', 'utf8')),
  ).state;
  state.connection.route = { target: 'olive' };
  await ready(page, state);
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  return state;
}

async function navigation(page: Page) {
  return page.locator(status).evaluate((node) => {
    const element = node as HTMLElement;
    const resume = element.querySelector<HTMLButtonElement>('[data-action="route-resume"]')!;
    const cancel = element.querySelector<HTMLButtonElement>('[data-action="cancel-navigation"]')!;
    const flag = document.querySelector<SVGElement>('.minimap-destination');
    return {
      visible: !element.hidden,
      text: element.querySelector('span')!.textContent,
      resumeVisible: !resume.hidden,
      resumeDisabled: resume.disabled,
      cancelDisabled: cancel.disabled,
      flagVisible: !!flag && getComputedStyle(flag).display !== 'none',
      graphicsPaused: document.querySelector<HTMLElement>('#ui')!.dataset.graphicsPaused,
    };
  });
}

async function startRoute(page: Page) {
  await page.locator(resume).click();
  await settled(page);
  await expect(page.locator(status)).toContainText('Approaching Olive grove');
  await expect(page.locator(flag)).toBeVisible();
}

async function graphicsLoss(page: Page) {
  const extension = await page.locator('#game-canvas').evaluateHandle((node) => {
    const canvas = node as HTMLCanvasElement;
    return (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))!.getExtension(
      'WEBGL_lose_context',
    );
  });
  expect(await extension.evaluate((value) => !!value)).toBe(true);
  await extension.evaluate((value) => value!.loseContext());
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'true');
  return extension;
}

test('permitted route cancellation during real graphics loss clears approaching feedback without changing earned progress', async ({
  page,
  isMobile,
}, info) => {
  await savedRoute(page, isMobile);
  await startRoute(page);
  const approaching = await navigation(page);
  const extension = await graphicsLoss(page);
  try {
    const paused = await navigation(page);
    const before = await exported(page);
    expect(before.connection.route).toEqual({ target: 'olive' });
    await dismiss(page);
    await expect(page.locator(cancel)).toBeEnabled();
    await page.locator(cancel).click();
    await settled(page);
    const cancelled = await navigation(page);
    await page.screenshot({ path: info.outputPath('cancelled-paused-route.png'), scale: 'css' });
    const saved = await exported(page);
    const expected = structuredClone(before);
    expected.connection.route = null;
    expected.playTime = saved.playTime;
    expect(saved).toEqual(expected);
    await writeFile(
      info.outputPath('paused-route-cancellation.json'),
      JSON.stringify({ approaching, paused, cancelled, before, saved }, null, 2),
    );
    // Prove the native, enabled command changed state before checking its visible result.
    expect(cancelled.visible).toBe(false);
    expect(cancelled.flagVisible).toBe(false);
    expect(paused.text).not.toContain('Approaching');
    expect(paused.flagVisible).toBe(false);
    expect(paused.resumeVisible).toBe(true);
    expect(paused.resumeDisabled).toBe(true);
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await dismiss(page);
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
  await expect(page.locator(status)).toBeHidden();
  await expect(page.locator(flag)).toBeHidden();
});

test('an interrupted saved route waits for deliberate Resume after graphics restoration and clears feedback on arrival', async ({
  page,
  isMobile,
}, info) => {
  const initial = await savedRoute(page, isMobile);
  await startRoute(page);
  const extension = await graphicsLoss(page);
  let interrupted: Awaited<ReturnType<typeof exported>>;
  try {
    const paused = await navigation(page);
    interrupted = await exported(page);
    expect({ ...interrupted, position: initial.position, playTime: initial.playTime }).toEqual(
      initial,
    );
    await dismiss(page);
    await page.locator('#game-canvas').focus();
    await page.keyboard.down('w');
    await page.waitForTimeout(120);
    await page.keyboard.up('w');
    const held = await exported(page);
    expect({ ...held, playTime: interrupted.playTime }).toEqual(interrupted);
    await dismiss(page);
    await page.screenshot({
      path: info.outputPath('saved-route-awaits-restoration.png'),
      scale: 'css',
    });
    await writeFile(
      info.outputPath('saved-route-interruption.json'),
      JSON.stringify({ paused, initial, interrupted, held }, null, 2),
    );
    expect(paused.text).toBe('Olive grove · Your destination is in this region.');
    expect(paused.flagVisible).toBe(false);
    expect(paused.resumeVisible).toBe(true);
    expect(paused.resumeDisabled).toBe(true);
    await expect(page.locator(resume)).toBeDisabled();
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
  await expect(page.locator(resume)).toBeEnabled();
  await expect(page.locator(status)).not.toContainText('Approaching');
  await expect(page.locator(flag)).toBeHidden();
  const restored = await exported(page);
  expect({ ...restored, playTime: interrupted.playTime }).toEqual(interrupted);
  await dismiss(page);
  await startRoute(page);
  await expect(
    page.getByRole('heading', { name: 'Under the olive trees', exact: true }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await settled(page);
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  await settled(page);
  await expect(page.locator(status)).toBeHidden();
  await expect(page.locator(flag)).toBeHidden();
  const arrived = await exported(page);
  const expected = structuredClone(restored);
  expected.connection.route = null;
  expected.position = arrived.position;
  expected.playTime = arrived.playTime;
  expect(arrived).toEqual(expected);
  expect(Math.hypot(arrived.position.x + 17, arrived.position.z - 6)).toBeLessThan(2.8);
  await writeFile(
    info.outputPath('saved-route-restored-arrival.json'),
    JSON.stringify({ interrupted, restored, arrived }, null, 2),
  );
});

test('a live ground walk survives tracking refresh while graphics pause clears only its active flag', async ({
  page,
  isMobile,
}, info) => {
  await savedRoute(page, isMobile);
  const before = await exported(page);
  await dismiss(page);
  await settled(page);
  await page.locator('.objective-toggle').click();
  const point = await page.locator('.minimap').evaluate((node) => {
    const map = node as HTMLElement;
    const bearing =
      (parseFloat(map.parentElement!.style.getPropertyValue('--map-bearing')) * Math.PI) / 180;
    const view = map.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
    // Open village ground north of the cottages; this point avoids both radar controls.
    const dx = ((-4 + 24) * 4 - view[0]!) / 192 - 0.5;
    const dy = ((24 - 8) * 4 - view[1]!) / 192 - 0.5;
    const u = dx * Math.cos(bearing) - dy * Math.sin(bearing) + 0.5;
    const v = dx * Math.sin(bearing) + dy * Math.cos(bearing) + 0.5;
    const rect = map.getBoundingClientRect();
    return {
      x: rect.left + map.clientLeft + u * map.clientWidth,
      y: rect.top + map.clientTop + v * map.clientHeight,
    };
  });
  expect(
    await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.minimap'),
      point,
    ),
  ).toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(flag)).toBeVisible();
  await expect(page.locator(status)).not.toContainText('Approaching');
  await page.locator('.village-shortcut').click();
  await settled(page);
  await expect(page.locator(flag)).toBeVisible();
  const walking = await navigation(page);
  const extension = await graphicsLoss(page);
  try {
    const paused = await navigation(page);
    const saved = await exported(page);
    expect(saved.connection.route).toEqual(before.connection.route);
    expect(saved.tracking).toBe('village');
    expect({
      ...saved,
      position: before.position,
      tracking: before.tracking,
      playTime: before.playTime,
    }).toEqual(before);
    expect(
      Math.hypot(saved.position.x - before.position.x, saved.position.z - before.position.z),
    ).toBeGreaterThan(0);
    await dismiss(page);
    await page.screenshot({ path: info.outputPath('paused-ground-walk.png'), scale: 'css' });
    await writeFile(
      info.outputPath('ground-walk-pause.json'),
      JSON.stringify({ walking, paused, before, saved }, null, 2),
    );
    expect(walking.flagVisible).toBe(true);
    expect(paused.flagVisible).toBe(false);
    expect(paused.text).not.toContain('Approaching');
    expect(paused.resumeDisabled).toBe(true);
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
  await expect(page.locator(resume)).toBeEnabled();
  await expect(page.locator(flag)).toBeHidden();
});
