import { test, expect } from '@playwright/test';
import { ready, visit, exported, settled } from '../helpers/connection-browser';
import { preparedSpring } from '../helpers/galilee';

test('WebGL startup, keyboard exploration, journal and a saved practical action', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toHaveAttribute('data-region', 'capernaum');
  const start = await exported(page);
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await settled(page);
  await canvas.focus();
  const beforeMarker = await page.locator('#minimap-player').getAttribute('transform');
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(async () => {
        const position = (await page.locator('#minimap-player').getAttribute('transform'))!.match(
          /translate\(([^,]+),([^)]+)\)/,
        )!;
        const before = beforeMarker!.match(/translate\(([^,]+),([^)]+)\)/)!;
        return Math.hypot(
          Number(position[1]) - Number(before[1]),
          Number(position[2]) - Number(before[2]),
        );
      })
      .toBeGreaterThan(1);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  const moved = await exported(page);
  expect(
    Math.hypot(moved.position.x - start.position.x, moved.position.z - start.position.z),
  ).toBeGreaterThan(0.2);
  await page.locator('#import-save').setInputFiles({
    name: 'prepared-spring.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify((await import('../../src/persistence/schema')).makeSave(preparedSpring())),
    ),
  });
  await settled(page);
  await visit(page, 'channel-entry');
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
  await page.locator('[data-action="galilee-turn"]').focus();
  await page.locator('[data-action="galilee-turn"]').press('Enter');
  await settled(page);
  await expect(page.locator('[data-action="galilee-turn"]')).toBeFocused();
  await expect(page.locator('.work-state')).toContainText('east / west');
  await page.screenshot({ path: info.outputPath('focused-work.png') });
  const changed = await exported(page);
  expect(changed.galilee.spring.turns.entry).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await settled(page);
  await canvas.press('j');
  await expect(page.locator('.journey-overview')).toBeVisible();
  await page.keyboard.press('Escape');
  await visit(page, 'channel-entry');
  await expect(page.locator('.work-state')).toContainText('east / west');
  await page.keyboard.press('Escape');
  await canvas.press('F3');
  const rows = page.locator('.diagnostics-table tr');
  const diagnostics = await rows.evaluateAll((elements) =>
    Object.fromEntries(
      elements.map((row) => [
        row.querySelector('th')!.textContent,
        row.querySelector('td')!.textContent,
      ]),
    ),
  );
  expect(Number(diagnostics.drawCalls)).toBeGreaterThan(0);
  expect(Number(diagnostics.scenes)).toBe(1);
  expect(errors).toEqual([]);
});
