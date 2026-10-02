import { expect, test } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';
import { newGame } from '../../src/game/types';

test('an anonymous native minimap walk offers Cancel and stops without changing earned progress', async ({
  page,
  isMobile,
}, info) => {
  await ready(page);
  const flag = page.locator('.minimap-destination');
  const status = page.locator('#travel-status');
  const cancel = status.locator('[data-action="cancel-navigation"]');
  const player = page.locator('#minimap-player');
  const original = await player.getAttribute('transform');
  const point = await page.locator('.minimap svg').evaluate((node) => {
    const svg = node as SVGSVGElement;
    const point = svg.createSVGPoint();
    // A reachable western destination leaves several seconds for a deliberate cancellation.
    point.x = (-20 + 24) * 4;
    point.y = (24 + 3) * 4;
    const rendered = point.matrixTransform(svg.getScreenCTM()!);
    const hit = document.elementFromPoint(rendered.x, rendered.y);
    return { x: rendered.x, y: rendered.y, minimap: !!hit?.closest('.minimap') };
  });
  expect(point.minimap).toBe(true);
  if (isMobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(flag).toBeVisible();
  await expect(status).toContainText('Walking to chosen point');
  await expect(status.locator('[data-action="route-resume"]')).toBeHidden();
  await expect(cancel).toBeEnabled();
  await expect(player).not.toHaveAttribute('transform', original!);
  await page.screenshot({ path: info.outputPath('chosen-point-cancel.png') });
  if (isMobile) await cancel.tap();
  else await cancel.click();
  await settled(page);
  await expect(flag).toBeHidden();
  await expect(status).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeFocused();
  const stopped = await player.getAttribute('transform');
  // Keep the world running through further real frames: cancellation must stop actual travel.
  await page.waitForTimeout(400);
  await expect(player).toHaveAttribute('transform', stopped!);
  await expect(page.getByRole('dialog')).toBeHidden();
  const saved = await exported(page);
  expect(saved).toEqual({ ...newGame(), position: saved.position, playTime: saved.playTime });
});
