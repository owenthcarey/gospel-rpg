import type { Point } from '../game/types';
import { distance } from '../game/pathfinding';

export const BENCH_WALK_SPEED = 3.25;
export const BENCH_TURN_TIME = 0.16;
export const BENCH_FRONT_CLEARANCE = 0.75;
export interface BenchMotion {
  time: number;
  route: Point[];
  length: number;
  bench: Point;
  heading: number;
}

/** Cosmetic points relative to the saved navigation root, around the finite bench's left end. */
export function benchMotion(position: Point, bench: Point, heading: number): BenchMotion {
  const relative = (point: Point) => ({ x: point.x - position.x, z: point.z - position.z });
  const front = { x: bench.x - 0.45, z: bench.z + BENCH_FRONT_CLEARANCE };
  const westBack = { x: bench.x - 1.4, z: bench.z - 0.75 };
  const westFront = { x: bench.x - 1.4, z: front.z };
  const westNorth = { x: bench.x - 1.4, z: bench.z + 1.5 };
  const eastBack = { x: bench.x + 1.4, z: westBack.z };
  const eastNorth = { x: bench.x + 1.4, z: westNorth.z };
  const lengthOf = (points: Point[]) =>
    points.slice(1).reduce((sum, point, i) => sum + distance(points[i]!, point), 0);
  let points: Point[];
  if (position.x <= westFront.x) points = [position, westFront, front];
  else if (position.z <= westBack.z) points = [position, westBack, westFront, front];
  else if (position.z >= westNorth.z) points = [position, westNorth, westFront, front];
  else {
    // The north contour also clears the seated neighbor's knees. An east-side
    // start takes the shorter clear contour, rather than cutting through either sitter.
    const south = [position, eastBack, westBack, westFront, front];
    const north = [position, eastNorth, westNorth, westFront, front];
    points = lengthOf(south) <= lengthOf(north) ? south : north;
  }
  const route = points.map(relative);
  const length = route.slice(1).reduce((sum, point, i) => sum + distance(route[i]!, point), 0);
  return { time: 0, route, length, bench: relative(bench), heading };
}

export function benchRoutePose(motion: BenchMotion, traveled: number, retreat = false) {
  const points = retreat ? [...motion.route].reverse() : motion.route;
  let remaining = Math.max(0, Math.min(motion.length, traveled));
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!,
      to = points[i]!,
      length = distance(from, to);
    if (remaining <= length || i === points.length - 1) {
      const amount = length ? Math.min(1, remaining / length) : 1;
      return {
        x: from.x + (to.x - from.x) * amount,
        z: from.z + (to.z - from.z) * amount,
        heading: Math.PI + Math.atan2(to.x - from.x, to.z - from.z),
      };
    }
    remaining -= length;
  }
  return { ...points[0]!, heading: motion.heading };
}

export function benchSeatAmount(phase: number): number {
  const amount = Math.max(0, Math.min(phase / 0.25, 1, (1 - phase) / 0.25));
  return amount * amount * (3 - 2 * amount);
}
