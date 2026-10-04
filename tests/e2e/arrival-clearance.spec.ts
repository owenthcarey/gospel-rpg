import { test, expect } from '@playwright/test';
import { ready } from '../helpers/connection-browser';

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 548 },
  { width: 320, height: 568 },
  { width: 568, height: 320 },
]) {
  test(`arrival plaque preserves clear HUD space at ${size.width}×${size.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      const samples: { visible: boolean; overlaps: string[]; contained: boolean; live: string }[] =
        [];
      (window as unknown as { arrivalSamples: typeof samples }).arrivalSamples = samples;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) {
            if (!(node instanceof HTMLElement) || !node.classList.contains('chapter-card'))
              continue;
            const sample = () => {
              if (!node.isConnected) return;
              const plaque = node.querySelector('.chapter-card-inner')!.getBoundingClientRect();
              const visible = getComputedStyle(node).visibility !== 'hidden';
              const overlaps = [
                ...document.querySelectorAll<HTMLElement>(
                  '.topbar,.quest-card,.minimap-wrap,.bottom-center,.traveler-card,#toast,#scene-controls',
                ),
              ].flatMap((control) => {
                const box = control.getBoundingClientRect();
                return visible &&
                  box.width &&
                  box.height &&
                  getComputedStyle(control).visibility !== 'hidden' &&
                  box.left < plaque.right &&
                  box.right > plaque.left &&
                  box.top < plaque.bottom &&
                  box.bottom > plaque.top
                  ? [control.id || control.className]
                  : [];
              });
              samples.push({
                visible,
                overlaps,
                contained:
                  plaque.left >= 12 &&
                  plaque.right <= innerWidth - 12 &&
                  plaque.top >= 12 &&
                  plaque.bottom <= innerHeight - 12,
                live: document.querySelector('.chapter-card-live')?.textContent ?? '',
              });
              requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          }
      }).observe(document, { childList: true, subtree: true });
    });
    // The plaque lasts 4.6 seconds. Observe it while the native journey input
    // settles: a slow software renderer can finish ready() after its fade-out.
    const arrival = (async () => {
      await Promise.all([
        expect(page.locator('.chapter-card-live')).toContainText('Capernaum'),
        expect(page.locator('.chapter-card')).toHaveCSS('opacity', '1'),
      ]);
      await expect(page.locator('.veil')).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('arrival-plaque.png') });
    })();
    await Promise.all([ready(page), arrival]);
    await expect(page.locator('.chapter-card')).toHaveCount(0);
    const samples = await page.evaluate(
      () =>
        (
          window as unknown as {
            arrivalSamples: {
              visible: boolean;
              overlaps: string[];
              contained: boolean;
              live: string;
            }[];
          }
        ).arrivalSamples,
    );
    expect(samples.length).toBeGreaterThan(1);
    // This short landscape has no centered gap between its three HUD columns.
    // The live location announcement remains available when the plaque yields.
    expect(samples.some((sample) => sample.visible)).toBe(size.width !== 568);
    expect(
      samples.filter((sample) => sample.visible && (!sample.contained || sample.overlaps.length)),
    ).toEqual([]);
    expect(samples.every((sample) => sample.live.includes('Capernaum'))).toBe(true);
    await page.screenshot({ path: info.outputPath('clear-arrival-world.png') });
    await expect(page.locator('#game-canvas')).toBeFocused();
    await expect(page.locator('.objective-toggle')).toBeVisible();
  });
}
