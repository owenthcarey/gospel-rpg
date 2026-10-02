import { test, expect, type Page } from '@playwright/test';
import { ready, visit, exported, dismiss } from '../helpers/connection-browser';

const turn = (from: number, to: number) => Math.abs(((to - from + 540) % 360) - 180);
const bearing = (page: Page) =>
  page
    .locator('.minimap-wrap')
    .evaluate((node) => parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing')));

async function holdQ(page: Page, from: number, leaveConversation = false, reading = false) {
  return page.locator('#game-canvas').evaluate(
    async (node, options) => {
      const canvas = node as HTMLCanvasElement;
      const map = document.querySelector<HTMLElement>('.minimap-wrap')!;
      let firstTurn: number | undefined;
      const send = (type: string) =>
        canvas.dispatchEvent(
          new KeyboardEvent(type, {
            bubbles: true,
            cancelable: true,
            key: 'q',
            code: 'KeyQ',
          }),
        );
      // Compare the same rendered turn, rather than wall-clock holds with different frame rates.
      const rotated = new Promise<void>((resolve) => {
        if (options.reading) {
          setTimeout(resolve, 900);
          return;
        }
        const observer = new MutationObserver(() => {
          const bearing = parseFloat(map.style.getPropertyValue('--map-bearing'));
          const turn = ((bearing - options.from + 540) % 360) - 180;
          if (firstTurn === undefined && Math.abs(turn) > 0.001) firstTurn = turn;
          if (turn < 90) return;
          observer.disconnect();
          send('keyup');
          resolve();
        });
        observer.observe(map, { attributes: true, attributeFilter: ['style'] });
      });
      if (options.leaveConversation) {
        // Begin at the real close checkpoint, before the 700 ms return gets a frame.
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
        await rotated;
      } finally {
        send('keyup');
      }
      await new Promise((resolve) => setTimeout(resolve, 850));
      return firstTurn;
    },
    { from, leaveConversation, reading },
  );
}

test('world letter controls keep working from focused camera buttons without claiming button arrows', async ({
  page,
}) => {
  await ready(page);
  const compass = page.getByRole('button', { name: 'Face north', exact: true });
  const player = page.locator('#minimap-player');
  await compass.click();
  await expect(compass).toBeFocused();
  await expect.poll(async () => Math.abs(await bearing(page))).toBeLessThan(0.04);
  const position = await player.getAttribute('transform');
  await page.keyboard.down('q');
  try {
    await expect.poll(() => bearing(page)).toBeGreaterThan(14);
  } finally {
    await page.keyboard.up('q');
  }
  await expect(compass).toBeFocused();
  await expect(player).toHaveAttribute('transform', position!);
  await page.keyboard.down('ArrowUp');
  try {
    await page.waitForTimeout(450);
    await expect(player).toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  // Enter still activates the focused compass and restores a north-facing walk.
  await page.keyboard.press('Enter');
  await expect.poll(async () => Math.abs(await bearing(page))).toBeLessThan(0.04);
  await page.keyboard.down('w');
  try {
    await expect(player).not.toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('w');
  }
  await expect(compass).toBeFocused();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});

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
  const ordinaryFirst = (await holdQ(page, initial))!;
  expect(ordinaryFirst).toBeGreaterThan(0);
  expect(ordinaryFirst).toBeLessThan(12);
  const ordinaryTurn = turn(initial, await bearing(page));
  expect(ordinaryTurn).toBeGreaterThanOrEqual(90);
  expect(ordinaryTurn).toBeLessThan(102);

  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.waitForTimeout(150);
  await visit(page, 'simon');
  const returningFirst = (await holdQ(page, initial, true))!;
  // A held Q must start at the exploration bookmark on its first frame, without easing back.
  expect(returningFirst).toBeGreaterThan(0);
  expect(returningFirst).toBeLessThan(12);
  const returned = await bearing(page);
  expect(turn(initial, returned) / ordinaryTurn).toBeGreaterThan(0.85);
  expect(turn(initial, returned) / ordinaryTurn).toBeLessThan(1.15);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.world-option-menu')).toBeHidden();

  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await holdQ(page, returned, false, true);
  await dismiss(page);
  await page.waitForTimeout(150);
  expect(turn(returned, await bearing(page))).toBeLessThan(0.1);
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', position!);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
});
