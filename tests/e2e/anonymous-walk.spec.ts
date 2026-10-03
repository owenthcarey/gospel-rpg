import { expect, test } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';
import { newGame } from '../../src/game/types';

test('an anonymous native minimap walk offers Cancel and stops without changing earned progress', async ({
  page,
  isMobile,
}, info) => {
  await ready(page);
  const flag = page.locator('.minimap-destination');
  const status = page.locator('#travel-status');
  const player = page.locator('#minimap-player');
  const original = await player.getAttribute('transform');
  const audit = await page.evaluateHandle((original) => {
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
    const position = (node: Element | null) => {
      const coordinates = node?.getAttribute('transform')?.match(/^translate\(([^,]+),([^)]+)\)/);
      if (
        !coordinates ||
        !coordinates.slice(1).every((v) => v.trim() && Number.isFinite(Number(v)))
      )
        return null;
      return { x: Number(coordinates[1]), y: Number(coordinates[2]) };
    };
    const sample = (contact?: { x: number; y: number }) => {
      const controls = document.querySelectorAll<HTMLButtonElement>(
        '#travel-status [data-action="cancel-navigation"]',
      );
      const cancel = controls.length === 1 ? controls[0]! : null;
      const status = document.querySelector('#travel-status');
      const player = document.querySelector('#minimap-player');
      const flag = document.querySelector('.minimap-destination');
      const current = position(player),
        destination = position(flag);
      const rect = cancel?.getBoundingClientRect();
      const point =
        contact ?? (rect && { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      return {
        point,
        position: current,
        destination,
        flagVisible: visible(flag),
        walking: visible(status) && !!status?.textContent?.includes('Walking to chosen point'),
        resumeHidden: !visible(status?.querySelector('[data-action="route-resume"]') ?? null),
        cancelEnabled: !!cancel && !cancel.disabled,
        cancelVisible: visible(cancel),
        nativeTarget: !!point && !!cancel?.contains(document.elementFromPoint(point.x, point.y)),
        moved:
          !!original &&
          !!player?.getAttribute('transform') &&
          player.getAttribute('transform') !== original,
        beforeArrival:
          !!current &&
          !!destination &&
          (current.x !== destination.x || current.y !== destination.y),
      };
    };
    const events: { trusted: boolean; snapshot: ReturnType<typeof sample> }[] = [];
    const record = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('[data-action="cancel-navigation"]')
      )
        return;
      events.push({
        trusted: event.isTrusted,
        snapshot: sample({ x: event.clientX, y: event.clientY }),
      });
    };
    window.addEventListener('click', record, { capture: true, passive: true });
    return { sample, events, cleanup: () => window.removeEventListener('click', record, true) };
  }, original);
  const point = await page.locator('.minimap svg').evaluate((node) => {
    const svg = node as SVGSVGElement;
    const point = svg.createSVGPoint();
    // A reachable western destination leaves several seconds for a deliberate cancellation.
    point.x = (-20 + 24) * 4;
    point.y = (24 + 3) * 4;
    const rendered = point.matrixTransform(svg.getScreenCTM()!);
    const hit = document.elementFromPoint(rendered.x, rendered.y);
    return { x: rendered.x, y: rendered.y, minimap: !!hit?.closest('.minimap') };
  });
  expect(point.minimap).toBe(true);
  const activeWalk = {
    flagVisible: true,
    walking: true,
    resumeHidden: true,
    cancelEnabled: true,
    cancelVisible: true,
    nativeTarget: true,
    moved: true,
    beforeArrival: true,
  };
  let destination: { x: number; y: number } | null | undefined;
  try {
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    // Observe all live route predicates together before the original native locator input.
    // Serial assertions and a WebGL screenshot can otherwise consume the entire walk.
    await expect.poll(() => audit.evaluate((value) => value.sample())).toMatchObject(activeWalk);
    const cancel = status.locator('[data-action="cancel-navigation"]');
    if (isMobile) await cancel.tap();
    else await cancel.click();
    const events = await audit.evaluate((value) => value.events);
    await info.attach('chosen-point-native-cancel', {
      body: JSON.stringify(events, null, 2),
      contentType: 'application/json',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ trusted: true, snapshot: activeWalk });
    destination = events[0]!.snapshot.destination;
  } finally {
    await audit.evaluate((value) => value.cleanup());
    await audit.dispose();
  }
  await settled(page);
  await expect(flag).toBeHidden();
  await expect(status).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeFocused();
  const stopped = await player.getAttribute('transform');
  expect(stopped).not.toBe(`translate(${destination!.x},${destination!.y})`);
  // Keep the world running through further real frames: cancellation must stop actual travel.
  await page.waitForTimeout(400);
  await expect(player).toHaveAttribute('transform', stopped!);
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.screenshot({ path: info.outputPath('chosen-point-cancel.png') });
  const saved = await exported(page);
  expect(saved).toEqual({ ...newGame(), position: saved.position, playTime: saved.playTime });
});
