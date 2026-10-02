import type { Page } from '@playwright/test';
import type { Point } from '../../src/game/types';

interface RadarWalk {
  start: Point;
  endpoint: Point;
  arrived: Point;
}

/** Retain the actual flag and arrival before a short walk can finish between driver calls. */
export async function observeRadarWalk(
  page: Page,
  bounds: { min: number; max: number },
): Promise<{ completed: Promise<RadarWalk> }> {
  await page.locator('.minimap').evaluate((map, bounds) => {
    const reading = window as Window & { radarWalk?: Promise<RadarWalk> };
    const point = (node: Element): Point => {
      const [, x, y] = node.getAttribute('transform')!.match(/translate\(([^,]+),([^)]*)\)/)!;
      const scale = 192 / (bounds.max - bounds.min);
      return { x: Number(x) / scale + bounds.min, z: bounds.max - Number(y) / scale };
    };
    const initial = point(map.querySelector('#minimap-player')!);
    reading.radarWalk = new Promise<RadarWalk>((resolve, reject) => {
      let endpoint: Point | undefined;
      const observer = new MutationObserver(() => {
        const flag = map.querySelector<SVGElement>('.minimap-destination');
        const player = map.querySelector('#minimap-player');
        if (!player) return;
        const visible = !!flag && getComputedStyle(flag).display !== 'none';
        if (visible && !endpoint) endpoint = point(flag!);
        if (endpoint && !visible) {
          observer.disconnect();
          window.clearTimeout(timer);
          resolve({ start: initial, endpoint, arrived: point(player) });
        }
      });
      const timer = window.setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            'No observed flag and arrival within the existing 60s route bound: ' +
              JSON.stringify({
                initial,
                endpoint,
                player: map.querySelector('#minimap-player')?.getAttribute('transform'),
              }),
          ),
        );
      }, 60_000);
      observer.observe(map, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'transform'],
      });
    });
    void reading.radarWalk.catch(() => {});
  }, bounds);
  const completed = page
    .evaluate(() => (window as Window & { radarWalk?: Promise<RadarWalk> }).radarWalk!)
    .finally(async () => {
      await page
        .evaluate(() => {
          delete (window as Window & { radarWalk?: Promise<RadarWalk> }).radarWalk;
        })
        .catch(() => {});
    });
  void completed.catch(() => {});
  return { completed };
}
