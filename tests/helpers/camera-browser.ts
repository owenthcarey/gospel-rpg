import { expect, type Page } from '@playwright/test';

// Use the real disclosure when the ordinary short-portrait HUD folds the buttons.
export async function revealCameraControls(page: Page, touch = false): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Show camera controls', exact: true });
  if (await toggle.isVisible()) {
    if (touch) await toggle.tap();
    else await toggle.click();
    await expect(page.locator('.camera-disclosure')).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.getByRole('button', { name: 'Reset camera', exact: true })).toBeVisible();
}
