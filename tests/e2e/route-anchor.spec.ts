import { expect, test } from '@playwright/test';
import { newGame } from '../../src/game/types';
import { exported, ready, settled } from '../helpers/connection-browser';

for (const compact of [false, true]) {
  test(`the ${compact ? '320px landscape' : 'ordinary'} route ribbon keeps its native Cancel target through actual Miriam proximity`, async ({
    page,
    isMobile,
  }, info) => {
    if (compact) await page.setViewportSize({ width: 568, height: 320 });
    await ready(page);
    await expect(page.locator('.chapter-card')).toHaveCount(0);
    await expect(page.locator('#toast')).toBeHidden();
    await expect(page.locator('#nearby-action')).toBeHidden();
    const player = page.locator('#minimap-player');
    const original = await player.getAttribute('transform');
    const observation = await page.evaluateHandle((original) => {
      const visible = (node: Element | null) => {
        if (!node?.isConnected || !node.getClientRects().length) return false;
        for (let parent: Element | null = node; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (
            parent.hasAttribute('hidden') ||
            parent.hasAttribute('inert') ||
            style.display === 'none' ||
            style.visibility !== 'visible' ||
            Number(style.opacity) === 0
          )
            return false;
        }
        return true;
      };
      const rect = (node: Element) => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      };
      const clippedRect = (node: Element) => {
        const bounds = rect(node);
        let left = bounds.x,
          right = bounds.x + bounds.width,
          top = bounds.y,
          bottom = bounds.y + bounds.height;
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent),
            clip = parent.getBoundingClientRect();
          if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
          }
          if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) {
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
        }
        return {
          x: left,
          y: top,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        };
      };
      const position = (node: Element | null) => {
        const values = node?.getAttribute('transform')?.match(/^translate\(([^,]+),([^)]+)\)/);
        return values && values.slice(1).every((v) => v.trim() && Number.isFinite(Number(v)))
          ? { x: Number(values[1]), y: Number(values[2]) }
          : null;
      };
      const sample = (contact?: { x: number; y: number }) => {
        const status = document.querySelector<HTMLElement>('#travel-status')!;
        const cancel = status.querySelector<HTMLButtonElement>(
          '[data-action="cancel-navigation"]',
        )!;
        const prompt = document.querySelector<HTMLElement>('#nearby-action')!;
        const player = document.querySelector('#minimap-player');
        const flag = document.querySelector('.minimap-destination');
        const current = position(player),
          destination = position(flag),
          button = rect(cancel),
          route = rect(status),
          hints = rect(document.querySelector('.control-hints')!);
        const point = contact ?? {
          x: button.x + button.width / 2,
          y: button.y + button.height / 2,
        };
        const peers = [
          ...document.querySelectorAll(
            '.topbar,.quest-card,.minimap-wrap,.minimap-compass,.minimap-open,.traveler-card,.time-of-day,.hud-actions,#action-tray,#nearby-action,.action-scroll-cue,.control-hints,#toast',
          ),
        ]
          .filter(visible)
          .map((node) => ({ name: node.id || node.className, ...clippedRect(node) }))
          .filter((bounds) => bounds.width > 0 && bounds.height > 0);
        const overlaps = peers.filter(
          (other) =>
            route.x < other.x + other.width &&
            route.x + route.width > other.x &&
            route.y < other.y + other.height &&
            route.y + route.height > other.y,
        );
        return {
          at: performance.now(),
          viewport: { width: innerWidth, height: innerHeight },
          position: current,
          destination,
          button,
          route,
          hints,
          point,
          peers,
          overlaps,
          miriam: visible(prompt) && !!prompt.textContent?.includes('Speak with Miriam'),
          prompt: { hidden: prompt.hidden, text: prompt.textContent, ...rect(prompt) },
          flagVisible: visible(flag),
          walking: visible(status) && !!status.textContent?.includes('Walking to chosen point'),
          resumeHidden: !visible(status.querySelector('[data-action="route-resume"]')),
          cancelVisible: visible(cancel),
          cancelEnabled: !cancel.disabled,
          nativeTarget: cancel.contains(document.elementFromPoint(point.x, point.y)),
          moved: !!original && player?.getAttribute('transform') !== original,
          beforeArrival:
            !!current &&
            !!destination &&
            (current.x !== destination.x || current.y !== destination.y),
          inViewport:
            route.x >= 0 &&
            route.y >= 0 &&
            route.x + route.width <= innerWidth &&
            route.y + route.height <= innerHeight,
        };
      };
      const frames: ReturnType<typeof sample>[] = [];
      const events: {
        type: string;
        trusted: boolean;
        targetAction?: string;
        targetLabel?: string;
        snapshot: ReturnType<typeof sample>;
      }[] = [];
      const transition = (current = sample()) => {
        const before = frames.find((frame) => frame.walking && frame.moved && frame.prompt.hidden);
        const after =
          before && frames.find((frame) => frame.at > before.at && frame.walking && frame.miriam);
        return { before, after, current };
      };
      const active = (frame: ReturnType<typeof sample> | undefined) =>
        !!frame &&
        frame.walking &&
        frame.flagVisible &&
        frame.resumeHidden &&
        frame.cancelVisible &&
        frame.cancelEnabled &&
        frame.nativeTarget &&
        frame.moved &&
        frame.beforeArrival &&
        frame.inViewport &&
        frame.overlaps.length === 0;
      let resolveFirst!: (value: ReturnType<typeof transition>) => void;
      const firstValid = new Promise<ReturnType<typeof transition>>((resolve) => {
        resolveFirst = resolve;
      });
      let resolved = false;
      let running = true;
      let raf = 0;
      const painted = () => {
        const current = sample();
        frames.push(current);
        const value = transition(current);
        if (
          !resolved &&
          active(value.before) &&
          active(value.after) &&
          active(current) &&
          !value.before!.miriam &&
          value.before!.prompt.hidden &&
          value.after!.miriam &&
          !value.after!.prompt.hidden &&
          current.miriam
        ) {
          resolved = true;
          resolveFirst(value);
        }
        if (running) raf = requestAnimationFrame(painted);
      };
      const record = (event: MouseEvent) => {
        const target =
          event.target instanceof Element ? event.target.closest<HTMLElement>('button') : null;
        events.push({
          type: event.type,
          trusted: event.isTrusted,
          targetAction: target?.dataset.action,
          targetLabel: target?.textContent ?? undefined,
          snapshot: sample({ x: event.clientX, y: event.clientY }),
        });
        if (event.type === 'click' && target?.dataset.action === 'cancel-navigation') {
          running = false;
          cancelAnimationFrame(raf);
        }
      };
      for (const type of ['pointerdown', 'pointerup', 'click'] as const)
        window.addEventListener(type, record, { capture: true, passive: true });
      raf = requestAnimationFrame(painted);
      return {
        snapshot: () => ({ frames, events }),
        firstTransition: () => firstValid,
        cleanup: () => {
          if (!resolved) resolveFirst(transition());
          running = false;
          cancelAnimationFrame(raf);
          for (const type of ['pointerdown', 'pointerup', 'click'] as const)
            window.removeEventListener(type, record, true);
        },
      };
    }, original);
    const destination = await page.locator('.minimap svg').evaluate((node) => {
      const svg = node as SVGSVGElement;
      const point = svg.createSVGPoint();
      // This shipped western path crosses the baker's proximity on its way to the olive rows.
      point.x = (-20 + 24) * 4;
      point.y = (24 - 7) * 4;
      const target = point.matrixTransform(svg.getScreenCTM()!);
      return {
        x: target.x,
        y: target.y,
        minimap: !!document.elementFromPoint(target.x, target.y)?.closest('.minimap'),
      };
    });
    const active = {
      walking: true,
      flagVisible: true,
      resumeHidden: true,
      cancelVisible: true,
      cancelEnabled: true,
      nativeTarget: true,
      moved: true,
      beforeArrival: true,
      inViewport: true,
      overlaps: [],
    };
    let target: { x: number; y: number } | null | undefined;
    const transitionSample = () => observation.evaluate((value) => value.firstTransition());
    let transition: Awaited<ReturnType<typeof transitionSample>> | undefined;
    try {
      expect(destination.minimap).toBe(true);
      if (isMobile) await page.touchscreen.tap(destination.x, destination.y);
      else await page.mouse.click(destination.x, destination.y);
      // The first valid rendered transition was armed before native input. Await it
      // within the configured poll deadline so serialized backoff cannot miss proximity.
      await expect
        .poll(async () => {
          transition = await transitionSample();
          return transition;
        })
        .toMatchObject({
          before: { ...active, miriam: false, prompt: { hidden: true } },
          after: { ...active, miriam: true, prompt: { hidden: false } },
          current: { ...active, miriam: true },
        });
      expect(transition!.before!.destination).toEqual({ x: 16, y: 68 });
      expect(transition!.after!.destination).toEqual(transition!.before!.destination);
      const originalTarget = transition!.before!.point;
      // Deliberately use the pre-proximity coordinate: locator retrying would conceal a moving target.
      if (isMobile) await page.touchscreen.tap(originalTarget.x, originalTarget.y);
      else await page.mouse.click(originalTarget.x, originalTarget.y);
      const observed = await observation.evaluate((value) => value.snapshot());
      const contact = observed.events.filter(
        (event) => event.type === 'click' && event.targetAction === 'cancel-navigation',
      );
      expect(contact).toHaveLength(1);
      expect(contact[0]).toMatchObject({ trusted: true, snapshot: { ...active, miriam: true } });
      target = contact[0]!.snapshot.destination;
      for (const type of ['pointerdown', 'pointerup'])
        expect(observed.events).toContainEqual(
          expect.objectContaining({ type, trusted: true, targetAction: 'cancel-navigation' }),
        );
      const movingFrames = observed.frames.filter((frame) => frame.at >= transition!.before!.at);
      expect(movingFrames.some((frame) => !frame.miriam)).toBe(true);
      expect(movingFrames.some((frame) => frame.miriam)).toBe(true);
      for (const frame of movingFrames) {
        expect(frame, `rendered frame at ${frame.at}`).toMatchObject(active);
        expect(frame.point.x).toBeCloseTo(originalTarget.x, 2);
        expect(frame.point.y).toBeCloseTo(originalTarget.y, 2);
        expect(frame.button.width).toBeGreaterThanOrEqual(44);
        expect(frame.button.height).toBeGreaterThanOrEqual(isMobile || compact ? 44 : 32);
        // The ribbon stays clear of the hints: above them when they share columns, as in the
        // touch layouts, or beside them where the classic frame docks hints under the chatbox.
        const sharedColumns =
          frame.route.x < frame.hints.x + frame.hints.width &&
          frame.route.x + frame.route.width > frame.hints.x;
        if (sharedColumns)
          expect(frame.route.y + frame.route.height).toBeLessThanOrEqual(frame.hints.y - 5);
        else expect(frame.route.x).toBeGreaterThanOrEqual(frame.hints.x + frame.hints.width + 5);
      }
    } finally {
      try {
        const observed = await observation.evaluate((value) => value.snapshot());
        await info.attach('native-route-anchor-frames-and-contact', {
          body: JSON.stringify(observed, null, 2),
          contentType: 'application/json',
        });
      } finally {
        await observation.evaluate((value) => value.cleanup());
        await observation.dispose();
      }
    }
    await settled(page);
    await expect(page.locator('.minimap-destination')).toBeHidden();
    await expect(page.locator('#travel-status')).toBeHidden();
    await expect(page.locator('#game-canvas')).toBeFocused();
    await expect(page.getByRole('dialog')).toBeHidden();
    const stopped = await player.getAttribute('transform');
    expect(stopped).not.toBe(`translate(${target!.x},${target!.y})`);
    await page.waitForTimeout(400);
    await expect(player).toHaveAttribute('transform', stopped!);
    await page.screenshot({
      path: info.outputPath('native-miriam-proximity-cancel.png'),
      scale: 'css',
    });
    const saved = await exported(page);
    expect(saved).toEqual({ ...newGame(), position: saved.position, playTime: saved.playTime });
  });
}
