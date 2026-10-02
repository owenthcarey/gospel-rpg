import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { dismiss, settled } from './connection-browser';

export async function painted(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

export async function visitSimon(page: Page, touch: boolean) {
  await dismiss(page);
  const map = page.locator('.toolbar [data-action="map"]');
  const person = page.locator('.map-destinations [data-value="simon"]');
  if (touch) {
    await map.tap();
    await person.tap();
  } else {
    await map.click();
    await person.click();
  }
  await expect(page.locator('.dialogue-box')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#dialogue-speaker')).toHaveText('Simon');
  await settled(page);
}

export async function geometry(page: Page) {
  return page.locator('.dialogue-box').evaluate((element) => {
    const box = element as HTMLElement;
    const text = box.querySelector<HTMLElement>('.dialogue-text')!;
    const header = box.querySelector<HTMLElement>('header')!;
    const source = box.querySelector<HTMLElement>('.dialogue-source')!;
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
    const intersect = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => {
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
    const r = rect(box);
    const clip = {
      left: r.left + box.clientLeft,
      top: r.top + box.clientTop,
      right: r.left + box.clientLeft + box.clientWidth,
      bottom: r.top + box.clientTop + box.clientHeight,
      width: box.clientWidth,
      height: box.clientHeight,
    };
    const within = (bounds: ReturnType<typeof rect>, area = clip) =>
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.left >= area.left - 0.01 &&
      bounds.right <= area.right + 0.01 &&
      bounds.top >= area.top - 0.01 &&
      bounds.bottom <= area.bottom + 0.01 &&
      bounds.left >= 0 &&
      bounds.right <= innerWidth &&
      bounds.top >= 0 &&
      bounds.bottom <= innerHeight;
    const css = getComputedStyle(text);
    const textClip = ['auto', 'scroll', 'hidden', 'clip'].includes(css.overflowY)
      ? intersect(clip, rect(text))
      : clip;
    const words: {
      index: number;
      word: string;
      visible: boolean;
      rects: ReturnType<typeof rect>[];
    }[] = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, word.index!);
        range.setEnd(node, word.index! + word[0].length);
        const bounds = [...range.getClientRects()].map((r) => ({
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        }));
        words.push({
          index: words.length,
          word: word[0],
          visible: bounds.length > 0 && bounds.every((r) => within(r, textClip)),
          rects: bounds,
        });
      }
    }
    const labelWords = (control: HTMLElement) => {
      const result: { word: string; visible: boolean; rects: ReturnType<typeof rect>[] }[] = [];
      const labelClip = intersect(clip, rect(control));
      const labelWalker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
      while (labelWalker.nextNode()) {
        const node = labelWalker.currentNode;
        if (node.parentElement?.closest('.choice-index,svg')) continue;
        for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, word.index!);
          range.setEnd(node, word.index! + word[0].length);
          const bounds = [...range.getClientRects()].map((r) => ({
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          }));
          result.push({
            word: word[0],
            visible: bounds.length > 0 && bounds.every((r) => within(r, labelClip)),
            rects: bounds,
          });
        }
      }
      return result;
    };
    const controls = [...box.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].map(
      (control) => ({
        action: control.dataset.action,
        value: control.dataset.value ?? null,
        label: control.getAttribute('aria-label') ?? control.textContent?.trim(),
        rect: rect(control),
        visible: within(rect(control)),
        minHeight: parseFloat(getComputedStyle(control).minHeight),
        labelWords: labelWords(control),
      }),
    );
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      box: r,
      clip,
      header: rect(header),
      headerVisible: within(rect(header)),
      speaker: box.querySelector('#dialogue-speaker')?.textContent,
      subtitle: header.querySelector('p')?.textContent,
      question: rect(text),
      visibleQuestion: intersect(rect(text), textClip),
      questionText: text.textContent,
      words,
      questionBeginningVisible: words[0]?.visible ?? false,
      questionEndingVisible: words.at(-1)?.visible ?? false,
      questionOpacity: css.opacity,
      compact: box.classList.contains('dialogue-compact-reading'),
      maximumCardHeight: parseFloat(getComputedStyle(box).maxHeight),
      questionRegion: {
        role: text.getAttribute('role'),
        tabindex: text.getAttribute('tabindex'),
        label: text.getAttribute('aria-label'),
        cap: box.style.getPropertyValue('--dialogue-question-height'),
      },
      source: rect(source),
      sourceText: source.textContent,
      sourceVisible: within(rect(source)),
      controls,
      firstAnswer: controls.find((control) => control.action === 'choice' && control.value === '0'),
      focus: {
        tag: active?.tagName,
        action: active?.dataset.action ?? null,
        value: active?.dataset.value ?? null,
        label: active?.getAttribute('aria-label') ?? active?.textContent?.trim(),
        withinDialogue: !!active && box.contains(active),
      },
      scroll: {
        card: box.scrollTop,
        cardMax: box.scrollHeight - box.clientHeight,
        question: text.scrollTop,
        questionMax: text.scrollHeight - text.clientHeight,
      },
    };
  });
}

export async function capture(page: Page, info: TestInfo, label: string) {
  const measured = await geometry(page);
  await writeFile(info.outputPath(`${label}.json`), JSON.stringify(measured, null, 2));
  await page.screenshot({ path: info.outputPath(`${label}.png`), scale: 'css' });
  return measured;
}

export async function readSwipe(page: Page, info: TestInfo, index: number | string) {
  const visible = (await geometry(page)).visibleQuestion;
  expect(visible.height, 'A native swipe must begin in visible question text').toBeGreaterThan(12);
  const start = { x: (visible.left + visible.right) / 2, y: visible.bottom - 2 };
  const end = { x: start.x, y: Math.max(visible.top + 2, start.y - 24) };
  expect(start.y - end.y).toBeGreaterThan(8);
  const probe = await page.evaluateHandle((p) => {
    const describe = (target: EventTarget | null) => {
      const node = target instanceof Element ? target : null;
      return {
        tag: node?.tagName,
        className: node?.getAttribute('class'),
        inQuestion: !!node?.closest('.dialogue-text'),
        action: node?.closest<HTMLElement>('[data-action]')?.dataset.action ?? null,
      };
    };
    const events: {
      type: string;
      trusted: boolean;
      pointerType: string;
      target: ReturnType<typeof describe>;
    }[] = [];
    const listener: EventListener = (event) => {
      if (!(event instanceof PointerEvent)) return;
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        pointerType: event.pointerType,
        target: describe(event.target),
      });
    };
    for (const type of ['pointerdown', 'pointerup', 'pointercancel'])
      window.addEventListener(type, listener, { capture: true, passive: true });
    return {
      preContact: describe(document.elementFromPoint(p.x, p.y)),
      events: () => events,
      dispose: () => {
        for (const type of ['pointerdown', 'pointerup', 'pointercancel'])
          window.removeEventListener(type, listener, true);
      },
    };
  }, start);
  let events: {
    type: string;
    trusted: boolean;
    pointerType: string;
    target: { inQuestion: boolean; action: string | null };
  }[];
  try {
    expect(await probe.evaluate((probe) => probe.preContact.inQuestion)).toBe(true);
    const session = await page.context().newCDPSession(page);
    let contact = false;
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ id: 1, ...start }],
      });
      contact = true;
      // A slow real native drag reads one overlapping portion, avoiding a fling
      // past unseen lines. No timer, application scroll or event injection overrides.
      for (let step = 1; step <= 8; step++) {
        await page.waitForTimeout(60);
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ id: 1, x: start.x, y: start.y + ((end.y - start.y) * step) / 8 }],
        });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      contact = false;
    } finally {
      try {
        if (contact)
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally {
        await session.detach();
      }
    }
  } finally {
    try {
      events = await probe.evaluate((probe) => probe.events());
      await writeFile(
        info.outputPath(`native-read-swipe-${index}.json`),
        JSON.stringify({ start, end, events }, null, 2),
      );
    } finally {
      try {
        await probe.evaluate((probe) => probe.dispose());
      } finally {
        await probe.dispose();
      }
    }
  }
  const down = events.find((event) => event.type === 'pointerdown');
  expect(down).toMatchObject({
    trusted: true,
    pointerType: 'touch',
    target: { inQuestion: true, action: null },
  });
  await painted(page);
  await page.waitForTimeout(100);
}

type Reading = Awaited<ReturnType<typeof geometry>>;

export async function selectNativeControl(page: Page, action: string, value: string | null) {
  for (let index = 0; index < 14; index++) {
    const selected = (await geometry(page)).focus;
    if (selected.action === action && selected.value === value) return;
    await page.keyboard.press('Tab');
    await painted(page);
  }
  throw new Error(`Native Tab did not reach ${action}:${value}`);
}

export async function readCurrentQuestion(
  page: Page,
  info: TestInfo,
  label: string,
  touch: boolean,
  expectedOuterReading = false,
) {
  const initial = await capture(page, info, `${label}-before-reading`);
  const snapshots = [initial];
  const covered = new Set(initial.words.filter((word) => word.visible).map((word) => word.index));
  const overflowingRegion = initial.scroll.questionMax > 0;
  let mandatoryRegionSwipes = 0;
  let mandatoryOuterSwipes = 0;
  if (overflowingRegion) {
    expect(initial.questionRegion).toMatchObject({
      role: 'region',
      tabindex: '0',
      label: 'Question from Simon',
    });
    await selectNativeControl(page, 'choice', '0');
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('region', { name: 'Question from Simon', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Home');
    await expect
      .poll(() => page.locator('.dialogue-text').evaluate((node) => node.scrollTop))
      .toBe(0);
    const top = await capture(page, info, `${label}-question-top`);
    snapshots.push(top);
    // Real overflow must be read by at least one actual trusted native touch
    // drag before keyboard coverage can complete. No placeholder drag is made
    // when this authored question has no inner overflow.
    if (touch) {
      await readSwipe(page, info, `${label}-required-region-swipe`);
      mandatoryRegionSwipes++;
    } else {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
    }
    const swiped = await capture(page, info, `${label}-question-native-swipe`);
    snapshots.push(swiped);
    await writeFile(
      info.outputPath(`${label}-mandatory-region-scroll.json`),
      JSON.stringify(
        {
          compiledRuntime: true,
          before: top.scroll,
          after: swiped.scroll,
          questionDelta: swiped.scroll.question - top.scroll.question,
        },
        null,
        2,
      ),
    );
    expect(swiped.scroll.question).toBeGreaterThan(top.scroll.question + 0.01);
    await page.waitForTimeout(150);
    const stable = await geometry(page);
    expect(stable.scroll.question).toBeGreaterThanOrEqual(swiped.scroll.question);
    await writeFile(
      info.outputPath(`${label}-question-reading-through-frames.json`),
      JSON.stringify({ afterNativeInput: swiped.scroll, afterLiveFrames: stable.scroll }, null, 2),
    );
  } else {
    await selectNativeControl(page, 'close', null);
    await page.keyboard.press('Home');
    await expect
      .poll(() => page.locator('.dialogue-box').evaluate((node) => node.scrollTop))
      .toBe(0);
    const top = await capture(page, info, `${label}-native-header-reading`);
    snapshots.push(top);
    if (expectedOuterReading && top.scroll.cardMax > 0) {
      // This genuine Large320 authored state must use the original full outer
      // reading area. Prove actual native pan there, independently of Home or
      // word coverage, without manufacturing an inner question scrollport.
      await readSwipe(page, info, `${label}-required-outer-swipe`);
      mandatoryOuterSwipes++;
      const swiped = await capture(page, info, `${label}-outer-native-swipe`);
      snapshots.push(swiped);
      await writeFile(
        info.outputPath(`${label}-mandatory-outer-scroll.json`),
        JSON.stringify(
          {
            compiledRuntime: true,
            before: top.scroll,
            after: swiped.scroll,
            outerDelta: swiped.scroll.card - top.scroll.card,
          },
          null,
          2,
        ),
      );
      expect(swiped.scroll.card).toBeGreaterThan(top.scroll.card + 0.01);
      expect(swiped.scroll.question).toBe(0);
      await page.waitForTimeout(150);
      const stable = await geometry(page);
      expect(stable.scroll.card).toBeGreaterThanOrEqual(swiped.scroll.card);
      await writeFile(
        info.outputPath(`${label}-outer-reading-through-frames.json`),
        JSON.stringify(
          { afterNativeInput: swiped.scroll, afterLiveFrames: stable.scroll },
          null,
          2,
        ),
      );
    }
  }
  for (const snapshot of snapshots)
    for (const word of snapshot.words.filter((word) => word.visible)) covered.add(word.index);
  for (let index = 0; index < 16 && covered.size < initial.words.length; index++) {
    if (touch) await readSwipe(page, info, `${label}-read-${index}`);
    else {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      await painted(page);
    }
    const snapshot = await geometry(page);
    snapshots.push(snapshot);
    for (const word of snapshot.words.filter((word) => word.visible)) covered.add(word.index);
  }
  if (overflowingRegion) {
    await expect(
      page.getByRole('region', { name: 'Question from Simon', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('End');
    await expect
      .poll(() =>
        page
          .locator('.dialogue-text')
          .evaluate((node) => Math.abs(node.scrollTop - (node.scrollHeight - node.clientHeight))),
      )
      .toBeLessThanOrEqual(0.01);
    const ending = await capture(page, info, `${label}-native-question-end`);
    snapshots.push(ending);
    for (const word of ending.words.filter((word) => word.visible)) covered.add(word.index);
  }
  const selectedControls: Reading[] = [];
  const seenControls = new Set<string>();
  for (
    let index = 0;
    index < initial.controls.length + 8 && seenControls.size < initial.controls.length;
    index++
  ) {
    await page.keyboard.press('Tab');
    await painted(page);
    const selected = await geometry(page);
    const control = selected.controls.find(
      (control) =>
        control.action === selected.focus.action && control.value === selected.focus.value,
    );
    if (control && selected.focus.withinDialogue) {
      seenControls.add(`${control.action}:${control.value}`);
      selectedControls.push(selected);
    }
  }
  const evidence = {
    compiledRuntime: true,
    initial,
    snapshots,
    coveredWordIndices: [...covered].sort((a, b) => a - b),
    totalWords: initial.words.length,
    overflowingRegion,
    mandatoryRegionSwipes,
    mandatoryOuterSwipes,
    expectedOuterReading,
    selectedControls,
    reachedControls: [...seenControls],
    allControlsReached: seenControls.size === initial.controls.length,
    nativeReadingAndControlInput: true,
    touch,
  };
  await writeFile(
    info.outputPath(`${label}-native-reading.json`),
    JSON.stringify(evidence, null, 2),
  );
  return evidence;
}

export async function nativeResize(
  page: Page,
  info: TestInfo,
  label: string,
  width: number,
  height: number,
) {
  await selectNativeControl(page, 'choice', '1');
  const identity = await page.evaluateHandle(() => ({
    box: document.querySelector('.dialogue-box'),
    control: document.activeElement,
  }));
  try {
    const before = await capture(page, info, `${label}-before-resize`);
    await page.setViewportSize({ width, height });
    await painted(page);
    await page.waitForTimeout(100);
    const after = await capture(page, info, `${label}-after-resize`);
    const sameIdentity = await identity.evaluate(({ box, control }) => ({
      sameSurface: document.querySelector('.dialogue-box') === box && !!box?.isConnected,
      sameLaterControl: document.activeElement === control && !!control?.isConnected,
    }));
    await writeFile(
      info.outputPath(`${label}-focus-resize.json`),
      JSON.stringify({ compiledRuntime: true, before, after, sameIdentity }, null, 2),
    );
    expect(sameIdentity).toEqual({ sameSurface: true, sameLaterControl: true });
    expect(after.focus).toMatchObject({ action: 'choice', value: '1', withinDialogue: true });
    return after;
  } finally {
    await identity.dispose();
  }
}
