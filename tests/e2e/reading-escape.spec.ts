import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { ready, exported, settled, dismiss } from '../helpers/connection-browser';

// Chromium's headless picker closes between frames even on a bare select.
// Keep this native-popup case windowed; ordinary reading checks stay headless.
const nativePickerTest = test.extend({
  headless: [
    async ({ browserName, headless }, use) => {
      await use(browserName === 'chromium' ? false : headless);
    },
    { scope: 'worker' },
  ],
});

async function preferences(page: Page) {
  return page.locator('.panel-body').evaluate((body) =>
    Array.from(body.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')).map(
      (control) => ({
        setting: control.dataset.setting,
        value: control.value,
        checked: control instanceof HTMLInputElement ? control.checked : undefined,
      }),
    ),
  );
}

test('Escape returns from selected settings controls without changing preferences or the journey', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const before = await exported(page);
  const original = await preferences(page);
  const selectors = [
    '#audio-volume',
    '#audio-musicVolume',
    '#audio-ambienceVolume',
    '#audio-effectsVolume',
    '[data-setting="sound"]',
    '[data-setting="reducedMotion"]',
    '[data-setting="quality"]',
    '[data-setting="guidance"]',
    '[data-setting="textSize"]',
    '#import-save',
  ];
  const report = [];
  for (const layout of [
    page.viewportSize()!,
    { width: 568, height: 320 },
    { width: 844, height: 300 },
  ]) {
    await page.setViewportSize(layout);
    for (const selector of selectors) {
      await expect(page.getByRole('dialog')).toBeVisible();
      const control = page.locator(selector);
      await control.focus();
      await expect(control).toBeFocused();
      // Editing controls still own ordinary game shortcuts.
      await page.keyboard.press('j');
      await expect(page.getByRole('heading', { name: 'A moment of rest' })).toBeVisible();
      await expect(control).toBeFocused();
      expect(await preferences(page)).toEqual(original);
      const selection = { selector, layout, preferences: await preferences(page) };
      await writeFile(info.outputPath('latest-escape.json'), JSON.stringify(selection, null, 2));
      await page.keyboard.press('Escape');
      await settled(page);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('#game-canvas')).toBeFocused();
      report.push(selection);
      await page.keyboard.press('Escape');
      await settled(page);
      await expect(page.getByRole('heading', { name: 'A moment of rest' })).toBeVisible();
      expect(await preferences(page)).toEqual(original);
    }
  }
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
  expect(await preferences(page)).toEqual(original);
  await dismiss(page);
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('settings-escape.json'), JSON.stringify(report, null, 2));
});

nativePickerTest(
  'a native select cancels its open picker before Escape returns to exploration',
  async ({ page, isMobile, browserName }, info) => {
    await ready(page);
    await expect(page.locator('.chapter-card')).toHaveCount(0);
    const before = await exported(page);
    await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
    const original = await preferences(page);
    const quality = page.locator('[data-setting="quality"]');
    await expect(quality).toHaveValue('low');
    const native = (await quality.elementHandle())!;
    await native.evaluate((control) => {
      const record = (event: KeyboardEvent, phase: string) => {
        if (event.target !== control) return;
        const records = JSON.parse(control.dataset.nativePickerEvents ?? '[]');
        records.push({
          key: event.key,
          phase,
          prevented: event.defaultPrevented,
          open: CSS.supports('selector(select:open)') && control.matches(':open'),
          value: (control as HTMLSelectElement).value,
        });
        control.dataset.nativePickerEvents = JSON.stringify(records);
      };
      window.addEventListener('keydown', (event) => record(event, 'capture'), true);
      window.addEventListener('keydown', (event) => record(event, 'bubble'));
    });
    await quality.focus();
    if (isMobile) await quality.tap();
    else if (browserName === 'firefox') await page.keyboard.press('Space');
    else await quality.click();
    await expect.poll(() => native.evaluate((control) => control.matches(':open'))).toBe(true);
    // macOS desktop cancels a pending arrow selection; Linux's picker keeps the arrow choice.
    // Exercise popup cancellation before changing the native selection on Linux and phones.
    if (!isMobile && process.platform === 'darwin') await page.keyboard.press('ArrowUp');
    const opened = await native.evaluate((control) => ({
      supported: CSS.supports('selector(select:open)'),
      open: CSS.supports('selector(select:open)') && control.matches(':open'),
      value: (control as HTMLSelectElement).value,
    }));
    expect(opened.open).toBe(true);
    await page.keyboard.press('Escape');
    await writeFile(
      info.outputPath('native-picker.json'),
      JSON.stringify(
        {
          opened,
          events: await native.evaluate((control) =>
            JSON.parse(control.dataset.nativePickerEvents ?? '[]'),
          ),
        },
        null,
        2,
      ),
    );
    await expect(page.getByRole('heading', { name: 'A moment of rest' })).toBeVisible();
    await expect(quality).toHaveValue('low');
    await expect(quality).toBeFocused();
    expect(await preferences(page)).toEqual(original);
    await expect.poll(() => native.evaluate((control) => control.matches(':open'))).toBe(false);
    await page.keyboard.press('Escape');
    await settled(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#game-canvas')).toBeFocused();
    const after = await exported(page);
    expect({ ...after, playTime: before.playTime }).toEqual(before);
    expect(await preferences(page)).toEqual(original);
  },
);
