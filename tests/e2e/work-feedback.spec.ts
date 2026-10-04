import { test, expect, type Page } from '@playwright/test';
import { chosenShelter } from '../helpers/galilee';
import { ready, visit, act, dismiss, settled, exported } from '../helpers/connection-browser';

async function readingGeometry(page: Page) {
  return page.locator('.work-body').evaluate((body) => {
    const viewport = body.getBoundingClientRect();
    const result = body.querySelector('.work-result')!.getBoundingClientRect();
    const top = viewport.top + body.clientTop;
    const bottom = top + body.clientHeight;
    return {
      scrollTop: body.scrollTop,
      visible: result.top >= top - 1 && result.bottom <= bottom + 1,
      visiblePixels: Math.max(0, Math.min(result.bottom, bottom) - Math.max(result.top, top)),
      resultHeight: result.height,
      pageScroll: [window.scrollX, window.scrollY],
    };
  });
}

test('new compact work feedback reveals its result while action and preview controls retain ownership', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === 'mobile-chromium';
  const site = phone ? 'breeze' : 'shade';
  await ready(page, chosenShelter(undefined, site));
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  for (const supply of ['mat', 'water', 'screen']) {
    await visit(page, 'rest-supplies');
    await act(page, 'galilee-action', 'shelter-take-' + supply);
    await visit(page, 'rest-' + site);
    await act(page, 'galilee-action', 'shelter-place-' + site + '-' + supply);
  }
  if (!phone) await page.setViewportSize({ width: 1024, height: 480 });
  const move = page.locator('.work-actions [data-action="galilee-screen"]');
  // Native focus/click reveals only the action, never the feedback used in the assertion.
  await move.click();
  await settled(page);
  await expect(page.locator('.work-result')).toHaveText(
    'Screen moved. Check the approach when you are ready.',
  );
  await expect(move).toBeFocused();
  await expect.poll(async () => (await readingGeometry(page)).visible).toBe(true);
  const revealed = await readingGeometry(page);
  expect(revealed.visiblePixels).toBeGreaterThanOrEqual(revealed.resultHeight - 1);
  expect(revealed.pageScroll).toEqual([0, 0]);
  await page.screenshot({ path: info.outputPath('compact-work-feedback.png') });

  // The same feedback after another native keyboard action keeps the action's reading position.
  await move.focus();
  const beforeRepeated = (await readingGeometry(page)).scrollTop;
  await page.keyboard.press('Enter');
  await settled(page);
  await expect(move).toHaveAttribute('data-value', '0');
  await expect(move).toBeFocused();
  expect((await readingGeometry(page)).scrollTop).toBeCloseTo(beforeRepeated, 1);

  const preview = page.locator('.screen-preview-controls');
  await preview.locator('summary').click();
  const east = preview.locator('[data-action="work-preview"][data-value="1"]');
  await east.focus();
  const beforePreview = (await readingGeometry(page)).scrollTop;
  await page.keyboard.press('Enter');
  await settled(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-preview', '1');
  await expect(east).toBeFocused();
  expect((await readingGeometry(page)).scrollTop).toBeCloseTo(beforePreview, 1);
  await act(page, 'work-preview-apply');
  await expect(page.locator('.work-result')).toContainText('Screen placed.');

  // A larger body already contains the changed result; another native move must not scroll it.
  await page.setViewportSize({ width: 1440, height: 1200 });
  if ((await preview.getAttribute('open')) !== null) await preview.locator('summary').click();
  await move.focus();
  await expect.poll(async () => (await readingGeometry(page)).visible).toBe(true);
  const beforeReadable = (await readingGeometry(page)).scrollTop;
  expect(beforeReadable).toBe(0);
  await page.keyboard.press('Enter');
  await settled(page);
  await expect(move).toHaveAttribute('data-value', '2');
  await expect(move).toBeFocused();
  expect((await readingGeometry(page)).scrollTop).toBeCloseTo(beforeReadable, 1);
  expect((await readingGeometry(page)).visible).toBe(true);
  const saved = await exported(page);
  expect(saved.galilee.shelter).toMatchObject({
    stage: 'arranging',
    site,
    placed: ['mat', 'water', 'screen'],
    screen: 2,
    checked: false,
  });
  expect(saved.campaign.carrying).toBeNull();
});
