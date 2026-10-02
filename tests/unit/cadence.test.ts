import { describe, expect, it } from 'vitest';
import { PausedCadence } from '../../src/scene/presentation/cadence';

/** Frame callbacks at the given times; returns the times at which a paused scene rendered. */
function paused(frames: number[], cadence = new PausedCadence()): number[] {
  const rendered: number[] = [];
  for (const now of frames)
    if (cadence.due(now)) {
      cadence.rendered(now);
      rendered.push(now);
    }
  return rendered;
}

describe('paused render cadence', () => {
  it('paints immediately when first opened, without waiting for the clock to reach 100 ms', () => {
    expect(paused([0, 16])).toEqual([0]);
  });

  it('discards a suspended frame measurement and still budgets genuine GPU work after repainting', () => {
    const cadence = new PausedCadence();
    cadence.rendered(1000);
    cadence.invalidate();
    expect(cadence.due(61_000)).toBe(true);
    cadence.rendered(61_000);
    // A real 150 ms frame still receives its original 300 ms rest afterward.
    expect(cadence.due(61_150)).toBe(false);
    expect(cadence.due(61_449)).toBe(false);
    expect(cadence.due(61_450)).toBe(true);
  });

  it('repaints a fast paused scene about every 100 ms, as before', () => {
    const frames = Array.from({ length: 40 }, (_, i) => 1000 + i * 16);
    const rendered = paused(frames);
    expect(rendered[0]).toBe(1000);
    for (let i = 1; i < rendered.length; i++)
      expect(rendered[i]! - rendered[i - 1]!).toBeGreaterThanOrEqual(100);
    expect(rendered.length).toBeGreaterThanOrEqual(5);
  });

  it('leaves a slow renderer at least two thirds of its time for the interface', () => {
    // Each render delays the next frame by 150 ms; other frames arrive every 16 ms.
    const cadence = new PausedCadence();
    let now = 1000;
    let busy = 0;
    while (now < 6000) {
      if (cadence.due(now)) {
        cadence.rendered(now);
        busy += 150;
        now += 150;
      } else now += 16;
    }
    expect(busy / (now - 1000)).toBeLessThanOrEqual(0.36);
  });

  it('measures a render from the running scene when pausing begins', () => {
    const cadence = new PausedCadence();
    for (let now = 200; now <= 1000; now += 200) cadence.rendered(now);
    // The first paused frame arrives 200 ms after the last render: it waits another 400 ms.
    expect(cadence.due(1200)).toBe(false);
    expect(cadence.due(1500)).toBe(false);
    expect(cadence.due(1600)).toBe(true);
  });
});
