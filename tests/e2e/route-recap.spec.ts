import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { completedJourney, homeAt } from '../helpers/connection';
import { ready, settled, exported, journal, act } from '../helpers/connection-browser';

async function savedRouteRecap(page: Page) {
  const before = await exported(page);
  await journal(page);
  await act(page, 'recap');
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  return before;
}

test('an unavailable saved route stays explained and cancellable without offering a dead Resume action', async ({
  page,
  isMobile,
}, info) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const state = completedJourney();
  state.connection.route = { target: 'simon' };
  await ready(page, state);
  await page.reload();
  const welcome = page.locator('.welcome-recap');
  await welcome.locator('summary').click();
  await expect(welcome).toContainText(
    'Saved route: Simon. This destination is no longer available.',
  );
  await expect(welcome).not.toContainText('Resume it after continuing.');
  await expect(welcome.locator('[data-action]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue your journey', exact: true }).click();
  await settled(page);
  const before = await savedRouteRecap(page);
  const recap = page.locator('.journey-recap');
  const resume = recap.getByRole('button', { name: 'Resume route', exact: true });
  const cancel = recap.getByRole('button', { name: 'Cancel route', exact: true });
  await expect(recap).toContainText('Simon');
  await expect(recap).toContainText('This destination is no longer available.');
  await expect(resume).toBeDisabled();
  await expect(cancel).toBeEnabled();
  await expect(page.locator('#travel-status [data-action="route-resume"]')).toBeDisabled();
  const panel = (await page.locator('.panel').elementHandle())!;
  try {
    await resume.scrollIntoViewIfNeeded();
    const bounds = (await resume.boundingBox())!;
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    // Use native pointer input: a disabled control must leave the reading menu intact.
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await settled(page);
    expect(await panel.evaluate((element) => element.isConnected)).toBe(true);
    await expect(recap).toBeVisible();
    await expect(resume).toBeDisabled();
    // Keyboard navigation skips Resume and still reaches the explicit way out.
    await page.getByRole('button', { name: 'Close menu', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await expect(cancel).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: info.outputPath('unavailable-route-controls.png'),
      scale: 'css',
    });
    await cancel.press('Enter');
    await settled(page);
    await expect(recap).toBeVisible();
    await expect(recap).not.toContainText('Your saved route');
    const after = await exported(page);
    expect({ ...after, playTime: before.playTime }).toEqual({
      ...before,
      connection: { ...before.connection, route: null },
    });
    await writeFile(
      info.outputPath('unavailable-route-cancellation.json'),
      JSON.stringify({ before, after }, null, 2),
    );
  } finally {
    await panel.dispose();
  }
});

test('an available saved route still resumes to its encounter and preserves earned progress', async ({
  page,
}, info) => {
  const state = homeAt(completedJourney(), 'table');
  state.connection.route = { target: 'home-table' };
  await ready(page, state);
  const before = await savedRouteRecap(page);
  const resume = page.locator('.journey-recap [data-action="route-resume"]');
  await expect(resume).toBeEnabled();
  await resume.focus();
  await resume.press('Enter');
  await expect(page.getByRole('heading', { name: 'A shared table', exact: true })).toBeVisible();
  await settled(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'bakehouse');
  const after = await exported(page);
  expect({ ...after, playTime: before.playTime }).toEqual({
    ...before,
    connection: { ...before.connection, route: null },
  });
  await writeFile(
    info.outputPath('available-route-resumed.json'),
    JSON.stringify({ before, after }, null, 2),
  );
});
