import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import { accounts } from '../../src/game/connection/accounts';
import { ACCOUNTS } from '../../src/game/connection/types';
import { completedJourney } from '../helpers/connection';
import { ready, dismiss, visit, library, act, settled } from '../helpers/connection-browser';
import { renderingCadence } from '../helpers/rendering';

test('the completed shore and passage markers render within the original High and Low budgets', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const s = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v10-way-home-complete.json', 'utf8')),
  ).state;
  await ready(page, s);
  const records: Record<string, unknown> = {};
  for (const quality of ['high', 'low']) {
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.locator('[data-setting="reducedMotion"]').check();
    await dismiss(page);
    const cadence = await renderingCadence(page);
    await page.locator('#game-canvas').press('F3');
    const rows = await page
      .locator('.diagnostics-table tr')
      .evaluateAll((rows) =>
        Object.fromEntries(
          rows.map((r) => [
            r.querySelector('th')!.textContent!,
            r.querySelector('td')!.textContent!,
          ]),
        ),
      );
    expect(Number(rows.scenes)).toBe(1);
    expect(Number(rows.drawCalls)).toBeGreaterThan(0);
    expect(Number(rows.drawCalls)).toBeLessThanOrEqual(quality === 'high' ? 300 : 130);
    records[quality] = { ...rows, cadence, physicalDevice: false };
    await dismiss(page);
    await page.screenshot({ path: info.outputPath('home-company-' + quality + '.png') });
  }
  await visit(page, 'to-lanes');
  await dismiss(page);
  await page.screenshot({ path: info.outputPath('passage-marker.png') });
  await page.locator('#game-canvas').press('F3');
  const marker = page.locator('.asset-diagnostics [data-asset="passage_marker"] td');
  expect(Number(await marker.nth(1).textContent())).toBeGreaterThan(0);
  expect(Number(await marker.nth(2).textContent())).toBeGreaterThan(0);
  await writeFile(
    info.outputPath('connected-journey-rendering.json'),
    JSON.stringify(records, null, 2),
  );
});

test('replay reading retains visible controls and world space at large text sizes', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await ready(page, completedJourney());
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  const sizes =
    info.project.name === 'mobile-chromium'
      ? [
          { width: 390, height: 844 },
          { width: 844, height: 390 },
        ]
      : [{ width: 1440, height: 900 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const account of ACCOUNTS) {
      await library(page);
      await act(page, 'replay-open', account + ':' + accounts[account].scenes[2]!.id);
      await expect(page.locator('.scene-continue')).toBeFocused();
      for (const action of [
        'scene-pause',
        'replay-next',
        'replay-previous',
        'replay-library',
        'scene-leave',
        'transcript',
      ])
        await expect(page.locator(`#scene-controls [data-action="${action}"]`)).toBeInViewport();
      const layout = await page.locator('#scene-controls').evaluate((el) => ({
        width: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        height: el.getBoundingClientRect().height,
        viewportHeight: innerHeight,
      }));
      expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.height).toBeLessThan(layout.viewportHeight * 0.8);
      await page.screenshot({ path: info.outputPath(`replay-${account}-${size.width}.png`) });
      await page.locator('#scene-controls [data-action="scene-leave"]').click();
      await settled(page);
    }
  }
});
