import { test, expect } from '@playwright/test';
import {
  ready,
  visit,
  act,
  dismiss,
  exported,
  settled,
  readableContrast,
} from '../helpers/connection-browser';
import { preparedSpring, arrangedShelter, chosenShelter } from '../helpers/galilee';
import { accounts } from '../../src/game/connection/accounts';
import { completedJourney } from '../helpers/connection';
import { transition } from '../../src/game/quest';

test('the journey overview prioritizes local play and deliberately follows the chosen story', async ({
  page,
}, info) => {
  await ready(page);
  await expect(page.locator('.objective-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.objective-toggle').click();
  await expect(page.locator('.quest-details').first()).toBeVisible();
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(
    page.locator('[data-action="journal-category"][data-value="overview"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.current-opportunity')).toContainText('Into the Deep');
  await expect(page.locator('.opportunity')).toHaveCount(2);
  await expect(page.locator('.journey-overview')).not.toContainText('Room under the olives');
  await readableContrast(page, '.opportunity p');
  await page.screenshot({ path: info.outputPath('fresh-journey-overview.png') });
  await page.locator('[data-action="follow-story"][data-value="village"]').click();
  await expect(page.getByRole('dialog')).toContainText('Ezra');
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  await expect(page.locator('.objective-toggle')).toHaveAttribute('aria-expanded', 'true');
  const s = await exported(page);
  expect(s.tracking).toBe('village');
  expect(s.villageStory).toBe('not-started');
  await dismiss(page);
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.locator('.current-opportunity')).toContainText('An ordinary morning');
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Filter journal by story' })).toBeVisible();
  await act(page, 'journal-category', 'overview');
  await act(page, 'open-story', 'main');
  await expect(page.locator('[data-journal-filter]')).toHaveValue('main');
});

test('focused spring work keeps reading, keyboard focus, framing and interrupted orientation', async ({
  page,
}, info) => {
  await ready(page, preparedSpring());
  await visit(page, 'channel-entry');
  const work = page.locator('.work-panel');
  await expect(work).toHaveAttribute('aria-modal', 'false');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-target', 'channel-entry');
  await readableContrast(page, '.work-state');
  await readableContrast(page, '.work-action button');
  await act(page, 'galilee-turn', 'entry:0');
  await expect(page.locator('[data-action="galilee-turn"]')).toBeFocused();
  await expect(page.locator('.work-state')).toContainText('east / west');
  await act(page, 'work-inspect');
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('.channel-plan svg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to the work' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(work).toBeVisible();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-target', 'channel-entry');
  await page.screenshot({ path: info.outputPath('channel-work.png') });
  await page.locator('#game-canvas').focus();
  await page.keyboard.press('ArrowDown');
  await expect(work).toHaveCount(0);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-target', '');
  const s = await exported(page);
  expect(s.galilee.spring.turns.entry).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await visit(page, 'channel-entry');
  await expect(page.locator('.work-state')).toContainText('east / west');
});

test('screen preview is temporary, readable and usable at large portrait and landscape sizes', async ({
  page,
}, info) => {
  const site = info.project.name === 'mobile-chromium' ? 'breeze' : 'shade';
  const state = arrangedShelter(chosenShelter(undefined, site), 2);
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await visit(page, 'rest-' + site);
  const sizes =
    info.project.name === 'mobile-chromium'
      ? [
          { width: 390, height: 844 },
          { width: 844, height: 390 },
        ]
      : [{ width: 1440, height: 900 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    const details = page.locator('.screen-preview-controls');
    if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
    await act(page, 'work-preview', '0');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-preview', '0');
    await expect(page.locator('.preview-description')).toContainText('approach is open');
    await expect(page.locator('.work-state')).toContainText('southern');
    await expect(page.locator('[data-action="work-preview"][data-value="0"]')).toBeFocused();
    await page.locator('[data-action="work-preview-apply"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-action="work-preview-apply"]')).toBeInViewport();
    await expect(page.locator('[data-action="work-inspect"]')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      size.width,
    );
    const panel = await page.locator('.work-panel').boundingBox();
    expect(panel!.height).toBeLessThanOrEqual(size.height * (size.width < 700 ? 0.46 : 0.92));
    await page.screenshot({ path: info.outputPath('screen-preview-' + size.width + '.png') });
  }
  await act(page, 'work-preview-cancel');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-preview', '');
  const before = await exported(page);
  expect(before.galilee).toEqual(state.galilee);
  await visit(page, 'rest-' + site);
  await page.locator('.screen-preview-controls summary').click();
  await act(page, 'work-preview', '0');
  await act(page, 'work-preview-apply');
  await expect(page.locator('.work-result')).toContainText('approach is open');
  await act(page, 'galilee-action', 'shelter-check-' + site);
  await expect(page.locator('.screen-preview-controls')).toHaveCount(0);
  const saved = await exported(page);
  expect(saved.galilee.shelter).toMatchObject({ stage: 'ready', screen: 0 });
  expect(saved.road.company).toEqual(state.road.company);
  expect(saved.connection).toEqual(before.connection);
});

test('replay overview can return to the actual traveler without changing the journey', async ({
  page,
}) => {
  const original = completedJourney();
  const s = transition(original, {
    type: 'replay-open',
    account: 'roof',
    checkpoint: accounts.roof.scenes[1]!.id,
  });
  await ready(page, s);
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.locator('aside.overview-notice').first()).toContainText(
    'Replaying Through the Roof',
  );
  await act(page, 'scene-leave');
  await settled(page);
  const saved = await exported(page);
  expect(saved.connection.replay).toBeNull();
  expect(saved.position).toEqual(original.position);
  expect(saved.campaign).toEqual(original.campaign);
});

test('ordinary shore work shares the same carried-object rules as reading and the nearby tray', async ({
  page,
}) => {
  const { completedPrelude } = await import('../helpers/journey');
  const s = transition(completedPrelude(), { type: 'start-episode' });
  await ready(page, s);
  await visit(page, 'supply-basket');
  await page.getByRole('button', { name: 'Work in the world' }).click();
  await settled(page);
  await expect(page.locator('.work-panel')).toContainText('basket');
  await act(page, 'work-act', 'episode:take-basket');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'empty-basket');
  await visit(page, 'landing');
  await page.getByRole('button', { name: 'Work in the world' }).click();
  await act(page, 'work-act', 'episode:place-basket');
  const save = await exported(page);
  expect(save.episode.carrying).toBeNull();
  expect(save.episode.preparations).toContain('basket');
});

test('canvas dragging leaves work selected while a deliberate ground tap leaves it', async ({
  page,
}) => {
  await ready(page, preparedSpring());
  await visit(page, 'channel-entry');
  const canvas = page.locator('#game-canvas');
  // This ground patch is left of the authored channel bounds in either viewport.
  await canvas.focus();
  await page.mouse.move(30, 180);
  await page.mouse.down();
  await page.mouse.move(65, 200, { steps: 8 });
  await page.mouse.move(30, 180, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.work-panel')).toBeVisible();
  await page.mouse.click(30, 180);
  await expect(page.locator('.work-panel')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-work-target', '');
  const s = await exported(page);
  expect(s.galilee.spring).toEqual(preparedSpring().galilee.spring);
});

test('modal focus includes disclosures and the import control, while work remains nonmodal', async ({
  page,
}) => {
  await ready(page, preparedSpring());
  await visit(page, 'channel-entry');
  await act(page, 'work-inspect');
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  const summary = page.locator('.work-hints summary');
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.work-hints')).toHaveAttribute('open', '');
  const last = page.getByRole('button', { name: 'Return to your journey' });
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.work-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const file = page.locator('#import-save');
  await file.focus();
  await expect(file).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Start a new journey…', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
});

test('focused work and its proposal stay within the original graphics budgets', async ({
  page,
}, info) => {
  const state = arrangedShelter(undefined, 2);
  await ready(page, state);
  const measurements: Record<string, unknown> = {};
  for (const quality of ['high', 'low']) {
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.locator('[data-setting="reducedMotion"]').check();
    await dismiss(page);
    await visit(page, 'rest-shade');
    await page.locator('.screen-preview-controls summary').click();
    await act(page, 'work-preview', '0');
    const { renderingCadence } = await import('../helpers/rendering');
    const cadence = await renderingCadence(page);
    await page.locator('#game-canvas').press('F3');
    const rows = await page
      .locator('.diagnostics-table tr')
      .evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((row) => [
            row.querySelector('th')!.textContent!,
            row.querySelector('td')!.textContent!,
          ]),
        ),
      );
    expect(Number(rows.scenes)).toBe(1);
    expect(Number(rows.drawCalls)).toBeGreaterThan(0);
    expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
    measurements[quality] = { ...rows, cadence, physicalDevice: false };
    await dismiss(page);
  }
  const { writeFile } = await import('node:fs/promises');
  await writeFile(info.outputPath('focused-rendering.json'), JSON.stringify(measurements, null, 2));
});

test('neighborhood work carries bread through the same focused action contract', async ({
  page,
}) => {
  const { district, action } = await import('../helpers/campaign');
  const s = action(action(district(), 'table-accept'), 'table-courtyard');
  await ready(page, s);
  await visit(page, 'bread-shelf');
  await page.getByRole('button', { name: 'Work in the world' }).click();
  await act(page, 'campaign-action', 'take-bread');
  const saved = await exported(page);
  expect(saved.campaign.carrying).toBe('bread-basket');
  expect(saved.campaign.table.location).toBe('courtyard');
});

test('focused landing controls still require deliberate boarding and docking', async ({ page }) => {
  const { lakeStart } = await import('../helpers/lake');
  await ready(page, lakeStart());
  await visit(page, 'board-capernaum');
  await page.getByRole('button', { name: 'Work in the world' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await page.route('**/boat.glb', (route) => route.abort());
  await act(page, 'journey', 'board-capernaum');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('.work-panel')).toHaveAttribute('data-work-target', 'board-capernaum');
  await expect(page.locator('.work-result')).toContainText('try again');
  await act(page, 'work-inspect');
  await page.getByRole('button', { name: 'Return to the work' }).click();
  await page.unroute('**/boat.glb');
  await act(page, 'journey', 'board-capernaum');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilee-water');
  await expect(page.locator('.work-panel')).toHaveCount(0);
  await visit(page, 'dock-capernaum');
  await page.getByRole('button', { name: 'Work in the world' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilee-water');
  await act(page, 'journey', 'dock-capernaum');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  expect((await exported(page)).lake.boat.mode).toBe('ashore');
});
