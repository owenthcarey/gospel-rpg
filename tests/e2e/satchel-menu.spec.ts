import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { importSave } from '../../src/persistence/schema';
import { dismiss, ready } from '../helpers/connection-browser';

test('right-clicking a satchel item offers Examine and Cancel and returns focus', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Right-click belongs to a mouse');
  const state = importSave(
    await readFile('tests/fixtures/saves/v3-carrying-bread.json', 'utf8'),
  ).state;
  await ready(page, state);
  await dismiss(page);
  await page.locator('.toolbar [data-action="inventory"]').click();
  const item = page.locator('.satchel-slot-button').first();
  await item.click({ button: 'right' });
  const menu = page.locator('.item-option-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['Examine Barley loaves', 'Cancel']);
  await expect(menu.getByRole('menuitem', { name: 'Examine Barley loaves' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(item).toBeFocused();
  // Escape closed only the menu; the satchel stays open.
  await expect(page.getByRole('dialog')).toBeVisible();
  await item.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Examine Barley loaves' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#satchel-inspection')).toContainText('Barley loaves');
  await expect(item).toHaveAttribute('aria-pressed', 'true');
});
