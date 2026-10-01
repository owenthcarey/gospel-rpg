import { test, expect } from '@playwright/test';
import { ready } from '../helpers/connection-browser';

test('expanded world labels remain steady beside reserved HUD edges', async ({ page }) => {
  await ready(page);
  await page.waitForTimeout(1500);
  const simon = page.locator('.world-label[data-value="simon"]');
  await expect(simon).toBeVisible();
  await expect(simon).toHaveClass(/expanded/);
  const size = await simon.evaluate((label) => {
    const node = label as HTMLElement & {
      visibilityFrames?: boolean[];
      visibilityObserver?: MutationObserver;
    };
    const height = node.getBoundingClientRect().height;
    const projected = node.style.transform.match(/translate\([^,]+,\s*([-\d.]+)px\)/);
    if (!projected) throw new Error('A projected world label is required');
    const y = Number(projected[1]);
    if (y < 40 || y > innerHeight - 40) throw new Error('The landmark must be inside the viewport');
    // Leave a gap smaller than the expanded label, with room for the old 26 px
    // fallback and the existing 5 px margins. Every other vertical offset is reserved.
    const allowance = (height - 11 - 26) / 2;
    const bands = [
      { selector: '.topbar', top: 0, height: y - 31 - allowance },
      { selector: '.quest-card', top: y + 5 + allowance, height: innerHeight - y - 5 - allowance },
    ];
    for (const { selector, top, height } of bands) {
      const band = document.querySelector<HTMLElement>(selector)!;
      for (const [key, value] of Object.entries({
        position: 'fixed',
        left: '0',
        top: `${top}px`,
        bottom: 'auto',
        width: '100vw',
        'max-width': 'none',
        'min-height': '0',
        height: `${height}px`,
        padding: '0',
        border: '0',
        'box-sizing': 'border-box',
        transform: 'none',
        overflow: 'hidden',
      }))
        band.style.setProperty(key, value, 'important');
    }
    for (const control of document.querySelectorAll<HTMLElement>(
      '.minimap-wrap,.minimap-compass,.minimap-open,.bottom-center,.traveler-card',
    ))
      control.style.setProperty('display', 'none', 'important');
    node.visibilityFrames = [];
    node.visibilityObserver = new MutationObserver(() => {
      node.visibilityFrames!.push(Boolean(node.hidden));
    });
    node.visibilityObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] });
    return height;
  });
  expect(size).toBeGreaterThan(40);
  try {
    await expect
      .poll(() =>
        simon.evaluate(
          (label) =>
            (label as HTMLElement & { visibilityFrames?: boolean[] }).visibilityFrames!.length,
        ),
      )
      .toBeGreaterThanOrEqual(10);
    const frames = await simon.evaluate(
      (label) => (label as HTMLElement & { visibilityFrames?: boolean[] }).visibilityFrames!,
    );
    expect(new Set(frames)).toEqual(new Set([true]));
    await expect(simon).toBeHidden();
    await expect(page.locator('#minimap-player')).toBeAttached();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await simon.evaluate((label) => {
      const node = label as HTMLElement & {
        visibilityFrames?: boolean[];
        visibilityObserver?: MutationObserver;
      };
      node.visibilityObserver?.disconnect();
      delete node.visibilityObserver;
      delete node.visibilityFrames;
    });
  }
});
