import { type Page } from '@playwright/test';
import type { Point } from '../../src/game/types';

export interface RadarCrossing {
  samples: Point[];
  before: Point;
  after: Point;
  crossing: Point;
}

/** Arm before the native tap, then pause at the first rendered crossing of a world Z plane. */
export async function observeRadarCrossing(
  page: Page,
  bounds: { min: number; max: number },
  z: number,
): Promise<{ completed: Promise<RadarCrossing> }> {
  const player = page.locator('#minimap-player');
  // Awaiting this setup acknowledges that the observer is attached before pointer input.
  await player.evaluate(
    (element, { bounds, z }) => {
      const node = element as Element & { navigationCrossing?: Promise<RadarCrossing> };
      const read = (): Point => {
        const [, x, y] = node.getAttribute('transform')!.match(/translate\(([^,]+),([^)]*)\)/)!;
        const scale = 192 / (bounds.max - bounds.min);
        return { x: Number(x) / scale + bounds.min, z: bounds.max - Number(y) / scale };
      };
      const initial = read();
      const direction = Math.sign(z - initial.z);
      if (!direction) throw new Error('The traveler already stands on the crossing plane.');
      node.navigationCrossing = new Promise<RadarCrossing>((resolve, reject) => {
        const samples = [initial];
        let previous = initial;
        const observer = new MutationObserver(() => {
          const point = read();
          samples.push(point);
          // Slow WebGL frames may skip a narrow band, but cannot skip a signed threshold.
          if (direction * (point.z - z) >= 0) {
            observer.disconnect();
            window.clearTimeout(timer);
            const fraction = (z - previous.z) / (point.z - previous.z);
            const crossing = { x: previous.x + (point.x - previous.x) * fraction, z };
            document.querySelector<HTMLButtonElement>('.toolbar [data-action="journal"]')!.click();
            resolve({ samples, before: previous, after: point, crossing });
          }
          previous = point;
        });
        const timer = window.setTimeout(() => {
          observer.disconnect();
          reject(
            new Error(
              'No radar crossing within the existing 60s route bound: ' +
                JSON.stringify({
                  z,
                  initial,
                  last: samples.at(-1),
                  sampleCount: samples.length,
                  recent: samples.slice(-5),
                  destination: document
                    .querySelector('.minimap-destination')
                    ?.getAttribute('transform'),
                }),
            ),
          );
        }, 60_000);
        observer.observe(node, { attributes: true, attributeFilter: ['transform'] });
      });
      // Keep diagnostics handled even if a pointer action fails before the result is read.
      void node.navigationCrossing.catch(() => {});
    },
    { bounds, z },
  );
  const completed = player.evaluate(async (element) => {
    const node = element as Element & { navigationCrossing?: Promise<RadarCrossing> };
    try {
      return await node.navigationCrossing!;
    } finally {
      delete node.navigationCrossing;
    }
  });
  void completed.catch(() => {});
  return { completed };
}
