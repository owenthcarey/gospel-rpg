import { test, expect, type Page } from '@playwright/test';
import { ready, visit, exported, dismiss } from '../helpers/connection-browser';

const turn = (from: number, to: number) => Math.abs(((to - from + 540) % 360) - 180);
const bearing = (page: Page) =>
  page
    .locator('.minimap-wrap')
    .evaluate((node) => parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing')));

async function holdQ(page: Page, leaveConversation = false) {
  await page.locator('#game-canvas').evaluate(async (node, leave) => {
    const canvas = node as HTMLCanvasElement;
    const send = (type: string) =>
      canvas.dispatchEvent(
        new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          key: 'q',
          code: 'KeyQ',
        }),
      );
    if (leave) {
      // Begin at the real close checkpoint, before the 700 ms return gets a frame.
      // Separate browser commands can outlast that window with software WebGL.
      await new Promise<void>((resolve) => {
        const overlay = document.querySelector('#overlay')!;
        const observer = new MutationObserver(() => {
          if (overlay.childElementCount) return;
          observer.disconnect();
          send('keydown');
          resolve();
        });
        observer.observe(overlay, { childList: true });
        document.querySelector<HTMLButtonElement>('[aria-label="Leave conversation"]')!.click();
      });
    } else send('keydown');
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
    } finally {
      send('keyup');
    }
    await new Promise((resolve) => setTimeout(resolve, 850));
  }, leaveConversation);
}

test('held Q takes over a conversation camera return and stays quiet behind the journal', async ({
  page,
}) => {
  await ready(page);
  await visit(page, 'simon');
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  await page.waitForTimeout(850);
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.waitForTimeout(150);
  const initial = await bearing(page);
  const position = await page.locator('#minimap-player').getAttribute('transform');
  await holdQ(page);
  const ordinaryTurn = turn(initial, await bearing(page));
  expect(ordinaryTurn).toBeGreaterThan(20);

  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.waitForTimeout(150);
  await visit(page, 'simon');
  await holdQ(page, true);
  const returned = await bearing(page);
  expect(turn(initial, returned) / ordinaryTurn).toBeGreaterThan(0.85);
  expect(turn(initial, returned) / ordinaryTurn).toBeLessThan(1.15);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.world-option-menu')).toBeHidden();

  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await holdQ(page);
  await dismiss(page);
  await page.waitForTimeout(150);
  expect(turn(returned, await bearing(page))).toBeLessThan(0.1);
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', position!);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});
