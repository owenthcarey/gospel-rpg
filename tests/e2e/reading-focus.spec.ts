import { expect, test, type Page } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';
import { ready, exported, settled, dismiss } from '../helpers/connection-browser';
import { parseSave } from '../../src/persistence/schema';

async function selectedBounds(page: Page) {
  return page.locator('.panel').evaluate((panel) => {
    const active = document.activeElement as HTMLElement;
    const control = active.closest<HTMLElement>('.audio-control,.import-button') ?? active;
    const body = panel.querySelector<HTMLElement>('.panel-body')!;
    const surface = body.contains(active) ? body : panel;
    const rect = control.getBoundingClientRect();
    const bounds = surface.getBoundingClientRect();
    const clipping =
      surface === body
        ? {
            top: bounds.top + body.clientTop,
            bottom: bounds.top + body.clientTop + body.clientHeight,
            left: bounds.left + body.clientLeft,
            right: bounds.left + body.clientLeft + body.clientWidth,
          }
        : { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right };
    const visible =
      panel.contains(active) &&
      rect.height > 0 &&
      rect.width > 0 &&
      rect.top >= clipping.top + 5 &&
      rect.bottom <= clipping.bottom - 5 &&
      rect.left >= clipping.left + 5 &&
      rect.right <= clipping.right - 5 &&
      rect.top >= 0 &&
      rect.bottom <= innerHeight &&
      rect.left >= 0 &&
      rect.right <= innerWidth;
    const notice = document.querySelector<HTMLElement>('#toast')!;
    return {
      visible,
      control: active.id || active.dataset.action || active.dataset.setting,
      bounds: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      clipping,
      scrollTop: body.scrollTop,
      noticeVisible: !notice.hidden && notice.offsetHeight > 0,
    };
  });
}

test('reading menus retain selected controls, complete volume values and focus rings through rotation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const before = await exported(page);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await page.locator('[data-setting="textSize"]').selectOption('large');
  const layouts = [
    { width: 568, height: 320 },
    { width: 844, height: 300 },
    { width: 607, height: 740 },
    { width: 320, height: 568 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ];
  const volumes = [
    { selector: '#audio-volume', value: '0.35', percentage: '35%' },
    { selector: '#audio-musicVolume', value: '0.7', percentage: '70%' },
    { selector: '#audio-ambienceVolume', value: '0.5', percentage: '50%' },
    { selector: '#audio-effectsVolume', value: '0.65', percentage: '65%' },
  ];
  const controls = [
    ...volumes.map(({ selector }) => selector),
    '[data-setting="quality"]',
    '#import-save',
    '[data-action="export"]',
    '.panel-header [data-action="close"]',
    '.panel-footer [data-action="close"]',
  ];
  const report = [];
  for (const selector of controls) {
    await page.setViewportSize({ width: 390, height: 844 });
    const control = page.locator('#overlay').locator(selector);
    await control.focus();
    await expect(control).toBeFocused();
    for (const layout of layouts) {
      await page.setViewportSize(layout);
      const first = await selectedBounds(page);
      await writeFile(
        info.outputPath('latest-rotation.json'),
        JSON.stringify({ selector, layout, ...first }, null, 2),
      );
      await expect.poll(async () => (await selectedBounds(page)).visible).toBe(true);
      await expect(control).toBeFocused();
      report.push({ selector, layout, ...(await selectedBounds(page)) });
      if (selector === '#audio-volume' && layout.height <= 320)
        await page.screenshot({
          path: info.outputPath(`selected-volume-${layout.width}x${layout.height}.png`),
          scale: 'css',
        });
    }
  }

  // A temporary notice must also leave each selected slider, its value and ring visible.
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  for (const { selector, value, percentage } of volumes) {
    const volume = page.locator(selector);
    for (const layout of layouts.filter((value) => value.height <= 320)) {
      await page.setViewportSize({ width: 390, height: 844 });
      const download = page.waitForEvent('download');
      await exportButton.focus();
      await exportButton.press('Enter');
      await settled(page);
      const state = parseSave(
        JSON.parse(await readFile((await (await download).path())!, 'utf8')),
      ).state;
      expect({ ...state, playTime: before.playTime }).toEqual(before);
      await volume.focus();
      await page.setViewportSize(layout);
      await writeFile(
        info.outputPath('latest-notice-rotation.json'),
        JSON.stringify({ selector, layout, ...(await selectedBounds(page)) }, null, 2),
      );
      await expect
        .poll(async () => {
          const current = await selectedBounds(page);
          return current.visible && current.noticeVisible;
        })
        .toBe(true);
      await expect(volume).toBeFocused();
      await expect(volume).toHaveValue(value);
      await expect(volume).toHaveAttribute('aria-valuetext', percentage);
      report.push({
        selector,
        layout,
        withNotice: true,
        ...(await selectedBounds(page)),
      });
      // Native Tab must reveal the whole value/control after the rotation has already settled.
      await page.locator('.panel-header [data-action="close"]').focus();
      await page.keyboard.press('Tab');
      for (let index = 0; index <= volumes.findIndex((item) => item.selector === selector); index++)
        await page.keyboard.press('Tab');
      await expect(volume).toBeFocused();
      await writeFile(
        info.outputPath('latest-keyboard-selection.json'),
        JSON.stringify({ selector, layout, ...(await selectedBounds(page)) }, null, 2),
      );
      await expect
        .poll(async () => {
          const current = await selectedBounds(page);
          return current.visible && current.noticeVisible;
        })
        .toBe(true);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(volume).toBeFocused();
      await expect
        .poll(async () => {
          const current = await selectedBounds(page);
          return current.visible && current.noticeVisible;
        })
        .toBe(true);
      report.push({
        selector,
        layout,
        withNotice: true,
        keyboardSelection: true,
        ...(await selectedBounds(page)),
      });
      await page.screenshot({
        path: info.outputPath(
          `selected-${selector.slice(1)}-notice-${layout.width}x${layout.height}.png`,
        ),
        scale: 'css',
      });
    }
  }
  await expect(page.locator('[data-setting="quality"]')).toHaveValue('low');
  await expect(page.locator('[data-setting="textSize"]')).toHaveValue('large');
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
  await dismiss(page);
  const opener = page.getByRole('button', { name: 'Settings and saves', exact: true });
  await expect(opener).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('reading-rotation.json'), JSON.stringify(report, null, 2));
});
