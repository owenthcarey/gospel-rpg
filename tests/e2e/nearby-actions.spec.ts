import { test, expect } from '@playwright/test';
import { chosenShelter } from '../helpers/galilee';
import {
  ready,
  visit,
  act,
  dismiss,
  exported,
  settled,
  readableContrast,
} from '../helpers/connection-browser';

test('nearby overflow keeps a fully placed resting place reachable from the quick tray', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === 'mobile-chromium';
  const site = phone ? 'breeze' : 'shade';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page, chosenShelter(undefined, site));
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  const quick = (id: string) =>
    page.locator(`#action-tray [data-action="quick-action"][data-value="galilee:${id}"]`);
  for (const supply of ['mat', 'water', 'screen']) {
    await visit(page, 'rest-supplies');
    await dismiss(page);
    await quick('shelter-take-' + supply).click();
    await settled(page);
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', 'rest-' + supply);
    await visit(page, 'rest-' + site);
    await dismiss(page);
    await quick('shelter-place-' + site + '-' + supply).click();
    await settled(page);
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', '');
  }
  await expect(page.locator('#action-tray [data-action="quick-action"]')).toHaveCount(3);
  await expect(quick('shelter-check-' + site)).toHaveCount(0);
  const more = page.locator(`#action-tray [data-action="navigate"][data-value="rest-${site}"]`);
  await expect(more).toHaveCount(1);
  await expect(more).toContainText('More actions at ');
  await expect(
    page.getByRole('button', { name: /Explore (The olive shade|The open resting place)/ }),
  ).toHaveCount(0);
  await readableContrast(page, '.nearby-more-actions button');
  const sizes = phone
    ? [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]
    : [{ width: 1440, height: 900 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await more.scrollIntoViewIfNeeded();
    await expect(more).toBeInViewport();
    if (phone) expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      size.width,
    );
    await expect(page.locator('#toast')).toBeHidden();
    await page.screenshot({ path: info.outputPath('nearby-overflow-' + size.width + '.png') });
    if (phone) await more.click();
    else {
      await more.focus();
      await page.keyboard.press('Enter');
    }
    const work = page.locator('.work-panel');
    await expect(work).toBeVisible();
    await expect(work).toHaveAttribute('data-work-target', 'rest-' + site);
    await expect(work).toHaveAttribute('aria-modal', 'false');
    await expect(
      work.getByRole('button', { name: 'Check the resting place', exact: true }),
    ).toBeVisible();
    await dismiss(page);
  }
  await more.click();
  await expect(page.locator('.work-panel')).toBeVisible();
  for (const expected of ['2', '3']) await act(page, 'galilee-screen', expected);
  await act(page, 'galilee-action', 'shelter-check-' + site);
  await expect(page.locator('.work-result')).toContainText('approach is open');
  await dismiss(page);
  await expect(page.locator('.nearby-more-actions')).toHaveCount(0);
  await expect(page.locator('#action-tray [data-action="quick-action"]')).toHaveCount(3);
  const saved = await exported(page);
  expect(saved.galilee.shelter).toMatchObject({
    stage: 'ready',
    site,
    screen: 0,
    placed: ['mat', 'water', 'screen'],
  });
  expect(saved.campaign.carrying).toBeNull();
  expect(errors).toEqual([]);
});
