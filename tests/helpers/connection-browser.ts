import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { makeSave, parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { displayRegion } from '../../src/game/connection/accounts';

export async function dismiss(page: Page) {
  const button = page.getByRole('button', { name: 'Close menu', exact: true });
  if (await button.isVisible()) await button.click();
}
export async function settled(page: Page) {
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
export async function ready(page: Page, state?: GameState) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  if (state) await importState(page, state);
  else {
    await dismiss(page);
    await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
    await settled(page);
  }
}
export async function importState(page: Page, state: GameState) {
  await page.locator('#import-save').setInputFiles({
    name: 'connected-journey.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(state))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', displayRegion(state));
  await settled(page);
}
export async function visit(page: Page, id: string) {
  await dismiss(page);
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator(`.map-destinations [data-value="${id}"]`).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 });
  await settled(page);
}
export async function act(page: Page, type: string, value?: string) {
  await page
    .locator(`#overlay [data-action="${type}"]${value ? `[data-value="${value}"]` : ''}`)
    .click();
  await settled(page);
}
export async function choice(page: Page, label: string) {
  await page.getByRole('button', { name: new RegExp(label) }).click();
  await settled(page);
}
export async function passage(page: Page, id: string, region: string) {
  await visit(page, id);
  await act(page, 'journey', id);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region);
}
export async function exported(page: Page) {
  await dismiss(page);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return parseSave(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).state;
}
export async function journal(page: Page) {
  await dismiss(page);
  await page.locator('.toolbar [data-action="journal"]').click();
}
export async function library(page: Page) {
  await journal(page);
  await act(page, 'replay-library');
}
export async function readAccount(page: Page, checkpoints: readonly string[]) {
  for (const id of checkpoints) {
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-checkpoint', id);
    await page.locator('.scene-continue').click();
    await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-checkpoint', id);
    await settled(page);
  }
}

/** Measure computed text against its composited CSS surface, including translucent buttons. */
export async function readableContrast(page: Page, selector: string): Promise<number> {
  const ratio = await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number);
      const layers: number[][] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const color = rgba(getComputedStyle(node).backgroundColor);
        layers.push(color);
        if ((color[3] ?? 1) === 1) break;
      }
      let background = [255, 255, 255];
      for (const color of layers.reverse()) {
        const alpha = color[3] ?? 1;
        background = background.map((v, i) => color[i]! * alpha + v * (1 - alpha));
      }
      const luminance = (color: number[]) =>
        color
          .slice(0, 3)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const a = luminance(rgba(getComputedStyle(element).color));
      const b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  expect(ratio, selector + ' text contrast').toBeGreaterThanOrEqual(4.5);
  return ratio;
}
