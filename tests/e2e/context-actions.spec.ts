import { test, expect } from '@playwright/test';
import { dock, sail } from '../helpers/lake';
import { ready, settled, exported, dismiss } from '../helpers/connection-browser';

test('nearby boat actions stay inside the HUD and replace the duplicate object prompt', async ({
  page,
}) => {
  const state = dock(sail(), 'reed-landing');
  await ready(page, state);
  const board = page.locator('#action-tray').getByRole('button', { name: /Board the boat/ });
  await expect(board).toBeVisible();
  await expect(page.locator('#nearby-action')).toBeHidden();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await board.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const camera = document.querySelector('.camera-controls')!.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        height: rect.height,
        cameraOverlap:
          rect.right > camera.left &&
          rect.left < camera.right &&
          rect.bottom > camera.top &&
          rect.top < camera.bottom,
      };
    });
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.cameraOverlap).toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await exported(page);
  await dismiss(page);
  await expect(page.locator('#toast')).toBeVisible();
  const noticeOverlap = await page.locator('#toast').evaluate((notice) => {
    const rect = notice.getBoundingClientRect();
    return [...document.querySelectorAll('.minimap-wrap, .minimap-compass, #action-tray')].some(
      (element) => {
        const control = element.getBoundingClientRect();
        return (
          rect.right > control.left &&
          rect.left < control.right &&
          rect.bottom > control.top &&
          rect.top < control.bottom
        );
      },
    );
  });
  expect(noticeOverlap).toBe(false);
  await board.click();
  await settled(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilee-water');
  const saved = await exported(page);
  expect(saved.lake.boat.mode).toBe('afloat');
  expect(saved.lake.boat.berth).toBeNull();
  expect(saved.episode).toEqual(state.episode);
  expect(saved.campaign.roof).toEqual(state.campaign.roof);
  expect(saved.road.chapter).toEqual(state.road.chapter);
});
