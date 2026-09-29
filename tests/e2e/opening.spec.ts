import { test, expect, type Page } from '@playwright/test';

// The cold open plays only on a first journey outside automation. These cases opt back in by
// hiding `navigator.webdriver`, the one condition the game uses to skip it for test runs.
async function asPlayer(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Title cards leave on a wall-clock timer, so record each one as it is inserted rather than
    // racing a slow software renderer to inspect it.
    const cards: { text: string; pointerEvents: string }[] = [];
    (window as unknown as { __cards: typeof cards }).__cards = cards;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof HTMLElement && node.classList.contains('chapter-card'))
            cards.push({
              text: node.textContent ?? '',
              pointerEvents: getComputedStyle(node).pointerEvents,
            });
    }).observe(document, { childList: true, subtree: true });
  });
}
const shownCards = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __cards: { text: string; pointerEvents: string }[] }).__cards,
  );
const settled = (page: Page) =>
  expect(page.locator('#ui')).toHaveAttribute('data-action-pending', 'false');

test('a first journey opens with a skippable cold open, then a veiled arrival and a title card', async ({
  page,
}) => {
  await asPlayer(page);
  const models: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.glb')) models.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-title', 'true');
  expect(models).toEqual([]);
  // Like the other journeys, this flow runs at Low so software-rendered CI can keep pace.
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: 'Begin your journey', exact: true }).click();
  const opening = page.getByRole('dialog', { name: 'Opening' });
  await expect(opening).toBeVisible();
  await expect(opening.locator('.cold-open-provenance')).toContainText('Original narration');
  await expect(page.locator('.cold-open-skip')).toBeFocused();
  await page.locator('.cold-open-continue').click();
  await page.locator('.cold-open-skip').click();
  await expect(opening).toHaveCount(0);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await settled(page);
  // The title card announces the place but never intercepts the world or HUD.
  await expect
    .poll(() => shownCards(page))
    .toContainEqual({ text: expect.stringContaining('Capernaum'), pointerEvents: 'none' });
  await expect(page.locator('.veil')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-title');
  // Returning players continue straight into their journey.
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum');
  await expect(page.locator('.cold-open')).toHaveCount(0);
});

test('Settings replays the opening; Escape leaves it and reduced motion shows still cards', async ({
  page,
}) => {
  await asPlayer(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings' }).click();
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('[data-action="replay-opening"]').click();
  const opening = page.getByRole('dialog', { name: 'Opening' });
  await expect(opening).toBeVisible();
  await expect(page.locator('.cold-open')).toHaveClass(/is-reduced/);
  await page.keyboard.press('Escape');
  await expect(opening).toHaveCount(0);
  // Watching the opening does not start or change a journey.
  await expect(page.getByRole('button', { name: 'Begin your journey', exact: true })).toBeVisible();
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-region', /.+/);
});
