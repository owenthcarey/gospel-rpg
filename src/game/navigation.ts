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

/** Resolve new furniture under a standing point without leaving the nearby interaction. */
export function clearancePosition(grid: WalkGrid, from: Point, anchor?: Point): Point {
  if (grid.walkable(from)) return from;
  if (anchor && distance(from, anchor) < 2.6) {
    const candidates: Point[] = [];
    const origin = grid.cell(from);
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++) {
        const p = { x: origin.x + x, z: origin.z + z };
        if (grid.walkable(p) && distance(p, anchor) < 2.35 && distance(p, from) <= 2)
          candidates.push(p);
      }
    candidates.sort(
      (a, b) => distance(a, from) - distance(b, from) || distance(a, anchor) - distance(b, anchor),
    );
    if (candidates[0]) return candidates[0];
  }
  return grid.nearest(from) ?? from;
}

/**
 * True when a straight walk from `a` to `b` stays inside walkable cells and never cuts a
 * blocked corner, using the same diagonal rule as the A* search.
 */
export function clearLine(grid: WalkGrid, a: Point, b: Point): boolean {
  const d = distance(a, b);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  let prev = grid.cell(a);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = grid.cell({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    if (!grid.walkable(c)) return false;
    if (c.x !== prev.x && c.z !== prev.z) {
      if (!grid.walkable({ x: c.x, z: prev.z }) || !grid.walkable({ x: prev.x, z: c.z }))
        return false;
    }
    prev = c;
  }
  return true;
}
/**
 * String-pull a cell path into the fewest straight legs with a clear line, so the traveler
 * walks diagonally across open ground instead of zig-zagging between cell centres. The
 * final point is unchanged, so arrival and reach are exactly those of the original route.
 */
export function smoothPath(grid: WalkGrid, from: Point, path: readonly Point[]): Point[] {
  if (path.length < 2) return path.map((p) => ({ ...p }));
  const out: Point[] = [];
  let anchor = from;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !clearLine(grid, anchor, path[j]!)) j--;
    out.push({ ...path[j]! });
    anchor = path[j]!;
    i = j + 1;
  }
  return out;
}
