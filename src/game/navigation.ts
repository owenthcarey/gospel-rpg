import type { Point } from './types';
import { distance, findPath, type WalkGrid } from './pathfinding';

/** Order approach cells by actual route length, including alternatives around obstacles. */
export function approachPath(grid: WalkGrid, from: Point, target: Point, radius = 2.25): Point[] {
  const paths: Point[][] = [];
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      const candidate = { x: Math.round(target.x) + x, z: Math.round(target.z) + z };
      if (!grid.walkable(candidate) || distance(candidate, target) >= radius) continue;
      const path = findPath(grid, from, candidate);
      if (path.length) paths.push(path);
    }
  }
  const length = (path: Point[]) =>
    path.reduce((sum, p, i) => sum + distance(i ? path[i - 1]! : from, p), 0);
  paths.sort((a, b) => length(a) - length(b));
  return paths[0] ?? [];
}
export interface NavigationStep {
  position: Point;
  path: Point[];
  moving: boolean;
  facing: Point | null;
  arrived: boolean;
}
/** Consume all movement time across cell boundaries, without cutting corners. */
export function stepPath(
  position: Point,
  route: readonly Point[],
  dt: number,
  speed = 3.25,
): NavigationStep {
  let remaining = Math.max(0, dt) * speed;
  let p = { ...position };
  const path = route.map((point) => ({ ...point }));
  let moving = false;
  let facing: Point | null = null;
  while (path.length && remaining > 0) {
    const target = path[0]!;
    const d = distance(p, target);
    if (d > 0.00001) facing = target;
    if (d <= remaining) {
      p = { ...target };
      path.shift();
      remaining -= d;
      moving ||= d > 0.00001;
    } else {
      p = {
        x: p.x + ((target.x - p.x) / d) * remaining,
        z: p.z + ((target.z - p.z) / d) * remaining,
      };
      remaining = 0;
      moving = true;
    }
  }
  return { position: p, path, moving, facing, arrived: route.length > 0 && path.length === 0 };
}
