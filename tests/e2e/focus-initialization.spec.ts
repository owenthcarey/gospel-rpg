import { test, expect } from '@playwright/test';
import { ready, settled } from '../helpers/connection-browser';

test('deferred dialog initialization preserves a control already focused in its new surface', async ({
  page,
}) => {
  await ready(page);
  // A user or assistive technology can choose a control before the next paint.
  // Observe insertion to reproduce that ordering without timing-dependent sleeps.
  await page.evaluate(() => {
    const overlay = document.querySelector('#overlay')!;
    const observer = new MutationObserver(() => {
      const input = overlay.querySelector<HTMLInputElement>('#import-save');
      if (input) {
        input.focus();
        observer.disconnect();
      }
    });
    observer.observe(overlay, { childList: true });
  });
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await settled(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator('#import-save')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Start a new journey…', exact: true }),
  ).toBeFocused();
});
