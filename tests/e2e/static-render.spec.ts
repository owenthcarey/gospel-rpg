import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { district } from '../helpers/campaign';
import { makeSave } from '../../src/persistence/schema';
import { isActorAsset } from '../../src/content/assets';

// A small fixed software-rendered scene gives the same reference on GPU and CI hosts.
test.use({
  viewport: { width: 960, height: 640 },
  deviceScaleFactor: 1,
  launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
});
const options = {
  stylePath: resolve('tests/e2e/static-render.css'),
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
  timeout: 30_000,
};

async function importRegion(page: Page, region: 'bakehouse' | 'gathering-house') {
  const s = district();
  s.region = region;
  s.position = { x: 0, z: -3 };
  await page.locator('#import-save').setInputFiles({
    name: 'render.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSave(s))),
  });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', region);
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
}
async function ready(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await importRegion(page, 'bakehouse');
}
async function essentialDraws(page: Page) {
  await expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');
  await page.locator('#game-canvas').press('F3');
  const oven = page.locator('.asset-diagnostics [data-asset="oven"] td').nth(2);
  await expect(oven).toHaveText('1');
  await expect(
    page
      .locator('.diagnostics-table tr')
      .filter({ has: page.getByRole('rowheader', { name: 'scenes', exact: true }) })
      .getByRole('cell'),
  ).toHaveText('1');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
}

test('static scenery survives quality switches, orbit, reload and region replacement; missing geometry fails the image contract', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'mobile-chromium',
    'Fixed software-rendered visual reference; phone scenery is checked in the six-region matrix.',
  );
  test.setTimeout(240_000);
  await ready(page);
  await essentialDraws(page);
  await expect(page).toHaveScreenshot('bakehouse-static-low.png', options);
  for (const quality of ['high', 'low', 'high', 'low']) {
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await page.locator('[data-setting="quality"]').selectOption(quality);
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    await essentialDraws(page);
  }
  await page.getByRole('button', { name: 'Rotate camera left', exact: true }).click();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  for (const region of ['gathering-house', 'bakehouse', 'gathering-house', 'bakehouse'] as const) {
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await importRegion(page, region);
  }
  await essentialDraws(page);
  await expect(page).toHaveScreenshot('bakehouse-static-low.png', options);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await essentialDraws(page);
  await expect(page).toHaveScreenshot('bakehouse-static-low.png', options);

  // Deliberately remove the rendered static geometry while keeping valid GLBs,
  // terrain, actors and labels. Aggregate mesh counts alone still look healthy.
  await page.route('**/assets/models/*.glb', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!.slice(0, -4);
    if (isActorAsset(id)) {
      await route.continue();
      return;
    }
    const bytes = await readFile('public/assets/models/' + id + '.glb');
    const length = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + length));
    for (const scene of gltf.scenes)
      for (const root of scene.nodes) gltf.nodes[root].scale = [0, 0, 0];
    const json = Buffer.from(JSON.stringify(gltf)),
      padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
    json.copy(padded);
    const header = Buffer.from(bytes.subarray(0, 20)),
      tail = bytes.subarray(20 + length);
    header.writeUInt32LE(20 + padded.length + tail.length, 8);
    header.writeUInt32LE(padded.length, 12);
    await route.fulfill({
      contentType: 'model/gltf-binary',
      body: Buffer.concat([header, padded, tail]),
    });
  });
  await ready(page);
  await expect(page).not.toHaveScreenshot('bakehouse-static-low.png', options);
  await page.screenshot({
    path: info.outputPath('deliberately-missing-static-geometry.png'),
    style: '#ui{visibility:hidden}',
  });
});
