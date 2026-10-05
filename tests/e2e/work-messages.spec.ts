import { test, expect, type Locator, type Page } from '@playwright/test';
import { transition } from '../../src/game/quest';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { REST_LAYOUTS } from '../../src/game/galilee/arrangement';
import { WalkGrid } from '../../src/game/pathfinding';
import { rememberPosition } from '../../src/game/road/progress';
import { arrangedShelter, chosenShelter, preparedSpring } from '../helpers/galilee';
import { ready, visit, dismiss, settled, exported } from '../helpers/connection-browser';

async function activate(control: Locator, touch: boolean) {
  if (touch) await control.tap();
  else {
    await control.focus();
    await control.press('Enter');
  }
}

async function leaveWork(page: Page, touch: boolean) {
  if (touch) await page.getByRole('button', { name: 'Close menu', exact: true }).tap();
  else await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.locator('.work-panel')).toHaveCount(0);
}

test('accepted channel turns stay readable in Messages after leaving compact work', async ({
  page,
  isMobile,
}, info) => {
  const id = isMobile ? 'north' : 'entry';
  const state = preparedSpring();
  const text = isMobile
    ? 'North channel turned. Open ends: east / south.'
    : 'Entry channel turned. Open ends: east / west.';
  await ready(page, state);
  await visit(page, 'channel-' + id);
  const baseline = await exported(page);
  expect(baseline.galilee.spring.turns[id]).toBe(0);
  const expected = transition(baseline, {
    type: 'galilee-turn',
    id,
    expected: baseline.galilee.spring.turns[id],
  });
  expect(expected).not.toBe(baseline);
  // Revisit the same reached target through the native map path; no new approach is needed.
  await visit(page, 'channel-' + id);
  const turn = page.locator('.work-actions [data-action="galilee-turn"]');
  await turn.focus();
  await activate(turn, isMobile);
  await settled(page);
  await expect(turn).toHaveAttribute('data-value', id + ':1');
  await expect(turn).toBeFocused();
  await expect(page.locator('.work-result')).toHaveText(
    isMobile ? 'Open ends: east / south.' : 'Open ends: east / west.',
  );
  await expect(page.locator('#toast')).toHaveText(text);
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  await leaveWork(page, isMobile);
  await activate(page.getByRole('button', { name: 'Recent game messages', exact: true }), isMobile);
  const outcome = page.locator('.message-list li').filter({ hasText: text });
  await expect(outcome).toHaveCount(1);
  await expect(outcome).toHaveText(text);
  await expect(outcome.locator('.message-repeat')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await expect(player).toHaveAttribute('transform', position!);
  await page.screenshot({ path: info.outputPath('channel-outcome-message.png') });
  const after = await exported(page);
  expect(after.galilee).toEqual(expected.galilee);
  expect(after.journal).toEqual(expected.journal);
  expect(after.campaign).toEqual(state.campaign);
  expect(after.episode).toEqual(state.episode);
  expect(after.inventory).toEqual(state.inventory);
  expect({ ...after, playTime: baseline.playTime }).toEqual(expected);
});

test('accepted screen outcomes retain their site while passive previews stay silent', async ({
  page,
  isMobile,
}, info) => {
  const site = isMobile ? 'breeze' : 'shade';
  const title = isMobile ? 'The open resting place' : 'The olive shade';
  const text = title + ' · Screen moved to the west side.';
  const state = arrangedShelter(chosenShelter(undefined, site), 2);
  if (isMobile) {
    // Stand east of the seat, clear of both real screen footprints. The usual
    // approach cell is covered when the south screen moves west.
    state.position = { x: REST_LAYOUTS[site].x + 2, z: REST_LAYOUTS[site].z };
    rememberPosition(state, 'roadside-farm');
    const turned = transition(state, { type: 'galilee-screen', expected: 2 });
    expect(turned).not.toBe(state);
    const layout = campaignLayout(state.region)!;
    for (const arrangement of [state, turned])
      expect(
        new WalkGrid(
          layoutObstacles(arrangement),
          layout.terrain,
          layout.bounds.min,
          layout.bounds.max,
        ).walkable(state.position),
      ).toBe(true);
  }
  await ready(page, state);
  await visit(page, 'rest-' + site);
  const baseline = await exported(page);
  if (isMobile) expect(baseline.position).toEqual(state.position);
  expect(baseline.galilee.shelter.screen).toBe(2);
  const expected = transition(baseline, {
    type: 'galilee-screen',
    expected: baseline.galilee.shelter.screen,
  });
  expect(expected).not.toBe(baseline);
  await visit(page, 'rest-' + site);
  const move = page.locator('.work-actions [data-action="galilee-screen"]');
  await move.focus();
  await activate(move, isMobile);
  await settled(page);
  await expect(move).toHaveAttribute('data-value', '3');
  await expect(move).toBeFocused();
  await expect(page.locator('.work-result')).toHaveText(
    'Screen moved. Check the approach when you are ready.',
  );
  await expect(page.locator('#toast')).toHaveText(text);
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const messages = page.getByRole('button', { name: 'Recent game messages', exact: true });
  await leaveWork(page, isMobile);
  await activate(messages, isMobile);
  await expect(page.locator('.message-list li').filter({ hasText: text })).toHaveText(text);
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await expect(player).toHaveAttribute('transform', position!);

  await dismiss(page);
  await visit(page, 'rest-' + site);
  await page.locator('.screen-preview-controls summary').click();
  const east = page.locator('[data-action="work-preview"][data-value="1"]');
  await east.focus();
  await activate(east, isMobile);
  await settled(page);
  await expect(east).toBeFocused();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-preview', '1');
  await expect(move).toHaveAttribute('data-value', '3');
  await activate(page.locator('[data-action="work-preview-cancel"]'), isMobile);
  await settled(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-preview', '');
  await expect(move).toHaveAttribute('data-value', '3');
  const beforeReading = await player.getAttribute('transform');
  await leaveWork(page, isMobile);
  await activate(messages, isMobile);
  const screenMessages = page
    .locator('.message-list li')
    .filter({ hasText: 'Screen moved to the' });
  await expect(screenMessages).toHaveCount(1);
  await expect(screenMessages).toHaveText(text);
  await expect(screenMessages.locator('.message-repeat')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await expect(player).toHaveAttribute('transform', beforeReading!);
  await page.screenshot({ path: info.outputPath('screen-outcome-message.png') });
  const after = await exported(page);
  expect(after.galilee).toEqual(expected.galilee);
  expect(after.journal).toEqual(expected.journal);
  expect(after.campaign).toEqual(state.campaign);
  expect(after.episode).toEqual(state.episode);
  expect(after.inventory).toEqual(state.inventory);
  expect({ ...after, playTime: baseline.playTime }).toEqual(expected);
});
