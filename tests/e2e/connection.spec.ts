import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { completedJourney, homeAt } from '../helpers/connection';
import { accounts } from '../../src/game/connection/accounts';
import { ACCOUNTS } from '../../src/game/connection/types';
import { parseSave } from '../../src/persistence/schema';
import { routePlan } from '../../src/game/connection/routes';
import {
  ready,
  settled,
  dismiss,
  act,
  exported,
  journal,
  library,
  readableContrast,
} from '../helpers/connection-browser';

// Elapsed seconds can accrue while opening menus before and after replay.
function sameJourney(
  actual: ReturnType<typeof completedJourney>,
  expected: ReturnType<typeof completedJourney>,
) {
  expect(actual.playTime).toBeGreaterThanOrEqual(expected.playTime);
  expect({ ...actual, playTime: expected.playTime }).toEqual(expected);
}

test('a saved multi-region destination survives interruption and requires deliberate boarding and docking', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const s = completedJourney();
  s.connection.route = { target: 'home-table' };
  await ready(page, s);
  await expect(page.locator('#travel-status')).toContainText('A shared table');
  await expect(page.locator('#travel-status [data-action="route-resume"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.welcome-recap')).toContainText('Peace, be still');
  await readableContrast(page, '.welcome-recap p');
  await page.screenshot({ path: info.outputPath('continue-recap.png') });
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await settled(page);
  const routeContrast = await readableContrast(page, '#travel-status button');
  await writeFile(info.outputPath('route-reading.json'), JSON.stringify({ route: routeContrast }));
  await page.screenshot({ path: info.outputPath('route-awaiting-resume.png') });
  await page.locator('#travel-status [data-action="route-resume"]').click();
  await expect(
    page.locator('#overlay [data-action="journey"][data-value="board-sheltered-cove"]'),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'sheltered-cove');
  for (const [gate, region] of [
    ['board-sheltered-cove', 'galilee-water'],
    ['dock-capernaum', 'capernaum'],
    ['to-lanes', 'capernaum-lanes'],
    ['to-bakehouse', 'bakehouse'],
  ]) {
    if (gate === 'board-sheltered-cove' && info.project.name === 'mobile-chromium') {
      await dismiss(page);
      await page
        .locator('#action-tray [data-action="quick-action"][data-value="lake:' + gate + '"]')
        .click();
      await settled(page);
    } else await act(page, 'journey', gate);
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region!);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.getByRole('heading', { name: 'A shared table', exact: true })).toBeVisible();
  const arrived = await exported(page);
  expect(arrived.connection.route).toBeNull();
  expect(arrived.lake.boat.berth).toBe('capernaum');
  expect(arrived.connection.home.visits).toEqual({});
  await journal(page);
  await page.locator('[data-journal-filter]').selectOption('home');
  await act(page, 'travel', 'home-farm');
  await page.keyboard.down('ArrowLeft');
  await expect(page.locator('#travel-status [data-action="route-resume"]')).toBeVisible();
  await page.keyboard.up('ArrowLeft');
  await page.locator('[data-action="cancel-navigation"]').click();
  expect((await exported(page)).connection.route).toBeNull();
  await page.screenshot({ path: info.outputPath('route-restored.png') });
});

test('all four replay accounts keep the journey intact through transcripts, previous scenes, reload and return', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const initial = completedJourney();
  initial.connection.route = { target: 'home-farm' };
  await ready(page, initial);
  const before = await exported(page);
  const contrast: Record<string, number> = {};
  for (const account of ACCOUNTS) {
    await library(page);
    for (const selector of ['h3', '.eyebrow', 'button'])
      contrast[selector] = await readableContrast(page, '.replay-library ' + selector);
    await page.screenshot({ path: info.outputPath('replay-library.png') });
    await act(page, 'replay-open', account + ':' + accounts[account].scenes[1]!.id);
    await expect(page.locator('#scene-controls .eyebrow')).toContainText('REPLAY');
    await expect(page.locator('#game-canvas')).toHaveAttribute(
      'data-region',
      accounts[account].region,
    );
    await page.locator('[data-action="scene-pause"]').click();
    await expect(page.locator('[data-action="scene-pause"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.locator('#scene-controls [data-action="transcript"]').click();
    await expect(page.locator('.transcript-beat, .transcript-scene')).toHaveCount(
      accounts[account].scenes.length,
    );
    await dismiss(page);
    await page.locator('[data-action="replay-previous"]').click();
    await settled(page);
    await expect(page.locator('#game-canvas')).toHaveAttribute(
      'data-checkpoint',
      accounts[account].scenes[0]!.id,
    );
    await expect(page.locator('[data-action="replay-previous"]')).toBeDisabled();
    await page.locator('.scene-continue').click();
    await settled(page);
    await page.reload();
    await expect(page.locator('.welcome-recap')).toContainText('Replay:');
    await page.getByRole('button', { name: 'Continue your journey' }).click();
    await settled(page);
    await expect(page.locator('#game-canvas')).toHaveAttribute(
      'data-checkpoint',
      accounts[account].scenes[1]!.id,
    );
    await page.screenshot({ path: info.outputPath('replay-' + account + '.png') });
    await page.locator('[data-action="replay-library"]').click();
    await act(page, 'replay-open', account + ':' + accounts[account].scenes.at(-1)!.id);
    await page.locator('.scene-continue').click();
    await settled(page);
    sameJourney(await exported(page), before);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await writeFile(info.outputPath('replay-reading.json'), JSON.stringify(contrast, null, 2));
  await library(page);
  await act(page, 'replay-open', 'lake:teaching');
  await journal(page);
  await act(page, 'recap');
  await page.locator('.journey-recap [data-action="cancel-navigation"]').click();
  await settled(page);
  await expect(page.locator('.journey-recap')).not.toContainText('Your saved route');
  const cancelled = await exported(page);
  expect(cancelled.connection.route).toBeNull();
  expect(cancelled.connection.replay).toBeNull();
  sameJourney(cancelled, { ...before, connection: { ...before.connection, route: null } });
});

test('failed replay startup and return preserve a portable journey and support retry', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const s = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v9-afloat-with-supply.json', 'utf8')),
  ).state;
  await ready(page, s);
  await journal(page);
  await act(page, 'recap');
  await expect(page.locator('.recap-details')).toContainText('Neri');
  for (const selector of ['h4', 'p', 'button'])
    await readableContrast(page, '.recap-details ' + selector);
  await page.screenshot({ path: info.outputPath('portable-journey-recap.png') });
  const before = await exported(page);
  await library(page);
  await page.route('**/procession_frame.glb', (r) => r.abort('failed'));
  await act(page, 'replay-open', 'nain:command');
  await expect(page.locator('#toast')).toContainText('could not load');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilee-water');
  sameJourney(await exported(page), before);
  await page.unroute('**/procession_frame.glb');
  await library(page);
  await act(page, 'replay-open', 'nain:command');
  const replay = await exported(page);
  expect(replay.connection.replay).toEqual({ account: 'nain', checkpoint: 'command' });
  await dismiss(page);
  await page.route('**/split_rock.glb', (r) => r.abort('failed'));
  await page.locator('#scene-controls [data-action="scene-leave"]').click();
  await settled(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'nain-account');
  sameJourney(await exported(page), replay);
  await page.unroute('**/split_rock.glb');
  await dismiss(page);
  await page.locator('#scene-controls [data-action="scene-leave"]').click();
  await settled(page);
  sameJourney(await exported(page), before);
});

test('return encounters, recap and journal statuses remain usable with skipped stories and large phone text', async ({
  page,
}, info) => {
  // Software WebGL reached the final reflection at the old six-minute CI deadline.
  test.setTimeout(process.env.CI ? 480_000 : 360_000);
  const contrast: Record<string, number> = {};
  let saved = homeAt(completedJourney(), 'shore');
  await ready(page, saved);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await journal(page);
  await page.locator('[data-journal-filter]').selectOption('home');
  await act(page, 'journal-status', 'available');
  await expect(
    page.locator('[data-action="journal-status"][data-value="available"]'),
  ).toBeFocused();
  await expect(page.locator('.connection-stories')).toContainText('The way home');
  for (const selector of ['h3', '.eyebrow', '.status-pill', 'button'])
    contrast['status-' + selector] = await readableContrast(
      page,
      '.connection-stories ' + selector,
    );
  await page.screenshot({ path: info.outputPath('story-status.png') });
  await act(page, 'open-story', 'home');
  await expect(page.locator('.home-summary')).toBeVisible();
  const order =
    info.project.name === 'chromium'
      ? (['shore', 'farm', 'table'] as const)
      : (['table', 'farm', 'shore'] as const);
  for (const id of order) {
    await journal(page);
    await page.locator('[data-journal-filter]').selectOption('home');
    await act(page, 'travel', 'home-' + id);
    for (const gate of routePlan(saved, 'home-' + id)!.steps.slice(0, -1)) {
      await expect(
        page.locator(`#overlay [data-action="journey"][data-value="${gate}"]`),
      ).toBeVisible({ timeout: 60_000 });
      await act(page, 'journey', gate);
    }
    await expect(page.locator('.home-encounter')).toBeVisible({ timeout: 60_000 });
    for (const selector of ['p:not(.caption-source)', '.caption-source', '.primary-button'])
      contrast[id + '-' + selector] = await readableContrast(page, '.home-encounter ' + selector);
    await page.locator('[data-action="home-remember"]').first().click();
    await settled(page);
    await expect(page.locator('.home-encounter')).toContainText('Your remembered choice');
    contrast[id + '-memory'] = await readableContrast(page, '.home-encounter blockquote');
    await page.screenshot({ path: info.outputPath('home-' + id + '.png') });
    saved = await exported(page);
    expect(saved.connection.home.visits[id]).toBeTruthy();
    await page.reload();
    await page.getByRole('button', { name: 'Continue your journey' }).click();
    await settled(page);
  }
  let final = await exported(page);
  // The final reflection stays local to Miriam: travel back through the actual route.
  await journal(page);
  await page.getByRole('button', { name: 'Return to the familiar landing', exact: true }).click();
  await settled(page);
  const plan = routePlan(final, 'home-shore')!;
  for (const gate of plan.steps.slice(0, -1)) {
    await expect(
      page.locator(`#overlay [data-action="journey"][data-value="${gate}"]`),
    ).toBeVisible({ timeout: 60_000 });
    await act(page, 'journey', gate);
  }
  await expect(page.locator('[data-action="home-reflect"]')).toHaveCount(2);
  await act(page, 'home-reflect', info.project.name === 'chromium' ? 'onward' : 'remain');
  final = await exported(page);
  expect(final.connection.home.reflection).toBeTruthy();
  await journal(page);
  await act(page, 'journal-status', 'completed');
  await expect(page.locator('.connection-stories')).toContainText('The way home');
  await act(page, 'recap');
  await expect(page.locator('.recap-memory')).toContainText(
    info.project.name === 'chromium' ? 'Carry the welcome onward' : 'Remain awhile',
  );
  contrast.recap = await readableContrast(page, '.journey-recap > p');
  contrast.recapHeading = await readableContrast(page, '.journey-recap h4');
  await writeFile(info.outputPath('home-reading.json'), JSON.stringify(contrast, null, 2));
  if (info.project.name === 'mobile-chromium')
    await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: info.outputPath('completed-recap.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await dismiss(page);
  await page.keyboard.press('F3');
  await page.screenshot({ path: info.outputPath('home-company.png') });
  expect(final.life.thread.stage).toBe('not-started');
  expect(final.galilee.shelter.stage).toBe('not-started');
});

test('direct story shortcuts reopen their reading content after status filtering', async ({
  page,
}, info) => {
  for (const [fixture, selector] of [
    ['v7-road-investigation.json', '.road-evidence'],
    ['v9-crossing-evidence.json', '.crossing-evidence'],
  ]) {
    const s = parseSave(
      JSON.parse(await readFile('tests/fixtures/saves/' + fixture, 'utf8')),
    ).state;
    await ready(page, s);
    await journal(page);
    await act(page, 'journal-status', 'completed');
    await dismiss(page);
    await page.getByRole('button', { name: 'Review the clues', exact: true }).click();
    await expect(page.locator(selector!)).toBeVisible();
    await expect(page.locator('[data-action="journal-status"][data-value="all"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    if (selector === '.crossing-evidence') await page.locator('.crossing-hints summary').click();
    await page.getByRole('button', { name: 'Show a more specific hint', exact: true }).click();
    await expect(page.locator(selector!)).toBeVisible();
    if (info.project.name === 'mobile-chromium') {
      await act(page, 'journal-status', 'completed');
      await dismiss(page);
      await page.getByRole('button', { name: 'Choose a story', exact: true }).click();
      await expect(
        page.locator('[data-action="journal-status"][data-value="all"]'),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-journal-filter]')).toHaveValue('all');
    }
  }
});
