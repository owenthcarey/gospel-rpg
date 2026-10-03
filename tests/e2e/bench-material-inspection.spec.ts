import { expect, test, type Page } from '@playwright/test';
import { action, at, district } from '../helpers/campaign';
import { ready, visit, dismiss, settled, exported } from '../helpers/connection-browser';
import { transition } from '../../src/game/quest';
import { allInteractables } from '../../src/content/region';

async function inspect(page: Page, id: string) {
  await visit(page, id);
  const full = page.getByRole('button', { name: 'Read the full inspection', exact: true });
  if (await full.isVisible()) await full.click();
  await settled(page);
  return page.getByRole('dialog').locator('.panel-lead');
}

async function practical(page: Page, id: string) {
  const before = await exported(page);
  await dismiss(page);
  const command = page.locator(`#action-tray [data-value="${id}"]`);
  await expect(command).toBeEnabled();
  await command.click();
  await settled(page);
  const expected = transition(before, { type: 'campaign-action', id });
  expect(expected).not.toBe(before);
  const after = await exported(page);
  expect(after).toEqual({ ...expected, playTime: after.playTime });
  await dismiss(page);
}

async function examine(page: Page, id: string, text: string) {
  const before = await exported(page);
  await dismiss(page);
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const label = page.locator(`.world-label[data-value="${id}"]`);
  await expect(label).toBeVisible();
  await label.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await expect(menu).toBeVisible();
  const name = allInteractables.find((place) => place.id === id)!.name;
  await menu.getByRole('menuitem', { name: 'Examine ' + name, exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(label).toBeFocused();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#toast')).toContainText(text);
  await expect(player).toHaveAttribute('transform', position!);
  const after = await exported(page);
  expect(after).toEqual({ ...before, playTime: after.playTime });
  await dismiss(page);
}

test('bench material inspections follow native borrowing, return and fitting', async ({
  page,
  isMobile,
}, info) => {
  const method = isMobile ? 'brace' : 'lashing';
  const source = isMobile ? 'brace-shelf' : 'cord-basket';
  let state = district();
  for (const id of ['life-bench-inspect', 'life-method-' + method, 'life-clear-bench'])
    state = action(state, id);
  await ready(page, at(state, source));
  const available = isMobile ? 'Hannah has kept a sound offcut' : 'A small basket holds spare cord';
  await expect(await inspect(page, source)).toContainText(available);
  await dismiss(page);
  await practical(page, 'life-take-' + method);
  await expect(await inspect(page, source)).toContainText('empty while you carry');
  await dismiss(page);
  await examine(page, source, 'in your hands.');
  await practical(page, 'life-return-' + method);
  await expect(await inspect(page, source)).toContainText(available);
  await dismiss(page);
  await practical(page, 'life-take-' + method);
  if (isMobile) {
    await visit(page, 'bakehouse-exit');
    await page.locator('[data-action="journey"][data-value="bakehouse-exit"]').click();
    await settled(page);
    await visit(page, 'to-shore');
    await page.locator('[data-action="journey"][data-value="to-shore"]').click();
    await settled(page);
  }
  await expect(await inspect(page, 'landing-bench')).toContainText('in your hands');
  await expect(page.getByRole('dialog').locator('.panel-lead')).toContainText(
    'You can fit the repair now.',
  );
  await dismiss(page);
  await practical(page, 'life-fit-' + method);
  if (isMobile) {
    await visit(page, 'to-lanes');
    await page.locator('[data-action="journey"][data-value="to-lanes"]').click();
    await settled(page);
    await visit(page, 'to-bakehouse');
    await page.locator('[data-action="journey"][data-value="to-bakehouse"]').click();
    await settled(page);
  }
  await expect(await inspect(page, source)).toContainText('empty.');
  await expect(page.getByRole('dialog').locator('.panel-lead')).toContainText('landing bench');
  await page.screenshot({ path: info.outputPath('fitted-material-source.png'), scale: 'css' });
  await dismiss(page);
  await examine(page, source, 'landing bench');
});
