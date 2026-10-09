import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { importSave } from '../../src/persistence/schema';
import { exported, ready, settled, visit } from '../helpers/connection-browser';

test('completing a story unrolls the congratulations scroll once and adds a chat line', async ({
  page,
}) => {
  const state = importSave(
    await readFile('tests/fixtures/saves/v3-complete-village.json', 'utf8'),
  ).state;
  // Ezra's story with every memory found, one conversation from complete.
  state.villageStory = 'exploring';
  state.villageMemory = null;
  state.journal = state.journal.filter((id) => id !== 'ezra-memory');
  await ready(page, state);
  await visit(page, 'ezra');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /The voices at the well/ }).click();
  await settled(page);
  for (let i = 0; i < 4; i++) {
    const remember = dialog.getByRole('button', { name: /Remember this morning/ });
    if (await remember.isVisible()) break;
    await dialog.getByRole('button', { name: /^1/ }).first().click();
    await settled(page);
  }
  await dialog.getByRole('button', { name: /Remember this morning/ }).click();
  await settled(page);

  const scroll = page.locator('.story-scroll');
  await expect(scroll).toBeVisible();
  await expect(scroll).toContainText('Congratulations!');
  await expect(scroll).toContainText('An ordinary morning');
  await expect(scroll).toHaveAttribute('aria-hidden', 'true');
  // Gains rise beside the orbs as classic drops, decorative and gone on their own.
  const drops = page.locator('.gain-drop');
  await expect(drops).toHaveText(['+1 Memory', '+1 Story point']);
  await expect(page.locator('.gain-drops')).toHaveAttribute('aria-hidden', 'true');
  await expect(drops).toHaveCount(0, { timeout: 5_000 });
  // A passing celebration: it never takes focus and leaves on its own.
  expect(await scroll.evaluate((node) => node.contains(document.activeElement))).toBe(false);
  await expect(scroll).toHaveCount(0, { timeout: 10_000 });

  // The chatbox keeps the line; the Messages history keeps only real feedback.
  await expect(
    page.locator('.chat-log [data-chat="celebration"]', { hasText: 'An ordinary morning' }),
  ).toContainText("Congratulations, you've completed a story");
  await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
  await expect(page.locator('.message-list')).not.toContainText('Congratulations');

  const after = await exported(page);
  expect(after.villageStory).toBe('complete');
});
