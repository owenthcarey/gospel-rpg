import { test, expect } from '@playwright/test';
import { newGame } from '../../src/game/types';
import { importState, ready } from '../helpers/connection-browser';

interface NoticeFrame {
  noticeVisible: boolean;
  labelVisible: boolean;
  overlap: boolean;
}
type NoticeLabel = HTMLElement & {
  noticeFrames?: NoticeFrame[];
  noticeObserver?: MutationObserver;
};

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

test('coarse-pointer world labels keep useful touch areas clear of menus and other labels', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Measures physical touch targets.');
  await ready(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toBeHidden();
  let measuredCollapsedLabel = false;
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 667, height: 375 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const measurement = () =>
      page.evaluate(() => {
        const labels = Array.from(
          document.querySelectorAll<HTMLElement>('.world-label:not([hidden])'),
        ).map((node) => ({ node, rect: node.getBoundingClientRect() }));
        const reserved = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.topbar,.quest-card,.minimap-wrap,.minimap-compass,.bottom-center,.traveler-card,#toast:not([hidden])',
          ),
        )
          .filter((node) => node.offsetHeight > 0)
          .map((node) => ({ node, rect: node.getBoundingClientRect() }));
        const overlap = (a: DOMRect, b: DOMRect) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const problems: string[] = [];
        for (const [index, { node, rect }] of labels.entries()) {
          const name = node.getAttribute('aria-label');
          const style = getComputedStyle(node);
          if (parseFloat(style.minWidth) < 44 || parseFloat(style.minHeight) < 44)
            problems.push(`${name}: small computed touch minimum`);
          // Projected translations can report a 44px box a few millionths below 44.
          if (rect.width < 43.99 || rect.height < 43.99) problems.push(`${name}: small touch area`);
          // The transparent part of a collapsed label must also receive the finger tap.
          for (const x of [rect.left + 3, rect.right - 3])
            for (const y of [rect.top + 3, rect.bottom - 3])
              if (document.elementFromPoint(x, y)?.closest('.world-label') !== node)
                problems.push(`${name}: touch area is covered`);
          for (const other of [...reserved, ...labels.slice(index + 1)])
            if (overlap(rect, other.rect)) problems.push(`${name}: overlaps another surface`);
        }
        return {
          count: labels.length,
          collapsed: labels.filter(({ node }) => !node.classList.contains('expanded')).length,
          problems,
        };
      });
    await expect
      .poll(async () => {
        const report = await measurement();
        return report.count > 0 ? report.problems : ['No visible world labels'];
      })
      .toEqual([]);
    measuredCollapsedLabel ||= (await measurement()).collapsed > 0;
    await page.screenshot({
      path: info.outputPath(`touch-labels-${viewport.width}x${viewport.height}.png`),
      scale: 'css',
    });
  }
  expect(measuredCollapsedLabel, 'compact landmark glyphs retain their enlarged touch areas').toBe(
    true,
  );
});

test('temporary import notices clear world names and release their space when they expire', async ({
  page,
}) => {
  await ready(page);
  const notice = page.locator('#toast');
  await expect(notice).toBeHidden();
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeFocused();
  const simon = page.locator('.world-label[data-value="simon"]');
  await expect(simon).toBeVisible();
  await expect(simon).toHaveClass(/expanded/);
  const baseline = await simon.evaluate((label) => {
    const node = label as NoticeLabel;
    const toast = document.querySelector<HTMLElement>('#toast')!;
    const player = document.querySelector<SVGElement>('#minimap-player')!;
    const box = node.getBoundingClientRect();
    // Arm before importing: separate software-WebGL commands can outlast the 4.8-second notice.
    // Pin the next real notice over this name, making the collision independent of viewport.
    for (const [key, value] of Object.entries({
      position: 'fixed',
      left: `${Math.max(8, Math.min(innerWidth - 208, box.left + box.width / 3))}px`,
      right: '8px',
      width: 'auto',
      maxWidth: '420px',
      top: `${box.top + 5}px`,
      bottom: 'auto',
      transform: 'none',
      animation: 'none',
    }))
      toast.style.setProperty(key, value, 'important');
    node.noticeFrames = [];
    node.noticeObserver = new MutationObserver(() => {
      const labelBox = node.getBoundingClientRect();
      const noticeBox = toast.getBoundingClientRect();
      const noticeVisible = !toast.hidden && toast.offsetHeight > 0;
      if (!noticeVisible) return;
      const labelVisible = !node.hidden && node.offsetHeight > 0;
      node.noticeFrames!.push({
        noticeVisible,
        labelVisible,
        overlap:
          noticeVisible &&
          labelVisible &&
          labelBox.left < noticeBox.right + 5 &&
          labelBox.right > noticeBox.left - 5 &&
          labelBox.top < noticeBox.bottom + 5 &&
          labelBox.bottom > noticeBox.top - 5,
      });
    });
    // Observe the stable map surface: importing replaces its player marker.
    // Interface updates transform after arranging labels, even when a name stays visible.
    node.noticeObserver.observe(document.querySelector('.minimap')!, {
      attributes: true,
      subtree: true,
      attributeFilter: ['transform'],
    });
    return { bottom: box.bottom, player: player.getAttribute('transform') };
  });
  try {
    // Reimport the same untouched region to obtain a fresh real notice without another title card.
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await importState(page, newGame());
    await expect(notice).toContainText('Your imported journey is ready.');
    await expect(notice).toHaveAttribute('role', 'status');
    await expect(notice).toHaveAttribute('aria-live', 'polite');
    await expect
      .poll(() => simon.evaluate((label) => (label as NoticeLabel).noticeFrames!.length))
      .toBeGreaterThan(0);
    await expect(notice).toBeHidden();
    const frames = await simon.evaluate((label) => (label as NoticeLabel).noticeFrames!);
    expect(frames.every((frame) => frame.noticeVisible)).toBe(true);
    expect(frames.every((frame) => !frame.overlap)).toBe(true);
    await expect(canvas).toBeFocused();
    await expect(page.locator('#minimap-player')).toHaveAttribute('transform', baseline.player!);
    // Culling or moving a name never removes the same destination from its accessible map.
    await page.locator('.toolbar [data-action="map"]').click();
    await expect(page.locator('.map-destinations [data-value="simon"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(canvas).toBeFocused();
    await expect(notice).toBeHidden();
    await expect(simon).toBeVisible();
    await expect
      .poll(() =>
        simon.evaluate(
          (label, bottom) => Math.abs(label.getBoundingClientRect().bottom - bottom),
          baseline.bottom,
        ),
      )
      .toBeLessThanOrEqual(1);
    await expect(page.locator('#minimap-player')).toHaveAttribute('transform', baseline.player!);
  } finally {
    await simon.evaluate((label) => {
      const node = label as NoticeLabel;
      node.noticeObserver?.disconnect();
      delete node.noticeObserver;
      delete node.noticeFrames;
    });
  }
});
