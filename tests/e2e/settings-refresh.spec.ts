import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { exported, ready, settled } from '../helpers/connection-browser';
import { parseSave } from '../../src/persistence/schema';

const slot = '[data-action="save-slot"][data-value="slot-3"]';

async function savedSlot(page: Page) {
  const raw = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('the-way-journeys');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction('saves', 'readonly').objectStore('saves').get('slot-3');
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
  return raw === null ? null : parseSave(raw).state;
}

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function readingPosition(page: Page) {
  return page.locator('.panel-body').evaluate((body) => {
    const active = document.activeElement as HTMLElement | null;
    const button = document.querySelector<HTMLElement>(
      '[data-action="save-slot"][data-value="slot-3"]',
    )!;
    const control = button.getBoundingClientRect();
    const reading = body.getBoundingClientRect();
    return {
      scrollTop: body.scrollTop,
      focusedAction: active?.dataset.action,
      focusedValue: active?.dataset.value,
      visible: control.top >= reading.top && control.bottom <= reading.bottom,
      control: { top: control.top, bottom: control.bottom },
      reading: { top: reading.top, bottom: reading.bottom },
    };
  });
}

async function selectedSave(page: Page, isMobile: boolean) {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  await ready(page);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await settled(page);
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  const before = await exported(page);
  await page.locator(slot).scrollIntoViewIfNeeded();
  await page.locator(slot).focus();
  await expect(page.locator(slot)).toBeFocused();
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  return before;
}

test('keyboard manual saves preserve the selected slot and reading position without changing the journey', async ({
  page,
  isMobile,
}, info) => {
  const before = await selectedSave(page, isMobile);
  const reading = await readingPosition(page);
  expect(reading.visible).toBe(true);
  if (isMobile) expect(reading.scrollTop).toBeGreaterThan(500);
  const positions = [reading];
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.locator(slot).press('Enter');
    await settled(page);
    await expect(page.locator('#toast')).toContainText('Your journey has been saved.');
    await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
    await painted(page);
    await expect(page.locator(slot)).toBeFocused();
    await expect(page.locator('[data-action="load-slot"][data-value="slot-3"]')).toBeEnabled();
    const position = await readingPosition(page);
    expect(position.visible).toBe(true);
    if (isMobile) expect(position.scrollTop).toBeGreaterThan(reading.scrollTop * 0.6);
    positions.push(position);
    const stored = (await savedSlot(page))!;
    expect({ ...stored, playTime: before.playTime }).toEqual(before);
  }
  await page.screenshot({ path: info.outputPath('selected-save-retained.png'), scale: 'css' });
  await writeFile(
    info.outputPath('settings-save-position.json'),
    JSON.stringify(positions, null, 2),
  );
});

test('a settings save refresh respects focus chosen in the replacement surface before its next paint', async ({
  page,
  isMobile,
}) => {
  const before = await selectedSave(page, isMobile);
  await page.evaluate(() => {
    const overlay = document.querySelector('#overlay')!;
    const previous = overlay.querySelector('.panel');
    const observer = new MutationObserver(() => {
      if (overlay.querySelector('.panel') === previous) return;
      const input = overlay.querySelector<HTMLSelectElement>('[data-setting="textSize"]');
      if (input) {
        input.focus();
        observer.disconnect();
      }
    });
    observer.observe(overlay, { childList: true });
  });
  await page.locator(slot).press('Enter');
  await settled(page);
  await expect(page.locator('#toast')).toContainText('Your journey has been saved.');
  await painted(page);
  const input = page.locator('[data-setting="textSize"]');
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport({ ratio: 1 });
  const stored = (await savedSlot(page))!;
  expect({ ...stored, playTime: before.playTime }).toEqual(before);
});

test('a failed manual save keeps its existing panel, selected slot and recoverable journey', async ({
  page,
  isMobile,
}, info) => {
  const before = await selectedSave(page, isMobile);
  const panel = await page.locator('.panel').elementHandle();
  const button = await page.locator(slot).elementHandle();
  const probe = await page.evaluateHandle(() => {
    const put = IDBObjectStore.prototype.put;
    let attempts = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'saves' && args[1] === 'slot-3') {
        attempts++;
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
    return {
      attempts: () => attempts,
      dispose() {
        IDBObjectStore.prototype.put = put;
      },
    };
  });
  try {
    await page.locator(slot).press('Enter');
    await settled(page);
    await expect(page.locator('#toast')).toContainText('The save could not be written.');
    await painted(page);
    expect(await probe.evaluate((probe) => probe.attempts())).toBe(1);
    expect(await panel!.evaluate((element) => element.isConnected)).toBe(true);
    expect(await button!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.locator(slot)).toBeFocused();
    expect((await readingPosition(page)).visible).toBe(true);
    expect(await savedSlot(page)).toBeNull();
    await expect(page.locator('[data-action="load-slot"][data-value="slot-3"]')).toBeDisabled();
    await page.screenshot({ path: info.outputPath('failed-save-retained.png'), scale: 'css' });
    const portable = await exported(page);
    expect({ ...portable, playTime: before.playTime }).toEqual(before);
  } finally {
    await probe.evaluate((probe) => probe.dispose());
    await probe.dispose();
    await panel?.dispose();
    await button?.dispose();
  }
});
