import { test, expect } from '@playwright/test';
import { ready, settled, dismiss } from '../helpers/connection-browser';

test('game messages remain readable after toasts fade and leave the traveler unchanged', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Settings and saves', exact: true }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await dismiss(page);
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  await page.locator('#game-canvas').focus();
  await page.keyboard.press('e');
  await expect(page.locator('#toast')).toContainText('Move closer');
  await page.keyboard.press('e');
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  const messages = page.getByRole('button', { name: 'Recent game messages', exact: true });
  await messages.click();
  await expect(page.getByRole('dialog')).toContainText('Game messages');
  await expect(page.locator('.message-list')).toContainText('Move closer');
  await expect(page.locator('.message-repeat')).toContainText('×2');
  expect(
    await page
      .locator('.message-list li')
      .first()
      .evaluate((row) => parseFloat(getComputedStyle(row).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await expect(messages).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(messages).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect(player).toHaveAttribute('transform', position!);
  await expect(page.locator('.message-count')).toBeHidden();
  await page.locator('#game-canvas').press('e');
  await expect(page.locator('#toast')).toBeVisible();
  await messages.click();
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('.message-repeat')).toContainText('×3');
  await page.keyboard.press('Escape');
});
