import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { makeSave } from '../../src/persistence/schema';
import { district, completedEpisode } from '../helpers/campaign';

async function ready(page: Page, shore = false) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('#import-save').setInputFiles({
    name: 'start.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(shore ? completedEpisode() : district()))),
  });
  await expect(page.locator('#hud')).toBeVisible();
}
async function close(page: Page) {
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
}
async function visit(page: Page, id: string) {
  await page.locator('.toolbar [data-action="map"]').click();
  await page.locator('.map-destinations [data-value="' + id + '"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function act(page: Page, id: string) {
  await page.locator('[data-action="campaign-action"][data-value="' + id + '"]').click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function practical(page: Page, id: string, keyboard = false) {
  const button = page.locator('#action-tray [data-value="' + id + '"]');
  await expect(button).toBeEnabled();
  if (keyboard) {
    await button.focus();
    await page.keyboard.press('Enter');
  } else await button.click();
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function door(page: Page, id: string, region: string) {
  await visit(page, id);
  await page.locator('[data-action="journey"][data-value="' + id + '"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region);
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function exported(page: Page) {
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return JSON.parse(await readFile((await (await promise).path())!, 'utf8')) as ReturnType<
    typeof makeSave
  >;
}

test('Ruth’s investigation survives clue order, pouch recovery, travel, journal filters and a chosen ending', async ({
  page,
}, info) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mobile = info.project.name === 'mobile-chromium';
  await ready(page);
  await visit(page, 'ruth');
  await act(page, 'life-thread-accept');
  await close(page);
  if (mobile) {
    await visit(page, 'thread-clue');
    await act(page, 'life-clue-water');
    await close(page);
  }
  await door(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'cloth-clue');
  await act(page, 'life-clue-cloth');
  await close(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await door(page, 'bakehouse-exit', 'capernaum-lanes');
  if (!mobile) {
    await visit(page, 'thread-clue');
    await act(page, 'life-clue-water');
    await close(page);
  }
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.getByRole('region', { name: 'Investigation evidence' })).toContainText(
    'two short stitches',
  );
  await page.getByRole('combobox', { name: 'Filter journal by story' }).selectOption('belonging');
  await expect(page.locator('.campaign-stories article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Memories', exact: true }).click();
  await expect(page.locator('[data-memory="thread-clue-water"]')).toBeVisible();
  await expect(page.locator('[data-memory="thread-clue-cloth"]')).toBeVisible();
  await expect(page.locator('[data-memory="roof-invitation"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Find Ruth', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await expect(page.locator('.journal-directory')).toContainText('Hannah’s bakehouse');
  await close(page);
  await door(page, 'to-shore', 'capernaum');
  await visit(page, 'sewing-rest');
  await act(page, 'life-identify');
  await close(page);
  await practical(page, 'life-take-pouch', !mobile);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'sewing-pouch');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-action-motion', '');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-actor-pose', 'Carry');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-actor-frame', '0.00');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tray = document.querySelector('#action-tray')!.getBoundingClientRect();
        return ['.minimap-wrap', '#toast'].some((selector) => {
          const node = document.querySelector<HTMLElement>(selector)!;
          if (node.hidden) return false;
          const box = node.getBoundingClientRect();
          return (
            tray.left < box.right &&
            tray.right > box.left &&
            tray.top < box.bottom &&
            tray.bottom > box.top
          );
        });
      }),
    )
    .toBe(false);
  await page.screenshot({ path: info.outputPath('pouch-held.png') });
  await practical(page, 'life-set-pouch');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', '');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await practical(page, 'life-take-pouch');
  await door(page, 'to-lanes', 'capernaum-lanes');
  await visit(page, 'ruth');
  await close(page);
  await practical(page, 'life-return-pouch', !mobile);
  await visit(page, 'ruth');
  await act(page, mobile ? 'life-ending-welcome' : 'life-ending-route');
  await close(page);
  const save = await exported(page);
  expect(save.version).toBe(6);
  expect(save.state.life.thread.stage).toBe('complete');
  expect(save.state.life.thread.ending).toBe(mobile ? 'welcome' : 'route');
  expect(save.state.campaign.roof.stage).toBe('exploring');
  await close(page);
  await page.screenshot({ path: info.outputPath('ruth-returned-pouch.png') });
  expect(errors).toEqual([]);
});

test('the landing bench supports both material routes, visible repair, pause, save recovery and lasting company', async ({
  page,
}, info) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mobile = info.project.name === 'mobile-chromium',
    method = mobile ? 'brace' : 'lashing';
  await ready(page, true);
  await visit(page, 'landing-bench');
  await act(page, 'life-bench-inspect');
  await act(page, 'life-method-' + method);
  await close(page);
  if (mobile) {
    await practical(page, 'life-clear-bench');
    await door(page, 'to-lanes', 'capernaum-lanes');
    await door(page, 'to-bakehouse', 'bakehouse');
    await visit(page, 'brace-shelf');
    await close(page);
  } else {
    await visit(page, 'cord-basket');
    await close(page);
  }
  await practical(page, 'life-take-' + method, !mobile);
  await practical(page, 'life-return-' + method);
  await practical(page, 'life-take-' + method);
  const material = mobile ? 'wood-brace' : 'lashing-cord';
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', material);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', material);
  if (mobile) {
    await door(page, 'bakehouse-exit', 'capernaum-lanes');
    await door(page, 'to-shore', 'capernaum');
  }
  await visit(page, 'landing-bench');
  await close(page);
  if (!mobile) await practical(page, 'life-clear-bench');
  await practical(page, 'life-fit-' + method);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', '');
  await practical(page, 'life-test-bench');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-action-motion', 'SitDown');
  await page.locator('.toolbar [data-action="inventory"]').click();
  const paused = await page.locator('#game-canvas').getAttribute('data-actor-frame');
  await page.getByRole('heading', { name: 'Your satchel', exact: true }).waitFor();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-actor-frame', paused!);
  await close(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-action-motion', '');
  await page.screenshot({ path: info.outputPath('landing-' + method + '.png') });
  await page.getByRole('button', { name: 'Read your memories', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Memories', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-memory="bench-complete"]')).toBeVisible();
  await close(page);
  const save = await exported(page);
  expect(save.state.life.bench).toEqual({ stage: 'complete', method, cleared: true });
  expect(save.state.campaign.roof.stage).toBe(mobile ? 'exploring' : 'not-started');
  await close(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await visit(page, 'landing-bench');
  await expect(page.getByRole('dialog')).toContainText('A neighbor has stopped to rest');
  await close(page);
  await visit(page, 'miriam');
  await expect(page.locator('.dialogue-text')).toContainText(
    'bench beside the landing is steady again',
  );
  await page.getByRole('button', { name: 'Leave conversation' }).click();
  if (mobile) {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await page.locator('[data-setting="reducedMotion"]').check();
    await page.locator('[data-setting="textSize"]').selectOption('large');
    await close(page);
    await page.screenshot({ path: info.outputPath('landing-landscape.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  expect(errors).toEqual([]);
});

test('a carried pouch has a usable return route while journal travel preserves a roof checkpoint', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('#import-save').setInputFiles('tests/fixtures/saves/v6-carrying-pouch.json');
  await expect(page.locator('#hud')).toBeVisible();
  await door(page, 'to-lanes', 'capernaum-lanes');
  await door(page, 'to-house', 'gathering-house');
  await visit(page, 'house-viewpoint');
  await act(page, 'roof-enter');
  const checkpoint = await page.locator('#game-canvas').getAttribute('data-checkpoint');
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Find Ruth', exact: true }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'gathering-house');
  await expect(page.locator('[data-action="journey"][data-value="house-exit"]')).toBeVisible();
  await page.locator('[data-action="journey"][data-value="house-exit"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum-lanes');
  await page.locator('.toolbar [data-action="journal"]').click();
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await page.locator('[data-action="track-story"][data-value="rest"]').click();
  await close(page);
  await expect(page.locator('#quest-card')).toContainText('resting place on the shore');
  await page.locator('.toolbar [data-action="inventory"]').click();
  await page.getByRole('button', { name: 'Find the return point', exact: true }).click();
  await expect(page.locator('[data-action="journey"][data-value="to-shore"]')).toBeVisible();
  await page.locator('[data-action="journey"][data-value="to-shore"]').click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await visit(page, 'sewing-rest');
  await close(page);
  await practical(page, 'life-set-pouch');
  const save = await exported(page);
  expect(save.state.campaign.roof.checkpoint).toBe(checkpoint);
  expect(save.state.campaign.roof.stage).toBe('witnessing');
  expect(save.state.life.thread.stage).toBe('identified');
  expect(save.state.campaign.carrying).toBeNull();
  expect(save.state.tracking).toBe('rest');
});
