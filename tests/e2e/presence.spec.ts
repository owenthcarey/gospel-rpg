import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { newGame } from '../../src/game/types';
import { makeSave } from '../../src/persistence/schema';
import { SCENE_IDS } from '../../src/game/episode/types';
import { onLake } from '../helpers/journey';
import {
  ready,
  settled,
  visit,
  dismiss,
  act,
  exported,
  readableContrast,
} from '../helpers/connection-browser';
import { district, gateway } from '../helpers/campaign';

/** Paused worlds render at 10 Hz; allow composition and its occlusion pass to settle. */
async function capture(page: Page, path: string) {
  await page.waitForTimeout(250);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await page.screenshot({ path, scale: 'css', animations: 'disabled' });
}

test('named-person framing survives resize, a failed region load and a return visit without changing story state', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const state = gateway(district(), 'to-bakehouse');
  await ready(page, state);
  await visit(page, 'hannah');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-conversation', 'hannah');
  await expect(page.locator('.speaker-portrait')).toHaveAttribute('src', /hannah.webp$/);
  await readableContrast(page, '.conversation-motion');
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  const frozen = await canvas.getAttribute('data-conversation-time');
  if (info.project.name === 'mobile-chromium')
    await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Resume motion', exact: true })).toBeInViewport();
  await page.waitForTimeout(300);
  expect(await canvas.getAttribute('data-conversation-time')).toBe(frozen);
  await expect(page.locator('#toast')).toBeHidden();
  await capture(page, info.outputPath('conversation-hannah.png'));
  await dismiss(page);
  await expect(canvas).not.toHaveAttribute('data-conversation');
  await visit(page, 'bakehouse-exit');
  await page.route('**/house.glb', (route) => route.abort());
  await act(page, 'journey', 'bakehouse-exit');
  await expect(canvas).toHaveAttribute('data-region', 'bakehouse');
  await expect(canvas).not.toHaveAttribute('data-conversation');
  await page.unroute('**/house.glb');
  await dismiss(page);
  await visit(page, 'hannah');
  await expect(canvas).toHaveAttribute('data-conversation', 'hannah');
  await expect(page.getByRole('button', { name: 'Pause motion', exact: true })).toBeVisible();
  const saved = await exported(page);
  expect(saved.campaign.table).toEqual(state.campaign.table);
  expect(saved.campaign.walk).toEqual(state.campaign.walk);
  expect(saved.episode).toEqual(state.episode);
  expect(saved.harbor).toEqual(state.harbor);
});

test('nearby conversations keep identities, motion pause and camera recovery through menus and reload', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, newGame());
  await visit(page, 'simon');
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-conversation', 'simon');
  const portrait = page.locator('.speaker-portrait');
  await expect(portrait).toBeVisible();
  await expect
    .poll(() =>
      portrait.evaluate((img) => ({
        loaded: (img as HTMLImageElement).complete,
        width: (img as HTMLImageElement).naturalWidth,
      })),
    )
    .toEqual({ loaded: true, width: 192 });
  const time = Number(await canvas.getAttribute('data-conversation-time'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-conversation-time')))
    .toBeGreaterThan(time + 0.1);
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  const frozen = await canvas.getAttribute('data-conversation-time');
  await page.waitForTimeout(450);
  expect(await canvas.getAttribute('data-conversation-time')).toBe(frozen);
  await expect(page.locator('.dialogue-choices button').first()).toBeVisible();
  await expect(page.locator('#toast')).toBeHidden();
  await capture(page, info.outputPath('conversation-simon.png'));
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-conversation-time')))
    .toBeGreaterThan(Number(frozen));
  await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  await expect(canvas).not.toHaveAttribute('data-conversation');
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await dismiss(page);
  await visit(page, 'simon');
  await expect(canvas).toHaveAttribute('data-conversation-time', '0.00');
  const panel = page.getByRole('dialog');
  const rect = await panel.boundingBox(),
    size = page.viewportSize()!;
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(size.width + 1);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height + 1);
  await capture(page, info.outputPath('conversation-large-still.png'));
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await settled(page);
  await expect(canvas).not.toHaveAttribute('data-conversation');
  await visit(page, 'miriam');
  await expect(canvas).toHaveAttribute('data-conversation', 'miriam');
  await expect(page.locator('.speaker-portrait')).toHaveAttribute('src', /miriam.webp$/);
  await capture(page, info.outputPath('conversation-miriam.png'));
  expect(errors).toEqual([]);
});

test('all ten Into the Deep compositions remain complete and readable at desktop, portrait and short landscape sizes', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = onLake();
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('#import-save').setInputFiles({
    name: 'presence-scenes.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(s))),
  });
  await settled(page);
  await expect(page.locator('#toast')).toBeHidden();
  const records = [];
  for (const id of SCENE_IDS) {
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', id);
    await expect(page.locator('.scene-continue')).toBeVisible();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-lake-time', id + ':0.00');
    const rect = await page.locator('#scene-controls').boundingBox(),
      size = page.viewportSize()!;
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height + 1);
    records.push({ id, width: size.width, height: size.height, panel: rect });
    await capture(page, info.outputPath('lake-' + id + '.png'));
    if (info.project.name === 'mobile-chromium') {
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.locator('.scene-continue')).toBeVisible();
      await capture(page, info.outputPath('landscape-' + id + '.png'));
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.locator('.scene-continue').click();
    await settled(page);
  }
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await writeFile(info.outputPath('reading-compositions.json'), JSON.stringify(records, null, 2));
  expect(errors).toEqual([]);
});
