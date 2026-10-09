import { expect, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { dismiss, exported, ready, settled } from './connection-browser';

const exportFeedback = 'Journey exported. Keep the file somewhere safe.';

async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** Read the same geometry while the real notice is visible, retaining it across driver latency. */
async function observeDialogueNotice(page: Page) {
  return page.evaluateHandle((expected) => {
    const read = () => {
      const toast = document.querySelector<HTMLElement>('#toast')!;
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
        dialogueSpeaker: box.querySelector('#dialogue-speaker')?.textContent,
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
    };
    const inputs: {
      type: string;
      action: string | null;
      controlText: string | null;
      key: string | null;
      trusted: boolean;
      time: number;
      conversing: boolean;
    }[] = [];
    const captures = new Map<string, { at: number; geometry: ReturnType<typeof read> }>();
    const waiters = new Set<() => void>();
    let visibleAt: number | undefined;
    let expiredAt: number | undefined;
    let exportInputSeen = false;
    let exportRendered = false;
    let frame = 0;
    let readyFrames = 0;
    let readyViewport = '';
    let stopped = false;
    let truncated = false;
    const viewport = () => innerWidth + 'x' + innerHeight;
    const dialogue = () =>
      document.querySelector('#ui')?.classList.contains('conversing') &&
      !!document.querySelector('.dialogue-box [data-action="choice"]');
    const visible = () => {
      const toast = document.querySelector<HTMLElement>('#toast');
      return (
        !!toast &&
        !toast.hidden &&
        getComputedStyle(toast).display !== 'none' &&
        toast.querySelector('.toast-text')?.textContent === expected
      );
    };
    const settled = () => {
      const toast = document.querySelector<HTMLElement>('#toast')!;
      const box = document.querySelector<HTMLElement>('.dialogue-box');
      const text = document.querySelector<HTMLElement>('.dialogue-text');
      const answer = document.querySelector<HTMLElement>('.dialogue-box [data-action="choice"]');
      return (
        exportRendered &&
        visible() &&
        dialogue() &&
        box &&
        text &&
        answer &&
        getComputedStyle(toast).opacity === '1' &&
        getComputedStyle(text).opacity === '1' &&
        getComputedStyle(answer).opacity === '1' &&
        toast.getAnimations().every((animation) => animation.playState === 'finished') &&
        box.getAnimations().every((animation) => animation.playState === 'finished') &&
        inputs.some(
          (input) =>
            input.type === 'keydown' && input.key === 'Shift' && input.trusted && input.conversing,
        )
      );
    };
    const sample = (painted = false) => {
      if (stopped) return;
      if (exportRendered && visibleAt === undefined && visible()) visibleAt = performance.now();
      if (visibleAt !== undefined && expiredAt === undefined && !visible())
        expiredAt = performance.now();
      const key = viewport();
      if (painted) {
        if (settled()) readyFrames = key === readyViewport ? readyFrames + 1 : 1;
        else readyFrames = 0;
        readyViewport = key;
        if (readyFrames >= 2 && !captures.has(key))
          captures.set(key, { at: performance.now(), geometry: read() });
      }
      for (const waiter of waiters) waiter();
    };
    const record = (event: Event) => {
      const node = event.target instanceof Element ? event.target : null;
      const key = event as KeyboardEvent;
      if (
        event.type === 'click' &&
        event.isTrusted &&
        node?.closest('[data-action]')?.getAttribute('data-action') === 'export'
      )
        exportInputSeen = true;
      if (inputs.length < 64)
        inputs.push({
          type: event.type,
          action: node?.closest('[data-action]')?.getAttribute('data-action') ?? null,
          controlText:
            node?.closest('[data-action]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
          key: key.key ?? null,
          trusted: event.isTrusted,
          time: event.timeStamp,
          conversing: !!dialogue(),
        });
      else truncated = true;
      sample();
    };
    for (const type of ['click', 'keydown', 'keyup'])
      window.addEventListener(type, record, { capture: true, passive: true });
    const observer = new MutationObserver((records) => {
      const toast = document.querySelector('#toast');
      // A previous Export can still be visible when a fresh cycle starts. Require the
      // actual new native Export's notice render; observing its old words is insufficient.
      if (
        exportInputSeen &&
        !exportRendered &&
        toast &&
        records.some(
          (record) =>
            record.type === 'childList' &&
            (record.target === toast || toast.contains(record.target)),
        )
      )
        exportRendered = true;
      sample();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'class'],
    });
    const next = () => {
      if (stopped) return;
      sample(true);
      frame = requestAnimationFrame(next);
    };
    frame = requestAnimationFrame(next);
    // DevTools holds an awaited page promise only weakly; keep each pending wait reachable
    // from the page, or a busy garbage collector can reject it before the notice settles.
    const pending = ((
      window as unknown as { __noticeWaits?: Set<Promise<unknown>> }
    ).__noticeWaits ??= new Set());
    const keep = <T>(promise: Promise<T>) => {
      pending.add(promise);
      const release = () => pending.delete(promise);
      promise.then(release, release);
      return promise;
    };
    const wait = <T>(check: () => T | undefined, description: string) =>
      keep(
        new Promise<T>((resolve, reject) => {
          const done = () => {
            const value = check();
            if (value !== undefined) {
              clearTimeout(timeout);
              waiters.delete(done);
              resolve(value);
            } else if (stopped || expiredAt !== undefined) {
              clearTimeout(timeout);
              waiters.delete(done);
              reject(
                new Error(
                  description +
                    ': real notice expired before the requested observation; ' +
                    JSON.stringify({ visibleAt, expiredAt, inputs, viewport: viewport() }),
                ),
              );
            }
          };
          const timeout = setTimeout(() => {
            waiters.delete(done);
            reject(
              new Error(
                description +
                  ': bounded read-only observation timed out; ' +
                  JSON.stringify({ visibleAt, expiredAt, inputs, viewport: viewport() }),
              ),
            );
          }, 10000);
          waiters.add(done);
          done();
        }),
      );
    const snapshot = () => ({
      visibleAt,
      expiredAt,
      inputs,
      truncated,
      captures: [...captures].map(([viewport, value]) => ({ viewport, ...value })),
    });
    return {
      read,
      ready: () => wait(() => (dialogue() ? true : undefined), 'Native Simon opening'),
      capture: () => {
        const key = viewport();
        return wait(() => {
          const capture = captures.get(key);
          return capture ? { ...capture, observation: snapshot() } : undefined;
        }, 'Visible settled dialogue ribbon at ' + key);
      },
      expiry: () =>
        wait(
          () => (expiredAt === undefined ? undefined : { visibleAt: visibleAt!, expiredAt }),
          'Original ordinary notice expiry',
        ),
      snapshot,
      cleanup: () => {
        stopped = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        for (const type of ['click', 'keydown', 'keyup'])
          window.removeEventListener(type, record, true);
        for (const waiter of [...waiters]) waiter();
      },
    };
  }, exportFeedback);
}

const observations = new WeakMap<Page, Awaited<ReturnType<typeof observeDialogueNotice>>>();

export async function disposeDialogueNotice(page: Page, info?: TestInfo) {
  const observation = observations.get(page);
  observations.delete(page);
  if (!observation) return;
  try {
    if (info)
      await writeFile(
        info.outputPath('dialogue-notice-final-observation.json'),
        JSON.stringify(await observation.evaluate((value) => value.snapshot()), null, 2),
      );
  } finally {
    try {
      await observation.evaluate((value) => value.cleanup());
    } finally {
      await observation.dispose();
    }
  }
}

export async function dialogueNoticeGeometry(page: Page) {
  const observation = observations.get(page);
  if (!observation) throw new Error('Dialogue notice observation must be armed before Export');
  return observation.evaluate((value) => value.read());
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
  await disposeDialogueNotice(page);
  const observation = await observeDialogueNotice(page);
  observations.set(page, observation); // Acknowledged before native Export starts its actual lease.
  const before = await exported(page);
  await dismiss(page);
  // The legal fixture is already in Simon's radius. Read the real exposed button
  // once and send native point input: repeated actionability-frame waits on a
  // software-rendered scene can consume the ordinary notice before opening it.
  const nearby = await page.evaluate(() => {
    const matches = document.querySelectorAll<HTMLButtonElement>('#nearby-action');
    if (matches.length !== 1)
      throw new Error(`Expected one nearby action; found ${matches.length}`);
    const button = matches[0]!;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return {
      x,
      y,
      width: rect.width,
      height: rect.height,
      disabled: button.disabled,
      hidden: button.hidden,
      text: button.textContent?.replace(/\s+/g, ' ').trim(),
      exposed: document.elementFromPoint(x, y)?.closest('button') === button,
    };
  });
  expect(nearby).toMatchObject({ disabled: false, hidden: false, exposed: true });
  expect(nearby.text).toContain('Speak with Simon');
  expect(nearby.width).toBeGreaterThan(0);
  expect(nearby.height).toBeGreaterThan(0);
  await page.mouse.click(nearby.x, nearby.y);
  await observation.evaluate((value) => value.ready());
  // Complete the real authored reveal immediately, before repeated driver reads can consume the lease.
  await page.keyboard.press('Shift');
  return before;
}

export async function captureDialogueNotice(
  page: Page,
  info: TestInfo,
  label: string,
  reportArtifacts = true,
) {
  const observation = observations.get(page);
  if (!observation) throw new Error('Visible notice capture must follow native openDialogueNotice');
  const captured = await observation.evaluate((value) => value.capture());
  const lease = captured.observation;
  const held = { ...captured.geometry, observedAt: captured.at, observedLease: lease };
  expect(lease.truncated).toBe(false);
  expect(lease.visibleAt).toBeDefined();
  expect(captured.at).toBeGreaterThanOrEqual(lease.visibleAt!);
  const exportedInput = lease.inputs.find(
    (input) => input.type === 'click' && input.action === 'export',
  );
  const nearestInput = lease.inputs.find(
    (input) => input.type === 'click' && input.action === 'nearest',
  );
  const revealInput = lease.inputs.find(
    (input) => input.type === 'keydown' && input.key === 'Shift',
  );
  expect(exportedInput).toMatchObject({ trusted: true });
  expect(nearestInput).toMatchObject({ trusted: true });
  expect(nearestInput!.controlText).toContain('Simon');
  expect(revealInput).toMatchObject({ trusted: true, conversing: true });
  expect(exportedInput!.time).toBeLessThanOrEqual(lease.visibleAt!);
  expect(nearestInput!.time).toBeGreaterThan(exportedInput!.time);
  expect(revealInput!.time).toBeGreaterThan(nearestInput!.time);
  expect(captured.at).toBeGreaterThan(revealInput!.time);
  if (lease.expiredAt !== undefined) expect(captured.at).toBeLessThan(lease.expiredAt);
  if (reportArtifacts) {
    await writeFile(info.outputPath(`${label}-visible.json`), JSON.stringify(held, null, 2));
    await page.screenshot({ path: info.outputPath(`${label}-support.png`), scale: 'css' });
  }
  expect(held.toastVisible).toBe(true);
  expect(held.dialogueSpeaker).toBe('Simon');
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
  retainedCapture?: Awaited<ReturnType<typeof captureDialogueNotice>>,
) {
  const held = retainedCapture ?? (await captureDialogueNotice(page, info, label));
  // Read the actual hidden transition retained in the browser. No timer override,
  // dismissal or Messages action may hide the ribbon before ordinary expiry.
  const observation = observations.get(page)!;
  const expiry = await observation.evaluate((value) => value.expiry());
  expect(held.observedAt).toBeLessThan(expiry.expiredAt);
  expect(expiry.expiredAt).toBeGreaterThan(expiry.visibleAt);
  // Mutation callbacks observe the actual render/hidden transition. Allow only
  // 100ms observation tolerance below the untouched ordinary 4800ms lifetime.
  expect(expiry.expiredAt - expiry.visibleAt).toBeGreaterThanOrEqual(4700);
  await writeFile(
    info.outputPath(`${label}-ordinary-lease.json`),
    JSON.stringify(
      {
        expectedLeaseMs: 4800,
        ...expiry,
        observedLeaseMs: expiry.expiredAt - expiry.visibleAt,
        capturedAt: held.observedAt,
        nativeInputs: held.observedLease.inputs,
      },
      null,
      2,
    ),
  );
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10000 });
  await painted(page);
  const expired = await dialogueNoticeGeometry(page);
  await writeFile(info.outputPath(`${label}-expired.json`), JSON.stringify(expired, null, 2));
  await page.screenshot({ path: info.outputPath(`${label}-expired.png`), scale: 'css' });
  expect(expired.toastVisible).toBe(false);
  await expect(page.locator('.dialogue-box [data-action="choice"]').first()).toBeFocused();
  await disposeDialogueNotice(page);
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
