import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { dismiss, exported, ready, settled } from './connection-browser';

const shortcut = '.quest-card .village-shortcut';

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

export async function questNoticePosition(page: Page) {
  return page.locator('.quest-card').evaluate((card) => {
    const button = card.querySelector<HTMLElement>('.village-shortcut')!;
    const toast = document.querySelector<HTMLElement>('#toast')!;
    const reading = card.getBoundingClientRect();
    const control = button.getBoundingClientRect();
    const notice = toast.getBoundingClientRect();
    const rect = (bounds: DOMRect) => ({
      top: bounds.top,
      bottom: bounds.bottom,
      left: bounds.left,
      right: bounds.right,
      height: bounds.height,
    });
    const active = document.activeElement as HTMLElement | null;
    const overlapWidth = Math.max(
      0,
      Math.min(reading.right, notice.right) - Math.max(reading.left, notice.left),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(reading.bottom, notice.bottom) - Math.max(reading.top, notice.top),
    );
    return {
      card: rect(reading),
      button: rect(control),
      notice: rect(notice),
      noticeVisible: !toast.hidden,
      noticeParent: toast.parentElement?.id,
      overlapArea: toast.hidden ? 0 : overlapWidth * overlapHeight,
      scrollTop: card.scrollTop,
      activeTag: active?.tagName,
      focusedAction: active?.dataset.action,
      focusedValue: active?.dataset.value,
      expanded: card.querySelector('.objective-toggle')?.getAttribute('aria-expanded'),
      visible:
        control.top >= reading.top &&
        control.bottom <= reading.bottom &&
        control.left >= reading.left &&
        control.right <= reading.right &&
        control.top >= 0 &&
        control.bottom <= innerHeight,
    };
  });
}

async function expandedQuest(page: Page, height: number, large: boolean) {
  await page.setViewportSize({ width: 320, height });
  const state = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v3-complete-village.json', 'utf8')),
  ).state;
  await ready(page, state);
  const journey = await exported(page);
  if (large) await page.locator('[data-setting="textSize"]').selectOption('large');
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await page.locator('.objective-toggle').click();
  await expect(page.locator('.objective-toggle')).toHaveAttribute('aria-expanded', 'true');
  return journey;
}

async function settledNotice(page: Page) {
  await settled(page);
  await expect(page.locator('#toast')).toBeVisible();
  await page
    .locator('#toast')
    .evaluate((toast) => Promise.all(toast.getAnimations().map((animation) => animation.finished)));
  await painted(page);
}

function clearNotice(position: Awaited<ReturnType<typeof questNoticePosition>>) {
  expect(position.noticeVisible).toBe(true);
  expect(position.noticeParent).toBe('ui');
  expect(position.overlapArea).toBe(0);
  expect(position.card.bottom).toBeLessThanOrEqual(position.notice.top);
  expect(position.visible).toBe(true);
  expect(position.expanded).toBe('true');
}

export async function keyboardQuestNotice(page: Page, info: TestInfo) {
  const journey = await expandedQuest(page, 568, false);
  await page.locator(shortcut).focus();
  const before = await questNoticePosition(page);
  const positions: Awaited<ReturnType<typeof questNoticePosition>>[] = [];
  for (const [index, height] of [568, 548, 568].entries()) {
    if (index) {
      await page.setViewportSize({ width: 320, height });
      await painted(page);
      await expect(page.locator(shortcut)).toBeFocused();
    }
    // Each resized layout receives real tracking feedback with its natural 4.8 s lifetime.
    // Software-rendered WebGL can use that entire lifetime on browser round trips alone.
    await page.locator(shortcut).press('Enter');
    await settledNotice(page);
    await expect(page.locator(shortcut)).toHaveAttribute(
      'data-value',
      index === 1 ? 'village' : 'main',
    );
    await expect(page.locator(shortcut)).toBeFocused();
    const position = await questNoticePosition(page);
    positions.push(position);
    await writeFile(
      info.outputPath('quest-notice-keyboard-position.json'),
      JSON.stringify({ before, positions }),
    );
    clearNotice(position);
    await page.screenshot({
      path: info.outputPath(`quest-notice-keyboard-${height}-${index}.png`),
      scale: 'css',
    });
  }
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await painted(page);
  await expect(page.locator(shortcut)).toBeFocused();
  const expired = await questNoticePosition(page);
  expect(expired.visible).toBe(true);
  expect(Math.abs(expired.card.height - before.card.height)).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: info.outputPath('quest-notice-keyboard-expired.png'),
    scale: 'css',
  });
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('village');
  await writeFile(
    info.outputPath('quest-notice-keyboard-position.json'),
    JSON.stringify({ before, positions, expired, journey, saved }),
  );
}

export async function pointerQuestNotice(
  page: Page,
  touch: boolean,
  browserName: string,
  info: TestInfo,
) {
  const journey = await expandedQuest(page, 548, true);
  // Native WebKit tap blurs this persistent control to BODY; don't pre-focus the shortcut.
  await page.locator('.toolbar [data-action="map"]').focus();
  await page.locator(shortcut).scrollIntoViewIfNeeded();
  const before = await questNoticePosition(page);
  expect(before.visible).toBe(true);
  if (touch) await page.locator(shortcut).tap();
  else await page.locator(shortcut).click();
  await settledNotice(page);
  await expect(page.locator(shortcut)).toHaveAttribute('data-value', 'main');
  const after = await questNoticePosition(page);
  await page.screenshot({ path: info.outputPath('quest-notice-pointer.png'), scale: 'css' });
  await writeFile(
    info.outputPath('quest-notice-pointer-position.json'),
    JSON.stringify({ before, after }),
  );
  if (browserName === 'webkit') expect(after.activeTag).toBe('BODY');
  else await expect(page.locator(shortcut)).toBeFocused();
  clearNotice(after);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await painted(page);
  const expired = await questNoticePosition(page);
  expect(expired.visible).toBe(true);
  expect(Math.abs(expired.card.height - before.card.height)).toBeLessThanOrEqual(1);
  if (browserName === 'webkit') expect(expired.activeTag).toBe('BODY');
  else await expect(page.locator(shortcut)).toBeFocused();
  await page.screenshot({
    path: info.outputPath('quest-notice-pointer-expired.png'),
    scale: 'css',
  });
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('village');
  await writeFile(
    info.outputPath('quest-notice-pointer-position.json'),
    JSON.stringify({ before, after, expired, journey, saved }),
  );
}

export async function graphicsQuestNotice(
  page: Page,
  info: TestInfo,
  touch = false,
  browserName = '',
) {
  const journey = await expandedQuest(page, 568, true);
  await page.locator(shortcut).focus();
  const before = await questNoticePosition(page);
  expect(before.visible).toBe(true);
  const extension = await page
    .locator('#game-canvas')
    .evaluateHandle((node) =>
      (node as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context'),
    );
  expect(await extension.evaluate((value) => !!value)).toBe(true);
  const positions: Awaited<ReturnType<typeof questNoticePosition>>[] = [];
  try {
    await extension.evaluate((value) => value!.loseContext());
    await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'true');
    await expect(page.locator('#toast')).toContainText('Graphics paused');
    await expect(page.locator('#toast')).toHaveAttribute('data-held', 'true');
    await settledNotice(page);
    await expect(page.locator(shortcut)).toBeFocused();
    positions.push(await questNoticePosition(page));
    await page.screenshot({
      path: info.outputPath('quest-notice-graphics-paused.png'),
      scale: 'css',
    });
    await writeFile(
      info.outputPath('quest-notice-graphics-position.json'),
      JSON.stringify({ before, positions }),
    );
    clearNotice(positions[0]!);
    for (const height of [548, 568]) {
      await page.setViewportSize({ width: 320, height });
      await painted(page);
      await expect(page.locator(shortcut)).toBeFocused();
      const position = await questNoticePosition(page);
      clearNotice(position);
      positions.push(position);
    }
    // A held outage ribbon must remain clear beyond an ordinary notice's expiry.
    await page.waitForTimeout(5100);
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator(shortcut)).toBeFocused();
    const held = await questNoticePosition(page);
    clearNotice(held);
    positions.push(held);
    await page.screenshot({
      path: info.outputPath('quest-notice-graphics-held.png'),
      scale: 'css',
    });
    await expect(page.locator(shortcut)).toBeEnabled();
    if (touch) {
      await page.locator('.toolbar [data-action="map"]').focus();
      await page.locator(shortcut).tap();
    } else await page.locator(shortcut).press('Enter');
    await settledNotice(page);
    await expect(page.locator(shortcut)).toHaveAttribute('data-value', 'main');
    await expect(page.locator('#toast')).toHaveAttribute('data-held', 'false');
    const tracking = await questNoticePosition(page);
    if (touch && browserName === 'webkit') expect(tracking.activeTag).toBe('BODY');
    else await expect(page.locator(shortcut)).toBeFocused();
    clearNotice(tracking);
    positions.push(tracking);
    await page.screenshot({
      path: info.outputPath('quest-notice-paused-tracking.png'),
      scale: 'css',
    });
    await expect(page.locator('#toast')).toContainText('Graphics paused', { timeout: 10_000 });
    await expect(page.locator('#toast')).toHaveAttribute('data-held', 'true');
    await settledNotice(page);
    const returned = await questNoticePosition(page);
    await writeFile(
      info.outputPath('quest-notice-graphics-position.json'),
      JSON.stringify({ before, positions, returned }),
    );
    clearNotice(returned);
    positions.push(returned);
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
    if (touch) await page.locator(shortcut).tap();
    else await page.locator(shortcut).press('Enter');
    await settledNotice(page);
    await expect(page.locator(shortcut)).toHaveAttribute('data-value', 'village');
    await expect(page.locator('.toolbar [data-action="map"]')).toBeFocused();
    const later = await questNoticePosition(page);
    clearNotice(later);
    positions.push(later);
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
  await expect(page.locator('#toast')).toContainText('The view has been restored.');
  await settledNotice(page);
  await expect(page.locator('.toolbar [data-action="map"]')).toBeFocused();
  const restored = await questNoticePosition(page);
  clearNotice(restored);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await painted(page);
  await expect(page.locator('.toolbar [data-action="map"]')).toBeFocused();
  const expired = await questNoticePosition(page);
  expect(expired.visible).toBe(true);
  expect(Math.abs(expired.card.height - before.card.height)).toBeLessThanOrEqual(1);
  const saved = await exported(page);
  expect({ ...saved, tracking: journey.tracking, playTime: journey.playTime }).toEqual(journey);
  expect(saved.tracking).toBe('main');
  await writeFile(
    info.outputPath('quest-notice-graphics-position.json'),
    JSON.stringify({ before, positions, restored, expired, journey, saved }),
  );
}
