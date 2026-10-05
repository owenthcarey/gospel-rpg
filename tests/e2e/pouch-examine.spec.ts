import { expect, test } from '@playwright/test';
import { action, at, district } from '../helpers/campaign';
import {
  ready,
  visit,
  dismiss,
  settled,
  act,
  passage,
  exported,
} from '../helpers/connection-browser';

test('native Examine follows an earned pouch return without moving or changing saved progress', async ({
  page,
  isMobile,
}, info) => {
  let state = district();
  for (const id of [
    'life-thread-accept',
    'life-clue-water',
    'life-clue-cloth',
    'life-identify',
    'life-take-pouch',
  ])
    state = action(state, id);
  await ready(page, at(state, 'ruth'));
  await visit(page, 'ruth');
  await dismiss(page);
  const returnPouch = page.locator('#action-tray [data-value="life-return-pouch"]');
  await expect(returnPouch).toBeEnabled();
  if (isMobile) await returnPouch.tap();
  else await returnPouch.click();
  await settled(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', '');
  await visit(page, 'ruth');
  await act(page, 'campaign-action', 'life-ending-welcome');
  await passage(page, 'to-shore', 'capernaum');
  await visit(page, 'sewing-rest');
  await expect(page.getByRole('dialog')).toContainText('The little resting place is empty.');
  const before = await exported(page);
  expect(before.life.thread.stage).toBe('complete');
  expect(before.campaign.carrying).toBeNull();
  await dismiss(page);
  await settled(page);
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const label = page.locator('.world-label[data-value="sewing-rest"]');
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await expect(label).toBeVisible();
  if (isMobile) {
    const bounds = await label.boundingBox();
    expect(bounds).not.toBeNull();
    const touch = await page.context().newCDPSession(page);
    try {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { id: 1, x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 },
        ],
      });
      await expect(menu).toBeVisible();
    } finally {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    }
  } else await label.click({ button: 'right' });
  const examine = menu.getByRole('menuitem', { name: 'Examine A pouch by the shore', exact: true });
  if (isMobile) await examine.tap();
  else await examine.click();
  await expect(menu).toBeHidden();
  await expect(label).toBeFocused();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#toast')).toContainText(
    'A pouch by the shore: The resting place is empty. Ruth’s pouch is safe beside her in the courtyard.',
  );
  await expect(player).toHaveAttribute('transform', position!);
  await page.screenshot({ path: info.outputPath('returned-pouch-examined.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
  await expect(page.locator('.message-list')).toContainText(
    'The resting place is empty. Ruth’s pouch is safe beside her in the courtyard.',
  );
  await dismiss(page);
  const after = await exported(page);
  expect(after).toEqual({ ...before, playTime: after.playTime });
});
