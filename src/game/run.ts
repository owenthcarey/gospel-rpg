/**
 * Optional running, in the classic manner: a toggle beside the map and an energy store that
 * empties while running and refills while walking or standing. Session-only; never saved.
 */
export const RUN_SPEED = 1.7;
/** Energy spent per meter run; a full store covers about 165 meters. */
const DRAIN_PER_METER = 0.6;
/** Energy recovered per second when not running; a full refill takes about 110 seconds. */
const RECOVERY_PER_SECOND = 0.9;

export interface RunState {
  on: boolean;
  /** 0 to 100. */
  energy: number;
}
export const FRESH_RUN: RunState = { on: false, energy: 100 };

export function toggleRun(s: RunState): RunState {
  return { ...s, on: !s.on && s.energy >= 1 };
}

/** Advance one frame. `metersRun` is the distance actually covered while running. */
export function tickRun(s: RunState, dt: number, metersRun: number): RunState {
  const energy =
    metersRun > 0
      ? Math.max(0, s.energy - metersRun * DRAIN_PER_METER)
      : Math.min(100, s.energy + Math.max(0, dt) * RECOVERY_PER_SECOND);
  return { on: s.on && energy > 0, energy };
}
