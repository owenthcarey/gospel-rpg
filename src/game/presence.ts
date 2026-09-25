import type { Point } from './types';

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Shortest signed turn, including wraparound at north. */
export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
export function turnToward(from: number, to: number, dt: number, rate = 12): number {
  return from + angleDelta(from, to) * (1 - Math.exp(-Math.max(0, dt) * rate));
}
export function ease(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return p * p * (3 - 2 * p);
}
/** Choose an unobscured composition area with the title bar and screen edges reserved. */
export function compositionArea(width: number, height: number, panel?: ScreenRect): ScreenRect {
  const margin = Math.min(24, width * 0.035);
  const full = {
    left: margin,
    top: Math.min(86, height * 0.13),
    right: width - margin,
    bottom: height - margin,
  };
  if (!panel) return full;
  const candidates = [
    { ...full, right: Math.min(full.right, panel.left - margin) },
    { ...full, bottom: Math.min(full.bottom, panel.top - margin) },
    { ...full, left: Math.max(full.left, panel.right + margin) },
  ].filter((r) => r.right - r.left > 80 && r.bottom - r.top > 80);
  return (
    candidates.sort(
      (a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top),
    )[0] ?? full
  );
}

/** Cosmetic time has a bounded step and never catches up after a hidden page. */
export class PresentationClock {
  elapsed = 0;
  advance(dt: number, active: boolean, reduced = false): number {
    if (active && !reduced && Number.isFinite(dt)) this.elapsed += Math.min(0.1, Math.max(0, dt));
    return reduced ? 0 : this.elapsed;
  }
  reset(): void {
    this.elapsed = 0;
  }
}

/** A shared deterministic profile for coherent, inexpensive stylized water. */
export function waterHeight(p: Point, time: number, strength: number): number {
  return (
    strength *
    (Math.sin(p.x * 0.56 + p.z * 0.31 - time * 1.2) * 0.62 +
      Math.sin(p.z * 0.85 - p.x * 0.17 + time * 0.72) * 0.24 +
      Math.sin(p.x * 1.6 + p.z * 0.8 - time * 1.9) * 0.14)
  );
}
export function noise(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
