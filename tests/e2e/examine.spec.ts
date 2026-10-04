import { test, expect } from '@playwright/test';
import { examineText } from '../../src/content/examine';
import { interactables } from '../../src/content/region';
import { ready, settled, exported, dismiss } from '../helpers/connection-browser';

test('Examine describes a distant person without moving or changing the journey and stays in messages', async ({
  page,
}) => {
  await ready(page);
  const before = await exported(page);
  await dismiss(page);
  await settled(page);
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const simon = page.locator('.world-label[data-value="simon"]');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  const description = examineText(interactables.find((place) => place.id === 'simon')!);

  await simon.click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: 'Talk-to Simon', exact: true })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Examine Simon', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(simon).toBeFocused();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.world-click-feedback')).toBeHidden();
  await expect(page.locator('#toast')).toContainText(description);
  await expect(player).toHaveAttribute('transform', position!);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await expect(player).toHaveAttribute('transform', position!);

  await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
  await expect(page.locator('.message-list')).toContainText(description);
  await page.keyboard.press('Escape');
  await settled(page);
  const after = await exported(page);
  // The ordinary session clock advances while the toast fades; Examine changes no journey data.
  expect(after.playTime).toBeGreaterThanOrEqual(before.playTime);
  expect(after).toEqual({ ...before, playTime: after.playTime });
});
