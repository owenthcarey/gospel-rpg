import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { routePlan } from '../../src/game/connection/routes';
import { completedJourney } from './connection';
import { dismiss, exported, ready, settled } from './connection-browser';
import { observeNavigation } from './navigation-pause-browser';

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function stableNotice(page: Page) {
  await expect(page.locator('#toast')).toBeVisible();
  await page
    .locator('#toast')
    .evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  await painted(page);
}

async function geometry(page: Page) {
  return page.locator('#travel-status').evaluate((node) => {
    const status = node as HTMLElement;
    const root = document.querySelector<HTMLElement>('#ui')!;
    const quest = root.querySelector<HTMLElement>('.quest-card')!;
    const toast = root.querySelector<HTMLElement>('#toast')!;
    const reading = status.querySelector<HTMLElement>('.travel-guidance')!;
    const cue = status.querySelector<HTMLElement>('.route-scroll-cue')!;
    const rect = (element: HTMLElement) => {
      const r = element.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const notice = rect(toast),
      card = rect(quest),
      guidance = rect(reading);
    const overlap = (a: typeof notice, b: typeof notice) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const toggle = quest.querySelector<HTMLElement>('.objective-toggle')!;
    const button = rect(toggle);
    const focused = document.activeElement as HTMLElement;
    // `normal` is a valid computed line height. Measure rendered row spacing in that case.
    const text = reading.firstChild!,
      character = document.createRange(),
      rows = new Set<number>();
    for (let offset = 0; offset < text.textContent!.length; offset++) {
      character.setStart(text, offset);
      character.setEnd(text, offset + 1);
      rows.add(character.getBoundingClientRect().top);
    }
    const orderedRows = [...rows].sort((a, b) => a - b);
    const lineHeight =
      parseFloat(getComputedStyle(reading).lineHeight) ||
      orderedRows[1]! - orderedRows[0]! ||
      character.getBoundingClientRect().height;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      status: rect(status),
      quest: card,
      notice,
      guidance,
      routeOverlap: overlap(rect(status), notice),
      questOverlap: overlap(card, notice),
      radarOverlap: overlap(rect(root.querySelector<HTMLElement>('.minimap-wrap')!), notice),
      compassOverlap: overlap(rect(root.querySelector<HTMLElement>('.minimap-compass')!), notice),
      noticeVisible: !toast.hidden,
      noticeParent: toast.parentElement?.id,
      noticeHeld: toast.dataset.held,
      noticeText: toast.textContent,
      questLimit: root.style.getPropertyValue('--quest-notice-max-height'),
      questScroll: quest.scrollTop,
      expanded: toggle.getAttribute('aria-expanded'),
      toggleVisible:
        button.top >= card.top &&
        button.bottom <= card.bottom &&
        button.left >= card.left &&
        button.right <= card.right &&
        button.bottom <= innerHeight,
      activeTag: focused.tagName,
      focusedAction: focused.dataset.action,
      fullText: reading.textContent,
      ellipsis: getComputedStyle(reading).textOverflow,
      guidanceScroll: reading.scrollTop,
      guidanceMax: reading.scrollHeight - reading.clientHeight,
      visibleLines: reading.clientHeight / lineHeight,
      cueVisible: !cue.hidden,
      cueText: cue.textContent,
      controls: [...status.querySelectorAll<HTMLButtonElement>('button')]
        .filter((el) => !el.hidden)
        .map((el) => {
          const bounds = rect(el),
            range = document.createRange();
          range.selectNodeContents(el);
          const words = range.getBoundingClientRect();
          return {
            action: el.dataset.action,
            disabled: el.disabled,
            ...bounds,
            font: getComputedStyle(el).fontSize,
            wordsVisible:
              words.top >= bounds.top &&
              words.bottom <= bounds.bottom &&
              words.left >= bounds.left &&
              words.right <= bounds.right,
          };
        }),
    };
  });
}

function clearFeedback(record: Awaited<ReturnType<typeof geometry>>) {
  expect(record.noticeVisible).toBe(true);
  expect(record.noticeParent).toBe('ui');
  expect(record.routeOverlap).toBe(0);
  expect(record.questOverlap).toBe(0);
  expect(record.radarOverlap).toBe(0);
  expect(record.compassOverlap).toBe(0);
  expect(record.visibleLines).toBeLessThanOrEqual(3.05);
  expect(record.ellipsis).not.toBe('ellipsis');
  for (const button of record.controls) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.font).toBe('12px');
    expect(button.wordsVisible).toBe(true);
    expect(button.disabled).toBe(button.action === 'route-resume');
  }
}

async function lastCharacterVisible(page: Page) {
  return page.locator('.travel-guidance').evaluate((element) => {
    const text = element.firstChild!;
    const range = document.createRange();
    range.setStart(text, text.textContent!.length - 1);
    range.setEnd(text, text.textContent!.length);
    const last = range.getBoundingClientRect(),
      bounds = element.getBoundingClientRect();
    return last.top >= bounds.top && last.bottom <= bounds.bottom;
  });
}

async function readGuidance(page: Page, touch: boolean, browserName: string) {
  const guidance = page.locator('.travel-guidance');
  await expect(guidance).toHaveAttribute('tabindex', '0');
  await expect(page.locator('.route-scroll-cue')).toBeVisible();
  await guidance.focus();
  await guidance.press('End');
  await expect.poll(() => lastCharacterVisible(page)).toBe(true);
  await expect(page.locator('.route-scroll-cue')).toContainText('above');
  await guidance.press('Home');
  await expect.poll(() => guidance.evaluate((node) => node.scrollTop)).toBe(0);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => guidance.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.down('w');
  await page.waitForTimeout(120);
  await page.keyboard.up('w');
  if (touch && browserName === 'chromium') {
    await guidance.press('Home');
    const box = (await guidance.boundingBox())!;
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ id: 1, x: box.x + box.width / 2, y: box.y + box.height - 7 }],
      });
      for (const distance of [8, 18, 30, 46, 65])
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ id: 1, x: box.x + box.width / 2, y: box.y + box.height - 7 - distance }],
        });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => lastCharacterVisible(page)).toBe(true);
    } finally {
      await session.detach();
    }
  }
  await expect(guidance).toContainText('cancel this route.');
  await guidance.focus();
  await guidance.press('j');
  await expect(page.getByRole('dialog')).toContainText('A traveler’s journal');
  await dismiss(page);
}

export async function phoneRouteHud(
  page: Page,
  available: boolean,
  large: boolean,
  touch: boolean,
  browserName: string,
  info: TestInfo,
) {
  await page.setViewportSize({ width: 320, height: 568 });
  const state = available
    ? parseSave(JSON.parse(await readFile('tests/fixtures/saves/v3-complete-village.json', 'utf8')))
        .state
    : completedJourney();
  state.connection.route = { target: available ? 'olive' : 'simon' };
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption(large ? 'large' : 'standard');
  const before = await exported(page);
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10000 });
  const original = await geometry(page);
  const plan = routePlan(before)!;
  const fullText = plan.title + ' · ' + plan.message;
  await expect(page.locator('.travel-guidance')).toHaveText(fullText);
  const resume = page.locator('#travel-status [data-action="route-resume"]');
  if (available) await expect(resume).toBeEnabled();
  else await expect(resume).toBeDisabled();
  if (!available) {
    // This runs with a live world: graphics pause must not conceal movement from reading keys.
    await readGuidance(page, touch, browserName);
    const read = await exported(page);
    expect({ ...read, playTime: before.playTime }).toEqual(before);
    await dismiss(page);
    await expect(page.locator('#toast')).toBeHidden({ timeout: 10000 });
  }
  const observation = available ? await observeNavigation(page, { loseContext: true }) : undefined;
  const extension = observation
    ? undefined
    : await page.locator('#game-canvas').evaluateHandle((node) => {
        const canvas = node as HTMLCanvasElement;
        return (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))!.getExtension(
          'WEBGL_lose_context',
        );
      });
  if (extension) expect(await extension.evaluate((value) => !!value)).toBe(true);
  const positions: Awaited<ReturnType<typeof geometry>>[] = [];
  const saves: Awaited<ReturnType<typeof exported>>[] = [];
  try {
    if (observation) {
      await resume.click();
      const { active } = await observation.observed();
      expect(active.text).toContain('Approaching Olive grove');
      expect(active.flagVisible).toBe(true);
      expect(active.graphicsPaused).not.toBe('true');
      await writeFile(info.outputPath('phone-route-active.json'), JSON.stringify(active, null, 2));
    } else await extension!.evaluate((value) => value!.loseContext());
    await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'true');
    for (const height of [568, 548]) {
      await page.setViewportSize({ width: 320, height });
      await expect(page.locator('#toast')).toHaveAttribute('data-held', 'true', { timeout: 10000 });
      await stableNotice(page);
      const held = await geometry(page);
      positions.push(held);
      clearFeedback(held);
      expect(held.fullText).toBe(fullText);
      await page.screenshot({ path: info.outputPath(`held-route-${height}.png`), scale: 'css' });
      const saved = await exported(page);
      expect({ ...saved, position: before.position, playTime: before.playTime }).toEqual(before);
      if (saves[0]) expect({ ...saved, playTime: saves[0].playTime }).toEqual(saves[0]);
      saves.push(saved);
      await dismiss(page);
      await settled(page);
      await expect(page.locator('#toast')).toContainText('Journey exported');
      await expect(page.locator('#toast')).toHaveAttribute('data-held', 'false');
      await stableNotice(page);
      const fresh = await geometry(page);
      positions.push(fresh);
      clearFeedback(fresh);
      expect(fresh.fullText).toBe(fullText);
      await page.screenshot({ path: info.outputPath(`fresh-route-${height}.png`), scale: 'css' });
      await expect(page.locator('#toast')).toHaveAttribute('data-held', 'true', { timeout: 10000 });
    }
    const toggle = page.locator('.objective-toggle');
    for (const expanded of [true, false]) {
      if (touch) await toggle.tap();
      else await toggle.click();
      await settled(page);
      await painted(page);
      const chosen = await geometry(page);
      positions.push(chosen);
      clearFeedback(chosen);
      expect(chosen.expanded).toBe(String(expanded));
      expect(chosen.toggleVisible).toBe(true);
    }
    // A later choice outside the capped card must survive subsequent notice/layout callbacks.
    const map = page.locator('.toolbar [data-action="map"]');
    await map.focus();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.setViewportSize({ width: 320, height: 548 });
    await painted(page);
    await expect(map).toBeFocused();
  } finally {
    if (observation) await observation.restore();
    else {
      await extension!.evaluate((value) => value!.restoreContext());
      await extension!.dispose();
    }
  }
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
  if (available) await expect(resume).toBeEnabled();
  else await expect(resume).toBeDisabled();
  await expect(page.locator('.toolbar [data-action="map"]')).toBeFocused();
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10000 });
  await painted(page);
  const expired = await geometry(page);
  expect(expired.questLimit).toBe('');
  expect(expired.quest.height).toBe(original.quest.height);
  expect(expired.expanded).toBe('false');
  const after = await exported(page);
  expect({ ...after, playTime: saves[0]!.playTime }).toEqual(saves[0]);
  await writeFile(
    info.outputPath('phone-route-hud.json'),
    JSON.stringify(
      { available, large, original, positions, expired, before, saves, after },
      null,
      2,
    ),
  );
}
