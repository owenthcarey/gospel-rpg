import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { dismiss, exported, settled, visit } from './connection-browser';

async function workPosition(page: Page) {
  return page.locator('.work-panel').evaluate(async (panel) => {
    // Read after framing has consumed the tray's actual ResizeObserver bounds.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const body = panel.querySelector<HTMLElement>('.work-body')!;
    const supplies = panel.querySelector<HTMLElement>('.work-supplies')!;
    const toast = document.querySelector<HTMLElement>('#toast')!;
    const toolbar = document.querySelector<HTMLElement>('.topbar')!;
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))!;
    const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const c = canvas.getBoundingClientRect();
    const rect = (node: Element) => {
      const bounds = node.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const world = {
      top:
        c.top +
        ((gl.drawingBufferHeight - viewport[1]! - viewport[3]!) / gl.drawingBufferHeight) *
          c.height,
      bottom: c.top + ((gl.drawingBufferHeight - viewport[1]!) / gl.drawingBufferHeight) * c.height,
    };
    return {
      panel: rect(panel),
      reading: rect(body),
      supplies: rect(supplies),
      toast: rect(toast),
      toolbar: rect(toolbar),
      toastVisible: !toast.hidden,
      world,
      worldMidpoint: (world.top + world.bottom) / 2,
      viewport: { width: innerWidth, height: innerHeight },
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      horizontalOverflow: body.scrollWidth - body.clientWidth,
      controls: [...panel.querySelectorAll<HTMLButtonElement>('button')]
        // WebKit retains layout boxes for unpainted children of closed disclosures.
        .filter(
          (button) =>
            !button.closest('details:not([open])') &&
            button.offsetHeight > 0 &&
            button.getClientRects().length > 0,
        )
        .map((button) => ({
          ...rect(button),
          action: button.dataset.action,
          disabled: button.disabled,
          minHeight: parseFloat(getComputedStyle(button).minHeight),
          cssHeight: parseFloat(getComputedStyle(button).height),
          fontSize: parseFloat(getComputedStyle(button).fontSize),
        })),
    };
  });
}

export async function narrowWorkReading(page: Page, info: TestInfo) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings', exact: true }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page
    .locator('#import-save')
    .setInputFiles('tests/fixtures/saves/v8-resting-place-unfinished.json');
  await settled(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  const before = await exported(page);
  expect(before.galilee.shelter).toMatchObject({ site: 'shade', placed: ['mat'] });
  await visit(page, 'rest-breeze');
  await expect(page.locator('.work-panel')).toHaveAttribute('data-work-target', 'rest-breeze');
  const positions: Awaited<ReturnType<typeof workPosition>>[] = [];
  for (const height of [568, 548]) {
    await page.setViewportSize({ width: 320, height });
    // Each height gets a fresh real export notice within its ordinary lifetime.
    await exported(page);
    await visit(page, 'rest-breeze');
    await page.locator('.work-supplies').scrollIntoViewIfNeeded();
    await expect(page.locator('.work-supplies .rest-socket')).toHaveText([
      'mat Placed at: The olive shade',
      'water At the rack',
      'screen At the rack',
    ]);
    await expect(page.locator('.work-actions [data-action="galilee-action"]')).toHaveCount(0);
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-target', 'rest-breeze');
    await expect(page.locator('#toast')).toContainText('Journey exported.');
    await page
      .locator('#toast')
      .evaluate((toast) =>
        Promise.all(toast.getAnimations().map((animation) => animation.finished)),
      );
    const position = await workPosition(page);
    positions.push(position);
    await page.screenshot({ path: info.outputPath(`work-reading-${height}.png`), scale: 'css' });
    await writeFile(
      info.outputPath('work-reading-position.json'),
      JSON.stringify({ before, positions }),
    );
    expect(position.pageOverflow).toBe(0);
    expect(position.horizontalOverflow).toBe(0);
    expect(position.supplies.top).toBeGreaterThanOrEqual(position.reading.top);
    expect(position.supplies.bottom).toBeLessThanOrEqual(position.reading.bottom);
    expect(position.supplies.left).toBeGreaterThanOrEqual(position.reading.left);
    expect(position.supplies.right).toBeLessThanOrEqual(position.reading.right);
    expect(position.toastVisible).toBe(true);
    expect(position.toast.bottom).toBeLessThanOrEqual(position.panel.top);
    // Low-quality buffers quantize the camera viewport to whole render pixels.
    expect(position.world.bottom).toBeLessThanOrEqual(position.panel.top + 2);
    expect(position.worldMidpoint).toBeGreaterThan(position.toolbar.bottom);
    expect(position.worldMidpoint).toBeLessThan(position.toast.top);
    for (const control of position.controls) {
      if (control.action === 'close') expect(control.cssHeight).toBeGreaterThanOrEqual(44);
      else expect(control.minHeight).toBeGreaterThanOrEqual(44);
      expect(control.width).toBeGreaterThanOrEqual(43.99);
      expect(control.height).toBeGreaterThanOrEqual(43.99);
      expect(control.top).toBeGreaterThanOrEqual(position.panel.top);
      expect(control.bottom).toBeLessThanOrEqual(position.panel.bottom);
      if (control.action !== 'close') expect(control.fontSize).toBeGreaterThanOrEqual(17);
    }
  }
  await page.locator('[data-action="work-inspect"]').click();
  await expect(page.locator('.rest-plan')).toBeVisible();
  await expect(page.locator('.rest-sockets .rest-socket small')).toHaveText([
    'Placed at: The olive shade',
    'At the rack',
    'At the rack',
  ]);
  await expect(page.locator('.context-actions [data-action="galilee-action"]')).toHaveCount(0);
  await page.locator('.rest-sockets').scrollIntoViewIfNeeded();
  await expect(page.locator('.rest-sockets')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('work-reading-inspection.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Return to the work', exact: true }).click();
  await expect(page.locator('.work-panel')).toHaveAttribute('data-work-target', 'rest-breeze');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-target', 'rest-breeze');
  const after = await exported(page);
  expect({ ...after, position: before.position, playTime: before.playTime }).toEqual(before);
  await dismiss(page);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('work-reading-position.json'),
    JSON.stringify({ before, positions, after, errors }),
  );
}
