import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { ready, dismiss, settled } from '../helpers/connection-browser';
import { parseSave } from '../../src/persistence/schema';

async function clearReading(page: Page) {
  // Measure the settled reading surface, including newly opened replacement menus.
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  await expect(page.locator('.panel > #toast')).toBeVisible();
  const bounds = await page.locator('.panel').evaluate((panel) => {
    const rect = (selector: string) => {
      const value = panel.querySelector(selector)!.getBoundingClientRect();
      return { top: value.top, bottom: value.bottom, left: value.left, right: value.right };
    };
    return {
      body: rect('.panel-body'),
      notice: rect('#toast'),
      footer: rect('.panel-footer'),
      height: innerHeight,
      width: innerWidth,
    };
  });
  expect(bounds.notice.top, 'reading content is not covered').toBeGreaterThanOrEqual(
    bounds.body.bottom,
  );
  expect(bounds.notice.bottom, 'return controls remain clear').toBeLessThanOrEqual(
    bounds.footer.top - 8,
  );
  expect(bounds.notice.bottom - bounds.notice.top).toBeGreaterThan(30);
  expect(bounds.notice.left).toBeGreaterThanOrEqual(0);
  expect(bounds.notice.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.footer.bottom).toBeLessThanOrEqual(bounds.height);
  return bounds;
}

async function focusedReading(page: Page) {
  const visible = await page.locator('.panel-body').evaluate((body) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !body.contains(active)) return false;
    const control = active.closest('.import-button') ?? active;
    const rect = control.getBoundingClientRect();
    const bounds = body.getBoundingClientRect();
    return (
      rect.top >= bounds.top &&
      rect.bottom <= bounds.bottom &&
      rect.left >= bounds.left &&
      rect.right <= bounds.right &&
      rect.height > 0
    );
  });
  expect(visible, 'the selected reading control stays visible after feedback appears').toBe(true);
}

test('reading notices reserve space through compact layouts, import errors and menu replacement', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings and saves', exact: true }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  const toast = page.locator('#toast');
  const layouts = [
    page.viewportSize()!,
    { width: 320, height: 568 },
    { width: 568, height: 320 },
    { width: 844, height: 300 },
  ];
  const report = [];
  let baseline;
  for (const layout of layouts) {
    await page.setViewportSize(layout);
    const download = page.waitForEvent('download');
    // Safari does not focus buttons on pointer clicks; activate an already selected control.
    await exportButton.focus();
    await expect(exportButton).toBeFocused();
    await exportButton.press('Enter');
    await settled(page);
    await expect(toast).toContainText('Journey exported.');
    await expect(toast).toBeVisible();
    await expect(exportButton).toBeFocused();
    await focusedReading(page);
    const state = parseSave(
      JSON.parse(await readFile((await (await download).path())!, 'utf8')),
    ).state;
    baseline ??= state;
    expect({ ...state, playTime: baseline.playTime }).toEqual(baseline);
    await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
    report.push({ layout, bounds: await clearReading(page) });
    await page.screenshot({
      path: info.outputPath(`export-${layout.width}x${layout.height}.png`),
      scale: 'css',
    });

    // Native import rejection must keep its selected control in the shrinking reading area.
    const input = page.getByRole('button', { name: 'Import a journey save', exact: true });
    await input.focus();
    await input.setInputFiles({
      name: 'invalid-journey.json',
      mimeType: 'application/json',
      buffer: Buffer.from('null'),
    });
    await settled(page);
    await expect(toast).toContainText('This file is not a valid journey save.');
    await expect(input).toBeFocused();
    await focusedReading(page);
    await clearReading(page);
  }
  const master = page.getByRole('slider', { name: 'Master volume', exact: true });
  await master.press('ArrowRight');
  await expect(master).toBeFocused();
  await expect(master).toHaveAttribute('aria-valuetext', '40%');
  await focusedReading(page);
  const withNotice = (await page.locator('.panel-body').boundingBox())!.height;
  await expect(toast).toBeHidden({ timeout: 10_000 });
  expect((await page.locator('.panel-body').boundingBox())!.height).toBeGreaterThan(
    withNotice + 30,
  );
  await expect(master).toBeFocused();

  await page.locator('[data-action="save-slot"][data-value="slot-1"]').click();
  await settled(page);
  await expect(toast).toContainText('Your journey has been saved.');
  await expect(toast).toBeVisible();
  await clearReading(page);
  await page.getByRole('button', { name: 'Controls & how to play', exact: true }).click();
  await settled(page);
  await expect(toast).toContainText('Your journey has been saved.');
  await expect(toast).toBeVisible();
  await clearReading(page);
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await dismiss(page);
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS('opacity', '1');
  const returnedNotice = await toast.evaluate((notice) => {
    const ancestors = [];
    for (let node: Element | null = notice; node; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      ancestors.push({
        id: node.id,
        className: node.className,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
        clientWidth: node.clientWidth,
        clientHeight: node.clientHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollTop: node.scrollTop,
        scrollLeft: node.scrollLeft,
      });
    }
    return { ancestors, viewport: { width: innerWidth, height: innerHeight } };
  });
  await writeFile(
    info.outputPath('world-notice-bounds.json'),
    JSON.stringify(returnedNotice, null, 2),
  );
  await page.screenshot({ path: info.outputPath('returned-world-notice.png'), scale: 'css' });
  await expect(toast).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('reading-notice-bounds.json'), JSON.stringify(report, null, 2));
});
