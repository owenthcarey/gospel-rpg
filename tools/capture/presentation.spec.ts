import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeSave, importSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { displayRegion } from '../../src/game/connection/accounts';
import { dock, sail } from '../../tests/helpers/lake';

// `CAPTURE_LABEL=after npm run capture:presentation` writes artifacts/rfc011/captures/<label>/.
const label = process.env.CAPTURE_LABEL ?? 'current';
const only = process.env.CAPTURE_ONLY?.split(',');
const output = resolve('artifacts/rfc011/captures', label);
const fixture = async (name: string) =>
  importSave(await readFile(resolve('tests/fixtures/saves', name + '.json'), 'utf8')).state;
const shots: { id: string; state: () => Promise<GameState | undefined> }[] = [
  { id: 'capernaum', state: async () => undefined },
  { id: 'capernaum-landing', state: () => fixture('v11-landing-observed') },
  { id: 'capernaum-lanes', state: () => fixture('v6-living-capernaum') },
  { id: 'gathering-house', state: () => fixture('v7-beyond-capernaum') },
  { id: 'bakehouse', state: () => fixture('v6-interrupted-repair') },
  { id: 'galilean-road', state: () => fixture('v7-road-investigation') },
  { id: 'roadside-farm', state: () => fixture('v8-living-galilee-complete') },
  { id: 'nain-gate', state: () => fixture('v7-road-complete') },
  { id: 'galilee-water', state: () => fixture('v9-afloat') },
  { id: 'reed-landing', state: async () => dock(sail(), 'reed-landing') },
  { id: 'sheltered-cove', state: () => fixture('v9-cove-berthed') },
  { id: 'lake-gennesaret', state: () => fixture('v4-interrupted-lake') },
  { id: 'roof-account', state: () => fixture('v5-interrupted-roof') },
  { id: 'nain-account', state: () => fixture('v7-nain-checkpoint') },
  { id: 'storm-account', state: () => fixture('v9-storm-waking') },
];

async function closeMenus(page: Page) {
  for (let i = 0; i < 3; i++) {
    const close = page.getByRole('button', { name: 'Close menu', exact: true });
    if (!(await close.isVisible().catch(() => false))) return;
    await close.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}
async function quality(page: Page, value: 'high' | 'low') {
  await page
    .getByRole('button', { name: /Saves & settings|Settings and saves/ })
    .first()
    .click();
  await page.locator('[data-setting="quality"]').selectOption(value);
}
async function diagnostics(page: Page) {
  await page.locator('#game-canvas').press('F3');
  const rows = await page
    .locator('.diagnostics-table tr')
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((e) => [e.querySelector('th')!.textContent!, e.querySelector('td')!.textContent!]),
      ),
    );
  await closeMenus(page);
  return rows;
}

test('capture reference compositions', async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const records: Record<string, Record<string, string>> = {};
  for (const shot of shots) {
    if (only && !only.includes(shot.id)) continue;
    const state = await shot.state();
    for (const q of ['high', 'low'] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto('/');
      await quality(page, q);
      if (state) {
        await page.locator('#import-save').setInputFiles({
          name: shot.id + '.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(makeSave(state))),
        });
        await expect(page.locator('#game-canvas')).toHaveAttribute(
          'data-region',
          displayRegion(state),
        );
      } else {
        await closeMenus(page);
        await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
      }
      await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
      await closeMenus(page);
      await page.waitForTimeout(2500);
      records[shot.id + '-' + q] = await diagnostics(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: resolve(output, `${shot.id}-${q}.png`) });
      await page.screenshot({
        path: resolve(output, `${shot.id}-${q}-world.png`),
        style: '#ui, #loading { visibility: hidden !important; }',
      });
      await context.close();
    }
  }
  await writeFile(resolve(output, 'diagnostics.json'), JSON.stringify(records, null, 2) + '\n');
});
