import { describe, expect, test } from 'vitest';
import { mapPoint, minimapBearing, minimapTarget } from '../../src/ui/minimap';

describe('rotating minimap navigation', () => {
  const bounds = { min: -16, max: 16 };
  test('north-up east and north taps retain world axes', () => {
    expect(minimapBearing(-Math.PI / 2)).toBe(0);
    expect(minimapTarget(0.75, 0.5, 0, bounds)).toEqual({ x: 8, z: 0 });
    expect(minimapTarget(0.5, 0.25, 0, bounds)).toEqual({ x: 0, z: 8 });
  });
  test('a west-facing camera places west at the top and north on the right', () => {
    const facingWest = minimapBearing(0);
    const top = minimapTarget(0.5, 0.25, facingWest, bounds)!;
    const right = minimapTarget(0.75, 0.5, facingWest, bounds)!;
    expect(top.x).toBeCloseTo(-8);
    expect(top.z).toBeCloseTo(0);
    expect(right.x).toBeCloseTo(0);
    expect(right.z).toBeCloseTo(8);
  });
  test('the same coordinate contract handles unequal region bounds and reversed map Z', () => {
    const offset = { min: -8, max: 24 };
    expect(mapPoint({ x: -8, z: 24 }, offset)).toEqual({ x: 0, y: 0 });
    expect(mapPoint({ x: 24, z: -8 }, offset)).toEqual({ x: 192, y: 192 });
    expect(minimapTarget(0.5, 0.5, 0, offset)).toEqual({ x: 8, z: 8 });
  });
  test('the carved frame and invalid coordinates cannot create a walk', () => {
    expect(minimapTarget(0, 0, 0, bounds)).toBeUndefined();
    expect(minimapTarget(0.5, 1.1, 0, bounds)).toBeUndefined();
    expect(minimapTarget(NaN, 0.5, 0, bounds)).toBeUndefined();
  });
  test('walking and panning the radar keeps the traveler at its center', () => {
    const traveler = { x: -8, z: 6 };
    expect(minimapTarget(0.5, 0.5, 0, bounds, traveler)).toEqual(traveler);
    expect(minimapTarget(0.75, 0.5, 0, bounds, traveler)).toEqual({ x: 0, z: 6 });
    expect(minimapTarget(0.5, 0.25, 0, bounds, traveler)).toEqual({ x: -8, z: 14 });
  });
});
