import { describe, expect, it } from 'vitest';
import { FRESH_RUN, RUN_SPEED, tickRun, toggleRun } from '../../src/game/run';

describe('running', () => {
  it('starts walking with a full store and toggles on and off', () => {
    expect(FRESH_RUN).toEqual({ on: false, energy: 100 });
    const on = toggleRun(FRESH_RUN);
    expect(on.on).toBe(true);
    expect(toggleRun(on).on).toBe(false);
    expect(RUN_SPEED).toBeGreaterThan(1);
  });

  it('spends energy only on distance actually run and stops when empty', () => {
    let s = toggleRun(FRESH_RUN);
    s = tickRun(s, 1, 0);
    expect(s.energy).toBe(100);
    s = tickRun(s, 1, 10);
    expect(s.energy).toBeCloseTo(94);
    s = tickRun(s, 1, 1_000);
    expect(s).toEqual({ on: false, energy: 0 });
    expect(toggleRun(s).on).toBe(false);
  });

  it('recovers while walking or standing, up to full', () => {
    let s = { on: false, energy: 10 };
    s = tickRun(s, 10, 0);
    expect(s.energy).toBeCloseTo(19);
    s = tickRun(s, 1_000, 0);
    expect(s.energy).toBe(100);
    expect(tickRun(s, -5, 0).energy).toBe(100);
  });
});
