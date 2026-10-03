import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { roadStart } from '../helpers/road';
import { galileeAction } from '../helpers/galilee';
import { ready, visit, dismiss, settled, exported } from '../helpers/connection-browser';
import { transition } from '../../src/game/quest';
import type { GameState } from '../../src/game/types';
import { overlaps } from '../../src/ui/labels';

async function nativeOptions(page: Page, touch: boolean) {
  const label = page.locator('.world-label[data-value="spring-tools"]');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  // A save/export notice can temporarily reserve the rack's projected space.
  // Let that ordinary feedback clear before choosing the phone's touch point.
  if (touch) await expect(page.locator('#toast')).toBeHidden();
  await expect(label).toBeVisible();
  const audit = await page.evaluateHandle(() => {
    const events: {
      type: string;
      trusted: boolean;
      pointerType: string;
      button: number;
      time: number;
      label: string | null;
    }[] = [];
    const record = (event: PointerEvent) => {
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        pointerType: event.pointerType,
        button: event.button,
        time: event.timeStamp,
        label:
          event.target instanceof Element
            ? (event.target.closest<HTMLElement>('.world-label')?.dataset.value ?? null)
            : null,
      });
    };
    window.addEventListener('pointerdown', record, { capture: true, passive: true });
    window.addEventListener('pointerup', record, { capture: true, passive: true });
    return {
      events,
      cleanup: () => {
        window.removeEventListener('pointerdown', record, true);
        window.removeEventListener('pointerup', record, true);
      },
    };
  });
  let events: Awaited<ReturnType<typeof audit.jsonValue>>['events'];
  try {
    if (touch) {
      let point: { x: number; y: number } | null;
      await expect
        .poll(async () => {
          point = await page.evaluate(async () => {
            const sample = () => {
              const node = document.querySelector<HTMLElement>(
                '.world-label[data-value="spring-tools"]',
              );
              if (!node?.isConnected || node.hidden || node.hasAttribute('disabled')) return null;
              for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
                const style = getComputedStyle(parent);
                if (
                  parent.hidden ||
                  parent.inert ||
                  style.display === 'none' ||
                  style.visibility !== 'visible' ||
                  Number(style.opacity) === 0
                )
                  return null;
              }
              const bounds = node.getBoundingClientRect();
              const x = bounds.x + bounds.width / 2;
              const y = bounds.y + bounds.height / 2;
              if (
                bounds.width < 44 ||
                bounds.height < 44 ||
                !node.contains(document.elementFromPoint(x, y)) ||
                document.querySelector('#ui')?.getAttribute('data-action-pending') !== 'false'
              )
                return null;
              return { x, y, width: bounds.width, height: bounds.height };
            };
            const first = sample();
            if (!first) return null;
            for (let frame = 0; frame < 4; frame++) {
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              if (JSON.stringify(sample()) !== JSON.stringify(first)) return null;
            }
            return { x: first.x, y: first.y };
          });
          return point !== null;
        }, 'The native phone hold starts on the settled, stable, topmost rack label')
        .toBe(true);
      const session = await page.context().newCDPSession(page);
      try {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ id: 1, x: point!.x, y: point!.y }],
        });
        await expect(menu).toBeVisible();
      } finally {
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await session.detach();
      }
    } else await label.click({ button: 'right' });
    await expect(menu).toBeVisible();
  } finally {
    events = await audit.evaluate((record) => {
      record.cleanup();
      return record.events;
    });
    await audit.dispose();
  }
  const down = events.filter((event) => event.type === 'pointerdown');
  const up = events.filter((event) => event.type === 'pointerup');
  expect(down).toHaveLength(1);
  expect(up).toHaveLength(1);
  expect(events.every((event) => event.trusted)).toBe(true);
  expect(down[0]).toMatchObject({
    pointerType: touch ? 'touch' : 'mouse',
    button: touch ? 0 : 2,
    label: 'spring-tools',
  });
  if (touch) expect(up[0]!.time - down[0]!.time).toBeGreaterThan(500);
  return { label, menu };
}

async function examine(
  page: Page,
  before: GameState,
  touch: boolean,
  held: boolean,
  info: TestInfo,
) {
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const { menu } = await nativeOptions(page, touch);
  const command = menu.getByRole('menuitem', { name: 'Examine The scoop rack', exact: true });
  if (touch) await command.tap();
  else await command.click();
  const text = held
    ? 'The scoop rack: The low rack is empty. The wooden scoop is in your hands.'
    : 'The scoop rack: A wooden scoop lies on a low rack beside the channel.';
  // Read the actual post-input DOM together while the ordinary notice is visible.
  const observe = () =>
    page.evaluate(() => {
      const label = document.querySelector('.world-label[data-value="spring-tools"]');
      const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Choose Option"]');
      const toast = document.querySelector<HTMLElement>('#toast');
      const rect = (node: Element) => {
        const bounds = node.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
        };
      };
      const focus = document.activeElement;
      return {
        post: {
          menuClosed: !!menu?.hidden,
          labelFocused: focus === label,
          labelVisible:
            !!label &&
            !(label as HTMLElement).hidden &&
            label.getClientRects().length > 0 &&
            getComputedStyle(label).visibility !== 'hidden',
          dialogOpen: [...document.querySelectorAll('[role="dialog"]')].some(
            (node) =>
              node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden',
          ),
          flagHidden:
            getComputedStyle(document.querySelector('.minimap-destination')!).display === 'none',
          player: document.querySelector('#minimap-player')?.getAttribute('transform'),
          toast: toast?.textContent,
          toastVisible: !!toast && !toast.hidden && getComputedStyle(toast).opacity === '1',
          settled: document.querySelector('#ui')?.getAttribute('data-action-pending') === 'false',
        },
        layout: {
          label: label && { ...rect(label), hidden: (label as HTMLElement).hidden },
          focus: {
            tag: focus?.tagName,
            id: focus?.id,
            value: (focus as HTMLElement | null)?.dataset.value,
          },
          reservations: [
            ...document.querySelectorAll<HTMLElement>(
              '.topbar,.quest-card,.minimap-wrap,.bottom-center,.traveler-card,#toast,#scene-controls',
            ),
          ]
            .filter(
              (node) =>
                !node.hidden &&
                node.getClientRects().length &&
                getComputedStyle(node).visibility !== 'hidden',
            )
            .map((node) => ({ id: node.id || node.className, ...rect(node) })),
        },
      };
    });
  let observed: Awaited<ReturnType<typeof observe>>;
  await expect
    .poll(async () => {
      observed = await observe();
      return observed.post;
    })
    .toEqual({
      menuClosed: true,
      labelFocused: true,
      labelVisible: true,
      dialogOpen: false,
      flagHidden: true,
      player: position,
      toast: text,
      toastVisible: true,
      settled: true,
    });
  expect(observed!.layout.label).not.toBeNull();
  expect(
    observed!.layout.reservations.some((reserved) => overlaps(observed!.layout.label!, reserved)),
  ).toBe(false);
  await page.screenshot({
    path: info.outputPath(held ? 'held-scoop-examined.png' : 'stored-scoop-examined.png'),
    scale: 'css',
  });
  await info.attach(held ? 'held-scoop-label-layout' : 'stored-scoop-label-layout', {
    body: Buffer.from(JSON.stringify(observed!.layout, null, 2)),
    contentType: 'application/json',
  });
  const after = await exported(page);
  expect(after).toEqual({ ...before, playTime: after.playTime });
  await dismiss(page);
  return after;
}

async function practical(page: Page, before: GameState, id: string, touch: boolean) {
  await visit(page, 'spring-tools');
  const command = page.locator(`.work-actions [data-action="galilee-action"][data-value="${id}"]`);
  await expect(command).toBeEnabled();
  if (touch) await command.tap();
  else await command.click();
  await settled(page);
  const expected = transition(before, { type: 'galilee-action', id });
  expect(expected).not.toBe(before);
  const after = await exported(page);
  expect(after).toEqual({ ...expected, playTime: after.playTime });
  await dismiss(page);
  return after;
}

test('native scoop rack Examine follows borrowing and return without moving or changing saved work', async ({
  page,
  isMobile,
}, info) => {
  let state = roadStart();
  for (const id of ['spring-start', 'spring-note-source', 'spring-note-basins'])
    state = galileeAction(state, id);
  await ready(page, state);
  await visit(page, 'spring-tools');
  let saved = await exported(page);
  await dismiss(page);
  expect(saved.campaign.carrying).toBeNull();
  saved = await examine(page, saved, isMobile, false, info);
  saved = await practical(page, saved, 'spring-borrow', isMobile);
  expect(saved.campaign.carrying).toBe('channel-scoop');
  saved = await examine(page, saved, isMobile, true, info);
  saved = await practical(page, saved, 'spring-return', isMobile);
  expect(saved.campaign.carrying).toBeNull();
  await examine(page, saved, isMobile, false, info);
});
