import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { exported, settled } from '../helpers/connection-browser';
import {
  painted,
  readingPosition,
  storyRegister,
  track,
  trackingAtReadingBoundary,
} from '../helpers/journal-browser';

async function focusedReplacementFilter(page: Page) {
  await page.evaluate(() => {
    const overlay = document.querySelector('#overlay')!;
    const previous = overlay.querySelector('.panel');
    const observer = new MutationObserver(() => {
      if (overlay.querySelector('.panel') === previous) return;
      const filter = overlay.querySelector<HTMLSelectElement>('[data-journal-filter]');
      if (!filter) return;
      filter.focus();
      observer.disconnect();
    });
    observer.observe(overlay, { childList: true });
  });
}

/** Hold one native save completion while the existing Journal remains available to the reader. */
async function heldSave(page: Page) {
  return page.evaluateHandle(() => {
    const put = IDBObjectStore.prototype.put;
    let armed = true;
    let holding = false;
    let release: (() => void) | undefined;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      if (this.name !== 'saves' || args[1] !== 'auto' || !armed) return request;
      armed = false;
      let released = false;
      request.addEventListener('success', (event) => {
        if (released) return;
        event.stopImmediatePropagation();
        holding = true;
        release = () => {
          released = true;
          holding = false;
          request.dispatchEvent(new Event('success'));
        };
      });
      return request;
    };
    return {
      holding: () => holding,
      release: () => release?.(),
      dispose() {
        IDBObjectStore.prototype.put = put;
        release?.();
      },
    };
  });
}

test('keyboard story tracking retains its selected row while opening a story starts its reading view', async ({
  page,
  isMobile,
}, info) => {
  const journey = await storyRegister(page, isMobile);
  await page.locator(track).scrollIntoViewIfNeeded();
  await page.locator(track).focus();
  const before = await readingPosition(page);
  expect(before.visible).toBe(true);
  expect(before.scrollTop).toBeGreaterThan(0);
  await page.locator(track).press('Enter');
  await settled(page);
  await expect(page.locator(track)).toHaveText('Tracked');
  await painted(page);
  await expect(page.locator(track)).toBeFocused();
  const after = await readingPosition(page);
  expect(after.visible).toBe(true);
  expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThanOrEqual(1);
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('tracked-story-retained.png'), scale: 'css' });
  await writeFile(
    info.outputPath('tracked-story-position.json'),
    JSON.stringify({ before, after }),
  );

  await page.locator('.story-register [data-action="open-story"][data-value="neighbors"]').click();
  await settled(page);
  await expect(page.locator('[data-journal-filter]')).toHaveValue('neighbors');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  expect(await page.locator('.panel-body').evaluate((body) => body.scrollTop)).toBe(0);
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('neighbors');
});

test('native pointer story tracking keeps the scrolled row after leaving a preference control', async ({
  page,
  isMobile,
}, info) => {
  const journey = await storyRegister(page, isMobile);
  await page.locator('[data-journal-filter]').focus();
  await page.locator(track).scrollIntoViewIfNeeded();
  const before = await readingPosition(page);
  expect(before.visible).toBe(true);
  expect(before.scrollTop).toBeGreaterThan(0);
  if (isMobile) await page.locator(track).tap();
  else await page.locator(track).click();
  await settled(page);
  await expect(page.locator(track)).toHaveText('Tracked');
  await painted(page);
  const after = await readingPosition(page);
  expect(after.visible).toBe(true);
  expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThanOrEqual(1);
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: info.outputPath('pointer-tracked-story-retained.png'),
    scale: 'css',
  });
  await writeFile(
    info.outputPath('pointer-story-position.json'),
    JSON.stringify({ before, after }),
  );
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('neighbors');
});

test('native pointer tracking reveals a row at the reading boundary after a save notice', async ({
  page,
  isMobile,
  browserName,
}, info) => {
  await trackingAtReadingBoundary(page, isMobile, browserName, info);
});

test('tracking and story status refreshes respect a later filter choice before the next paint', async ({
  page,
  isMobile,
}) => {
  const journey = await storyRegister(page, isMobile);
  const filter = page.locator('[data-journal-filter]');
  await page.locator(track).scrollIntoViewIfNeeded();
  await page.locator(track).focus();
  await focusedReplacementFilter(page);
  await page.locator(track).press('Enter');
  await settled(page);
  await painted(page);
  await expect(filter).toBeFocused();
  await expect(filter).toBeInViewport({ ratio: 1 });

  const available = page.locator('[data-action="journal-status"][data-value="available"]');
  await available.focus();
  await available.press('Enter');
  await settled(page);
  await painted(page);
  await expect(available).toHaveAttribute('aria-pressed', 'true');
  await expect(available).toBeFocused();
  const completed = page.locator('[data-action="journal-status"][data-value="completed"]');
  await completed.focus();
  await focusedReplacementFilter(page);
  await completed.press('Enter');
  await settled(page);
  await painted(page);
  await expect(completed).toHaveAttribute('aria-pressed', 'true');
  await expect(filter).toBeFocused();
  await expect(filter).toBeInViewport({ ratio: 1 });
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('neighbors');
});

test('a delayed tracking save preserves the reader’s newer old-surface control and footer Close', async ({
  page,
  isMobile,
}, info) => {
  const journey = await storyRegister(page, isMobile);
  const positions = [];
  for (const [story, selector] of [
    ['neighbors', '.journey-tools [data-action="recap"]'],
    ['village', '.panel-footer [data-action="close"]'],
  ]) {
    const target = page.locator(
      `.story-register [data-action="track-story"][data-value="${story}"]`,
    );
    await target.scrollIntoViewIfNeeded();
    await target.focus();
    const panel = await page.locator('.panel').elementHandle();
    const probe = await heldSave(page);
    try {
      await target.press('Enter');
      await expect.poll(() => probe.evaluate((probe) => probe.holding())).toBe(true);
      await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'true');
      expect(await panel!.evaluate((element) => element.isConnected)).toBe(true);
      const choice = page.locator(selector!);
      await choice.focus();
      await expect(choice).toBeFocused();
      const scroll = await page.locator('.panel-body').evaluate((body) => body.scrollTop);
      await probe.evaluate((probe) => probe.release());
      await settled(page);
      await painted(page);
      expect(await panel!.evaluate((element) => element.isConnected)).toBe(false);
      await expect(choice).toBeFocused();
      const retained = await page.locator('.panel-body').evaluate((body) => body.scrollTop);
      expect(Math.abs(retained - scroll)).toBeLessThanOrEqual(1);
      positions.push({ story, selector, scroll, retained });
    } finally {
      await probe.evaluate((probe) => probe.dispose());
      await probe.dispose();
      await panel?.dispose();
    }
  }
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).not.toBeFocused();
  await page.screenshot({ path: info.outputPath('delayed-save-footer-focus.png'), scale: 'css' });
  await writeFile(info.outputPath('delayed-save-position.json'), JSON.stringify(positions));
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('village');
});
