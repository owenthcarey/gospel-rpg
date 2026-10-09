import { describe, expect, it } from 'vitest';
import { bubbleLayout, bubbleScale } from '../../src/scene/environment/fishing-spot';

describe('fishing spot bubbles', () => {
  it('swell and pop within each cycle, never negative', () => {
    expect(bubbleScale(0)).toBeCloseTo(0);
    expect(bubbleScale(0.4)).toBeCloseTo(1);
    expect(bubbleScale(0.9)).toBe(0);
    expect(bubbleScale(1.4)).toBeCloseTo(bubbleScale(0.4));
    for (let t = 0; t < 3; t += 0.01) expect(bubbleScale(t)).toBeGreaterThanOrEqual(0);
  });
  it('stay within a small spot with staggered timing', () => {
    const offsets = new Set<number>();
    for (let i = 0; i < 9; i++) {
      const { dx, dz, offset } = bubbleLayout(i);
      expect(Math.hypot(dx, dz)).toBeLessThan(0.8);
      offsets.add(Math.round(offset * 100));
    }
    expect(offsets.size).toBe(9);
  });
});
