import { test, expect } from '@playwright/test';
import { ready, exported, dismiss, settled, visit } from '../helpers/connection-browser';

test('radar symbols remain legible and its local map control follows the frame on resize', async ({
  page,
}) => {
  await ready(page);
  const map = page.getByRole('button', { name: 'Walk using minimap' });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const metrics = await map.evaluate((el) => {
          const radar = el as HTMLElement;
          const wrap = radar.parentElement!;
          const player = radar.querySelector<SVGGraphicsElement>('#minimap-player circle')!;
          const matrix = player.getScreenCTM()!;
          return {
            frame: radar.offsetWidth,
            configured: parseFloat((wrap as HTMLElement).style.getPropertyValue('--map-size')),
            player: player.getBBox().width * Math.hypot(matrix.a, matrix.b),
          };
        });
        return (
          Math.abs(metrics.frame - metrics.configured) < 1 && Math.abs(metrics.player - 5) < 0.1
        );
      })
      .toBe(true);
    const people = map.locator('[data-map-place="miriam"]');
    await expect(people).toHaveAttribute('data-map-kind', 'person');
    await expect(people).toHaveCSS('fill', 'rgb(255, 228, 53)');
    const landmark = map.locator('[data-map-place="nets"]');
    await expect(landmark).toHaveAttribute('data-map-kind', 'object');
    await expect(landmark).toHaveCSS('fill', 'rgb(222, 205, 165)');
    const box = (await map.boundingBox())!;
    const localMap = (await page
      .getByRole('button', { name: 'Open local map', exact: true })
      .boundingBox())!;
    if (viewport.width >= 1001 && viewport.height >= 560) {
      // The classic frame's world map orb rests on the minimap's lower-left rim.
      const x = localMap.x + localMap.width / 2,
        y = localMap.y + localMap.height / 2;
      expect(x).toBeLessThan(box.x + box.width * 0.25);
      expect(y).toBeGreaterThan(box.y + box.height / 2);
      expect(y).toBeLessThan(box.y + box.height);
    } else
      expect(Math.abs(localMap.x + localMap.width / 2 - (box.x + box.width / 2))).toBeLessThan(1);
  }
});

test('mixed-surface phone gestures never turn a minimap release into a walk', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'mobile-chromium',
    'Native touch ownership uses the phone project',
  );
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await ready(page);
  const map = page.getByRole('button', { name: 'Walk using minimap' });
  const mapBox = (await map.boundingBox())!;
  const canvasBox = (await page.locator('#game-canvas').boundingBox())!;
  const first = { id: 1, x: mapBox.x + mapBox.width * 0.4, y: mapBox.y + mapBox.height * 0.5 };
  const second = { id: 2, x: canvasBox.width * 0.5, y: canvasBox.height * 0.5 };
  const position = await page.locator('#minimap-player').getAttribute('transform');
  const send = (type: 'touchStart' | 'touchEnd', touchPoints: (typeof first)[]) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints });
  for (const [a, b] of [
    [first, second],
    [second, first],
  ] as const) {
    await send('touchStart', [a]);
    await send('touchStart', [a, b]);
    await send('touchEnd', [b]);
    await send('touchEnd', []);
    await page.waitForTimeout(650);
    await expect(page.locator('#minimap-player')).toHaveAttribute('transform', position!);
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await session.detach();
  // A fresh, deliberate single-finger tap still walks after the rejected sequences.
  await page.touchscreen.tap(first.x, first.y);
  await expect(page.locator('.minimap-destination')).toBeVisible();
});

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
    const flag = page.locator('.minimap-destination');
    await expect(flag).toBeVisible();
    // The map rotates around the player, but the traveling flag stays upright.
    await expect
      .poll(() =>
        flag.evaluate((el) => {
          const matrix = (el as SVGGraphicsElement).getScreenCTM()!;
          return Math.abs(Math.atan2(matrix.b, matrix.a));
        }),
      )
      .toBeLessThan(0.001);
    await expect(flag).toBeHidden({ timeout: 20_000 });
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
