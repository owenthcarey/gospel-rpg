import { test, expect } from '@playwright/test';
import { exported, ready, settled } from '../helpers/connection-browser';

test('typing in the chatbox speaks overhead without moving or interacting', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The chat line belongs to the desktop frame');
  await ready(page);
  await settled(page);
  const before = await exported(page);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  await page.locator('#game-canvas').focus();
  await page.keyboard.press('Enter');
  const chat = page.getByRole('textbox', { name: 'Say something aloud' });
  await expect(chat).toBeFocused();
  // Letter keys type; they neither walk nor interact while the chat line has focus.
  await page.keyboard.type('wasd e Peace to you');
  await page.waitForTimeout(400);
  await expect(player).toHaveAttribute('transform', position!);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(chat).toHaveValue('');
  await expect(page.locator('.traveler-speech')).toBeVisible();
  await expect(page.locator('.traveler-speech')).toHaveText('wasd e Peace to you');
  await expect(page.locator('.chat-log .chat-said').last()).toHaveText('wasd e Peace to you');
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-canvas')).toBeFocused();
  // Speech is only a moment: it fades on its own and never changes the journey.
  await expect(page.locator('.traveler-speech')).toBeHidden({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
  await expect(page.locator('.message-list')).not.toContainText('Peace to you');
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
});
