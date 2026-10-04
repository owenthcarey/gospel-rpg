import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ready, dismiss, exported, readableContrast } from '../helpers/connection-browser';
import { arrangedShelter, chosenShelter } from '../helpers/galilee';

async function phoneControls(page: Page) {
  const controls = await page
    .locator(
      '.toolbar button, .camera-controls button, .minimap-compass, .minimap-open, .control-hints button',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return {
            name: element.getAttribute('aria-label') ?? element.getAttribute('title'),
            x,
            y,
            width,
            height,
            viewport: { width: innerWidth, height: innerHeight },
          };
        }),
    );
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.x).toBeGreaterThanOrEqual(0);
    expect(control.y).toBeGreaterThanOrEqual(0);
    expect(control.x + control.width).toBeLessThanOrEqual(control.viewport.width);
    expect(control.y + control.height).toBeLessThanOrEqual(control.viewport.height);
  }
  for (let i = 0; i < controls.length; i++) {
    for (const other of controls.slice(i + 1)) {
      const control = controls[i]!;
      const overlap =
        control.x < other.x + other.width &&
        control.x + control.width > other.x &&
        control.y < other.y + other.height &&
        control.y + control.height > other.y;
      expect(overlap, `${control.name} overlaps ${other.name}`).toBe(false);
    }
  }
}

test('low graphics stays sharp on phones after resize and restores the desktop pixel budget', async ({
  page,
}, info) => {
  await ready(page);
  const width = () =>
    page.locator('#game-canvas').evaluate((el) => (el as HTMLCanvasElement).width);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(width).toBe(390);
  await phoneControls(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(width)
    .toBe(info.project.name === 'mobile-chromium' ? 844 : Math.floor(844 / 1.5));
  await phoneControls(page);
  await page.setViewportSize({ width: 844, height: 300 });
  await expect
    .poll(width)
    .toBe(info.project.name === 'mobile-chromium' ? 844 : Math.floor(844 / 1.5));
  await phoneControls(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(width).toBe(info.project.name === 'mobile-chromium' ? 1440 : 960);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(width).toBe(320);
  await phoneControls(page);
});

test('long objectives and nearby work stay separate in short landscapes', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const quest = page.locator('.quest-card');
  const objective = quest.locator('.current-objective');
  const original = await objective.textContent();
  const separate = async () => {
    const rectangles = await page
      .locator('.topbar, .quest-card, .bottom-center, .minimap-wrap')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { name: node.className, x, y, width, height };
        }),
      );
    const viewport = page.viewportSize()!;
    for (const rect of rectangles) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    }
    for (let i = 0; i < rectangles.length; i++) {
      const first = rectangles[i]!;
      for (const other of rectangles.slice(i + 1)) {
        const overlap =
          first.x < other.x + other.width &&
          first.x + first.width > other.x &&
          first.y < other.y + other.height &&
          first.y + first.height > other.y;
        expect(overlap, `${first.name} overlaps ${other.name}`).toBe(false);
      }
    }
  };
  for (const size of [
    { width: 480, height: 320 },
    { width: 520, height: 300 },
    { width: 568, height: 320 },
    { width: 667, height: 375 },
    { width: 690, height: 300 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await separate();
    await phoneControls(page);
    const follow = quest.getByRole('button', { name: 'Follow the path', exact: true });
    await expect(follow).toBeInViewport();
    const followBox = (await follow.boundingBox())!;
    const cardBox = (await quest.boundingBox())!;
    expect(followBox.width).toBeGreaterThanOrEqual(44);
    expect(followBox.height).toBeGreaterThanOrEqual(44);
    expect(followBox.y + followBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
    expect((await quest.locator('.objective-toggle').boundingBox())!.height).toBeGreaterThanOrEqual(
      44,
    );
    await page.screenshot({
      path: info.outputPath(`long-objective-${size.width}.png`),
      scale: 'css',
    });
    const collapsed = (await objective.boundingBox())!.height;
    await quest.getByRole('button', { name: 'Show steps', exact: true }).click();
    await expect(objective).toHaveText(original!);
    if (size.height <= 420)
      expect((await objective.boundingBox())!.height).toBeGreaterThan(collapsed);
    await separate();
    await quest.getByRole('button', { name: 'Hide steps', exact: true }).click();
    await expect(follow).toBeInViewport();
    const tray = page.locator('#action-tray');
    for (const action of await tray.getByRole('button').all()) {
      await action.scrollIntoViewIfNeeded();
      const button = (await action.boundingBox())!;
      const surface = (await tray.boundingBox())!;
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.y).toBeGreaterThanOrEqual(surface.y);
      expect(button.y + button.height).toBeLessThanOrEqual(surface.y + surface.height);
      await expect(action).toBeInViewport({ ratio: 1 });
    }
    await tray.evaluate((element) => (element.scrollTop = 0));
  }
  const saved = await exported(page);
  expect(saved.galilee).toEqual(state.galilee);
  expect(saved.position).toEqual(state.position);
});

test('landscape feedback makes room for actions and returns to the overlay for menus', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  for (const size of [
    { width: 480, height: 320 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    const save = await exported(page);
    expect(save.galilee).toEqual(state.galilee);
    expect(save.position).toEqual(state.position);
    // Feedback must stay outside the inert HUD while its menu is open.
    await expect(page.locator('#toast')).toBeVisible();
    expect(await page.locator('#toast').evaluate((notice) => !!notice.closest('[inert]'))).toBe(
      false,
    );
    await dismiss(page);
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(page.locator('.hud-actions > #toast')).toHaveCount(size.height <= 420 ? 1 : 0);
    const bounds = await toast.evaluate((notice) => {
      const rect = notice.getBoundingClientRect();
      const overlaps = [
        ...document.querySelectorAll(
          '.topbar,.quest-card,.minimap-wrap,.minimap-compass,#action-tray,.control-hints,#travel-status:not([hidden])',
        ),
      ]
        .filter((node) => (node as HTMLElement).offsetHeight > 0)
        .filter((node) => {
          const control = node.getBoundingClientRect();
          return (
            rect.left < control.right &&
            rect.right > control.left &&
            rect.top < control.bottom &&
            rect.bottom > control.top
          );
        })
        .map((node) => node.id || node.className);
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, overlaps };
    });
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(size.width);
    expect(bounds.bottom).toBeLessThanOrEqual(size.height);
    expect(bounds.overlaps).toEqual([]);
    if (size.width < 700 || size.height <= 540 || info.project.name === 'mobile-chromium')
      await phoneControls(page);
    await page.screenshot({ path: info.outputPath(`feedback-${size.width}.png`), scale: 'css' });
    const tray = page.locator('#action-tray');
    const lastAction = tray.getByRole('button').last();
    await lastAction.scrollIntoViewIfNeeded();
    const action = (await lastAction.boundingBox())!;
    const surface = (await tray.boundingBox())!;
    expect(action.y).toBeGreaterThanOrEqual(surface.y);
    expect(action.y + action.height).toBeLessThanOrEqual(surface.y + surface.height);
    await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
    await expect(page.locator('#toast')).toBeHidden();
    await expect(page.locator('.message-list li').first()).toContainText(
      'Journey exported. Keep the file somewhere safe.',
    );
    await dismiss(page);
    await expect(toast).toBeHidden();
  }
});

/** Case-local Chromium transport for the existing scroll/size/viewport checks. */
async function compactReachability(page: Page, selector: string, budgetMs: number, sized = true) {
  const cdp = await page.context().newCDPSession(page);
  const objectGroup = 'compact-reachability-' + randomUUID();
  let failed = false;
  let failure: unknown;
  const cleanupErrors: unknown[] = [];
  const check = (result: { exceptionDetails?: unknown }) => {
    if (result.exceptionDetails)
      throw new Error(
        'Compact reachability observation failed: ' + JSON.stringify(result.exceptionDetails),
      );
  };
  const within = async <T>(deadline: number, task: () => Promise<T>): Promise<T> => {
    if (Date.now() >= deadline) throw new Error('Compact reachability phase budget exhausted');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        task(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Compact reachability phase timed out')),
            Math.max(0, deadline - Date.now()),
          );
        }),
      ]);
      if (Date.now() > deadline) throw new Error('Late compact reachability phase result');
      return value;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
  const prepare = (selector: string, index: number, deadline: number, strict: boolean) =>
    new Promise<Element>((resolve, reject) => {
      const lookup = () => {
        const elements = [...document.querySelectorAll(selector)];
        if (!strict) return elements;
        // Current UI Resume is an actual plain-text BUTTON. Preserve the original exact role/name.
        return elements.filter((element) => {
          if (!(element instanceof HTMLButtonElement)) return false;
          if (element.hasAttribute('aria-labelledby'))
            throw new Error('Unsupported referenced button name in compact Resume lookup');
          const label = element.getAttribute('aria-label');
          const name = (label?.trim() ? label : (element.textContent ?? ''))
            .replace(/[\u200b\u00ad]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (name !== 'Resume route') return false;
          const role = element.getAttribute('role');
          if (role !== null && role.trim() !== 'button')
            throw new Error('Unsupported explicit Resume button role');
          if (!label?.trim() && element.children.length > 0)
            throw new Error('Unsupported non-plaintext Resume button name');
          const style = getComputedStyle(element);
          if (style.visibility !== 'visible' || !element.checkVisibility()) return false;
          for (let parent: Element | null = element; parent; parent = parent.parentElement) {
            if (
              getComputedStyle(parent).display === 'none' ||
              parent.getAttribute('aria-hidden')?.toLowerCase() === 'true'
            )
              return false;
          }
          return true;
        });
      };
      let frame: number | undefined;
      let wait: number | undefined;
      let node: Element | undefined;
      let last: { x: number; y: number; width: number; height: number } | undefined;
      let attachAttempt = 0;
      let stableAttempt = 0;
      const clear = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        if (wait !== undefined) clearTimeout(wait);
        clearTimeout(timer);
      };
      const fail = (error: unknown) => {
        clear();
        reject(error);
      };
      const timer = window.setTimeout(
        () => fail(new Error('Compact button attachment/stability budget exceeded')),
        Math.max(0, deadline - Date.now()),
      );
      const sample = () => {
        try {
          if (Date.now() > deadline) throw new Error('Late compact button attachment/stability');
          if (!node) {
            const matches = lookup();
            if (strict && matches.length > 1)
              throw new Error('Multiple compact Resume route buttons');
            node = matches[index];
            if (!node) {
              wait = window.setTimeout(
                sample,
                [20, 50, 100, 100, 500][Math.min(attachAttempt++, 4)]!,
              );
              return;
            }
          }
          if (!node.isConnected) throw new Error('Compact button detached during scroll admission');
          const box = node.getBoundingClientRect();
          const rect = { x: box.top, y: box.left, width: box.width, height: box.height };
          if (last) {
            const stable =
              rect.x === last.x &&
              rect.y === last.y &&
              rect.width === last.width &&
              rect.height === last.height;
            if (stable) {
              clear();
              resolve(node);
              return;
            }
            last = undefined;
            wait = window.setTimeout(() => {
              frame = requestAnimationFrame(sample);
            }, [0, 20, 100, 100, 500][Math.min(stableAttempt++, 4)]!);
            return;
          }
          last = rect;
          frame = requestAnimationFrame(sample);
        } catch (error) {
          fail(error);
        }
      };
      frame = requestAnimationFrame(sample);
    });
  const viewport = function (
    this: Element,
    selector: string,
    index: number,
    deadline: number,
    strict: boolean,
  ) {
    return new Promise<number>((resolve, reject) => {
      const lookup = () => {
        const elements = [...document.querySelectorAll(selector)];
        if (!strict) return elements;
        // Current UI Resume is an actual plain-text BUTTON. Preserve the original exact role/name.
        return elements.filter((element) => {
          if (!(element instanceof HTMLButtonElement)) return false;
          if (element.hasAttribute('aria-labelledby'))
            throw new Error('Unsupported referenced button name in compact Resume lookup');
          const label = element.getAttribute('aria-label');
          const name = (label?.trim() ? label : (element.textContent ?? ''))
            .replace(/[\u200b\u00ad]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (name !== 'Resume route') return false;
          const role = element.getAttribute('role');
          if (role !== null && role.trim() !== 'button')
            throw new Error('Unsupported explicit Resume button role');
          if (!label?.trim() && element.children.length > 0)
            throw new Error('Unsupported non-plaintext Resume button name');
          const style = getComputedStyle(element);
          if (style.visibility !== 'visible' || !element.checkVisibility()) return false;
          for (let parent: Element | null = element; parent; parent = parent.parentElement) {
            if (
              getComputedStyle(parent).display === 'none' ||
              parent.getAttribute('aria-hidden')?.toLowerCase() === 'true'
            )
              return false;
          }
          return true;
        });
      };
      let observer: IntersectionObserver | undefined;
      let frame: number | undefined;
      let wait: number | undefined;
      let attempt = 0;
      const clear = () => {
        observer?.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
        if (wait !== undefined) clearTimeout(wait);
        clearTimeout(timer);
      };
      const fail = (error: unknown) => {
        clear();
        reject(error);
      };
      const timer = window.setTimeout(
        () => fail(new Error('Compact button viewport expectation budget exceeded')),
        Math.max(0, deadline - Date.now()),
      );
      const sample = () => {
        try {
          if (Date.now() > deadline) throw new Error('Late compact button viewport observation');
          // The original Locator expectation resolves the current nth match on each attempt.
          const matches = lookup();
          if (strict && matches.length > 1)
            throw new Error('Multiple compact Resume route buttons');
          const node = matches[index];
          if (!node?.isConnected) {
            wait = window.setTimeout(sample, [0, 20, 50, 100, 100, 500][Math.min(attempt++, 5)]!);
            return;
          }
          observer = new IntersectionObserver((entries) => {
            try {
              observer?.disconnect();
              const ratio = entries[0]!.intersectionRatio;
              if (Date.now() > deadline) throw new Error('Late compact button viewport delivery');
              // The installed toBeInViewport({ ratio: 1 }) matcher uses this exact predicate.
              if (ratio > 0 && ratio > 1 - 1e-9) {
                clear();
                resolve(ratio);
                return;
              }
              wait = window.setTimeout(sample, [0, 20, 50, 100, 100, 500][Math.min(attempt++, 5)]!);
            } catch (error) {
              fail(error);
            }
          });
          observer.observe(node);
          frame = requestAnimationFrame(() => {});
        } catch (error) {
          fail(error);
        }
      };
      sample();
    });
  };
  try {
    const counted = await cdp.send('Runtime.evaluate', {
      expression: 'document.querySelectorAll(' + JSON.stringify(selector) + ').length',
      returnByValue: true,
    });
    check(counted);
    const count = sized ? counted.result.value : 1;
    if (!Number.isInteger(count) || count < 0) throw new Error('Invalid compact button count');
    for (let index = 0; index < count; index++) {
      const actionDeadline = Date.now() + budgetMs;
      let objectId: string | undefined;
      let retry = 0;
      while (true) {
        const admitted = await within(actionDeadline, () =>
          cdp.send('Runtime.evaluate', {
            expression:
              '(' +
              prepare.toString() +
              ')(' +
              JSON.stringify(selector) +
              ',' +
              index +
              ',' +
              actionDeadline +
              ',' +
              !sized +
              ')',
            objectGroup,
            awaitPromise: true,
            returnByValue: false,
          }),
        );
        check(admitted);
        objectId = admitted.result.objectId;
        if (!objectId || admitted.result.subtype !== 'node')
          throw new Error('Missing compact button node');
        if (Date.now() > actionDeadline) throw new Error('Late compact button scroll admission');
        try {
          // This is the installed Playwright Chromium scroll primitive, with the same omitted rect.
          await within(actionDeadline, () => cdp.send('DOM.scrollIntoViewIfNeeded', { objectId }));
          if (Date.now() > actionDeadline) throw new Error('Late compact button native scroll');
          break;
        } catch (error) {
          if (!String(error).includes('Node does not have a layout object')) throw error;
          const delay = [0, 20, 100, 100, 500][Math.min(retry++, 4)]!;
          if (Date.now() + delay >= actionDeadline) throw error;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      if (sized) {
        // Read the original border quad, rather than substituting a rectangle/clipping oracle.
        const boxDeadline = Date.now() + budgetMs;
        const result = await within(boxDeadline, () => cdp.send('DOM.getBoxModel', { objectId }));
        const quad = result.model.border;
        const x = Math.min(quad[0]!, quad[2]!, quad[4]!, quad[6]!);
        const y = Math.min(quad[1]!, quad[3]!, quad[5]!, quad[7]!);
        const width = Math.max(quad[0]!, quad[2]!, quad[4]!, quad[6]!) - x;
        const height = Math.max(quad[1]!, quad[3]!, quad[5]!, quad[7]!) - y;
        expect(width).toBeGreaterThanOrEqual(44);
        expect(height).toBeGreaterThanOrEqual(44);
      }
      // The expectation has its original separate budget, starting after the size assertions.
      const expectDeadline = Date.now() + budgetMs;
      const observed = await within(expectDeadline, () =>
        cdp.send('Runtime.callFunctionOn', {
          objectId,
          objectGroup,
          functionDeclaration: viewport.toString(),
          arguments: [
            { value: selector },
            { value: index },
            { value: expectDeadline },
            { value: !sized },
          ],
          awaitPromise: true,
          returnByValue: true,
        }),
      );
      check(observed);
      if (Date.now() > expectDeadline) throw new Error('Late compact button viewport result');
      const ratio = observed.result.value;
      expect(typeof ratio === 'number' && ratio > 0 && ratio > 1 - 1e-9).toBe(true);
    }
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    try {
      await cdp.send('Runtime.releaseObjectGroup', { objectGroup });
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await cdp.detach();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (failed) throw failure;
  if (cleanupErrors.length)
    throw new Error('Compact reachability cleanup failed: ' + cleanupErrors.map(String).join('; '));
}

test('saved routes keep touch controls and nearby work reachable in compact landscapes', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  state.connection.route = { target: 'spring-source' };
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const resume = page.getByRole('button', { name: 'Resume route', exact: true });
  await expect(resume).toBeEnabled();
  const touch =
    info.project.name === 'mobile-chromium' ? await page.context().newCDPSession(page) : undefined;
  let detachFailure: { error: unknown } | undefined;
  try {
    for (const size of [
      { width: 480, height: 320 },
      { width: 520, height: 300 },
      { width: 568, height: 320 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      const saved = await exported(page);
      expect(saved.connection.route).toEqual(state.connection.route);
      expect(saved.galilee).toEqual(state.galilee);
      expect(saved.position).toEqual(state.position);
      await dismiss(page);
      await expect(page.locator('#toast')).toBeVisible();
      await phoneControls(page);
      const column = page.locator('.bottom-center');
      const box = (await column.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      const actions = page.locator('.hud-actions');
      const cue = page.locator('.action-scroll-cue');
      await actions.evaluate((element) => (element.scrollTop = 0));
      if (size.height <= 420) {
        await expect(cue).toBeVisible();
        await expect(cue).toContainText('↓');
        await readableContrast(page, '.action-scroll-cue');
      } else await expect(cue).toBeHidden();
      if (touch && size.width === 480) {
        const surface = (await actions.boundingBox())!;
        const point = {
          id: 1,
          x: surface.x + surface.width / 2,
          y: surface.y + surface.height * 0.85,
        };
        const observation = await actions.evaluateHandle((element, origin) => {
          const rect = (node: Element) => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
          };
          const measure = () => {
            const toast = document.getElementById('toast')!;
            const style = getComputedStyle(toast);
            return {
              at: performance.now(),
              viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
              actions: {
                rect: rect(element),
                scrollTop: element.scrollTop,
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
              },
              toast: {
                hidden: toast.hidden,
                visible: !toast.hidden && style.display !== 'none' && style.visibility !== 'hidden',
                text: toast.textContent,
                rect: rect(toast),
              },
            };
          };
          const target = (node: EventTarget | null) => {
            const element = node instanceof Element ? node : null;
            return element
              ? { tag: element.tagName, id: element.id, className: element.getAttribute('class') }
              : null;
          };
          const initial = {
            ...measure(),
            origin,
            originSurface: target(document.elementFromPoint(origin.x, origin.y)),
          };
          const nativeEvents: {
            type: string;
            isTrusted: boolean;
            insideActions: boolean;
            target: ReturnType<typeof target>;
            points: { x: number; y: number; id: number }[];
            geometry: ReturnType<typeof measure>;
          }[] = [];
          const scrolls: ReturnType<typeof measure>[] = [];
          const noticeChanges: ReturnType<typeof measure>[] = [];
          let gestureStartedAt: number | null = null;
          let maxNativeScrollTop = 0;
          const onNative = (event: Event) => {
            const insideActions = event.target instanceof Node && element.contains(event.target);
            const geometry = measure();
            if (event.type === 'touchstart' && event.isTrusted && insideActions)
              gestureStartedAt = geometry.at;
            const points =
              event instanceof TouchEvent
                ? [...event.changedTouches].map((touch) => ({
                    x: touch.clientX,
                    y: touch.clientY,
                    id: touch.identifier,
                  }))
                : event instanceof PointerEvent
                  ? [{ x: event.clientX, y: event.clientY, id: event.pointerId }]
                  : [];
            nativeEvents.push({
              type: event.type,
              isTrusted: event.isTrusted,
              insideActions,
              target: target(event.target),
              points,
              geometry,
            });
          };
          const onScroll = () => {
            const geometry = measure();
            scrolls.push(geometry);
            if (gestureStartedAt !== null)
              maxNativeScrollTop = Math.max(maxNativeScrollTop, geometry.actions.scrollTop);
          };
          const types = [
            'touchstart',
            'touchmove',
            'touchend',
            'touchcancel',
            'pointerdown',
            'pointermove',
            'pointerup',
            'pointercancel',
          ];
          for (const type of types)
            document.addEventListener(type, onNative, { capture: true, passive: true });
          element.addEventListener('scroll', onScroll, { passive: true });
          const notice = new MutationObserver(() => noticeChanges.push(measure()));
          notice.observe(document.getElementById('toast')!, {
            attributes: true,
            attributeFilter: ['hidden', 'class', 'style'],
          });
          return {
            snapshot: () => ({
              initial,
              nativeEvents,
              scrolls,
              noticeChanges,
              gestureStartedAt,
              maxNativeScrollTop,
              final: measure(),
            }),
            dispose: () => {
              for (const type of types) document.removeEventListener(type, onNative, true);
              element.removeEventListener('scroll', onScroll);
              notice.disconnect();
            },
          };
        }, point);
        const collect = () => observation.evaluate((observer) => observer.snapshot());
        let touchActive = false;
        let evidence: Awaited<ReturnType<typeof collect>> | undefined;
        try {
          touchActive = true;
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [point],
          });
          for (let step = 1; step <= 8; step++) {
            await touch.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ ...point, y: point.y - step * surface.height * 0.06 }],
            });
            await page.waitForTimeout(20);
          }
          // A deliberate scroll ends at rest, rather than flinging through the next inspection.
          await page.waitForTimeout(80);
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          touchActive = false;
        } finally {
          try {
            if (touchActive)
              await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } finally {
            try {
              evidence = await collect();
              await info.attach('native-compact-landscape-scroll', {
                body: JSON.stringify(evidence, null, 2),
                contentType: 'application/json',
              });
            } finally {
              try {
                await observation.evaluate((observer) => observer.dispose());
              } finally {
                await observation.dispose();
              }
            }
          }
        }
        if (!evidence) throw new Error('Missing retained native scroll observation.');
        expect(evidence.maxNativeScrollTop).toBeGreaterThan(0);
        expect(
          evidence.nativeEvents.some(
            (event) => event.type === 'touchstart' && event.isTrusted && event.insideActions,
          ),
        ).toBe(true);
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(resume).toBeEnabled();
      }
      await compactReachability(
        page,
        '#travel-status button:not([hidden]), #action-tray button',
        process.env.CI ? 60_000 : 20_000,
      );
      if (size.height <= 420) await expect(cue).toContainText('↑');
      await actions.evaluate((element) => (element.scrollTop = 0));
      await page.screenshot({
        path: info.outputPath(`saved-route-${size.width}.png`),
        scale: 'css',
      });
      await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
      await expect(page.locator('.message-list')).toContainText('Journey exported');
      await dismiss(page);
      await expect(page.locator('#toast')).toBeHidden();
      await compactReachability(page, 'button', process.env.CI ? 60_000 : 20_000, false);
    }
  } finally {
    try {
      await touch?.detach();
    } catch (error) {
      detachFailure = { error };
      info.annotations.push({
        type: 'cleanup-error',
        description: 'touch.detach: ' + String(error),
      });
    }
  }
  if (detachFailure) throw detachFailure.error;
});
