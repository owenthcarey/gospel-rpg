import { test, expect } from '@playwright/test';
import { ready, settled, exported, visit, dismiss } from '../helpers/connection-browser';
import { harborAction, preparedHarbor } from '../helpers/harbor';
import { nearbyActions } from '../../src/ui/views/actions';
import { newGame } from '../../src/game/types';

test('WASD takes over Follow the path and Resume route while retaining the saved destination', async ({
  page,
}, info) => {
  const initial = newGame();
  // The ordinary spawn is only a short walk from Simon. A real southern
  // approach leaves time to interrupt it even while software WebGL observes the HUD.
  initial.position = { x: -1, z: -15 };
  await ready(page, initial);
  const follow = page.locator('#quest-card [data-action="navigate"]');
  const target = await follow.getAttribute('data-value');
  const resume = page.locator('#travel-status [data-action="route-resume"]');
  const audit = await page.evaluateHandle(() => {
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
    const sample = (action: string) => {
      const selector =
        action === 'navigate' ? '#quest-card [data-action="navigate"]' : '#game-canvas';
      const controls = document.querySelectorAll<HTMLElement>(selector);
      const control = controls.length === 1 ? controls[0]! : null;
      const player = document.querySelector('#minimap-player');
      const flag = document.querySelector('.minimap-destination');
      const current = position(player),
        destination = position(flag);
      const resume = document.querySelector<HTMLButtonElement>(
        '#travel-status [data-action="route-resume"]',
      );
      return {
        settled: document.querySelector('#ui')?.getAttribute('data-action-pending') === 'false',
        focused: !!control && document.activeElement === control,
        enabled: !!control && !(control instanceof HTMLButtonElement && control.disabled),
        controlVisible: visible(control),
        flagVisible: visible(flag),
        beforeArrival:
          !!current &&
          !!destination &&
          (current.x !== destination.x || current.y !== destination.y),
        position: current ? player!.getAttribute('transform') : null,
        dialogHidden: ![...document.querySelectorAll('[role="dialog"]')].some(visible),
        resumeVisible: visible(resume),
        resumeEnabled: !!resume && !resume.disabled,
      };
    };
    const events: {
      trusted: boolean;
      owner: string | null;
      target: string | null;
      snapshot: ReturnType<typeof sample>;
    }[] = [];
    const record = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's') return;
      const control =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
      events.push({
        trusted: event.isTrusted,
        owner:
          event.target instanceof HTMLElement
            ? event.target.id || control?.dataset.action || null
            : null,
        target: control?.dataset.value ?? null,
        snapshot: sample(control?.dataset.action ?? ''),
      });
    };
    window.addEventListener('keydown', record, { capture: true, passive: true });
    return { sample, events, cleanup: () => window.removeEventListener('keydown', record, true) };
  });
  const interrupt = async (action: 'navigate' | 'route-resume') => {
    const activeRoute = {
      settled: true,
      focused: true,
      enabled: true,
      controlVisible: true,
      flagVisible: true,
      beforeArrival: true,
      dialogHidden: true,
    };
    // One fresh observation replaces the serial waits that let Resume arrive
    // before S. The passive key observer also verifies ownership at actual dispatch.
    await expect
      .poll(() => audit.evaluate((value, action) => value.sample(action), action))
      .toMatchObject(activeRoute);
    await page.keyboard.down('s');
    try {
      const event = await audit.evaluate((value) => value.events.at(-1));
      expect(event).toMatchObject({
        trusted: true,
        owner: action === 'navigate' ? 'navigate' : 'game-canvas',
        snapshot: activeRoute,
      });
      if (action === 'navigate') expect(event!.target).toBe(target);
      await expect
        .poll(() =>
          audit.evaluate((value, position) => {
            const after = value.sample('route-resume');
            return {
              ...after,
              moved: !!position && !!after.position && after.position !== position,
            };
          }, event!.snapshot.position),
        )
        .toMatchObject({
          settled: true,
          flagVisible: false,
          moved: true,
          dialogHidden: true,
          resumeVisible: true,
          resumeEnabled: true,
        });
    } finally {
      await page.keyboard.up('s');
    }
  };
  try {
    await follow.click();
    await interrupt('navigate');
    await resume.click();
    await interrupt('route-resume');
    const events = await audit.evaluate((value) => value.events);
    expect(events).toHaveLength(2);
    await info.attach('follow-resume-native-keys', {
      body: JSON.stringify(events, null, 2),
      contentType: 'application/json',
    });
  } finally {
    await audit.evaluate((value) => value.cleanup());
    await audit.dispose();
  }
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(resume).toBeVisible();
  const saved = await exported(page);
  expect(saved.connection.route?.target).toBe(target);
  expect(saved.quest).toBe('not-started');
  expect(saved).toEqual({
    ...initial,
    position: saved.position,
    playTime: saved.playTime,
    connection: { ...initial.connection, route: { target } },
  });
});

test('a repeatable nearby action keeps native keyboard activation and yields to walking', async ({
  page,
}) => {
  let state = harborAction(preparedHarbor(), 'plank-south');
  // The authored plank starts north–south (turn=1). Two earned turns leave
  // that orientation in place while approaching its current southern position.
  for (let i = 0; i < 2; i++) state = harborAction(state, 'turn');
  expect(state.harbor.turn).toBe(1);
  const quickIds = [
    ...nearbyActions(state).matchAll(/data-action="quick-action" data-value="([^"]+)"/g),
  ].map((match) => match[1]);
  expect(quickIds).toEqual(['plank-north', 'plank-rack', 'turn']);
  // Approach the earned southern placement through the real map route before
  // returning to its quick tray. The rack and north crossing have different neighbours.
  await ready(page, { ...state, position: { x: 0, z: -3 } });
  await visit(page, 'harbor-plank');
  await dismiss(page);
  await expect
    .poll(() =>
      page
        .locator('#action-tray [data-action="quick-action"]')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.value)),
    )
    .toEqual(quickIds);
  const turn = page.locator('#action-tray [data-action="quick-action"][data-value="turn"]');
  await expect(turn).toBeEnabled();
  await expect(turn).toContainText('east–west');
  await turn.click();
  await settled(page);
  await expect(turn).toContainText('north–south');
  await expect(turn).toBeFocused();
  // The replacement button keeps focus after the arrangement changes. Enter
  // must still turn the plank, while a later S belongs to world movement.
  await turn.press('Enter');
  await settled(page);
  await expect(turn).toContainText('east–west');
  await expect(turn).toBeFocused();
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  await page.keyboard.down('s');
  try {
    await expect(player).not.toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('s');
  }
  await expect(page.getByRole('dialog')).toBeHidden();
  const saved = await exported(page);
  expect(saved.harbor.turn).toBe(state.harbor.turn);
  expect(saved.harbor.stage).toBe('working');
  expect(saved.campaign.carrying).toBeNull();
});
