import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { activeInteractables } from '../../src/content/region';
import { dismiss, exported, ready } from '../helpers/connection-browser';

const fixture = async (name: string) =>
  parseSave(JSON.parse(await readFile(`tests/fixtures/saves/${name}`, 'utf8'))).state;

test('opening a paused regional map retains its tracked passage on desktop and narrow phones', async ({
  page,
  isMobile,
}, info) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const state = await fixture('v7-road-investigation.json');
  state.tracking = 'nain';
  await ready(page, state);
  await dismiss(page);
  const radar = page.locator('.minimap [data-map-place="to-nain"]');
  await expect(radar).toHaveClass(/map-target/);
  const player = await page.locator('#minimap-player').getAttribute('transform');
  await page.getByRole('button', { name: 'Open local map', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Local destinations');
  await expect(page.locator('#world-labels')).toHaveJSProperty('inert', true);
  const passage = page.locator('.large-map [data-map-place="to-nain"]');
  await expect(passage).toHaveClass(/map-target/);
  await expect(passage).toHaveAttribute('cx', '96');
  await expect(passage).toHaveAttribute('cy', '24');
  await expect(passage).toHaveCSS('stroke', 'rgb(255, 243, 168)');
  await expect(passage).toHaveCSS('stroke-width', '2px');
  await expect(page.locator('.large-map .map-target')).toHaveCount(1);
  expect(
    await page
      .locator('.map-destinations [data-action="travel"]')
      .evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.value)),
  ).toEqual(activeInteractables(state).map((place) => place.id));
  await passage.scrollIntoViewIfNeeded();
  await expect(passage).toBeInViewport();
  await page.screenshot({ path: info.outputPath('tracked-regional-passage.png'), scale: 'css' });
  // Open menus pause world input; the marker must already be right without a later HUD refresh.
  await page.keyboard.press('w');
  await page.waitForTimeout(350);
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', player!);
  await expect(passage).toHaveClass(/map-target/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('a completed tracked chapter leaves regional destinations available without a next-stop ring', async ({
  page,
  isMobile,
}) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const state = await fixture('v7-road-complete.json');
  state.tracking = 'trail';
  await ready(page, state);
  await dismiss(page);
  await expect(page.locator('.minimap .map-target')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open local map', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Local destinations');
  await expect(page.locator('.large-map .map-target')).toHaveCount(0);
  await expect(page.locator('.large-map [data-map-place="nain-viewpoint"]')).toHaveCount(1);
  await expect(page.locator('.map-destinations [data-value="nain-viewpoint"]')).toBeEnabled();
  await expect(page.locator('.map-destinations [data-action="travel"]')).toHaveCount(
    activeInteractables(state).length,
  );
});

test('completed early stories keep an unfinished Capernaum gateway marked while reading the map', async ({
  page,
  isMobile,
}, info) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const state = await fixture('v4-complete-episode.json');
  await ready(page, state);
  const before = await exported(page);
  await dismiss(page);
  await expect(page.locator('.minimap [data-map-place="to-lanes"]')).toHaveClass(/map-target/);
  const player = await page.locator('#minimap-player').getAttribute('transform');
  await page.getByRole('button', { name: 'Open local map', exact: true }).click();
  await expect(page.locator('#world-labels')).toHaveJSProperty('inert', true);
  const passage = page.locator('.large-map [data-map-place="to-lanes"]');
  await expect(passage).toHaveClass(/map-target/);
  await expect(passage).toHaveAttribute('cx', '84');
  await expect(passage).toHaveAttribute('cy', '20');
  await expect(passage).toHaveAttribute('r', '2.6');
  await expect(passage).toHaveCSS('stroke', 'rgb(255, 243, 168)');
  await expect(passage).toHaveCSS('stroke-width', '2px');
  await expect(page.locator('.large-map .map-target')).toHaveCount(1);
  await expect(page.locator('.map-destinations [data-value="to-lanes"] small')).toHaveText(
    'Next stop',
  );
  expect(
    await page
      .locator('.map-destinations [data-action="travel"]')
      .evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.value)),
  ).toEqual(activeInteractables(state).map((place) => place.id));
  await expect(page.locator('.large-map .map-remembered')).toHaveCount(3);
  await passage.scrollIntoViewIfNeeded();
  await expect(passage).toBeInViewport();
  await page.keyboard.press('w');
  await page.waitForTimeout(350);
  await expect(page.locator('#minimap-player')).toHaveAttribute('transform', player!);
  await page.screenshot({ path: info.outputPath('tracked-capernaum-gateway.png'), scale: 'css' });
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual(before);
});
