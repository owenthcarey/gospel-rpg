import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { dismiss, exported, ready, settled } from './connection-browser';
import { parseSave } from '../../src/persistence/schema';

export const track = '.story-register [data-action="track-story"][data-value="neighbors"]';

export async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

export async function readingPosition(page: Page) {
  return page.locator('.panel-body').evaluate((body) => {
    const button = document.querySelector<HTMLElement>(
      '.story-register [data-action="track-story"][data-value="neighbors"]',
    )!;
    const control = button.getBoundingClientRect();
    const reading = body.getBoundingClientRect();
    const active = document.activeElement as HTMLElement | null;
    return {
      scrollTop: body.scrollTop,
      activeTag: active?.tagName,
      focusedAction: active?.dataset.action,
      focusedValue: active?.dataset.value,
      controlTop: control.top,
      controlBottom: control.bottom,
      readingTop: reading.top,
      readingBottom: reading.bottom,
      scrollMarginBottom: parseFloat(getComputedStyle(button).scrollMarginBottom) || 0,
      scrollPaddingBottom: parseFloat(getComputedStyle(body).scrollPaddingBottom) || 0,
      visible: control.top >= reading.top && control.bottom <= reading.bottom,
    };
  });
}

export async function storyRegister(page: Page, isMobile: boolean) {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v6-living-capernaum.json', 'utf8')),
  ).state;
  await ready(page, state);
  const before = await exported(page);
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await dismiss(page);
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(page.locator('.story-register')).toBeVisible();
  return before;
}

/** A real pointer action at a visible reading boundary must survive notice reflow. */
export async function trackingAtReadingBoundary(
  page: Page,
  isMobile: boolean,
  browserName: string,
  info: TestInfo,
) {
  const journey = await storyRegister(page, isMobile);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await page.locator('[data-journal-filter]').focus();
  await page
    .locator('.panel')
    .evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));
  await page.locator('.panel-body').evaluate((body) => {
    const button = document.querySelector<HTMLElement>(
      '.story-register [data-action="track-story"][data-value="neighbors"]',
    )!;
    // Start fully visible, three pixels above the actual reading area's lower edge.
    body.scrollTop +=
      button.getBoundingClientRect().bottom - (body.getBoundingClientRect().bottom - 3);
  });
  const before = await readingPosition(page);
  expect(before.visible).toBe(true);
  expect(Math.abs(before.readingBottom - before.controlBottom - 3)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('pointer-boundary-before.png'), scale: 'css' });
  if (isMobile) await page.locator(track).tap();
  else await page.locator(track).click();
  await settled(page);
  await expect(page.locator(track)).toHaveText('Tracked');
  await expect(page.locator('#toast')).toBeVisible();
  await painted(page);
  await page
    .locator('.panel')
    .evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));
  const after = await readingPosition(page);
  await page.screenshot({ path: info.outputPath('pointer-boundary-after.png'), scale: 'css' });
  await writeFile(
    info.outputPath('pointer-boundary-position.json'),
    JSON.stringify({ before, after }),
  );
  expect(after.readingBottom).toBeLessThan(before.readingBottom);
  expect(after.visible).toBe(true);
  expect(after.scrollTop).toBeGreaterThanOrEqual(before.scrollTop);
  expect(after.scrollTop - before.scrollTop).toBeLessThanOrEqual(
    before.readingBottom -
      after.readingBottom +
      Math.max(before.scrollMarginBottom, after.scrollMarginBottom) +
      Math.max(before.scrollPaddingBottom, after.scrollPaddingBottom) +
      1,
  );
  if (browserName === 'webkit') expect(after.activeTag).toBe('BODY');
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('neighbors');
}
