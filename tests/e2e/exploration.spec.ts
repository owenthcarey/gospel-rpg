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
import { STORY_TRACKS } from '../../src/game/campaign/types';

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
  await expect(page.locator('.opportunity')).toHaveCount(3);
  await expect(page.locator('.journey-overview')).not.toContainText('Room under the olives');
  await readableContrast(page, '.opportunity p');
  await readableContrast(page, '.quest-state');
  await page.screenshot({ path: info.outputPath('fresh-journey-overview.png') });
  await page.locator('[data-action="follow-story"][data-value="village"]').click();
  await expect(page.getByRole('dialog')).toContainText('Ezra');
  await readableContrast(page, '.dialogue-choices button');
  await readableContrast(page, '.dialogue-choices .choice-index');
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  await expect(page.locator('.objective-toggle')).toHaveAttribute('aria-expanded', 'true');
  const s = await exported(page);
  expect(s.tracking).toBe('village');
  expect(s.villageStory).toBe('not-started');
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.locator('.current-opportunity')).toContainText('An ordinary morning');
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Filter journal by story' })).toBeVisible();
  const register = page.getByRole('region', { name: 'Stories by status' });
  await expect(register.locator('article')).toHaveCount(STORY_TRACKS.length);
  await expect(page.locator('.episode-summary')).toHaveCount(0);
  await expect(
    register.locator('[data-story-status="unavailable"] .status-pill').first(),
  ).toBeVisible();
  await expect(
    register.locator('[data-story-status="available"] .status-pill').first(),
  ).toBeVisible();
  await expect(
    register.locator('[data-story-status="unavailable"] .status-pill').first(),
  ).toHaveText('unavailable');
  await readableContrast(page, '.story-register [data-story-status="unavailable"] h3');
  await readableContrast(page, '.story-register [data-story-status="available"] h3');
  await expect(page.locator('#overlay')).toHaveCSS('opacity', '1');
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const mainStory = register.locator('[data-action="open-story"][data-value="main"]');
  await mainStory.focus();
  await mainStory.press('Enter');
  await expect(page.locator('[data-journal-filter]')).toHaveValue('main');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await expect(register).toHaveCount(0);
  await expect(page.locator('.episode-summary')).toContainText('Into the Deep');
  await expect(page.locator('.episode-objectives li')).toHaveCount(9);
  await act(page, 'transcript', 'lake');
  await expect(page.locator('.transcript-beat')).toHaveCount(accounts.lake.scenes.length);
  const afterReading = await exported(page);
  expect(afterReading.playTime).toBeGreaterThanOrEqual(s.playTime);
  expect({ ...afterReading, playTime: s.playTime }).toEqual(s);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('journal categories and story filters keep keyboard focus without taking later focus', async ({
  page,
}) => {
  await ready(page);
  const before = await exported(page);
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await page.locator('.toolbar [data-action="journal"]').click();
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  await expect(close).toBeFocused();
  const categories = page.getByRole('navigation', { name: 'Journal categories' });
  await page.keyboard.press('Tab');
  await expect(categories.getByRole('button', { name: 'Your journey', exact: true })).toBeFocused();
  for (const name of ['Stories', 'People', 'Places', 'Memories']) {
    await page.keyboard.press('Tab');
    const category = categories.getByRole('button', { name, exact: true });
    await expect(category).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    await expect(category).toBeFocused();
  }
  await page.keyboard.press('Tab');
  const filter = page.getByRole('combobox', { name: 'Filter journal by story' });
  await expect(filter).toBeFocused();
  await filter.selectOption('village');
  await expect(filter).toHaveValue('village');
  await expect(filter).toBeFocused();
  await filter.selectOption('all');
  await expect(filter).toBeFocused();
  for (let step = 0; step < 4; step++) await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(categories.getByRole('button', { name: 'Stories', exact: true })).toBeFocused();
  for (let step = 0; step < 4; step++) await page.keyboard.press('Tab');
  await expect(filter).toBeFocused();
  await filter.selectOption('main');
  await expect(filter).toHaveValue('main');
  await expect(filter).toBeFocused();
  await expect(page.locator('.episode-summary')).toBeVisible();

  // Take another visible control immediately after the refresh, before its queued focus frame.
  await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('#overlay')!;
    const filter = overlay.querySelector<HTMLSelectElement>('[data-journal-filter]')!;
    return new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        overlay
          .querySelector<HTMLButtonElement>(
            '[data-action="journal-category"][data-value="people"]',
          )!
          .focus();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      observer.observe(overlay, { childList: true });
      filter.value = 'all';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await expect(categories.getByRole('button', { name: 'People', exact: true })).toBeFocused();
  await expect(filter).toHaveValue('all');
  await page.keyboard.press('Tab');
  await expect(categories.getByRole('button', { name: 'Places', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Return to your journey' }).focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.toolbar [data-action="journal"]')).toBeFocused();
  const after = await exported(page);
  expect(after.playTime).toBeGreaterThanOrEqual(before.playTime);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
});

test('phone atlas numbers stay readable across early and fully connected journeys', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Measures the phone atlas scaling.');
  const sizes = [
    { width: 390, height: 844 },
    { width: 320, height: 844 },
    { width: 844, height: 390 },
  ];
  for (const state of [undefined, completedJourney()]) {
    await page.setViewportSize(sizes[0]!);
    await ready(page, state);
    await page.locator('.toolbar [data-action="map"]').click();
    await page.getByRole('button', { name: 'Journey map', exact: true }).click();
    const labels = page.locator('.journey-map-number');
    await expect(labels).toHaveCount(state ? 10 : 1);
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      // The panel entry transform also scales its SVG until the modal has settled.
      await expect(page.locator('#overlay')).toHaveCSS('opacity', '1');
      await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
      await expect
        .poll(
          () =>
            labels.evaluateAll((nodes) => {
              if (!nodes.length) return 0;
              return Math.min(
                ...nodes.map((node) => {
                  const matrix = (node as SVGTextElement).getScreenCTM()!;
                  return (
                    parseFloat(getComputedStyle(node).fontSize) * Math.hypot(matrix.a, matrix.b)
                  );
                }),
              );
            }),
          { message: `Smallest atlas number at ${viewport.width}×${viewport.height}` },
        )
        .toBeGreaterThanOrEqual(14);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    }
  }
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
    await expect(page.locator('.quest-card')).toBeHidden();
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
    await expect(page.locator('.chapter-card')).toHaveCount(0);
    await expect(page.locator('#toast')).toBeHidden();
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
