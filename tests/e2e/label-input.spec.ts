import { test, expect } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';
import { newGame } from '../../src/game/types';

test('WASD takes over a label approach while the focused label keeps its normal activation keys', async ({
  page,
  isMobile,
}) => {
  const initial = newGame();
  // Keep a real approach available while software WebGL observes its flag and focus.
  initial.position = { x: -1, z: -15 };
  await ready(page, initial);
  const simon = page.locator('.world-label[data-value="simon"]');
  const player = page.locator('#minimap-player');
  if (isMobile && !(await simon.isVisible())) {
    // The southern viewpoint puts Simon behind the phone's quest card. Frame him
    // with an ordinary camera drag, starting only on live, unobstructed canvas.
    const point = await page.locator('#game-canvas').evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      for (const v of [0.55, 0.5, 0.6])
        for (const u of [0.85, 0.65, 0.5, 0.35]) {
          const x = bounds.x + bounds.width * u;
          const y = bounds.y + bounds.height * v;
          if (y - 300 > bounds.top && document.elementFromPoint(x, y) === canvas) return { x, y };
        }
      return null;
    });
    expect(point).not.toBeNull();
    await page.mouse.move(point!.x, point!.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(point!.x, point!.y - 300, { steps: 12 });
    await page.mouse.up({ button: 'middle' });
  }
  await expect(simon).toBeVisible();
  await simon.click();
  await settled(page);
  await expect(simon).toBeFocused();
  await expect(page.locator('.minimap-destination')).toBeVisible();
  const position = await player.getAttribute('transform');
  await page.keyboard.down('w');
  try {
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await expect(player).not.toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('w');
  }
  await expect(simon).toBeFocused();
  await expect(page.getByRole('dialog')).toBeHidden();
  await simon.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await expect(menu.getByRole('menuitem', { name: 'Talk-to Simon', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Walk here', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(simon).toBeFocused();
  const saved = await exported(page);
  expect(saved.quest).toBe('not-started');
  expect(saved.episode.stage).toBe('not-started');
  expect(saved).toEqual({
    ...initial,
    position: saved.position,
    playTime: saved.playTime,
    connection: { ...initial.connection, route: { target: 'simon' } },
  });
});
