import { test, expect } from '@playwright/test';
import {
  ready,
  dismiss,
  exported,
  visit,
  act,
  readableContrast,
} from '../helpers/connection-browser';
import { play } from '../helpers/journey';
import { arrangedShelter, chosenShelter } from '../helpers/galilee';
import { renderingCadence, worldPixels } from '../helpers/rendering';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';

test('graphics loss and recovery reveal fresh feedback after scrolling and preserve the journey', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  state.tracking = 'shelter';
  state.connection.route = { target: 'spring-source' };
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  await page.setViewportSize({ width: 568, height: 320 });
  const canvas = page.locator('#game-canvas');
  await canvas.press('F3');
  await expect(page.locator('.diagnostics-table')).toBeVisible();
  const before = await page
    .locator('.diagnostics-table tr')
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((row) => [
          row.querySelector('th')!.textContent!,
          row.querySelector('td')!.textContent!,
        ]),
      ),
    );
  const drawnBefore = await page
    .locator('.asset-diagnostics tr[data-asset]')
    .evaluateAll((rows) =>
      rows
        .filter((row) => Number(row.querySelectorAll('td')[2]!.textContent) > 0)
        .map((row) => (row as HTMLElement).dataset.asset!),
    );
  expect(drawnBefore).toContain('resting_mat');
  expect(drawnBefore).toContain('reed_screen');
  expect(drawnBefore).toContain('jug');
  await dismiss(page);
  const actions = page.locator('.hud-actions');
  await page.locator('#action-tray button').last().scrollIntoViewIfNeeded();
  expect(await actions.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await canvas.focus();
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  const pixelsBefore = await worldPixels(page);
  await page.screenshot({
    path: info.outputPath('world-before-loss.png'),
    scale: 'css',
    style: '#ui{visibility:hidden}',
  });
  const extension = await canvas.evaluateHandle((node) => {
    const element = node as HTMLCanvasElement;
    return (element.getContext('webgl2') ?? element.getContext('webgl'))!.getExtension(
      'WEBGL_lose_context',
    );
  });
  expect(await extension.evaluate((value) => !!value)).toBe(true);
  const toast = page.locator('#toast');
  let pixelsLost: Awaited<ReturnType<typeof worldPixels>> | undefined;
  try {
    await extension.evaluate((value) => value!.loseContext());
    await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'true');
    await expect(page.locator('#ui')).toHaveCSS('background-color', 'rgb(33, 29, 23)');
    await expect(toast).toContainText('Graphics paused');
    await expect(toast).toHaveAttribute('data-kind', 'warning');
    await expect(toast).toBeInViewport({ ratio: 1 });
    await expect(canvas).toBeFocused();
    pixelsLost = await worldPixels(page);
    expect(pixelsLost.lost).toBe(true);
    expect(pixelsLost.opaque).toBe(0);
    expect(pixelsLost.hash).not.toBe(pixelsBefore.hash);
    await page.screenshot({ path: info.outputPath('context-loss-notice.png'), scale: 'css' });
    await page.keyboard.down('w');
    await page.waitForTimeout(120);
    await page.keyboard.up('w');
    await expect(player).toHaveAttribute('transform', position!);
    // Outages can outlast a normal 4.8-second ribbon; menus must remain usable throughout.
    await page.waitForTimeout(5100);
    await expect(toast).toBeVisible();
    await expect(toast).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath('persistent-loss-notice.png'), scale: 'css' });
    await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
    await expect(page.locator('.message-list [data-kind="warning"]')).toContainText(
      'Graphics paused',
    );
    await expect(toast).toBeHidden();
    await expect(page.locator('.message-count')).toBeHidden();
    await dismiss(page);
    await expect(toast).toBeVisible();
    await expect(toast).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.message-count')).toBeHidden();
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await expect(toast).toBeHidden();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(toast).toContainText('export');
    const outageSaved = parseSave(
      JSON.parse(await readFile((await (await download).path())!, 'utf8')),
    ).state;
    expect(outageSaved.position).toEqual(state.position);
    expect(outageSaved.connection.route).toEqual(state.connection.route);
    expect(outageSaved.galilee).toEqual(state.galilee);
    expect(outageSaved.episode).toEqual(state.episode);
    await dismiss(page);
    await expect(toast).toContainText('Graphics paused', { timeout: 10_000 });
    await expect(toast).toBeVisible();
    await expect(toast).toBeInViewport({ ratio: 1 });
    // Recovery is also fresh feedback while the traveler has scrolled away again.
    await page.locator('#action-tray button').last().scrollIntoViewIfNeeded();
    expect(await actions.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(toast).toContainText('The view has been restored.');
  await expect(page.locator('#ui')).toHaveAttribute('data-graphics-paused', 'false');
  await expect(page.locator('#ui')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(toast).toHaveAttribute('data-held', 'false');
  await expect(toast).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole('button', { name: 'Settings and saves', exact: true }),
  ).toBeFocused();
  const cadence = await renderingCadence(page);
  const pixelsAfter = await worldPixels(page);
  await page.screenshot({
    path: info.outputPath('world-after-recovery.png'),
    scale: 'css',
    style: '#ui{visibility:hidden}',
  });
  expect(pixelsAfter.error).toBe(0);
  expect(pixelsAfter.lost).toBe(false);
  expect(pixelsAfter.opaque).toBeGreaterThan(0.95);
  expect(pixelsAfter.colors).toBeGreaterThan(80);
  expect(pixelsAfter.colored).toBeGreaterThan(0.5);
  expect(pixelsAfter.hash).toBe(pixelsBefore.hash);
  expect(errors).toEqual([]);
  await canvas.press('F3');
  await expect(page.locator('.diagnostics-table')).toBeVisible();
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
  expect(Number(rows.drawCalls)).toBeLessThanOrEqual(130);
  for (const key of ['meshes', 'materials', 'textures']) expect(rows[key]).toBe(before[key]);
  for (const id of drawnBefore)
    expect(
      Number(await page.locator(`.asset-diagnostics [data-asset="${id}"] td`).nth(2).textContent()),
      id + ' drawn after recovery',
    ).toBeGreaterThan(0);
  await writeFile(
    info.outputPath('graphics-recovery.json'),
    JSON.stringify(
      {
        before,
        rows,
        drawnBefore,
        cadence,
        pixelsBefore,
        pixelsLost,
        pixelsAfter,
        errors,
        physicalDevice: false,
      },
      null,
      2,
    ),
  );
  await dismiss(page);
  await expect(toast).toBeHidden({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
  await expect(page.locator('.message-list')).toContainText('Graphics paused');
  await expect(page.locator('.message-list')).toContainText('The view has been restored.');
  await expect(page.locator('.message-list li').filter({ hasText: 'Graphics paused' })).toHaveCount(
    1,
  );
  await expect(page.locator('.message-list .message-repeat')).toHaveCount(0);
  const saved = await exported(page);
  expect(saved.position).toEqual(state.position);
  expect(saved.galilee).toEqual(state.galilee);
  expect(saved.connection.route).toEqual(state.connection.route);
  expect(saved.episode).toEqual(state.episode);
  expect(saved.campaign.roof).toEqual(state.campaign.roof);
  expect(saved.road.chapter).toEqual(state.road.chapter);
  expect(saved.lake.chapter).toEqual(state.lake.chapter);
});

test('physical work preserves its proposal and blocked controls through graphics recovery', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  await ready(page, state);
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  await visit(page, 'rest-breeze');
  await page.locator('.screen-preview-controls summary').click();
  await act(page, 'work-preview', '0');
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const canvas = page.locator('#game-canvas');
  const apply = page.locator('[data-action="work-preview-apply"]');
  await apply.focus();
  const controls = page.locator(
    '.work-actions button, .work-target-list button, [data-action="work-preview"], [data-action="work-preview-apply"], [data-action="work-frame"]',
  );
  const disabled = () =>
    controls.evaluateAll((nodes) =>
      nodes.map((node) => ({
        action: (node as HTMLElement).dataset.action,
        value: (node as HTMLElement).dataset.value,
        disabled: (node as HTMLButtonElement).disabled,
      })),
    );
  const before = await disabled();
  expect(before.some((control) => control.disabled)).toBe(true);
  const pixelsBefore = await worldPixels(page);
  const extension = await canvas.evaluateHandle((node) =>
    (node as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context'),
  );
  try {
    await extension.evaluate((value) => value!.loseContext());
    await expect(page.locator('#toast')).toContainText('Graphics paused');
    await expect(apply).toBeDisabled();
    expect((await disabled()).every((control) => control.disabled)).toBe(true);
    await expect(canvas).toHaveAttribute('data-work-preview', '0');
    await expect(page.locator('.preview-description')).toContainText('approach is open');
    await expect(page.locator('[data-action="work-inspect"]')).toBeEnabled();
    await expect(page.locator('[data-action="work-preview-cancel"]')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('paused-physical-work.png'), scale: 'css' });
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(page.locator('#toast')).toContainText('The view has been restored.');
  await expect(apply).toBeEnabled();
  await expect(apply).toBeFocused();
  expect(await disabled()).toEqual(before);
  await expect(canvas).toHaveAttribute('data-work-preview', '0');
  await renderingCadence(page);
  const pixelsAfter = await worldPixels(page);
  expect(pixelsAfter.hash).toBe(pixelsBefore.hash);
  await writeFile(
    info.outputPath('work-recovery.json'),
    JSON.stringify({ before, after: await disabled(), pixelsBefore, pixelsAfter }, null, 2),
  );
  await act(page, 'work-preview-apply');
  await expect(canvas).toHaveAttribute('data-work-preview', '');
  await expect(page.locator('.work-result')).toContainText('Screen placed');
  const saved = await exported(page);
  expect(saved.galilee.shelter.screen).toBe(0);
  expect(saved.galilee.shelter.placed).toEqual(state.galilee.shelter.placed);
  expect(saved.position).toEqual(state.position);
  expect(saved.episode).toEqual(state.episode);
});

test('full inspection stays readable while physical commands pause and resume', async ({
  page,
}, info) => {
  const state = arrangedShelter(chosenShelter(undefined, 'breeze'), 2);
  await ready(page, state);
  await visit(page, 'rest-breeze');
  await act(page, 'work-inspect');
  const screen = page.getByRole('button', { name: 'Move the screen clockwise', exact: true });
  await expect(screen).toBeEnabled();
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const returnToWork = page.getByRole('button', { name: 'Return to the work', exact: true });
  await expect(returnToWork).toBeEnabled();
  const controls = page.locator('.context-actions button');
  const disabled = () =>
    controls.evaluateAll((nodes) =>
      nodes.map((node) => ({
        action: (node as HTMLElement).dataset.action,
        value: (node as HTMLElement).dataset.value,
        disabled: (node as HTMLButtonElement).disabled,
      })),
    );
  const before = await disabled();
  expect(before.every((control) => !control.disabled)).toBe(true);
  await screen.focus();
  const extension = await page
    .locator('#game-canvas')
    .evaluateHandle((node) =>
      (node as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context'),
    );
  try {
    await extension.evaluate((value) => value!.loseContext());
    await expect(screen).toBeDisabled();
    expect((await disabled()).every((control) => control.disabled)).toBe(true);
    await expect(page.locator('[data-graphics-pause]')).toContainText(
      'Physical actions will resume',
    );
    await expect(page.locator('.panel-lead')).toBeVisible();
    await expect(returnToWork).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeEnabled();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
    await expect(page.locator('.rest-plan')).toContainText('Screen on the south side');
    await page.screenshot({ path: info.outputPath('paused-inspection.png'), scale: 'css' });
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(screen).toBeEnabled();
  await expect(screen).toBeFocused();
  await expect(page.locator('[data-graphics-pause]')).toHaveCount(0);
  expect(await disabled()).toEqual(before);
  const saved = await exported(page);
  expect(saved.galilee).toEqual(state.galilee);
  expect(saved.position).toEqual(state.position);
  await visit(page, 'rest-breeze');
  await act(page, 'work-inspect');
  const player = page.locator('#minimap-player');
  // Arrival opens the inspection before a slow renderer publishes its next HUD frame.
  const positionAfterReturn = await player.evaluate(
    (node) =>
      new Promise<string>((resolve) => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve(node.getAttribute('transform')!);
        });
        observer.observe(node, { attributes: true, attributeFilter: ['transform'] });
      }),
  );
  await act(page, 'galilee-screen', '2');
  await expect(page.locator('.rest-plan')).toContainText('Screen on the west side');
  await expect(player).toHaveAttribute('transform', positionAfterReturn!);
  const changed = await exported(page);
  expect(changed.galilee.shelter.screen).toBe(3);
  expect(changed.episode).toEqual(state.episode);
});

test('paused collection choices retain the conversation while reading and keyboard answers remain usable', async ({
  page,
}, info) => {
  const state = play([{ type: 'accept-quest' }]);
  await ready(page, state);
  await visit(page, 'miriam');
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  const bread = page.getByRole('button', { name: /Take the bread for Simon/ });
  const reading = page.getByRole('button', { name: /Tell me about the village/ });
  await expect(bread).toBeEnabled();
  const player = page.locator('#minimap-player');
  const position = await player.getAttribute('transform');
  await bread.focus();
  const extension = await page
    .locator('#game-canvas')
    .evaluateHandle((node) =>
      (node as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context'),
    );
  try {
    await extension.evaluate((value) => value!.loseContext());
    await expect(bread).toBeDisabled();
    await expect(reading).toBeEnabled();
    await expect(page.locator('[data-graphics-pause]')).toBeVisible();
    await page.keyboard.press('1');
    await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
    await expect(bread).toBeDisabled();
    await page.keyboard.press('2');
    await expect(page.locator('.dialogue-text')).toContainText('The lake gives us fish');
    await page.getByRole('button', { name: /About the bread/ }).click();
    await expect(bread).toBeDisabled();
    await expect(reading).toBeFocused();
    await expect(page.locator('.dialogue-box')).toHaveCSS('opacity', '1');
    await expect(page.locator('.dialogue-text')).toHaveCSS('opacity', '1');
    await readableContrast(page, '[data-graphics-pause]');
    await page.screenshot({ path: info.outputPath('paused-collection.png'), scale: 'css' });
  } finally {
    await extension.evaluate((value) => value!.restoreContext());
    await extension.dispose();
  }
  await expect(bread).toBeEnabled();
  await expect(reading).toBeFocused();
  await expect(page.locator('[data-graphics-pause]')).toHaveCount(0);
  await expect(player).toHaveAttribute('transform', position!);
  await bread.click();
  await expect(page.locator('.dialogue-box')).toHaveCount(0);
  const saved = await exported(page);
  expect(saved.inventory).toEqual(['bread']);
  expect(saved.quest).toBe('gathering');
  expect(saved.episode).toEqual(state.episode);
  await expect(player).toHaveAttribute('transform', position!);
});
