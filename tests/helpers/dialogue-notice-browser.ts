import { expect, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { dismiss, exported, ready, settled, visit } from './connection-browser';

const exportFeedback = 'Journey exported. Keep the file somewhere safe.';

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

export async function dialogueNoticeGeometry(page: Page) {
  return page.locator('#toast').evaluate((element) => {
    const toast = element as HTMLElement;
    const box = document.querySelector<HTMLElement>('.dialogue-box')!;
    const text = box.querySelector<HTMLElement>('.dialogue-text')!;
    const first = box.querySelector<HTMLElement>('[data-action="choice"]')!;
    const active = document.activeElement as HTMLElement;
    const css = getComputedStyle(toast);
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const intersection = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => {
      const left = Math.max(a.left, b.left),
        right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top),
        bottom = Math.min(a.bottom, b.bottom);
      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    };
    const area = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => {
      const r = intersection(a, b);
      return r.width * r.height;
    };
    const notice = rect(toast),
      dialogue = rect(box),
      answer = rect(first);
    const screen = {
      left: 0,
      top: 0,
      right: innerWidth,
      bottom: innerHeight,
      width: innerWidth,
      height: innerHeight,
    };
    const visibleText = intersection(intersection(rect(text), dialogue), screen);
    const focused = rect(active);
    const answerRange = document.createRange();
    answerRange.selectNodeContents(first);
    const words = answerRange.getBoundingClientRect();
    const verticalInsets = [
      'paddingTop',
      'paddingBottom',
      'borderTopWidth',
      'borderBottomWidth',
    ].reduce(
      (sum, property) => sum + parseFloat(css[property as keyof CSSStyleDeclaration] as string),
      0,
    );
    const naturalHeight =
      Math.max(
        toast.querySelector<HTMLElement>('.toast-icon')!.offsetHeight,
        toast.querySelector<HTMLElement>('.toast-text')!.offsetHeight,
      ) + verticalInsets;
    const topbar = rect(document.querySelector('.topbar')!);
    const noticeText = toast.querySelector<HTMLElement>('.toast-text')!;
    const noticeWords: ReturnType<typeof rect>[] = [];
    const walker = document.createTreeWalker(noticeText, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const contents = node.textContent ?? '';
      for (const word of contents.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index!);
        range.setEnd(node, word.index! + word[0].length);
        for (const r of range.getClientRects()) {
          noticeWords.push({
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          });
        }
      }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      toast: notice,
      topbar,
      dialogue,
      dialogueText: rect(text),
      visibleDialogueText: visibleText,
      firstAnswer: answer,
      focused,
      focusedAction: active.dataset.action,
      focusedValue: active.dataset.value,
      toastParent: toast.parentElement?.id,
      toastVisible: !toast.hidden,
      toastText: toast.textContent,
      noticeText: noticeText.textContent,
      noticeWords,
      completeNoticeWordsVisible:
        noticeWords.length > 0 &&
        noticeWords.every(
          (word) =>
            word.left >= notice.left &&
            word.right <= notice.right &&
            word.top >= notice.top &&
            word.bottom <= notice.bottom &&
            word.left >= 0 &&
            word.right <= innerWidth &&
            word.top >= 0 &&
            word.bottom <= innerHeight,
        ),
      noticeWithinViewport:
        notice.left >= 0 &&
        notice.right <= innerWidth &&
        notice.top >= 0 &&
        notice.bottom <= innerHeight,
      topbarOverlapArea: area(notice, topbar),
      dialogueTextOpacity: getComputedStyle(text).opacity,
      firstAnswerOpacity: getComputedStyle(first).opacity,
      firstAnswerFullyVisible:
        answer.top >= dialogue.top &&
        answer.bottom <= dialogue.bottom &&
        answer.left >= dialogue.left &&
        answer.right <= dialogue.right &&
        answer.top >= 0 &&
        answer.bottom <= innerHeight,
      firstAnswerWordsVisible:
        words.top >= answer.top &&
        words.bottom <= answer.bottom &&
        words.left >= answer.left &&
        words.right <= answer.right,
      toastStyle: {
        position: css.position,
        top: css.top,
        bottom: css.bottom,
        height: css.height,
        maxHeight: css.maxHeight,
        left: css.left,
        width: css.width,
        transform: css.transform,
        opacity: css.opacity,
        animationName: css.animationName,
        animationDuration: css.animationDuration,
      },
      animationPhase: toast.getAnimations().map((animation) => ({
        currentTime: animation.currentTime,
        playState: animation.playState,
        timing: animation.effect?.getComputedTiming(),
      })),
      naturalHeight,
      dialogueOverlapArea: area(notice, dialogue),
      visibleDialogueTextOverlapArea: area(notice, visibleText),
      focusedControlOverlapArea: area(notice, focused),
      dialogScroll: box.scrollTop,
      dialogScrollMax: box.scrollHeight - box.clientHeight,
    };
  });
}

export async function readyDialogueNotice(page: Page, info: TestInfo) {
  const file = 'tests/fixtures/saves/v1-arrival.json';
  const bytes = await readFile(file);
  const state = {
    ...parseSave(JSON.parse(bytes.toString('utf8'))).state,
    // Legal authored ground within Simon's conversation radius. No path is
    // required, so feedback layout cannot be confused with arrival progress.
    position: { x: 4, z: 0 },
  };
  await ready(page, state);
  await writeFile(
    info.outputPath('dialogue-notice-fixture.json'),
    JSON.stringify(
      {
        file,
        fixtureSha256: createHash('sha256').update(bytes).digest('hex'),
        importedState: state,
        served: await page.evaluate(() => ({
          scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(
            (node) => node.src,
          ),
          styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
            (node) => node.href,
          ),
        })),
      },
      null,
      2,
    ),
  );
  return state;
}

export async function openDialogueNotice(page: Page) {
  const before = await exported(page);
  await dismiss(page);
  await visit(page, 'simon');
  return before;
}

export async function captureDialogueNotice(page: Page, info: TestInfo, label: string) {
  await expect(page.locator('#ui')).toHaveClass(/conversing/);
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast .toast-text')).toHaveText(exportFeedback);
  await page
    .locator('#toast')
    .evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
  // Real harmless keyboard input finishes the authored reveal without choosing
  // an answer or altering the selected first answer.
  await page.keyboard.press('Shift');
  await painted(page);
  const held = await dialogueNoticeGeometry(page);
  await writeFile(info.outputPath(`${label}-visible.json`), JSON.stringify(held, null, 2));
  await page.screenshot({ path: info.outputPath(`${label}-visible.png`), scale: 'css' });
  expect(held.toastVisible).toBe(true);
  expect(held.toastParent).toBe('ui');
  expect(held.focusedAction).toBe('choice');
  expect(held.focusedValue).toBe('0');
  expect(held.dialogueTextOpacity).toBe('1');
  expect(held.firstAnswerOpacity).toBe('1');
  expect(held.noticeText).toBe(exportFeedback);
  // Both bounds matter: competing vertical insets can stretch a desktop notice
  // or compress a short landscape notice below its readable content height.
  expect(held.toast.height).toBeGreaterThanOrEqual(held.naturalHeight - 2);
  expect(held.toast.height).toBeLessThanOrEqual(held.naturalHeight + 2);
  expect(held.noticeWithinViewport).toBe(true);
  expect(held.topbarOverlapArea).toBe(0);
  expect(held.completeNoticeWordsVisible).toBe(true);
  expect(held.dialogueOverlapArea).toBe(0);
  expect(held.visibleDialogueTextOverlapArea).toBe(0);
  expect(held.firstAnswerFullyVisible).toBe(true);
  expect(held.firstAnswerWordsVisible).toBe(true);
  expect(held.focusedControlOverlapArea).toBe(0);
  return held;
}

export async function checkDialogueNoticeLifecycle(
  page: Page,
  info: TestInfo,
  label: string,
  before: GameState,
) {
  const held = await captureDialogueNotice(page, info, label);
  // Observe the real lease. No timer override, dismissal or Messages action
  // may hide the ribbon before this ordinary expiry assertion.
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10000 });
  await painted(page);
  const expired = await dialogueNoticeGeometry(page);
  await writeFile(info.outputPath(`${label}-expired.json`), JSON.stringify(expired, null, 2));
  await page.screenshot({ path: info.outputPath(`${label}-expired.png`), scale: 'css' });
  expect(expired.toastVisible).toBe(false);
  await expect(page.locator('.dialogue-box [data-action="choice"]').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.locator('#game-canvas')).toBeFocused();
  // Check the original feedback before another Export can add the same message.
  await page.locator('[data-action="messages"]').click();
  await expect(page.getByRole('dialog', { name: 'Game messages', exact: true })).toBeVisible();
  await expect(page.locator('.message-list')).toContainText(exportFeedback);
  await writeFile(
    info.outputPath(`${label}-original-export-history.json`),
    JSON.stringify(
      {
        originalFeedback: exportFeedback,
        historyBeforeReexport: await page.locator('.message-list').innerText(),
      },
      null,
      2,
    ),
  );
  await dismiss(page);
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
  await writeFile(
    info.outputPath(`${label}-state.json`),
    JSON.stringify({ before, after }, null, 2),
  );
  return { before, after, held, expired };
}
