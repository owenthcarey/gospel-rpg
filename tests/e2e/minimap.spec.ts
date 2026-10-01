import { test, expect } from '@playwright/test';
import { ready, exported, dismiss, settled, visit } from '../helpers/connection-browser';

test('the rotating minimap walks, clears its destination on arrival and keeps map keyboard access', async ({
  page,
}) => {
  await ready(page);
  const map = page.getByRole('button', { name: 'Walk using minimap' });
  const wrap = page.locator('.minimap-wrap');
  const box = (await map.boundingBox())!;
  const marker = await page.locator('#minimap-player').getAttribute('transform');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 3 });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', marker!);
  await page.getByRole('button', { name: 'Face north', exact: true }).click();
  await expect
    .poll(() =>
      wrap.evaluate((el) =>
        Math.abs(parseFloat((el as HTMLElement).style.getPropertyValue('--map-bearing'))),
      ),
    )
    .toBeLessThan(0.04);
  const clickTarget = async (x: number, z: number) => {
    const point = await map.evaluate(
      (el, target) => {
        const button = el as HTMLElement;
        const bearing =
          (parseFloat(button.parentElement!.style.getPropertyValue('--map-bearing')) * Math.PI) /
          180;
        const view = button.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
        const dx = ((target.x + 24) * 4 - view[0]!) / 192 - 0.5;
        const dy = ((24 - target.z) * 4 - view[1]!) / 192 - 0.5;
        const u = dx * Math.cos(bearing) - dy * Math.sin(bearing) + 0.5;
        const v = dx * Math.sin(bearing) + dy * Math.cos(bearing) + 0.5;
        const rect = button.getBoundingClientRect();
        return {
          x: rect.left + button.clientLeft + u * button.clientWidth,
          y: rect.top + button.clientTop + v * button.clientHeight,
        };
      },
      { x, z },
    );
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('.minimap-destination')).toBeVisible();
    await expect(page.locator('.minimap-destination')).toBeHidden({ timeout: 20_000 });
  };
  await clickTarget(-4, -3);
  await page.getByRole('button', { name: 'Rotate camera left', exact: true }).click();
  await expect
    .poll(() =>
      wrap.evaluate((el) =>
        parseFloat((el as HTMLElement).style.getPropertyValue('--map-bearing')),
      ),
    )
    .toBeGreaterThan(14);
  // This clear lane tests rotated coordinates; the olive beside (-6,-5) is blocked terrain.
  await clickTarget(-3, -7);
  const save = await exported(page);
  expect(Math.hypot(save.position.x + 3, save.position.z + 7)).toBeLessThan(0.8);
  expect(save.quest).toBe('not-started');
  await dismiss(page);
  await map.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Local destinations');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open local map', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Local destinations');
});

test('a menu cancels a held radar press and the compass takes over a returning camera', async ({
  page,
}) => {
  await ready(page);
  const map = page.getByRole('button', { name: 'Walk using minimap' });
  const marker = await page.locator('#minimap-player').getAttribute('transform');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await page.keyboard.press('Escape');
  await settled(page);
  await page.mouse.up();
  // Observe past several render frames: a stale release must never start a walk.
  await page.waitForTimeout(600);
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', marker!);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  await visit(page, 'simon');
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  await page.getByRole('button', { name: 'Face north', exact: true }).click();
  // The former conversation return lasts 700ms and must not restore its earlier bearing.
  await page.waitForTimeout(850);
  await expect
    .poll(() =>
      page
        .locator('.minimap-wrap')
        .evaluate((el) =>
          Math.abs(parseFloat((el as HTMLElement).style.getPropertyValue('--map-bearing'))),
        ),
    )
    .toBeLessThan(0.04);
});
