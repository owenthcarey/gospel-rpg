import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { ready, exported, dismiss, settled } from '../helpers/connection-browser';

const turn = (from: number, to: number) => Math.abs(((to - from + 540) % 360) - 180);

test('reading pauses stop an unfinished camera button turn at the last rendered view', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const before = await exported(page);
  await dismiss(page);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  const bearing = () =>
    page
      .locator('.minimap-wrap')
      .evaluate((node) =>
        parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing')),
      );
  const initial = await bearing();
  const rotate = page.getByRole('button', { name: 'Rotate camera right', exact: true });
  await rotate.click();
  await settled(page);
  await expect.poll(async () => turn(initial, await bearing())).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await settled(page);
  await expect.poll(async () => turn(initial, await bearing())).toBeLessThan(0.1);
  await page.locator('#ui').evaluate((root) => {
    const ui = root as HTMLElement;
    let busy = false;
    const observer = new MutationObserver(() => {
      if (ui.dataset.actionPending === 'true') busy = true;
      else if (busy) {
        observer.disconnect();
        const map = document.querySelector<HTMLElement>('.minimap-wrap')!;
        ui.dataset.cameraPauseStart = JSON.stringify({
          time: performance.now(),
          bearing: parseFloat(map.style.getPropertyValue('--map-bearing')),
        });
        // Open at the real command checkpoint, before the pending turn gets another frame.
        document.querySelector<HTMLButtonElement>('.toolbar [data-action="journal"]')!.click();
      }
    });
    observer.observe(ui, { attributes: true, attributeFilter: ['data-action-pending'] });
  });
  await rotate.click();
  await settled(page);
  await expect(
    page.getByRole('heading', { name: 'A traveler’s journal', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  const report = await page.evaluate(async () => {
    const ui = document.querySelector<HTMLElement>('#ui')!;
    const start = JSON.parse(ui.dataset.cameraPauseStart!);
    const map = document.querySelector<HTMLElement>('.minimap-wrap')!;
    const samples: { time: number; bearing: number; reading: boolean }[] = [];
    const end = performance.now() + 1500;
    await new Promise<void>((resolve) => {
      const sample = () => {
        samples.push({
          time: performance.now(),
          bearing: parseFloat(map.style.getPropertyValue('--map-bearing')),
          reading: !!document.querySelector('[role="dialog"]'),
        });
        if (performance.now() >= end) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return { start, samples };
  });
  await writeFile(info.outputPath('camera-pause.json'), JSON.stringify(report, null, 2));
  expect(report.samples.every((sample) => sample.reading)).toBe(true);
  const drift = Math.max(
    ...report.samples.map((sample) => turn(report.start.bearing, sample.bearing)),
  );
  expect(drift, 'manual camera motion stops when reading begins').toBeLessThan(0.1);
  await dismiss(page);
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(turn(report.start.bearing, await bearing())).toBeLessThan(0.1);
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
  expect(errors).toEqual([]);
});
