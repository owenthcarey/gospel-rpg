import { test, expect } from '@playwright/test';
import { ready, settled, exported, visit, dismiss } from '../helpers/connection-browser';
import { harborAction, preparedHarbor } from '../helpers/harbor';
import { nearbyActions } from '../../src/ui/views/actions';
import { newGame } from '../../src/game/types';

test('WASD takes over Follow the path and Resume route while retaining the saved destination', async ({
  page,
}) => {
  const initial = newGame();
  // The ordinary spawn is only a short walk from Simon. A real southern
  // approach leaves time to interrupt it even while software WebGL observes the HUD.
  initial.position = { x: -1, z: -15 };
  await ready(page, initial);
  const follow = page.locator('#quest-card [data-action="navigate"]');
  const flag = page.locator('.minimap-destination');
  const player = page.locator('#minimap-player');
  const target = await follow.getAttribute('data-value');
  await follow.click();
  await settled(page);
  await expect(follow).toBeFocused();
  await expect(flag).toBeVisible();
  let position = await player.getAttribute('transform');
  await page.keyboard.down('s');
  try {
    await expect(flag).toBeHidden();
    await expect(player).not.toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('s');
  }
  const resume = page.locator('#travel-status [data-action="route-resume"]');
  await expect(resume).toBeEnabled();
  await resume.click();
  await settled(page);
  await expect(flag).toBeVisible();
  position = await player.getAttribute('transform');
  await page.keyboard.down('s');
  try {
    await expect(flag).toBeHidden();
    await expect(player).not.toHaveAttribute('transform', position!);
  } finally {
    await page.keyboard.up('s');
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
