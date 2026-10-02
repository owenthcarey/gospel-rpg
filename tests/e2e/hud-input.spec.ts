import { test, expect } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';
import { harborAction, preparedHarbor } from '../helpers/harbor';

test('WASD takes over Follow the path and Resume route while retaining the saved destination', async ({
  page,
}) => {
  await ready(page);
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
});

test('a repeatable nearby action keeps native keyboard activation and yields to walking', async ({
  page,
}) => {
  const state = harborAction(preparedHarbor(), 'turn');
  await ready(page, state);
  const turn = page.locator('#action-tray [data-action="quick-action"][data-value="turn"]');
  await expect(turn).toBeEnabled();
  await turn.click();
  await settled(page);
  await expect(turn).toContainText('north–south');
  await expect(turn).toBeFocused();
  // The replacement button keeps focus after the arrangement changes. Enter
  // must still turn the plank, while a later S belongs to world movement.
  await page.keyboard.press('Enter');
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
