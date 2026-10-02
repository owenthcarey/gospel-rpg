import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';

const shortcut = '.quest-card .village-shortcut';

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function questPosition(page: Page) {
  return page.locator('.quest-card').evaluate((card) => {
    const button = card.querySelector<HTMLElement>('.village-shortcut')!;
    const control = button.getBoundingClientRect();
    const reading = card.getBoundingClientRect();
    const active = document.activeElement as HTMLElement | null;
    return {
      scrollTop: card.scrollTop,
      maxScroll: Math.max(0, card.scrollHeight - card.clientHeight),
      focusedAction: active?.dataset.action,
      focusedValue: active?.dataset.value,
      expanded: card.querySelector('.objective-toggle')?.getAttribute('aria-expanded'),
      visible:
        control.top >= reading.top &&
        control.bottom <= reading.bottom &&
        control.left >= reading.left &&
        control.right <= reading.right,
    };
  });
}

async function expandedQuest(page: Page, isMobile: boolean) {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v3-complete-village.json', 'utf8')),
  ).state;
  await ready(page, state);
  const before = await exported(page);
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await page.locator('.objective-toggle').click();
  await expect(page.locator('.objective-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator(shortcut).focus();
  await expect(page.locator(shortcut)).toBeFocused();
  return before;
}

test('quest story shortcuts retain the inverse control through expanded tracking changes and completed memories', async ({
  page,
  isMobile,
}, info) => {
  const journey = await expandedQuest(page, isMobile);
  const positions = [];
  for (const story of ['village', 'main', 'village']) {
    const selected = page.locator(shortcut);
    await expect(selected).toHaveAttribute('data-action', 'track-story');
    await expect(selected).toHaveAttribute('data-value', story);
    await expect(selected).toBeFocused();
    const before = await questPosition(page);
    expect(before.visible).toBe(true);
    if (isMobile) expect(before.scrollTop).toBeGreaterThan(0);
    await selected.press('Enter');
    await settled(page);
    await painted(page);
    const inverse = story === 'village' ? 'main' : 'village';
    await expect(selected).toHaveAttribute('data-value', inverse);
    await expect(selected).toBeEnabled();
    await expect(selected).toBeFocused();
    await expect(selected).toBeInViewport({ ratio: 1 });
    const after = await questPosition(page);
    expect(after.expanded).toBe('true');
    expect(after.visible).toBe(true);
    // Shorter cards clamp the bookmark; longer cards may scroll enough to reveal the successor.
    expect(after.scrollTop).toBeGreaterThanOrEqual(Math.min(before.scrollTop, after.maxScroll) - 1);
    expect(after.scrollTop).toBeLessThanOrEqual(after.maxScroll);
    positions.push({ story, before, after });
  }
  await expect(page.locator('.quest-card .quest-count')).toHaveText('COMPLETE');
  await expect(page.locator('.quest-card h1')).toHaveText('An ordinary morning');
  await page.screenshot({ path: info.outputPath('quest-shortcut-retained.png'), scale: 'css' });
  await writeFile(info.outputPath('quest-shortcut-position.json'), JSON.stringify(positions));
  const memories = page.locator('.quest-card [data-action="journal"][data-value="memories"]');
  await memories.focus();
  await memories.press('Enter');
  await settled(page);
  await expect(
    page.locator('[data-action="journal-category"][data-value="memories"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('village');
});

test('quest shortcut replacement respects a later toolbar focus choice before its next paint', async ({
  page,
  isMobile,
}) => {
  const journey = await expandedQuest(page, isMobile);
  await page.evaluate(() => {
    const card = document.querySelector('.quest-card')!;
    const previous = card.firstElementChild;
    const observer = new MutationObserver(() => {
      if (card.firstElementChild === previous) return;
      observer.disconnect();
      document.querySelector<HTMLElement>('.toolbar [data-action="map"]')!.focus();
    });
    observer.observe(card, { childList: true });
  });
  await page.locator(shortcut).press('Enter');
  await settled(page);
  await painted(page);
  await expect(page.locator(shortcut)).toHaveAttribute('data-value', 'main');
  await expect(page.locator('.objective-toggle')).toHaveAttribute('aria-expanded', 'true');
  const choice = page.locator('.toolbar [data-action="map"]');
  await expect(choice).toBeFocused();
  await expect(choice).toBeInViewport({ ratio: 1 });
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('village');
});
