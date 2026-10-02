import type { Point } from './types';

export interface Obstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export class WalkGrid {
  private readonly blocked = new Set<string>();
  constructor(
    obstacles: readonly Obstacle[] = [],
    terrain: (p: Point) => boolean = () => true,
    readonly min = -24,
    readonly max = 24,
  ) {
    for (let x = this.min; x <= this.max; x++) {
      for (let z = this.min; z <= this.max; z++) {
        const overlaps = obstacles.some(
          (o) => Math.abs(x - o.x) < o.width / 2 + 0.42 && Math.abs(z - o.z) < o.depth / 2 + 0.42,
        );
        if (overlaps || !terrain({ x, z })) this.blocked.add(this.key({ x, z }));
      }
    }
  }
  key(p: Point): string {
    return `${p.x},${p.z}`;
  }
  cell(p: Point): Point {
    return { x: Math.round(p.x), z: Math.round(p.z) };
  }
  walkable(p: Point): boolean {
    const c = this.cell(p);
    return (
      c.x >= this.min &&
      c.x <= this.max &&
      c.z >= this.min &&
      c.z <= this.max &&
      !this.blocked.has(this.key(c))
    );
  }
  nearest(p: Point, radius = 6): Point | null {
    const origin = this.cell(p);
    if (this.walkable(origin)) return origin;
    for (let r = 1; r <= radius; r++) {
      const candidates: Point[] = [];
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          if (Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
          const c = { x: origin.x + x, z: origin.z + z };
          if (this.walkable(c)) candidates.push(c);
        }
      }
      candidates.sort((a, b) => distance(a, p) - distance(b, p));
      if (candidates[0]) return candidates[0];
    }
    return null;
  }
  neighbors(p: Point): Point[] {
    const result: Point[] = [];
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !z) continue;
        const candidate = { x: p.x + x, z: p.z + z };
        if (!this.walkable(candidate)) continue;
        // Diagonal travel may not cut through the corner between two obstacles.
        if (
          x &&
          z &&
          (!this.walkable({ x: p.x + x, z: p.z }) || !this.walkable({ x: p.x, z: p.z + z }))
        )
          continue;
        result.push(candidate);
      }
    return result;
  }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Bounded A*, with an octile heuristic and no diagonal corner cutting. */
export function findPath(grid: WalkGrid, from: Point, to: Point): Point[] {
  const start = grid.nearest(from, 2);
  if (!start) return [];
  const target = grid.cell(to);
  const goals = new Map<string, { point: Point; distance: number }>();
  // A blocked click can have equally near cells on opposite sides of a building.
  // Keep their reachability and travel cost until the search can choose a useful side.
  if (grid.walkable(target)) goals.set(grid.key(target), { point: target, distance: 0 });
  else
    for (let x = -3; x <= 3; x++)
      for (let z = -3; z <= 3; z++) {
        const point = { x: target.x + x, z: target.z + z };
        if (grid.walkable(point))
          goals.set(grid.key(point), { point, distance: distance(point, to) });
      }
  if (!goals.size) return [];
  const closest = Math.min(...[...goals.values()].map((goal) => goal.distance));
  const preferred = [...goals.values()].filter((goal) => goal.distance <= closest + 0.000001);
  const preferredKeys = new Set(preferred.map((goal) => grid.key(goal.point)));
  const open: Point[] = [start];
  const visited = new Set<string>();
  const came = new Map<string, Point>();
  const g = new Map([[grid.key(start), 0]]);
  const estimates = new Map<string, number>();
  const heuristic = (p: Point) => {
    const key = grid.key(p);
    const saved = estimates.get(key);
    if (saved !== undefined) return saved;
    const estimate = Math.min(
      ...preferred.map(({ point }) => {
        const x = Math.abs(p.x - point.x),
          z = Math.abs(p.z - point.z);
        return Math.max(x, z) + (Math.SQRT2 - 1) * Math.min(x, z);
      }),
    );
    estimates.set(key, estimate);
    return estimate;
  };
  const pathTo = (end: Point): Point[] => {
    const path: Point[] = [end];
    let cursor = end;
    while (came.has(grid.key(cursor))) {
      cursor = came.get(grid.key(cursor))!;
      path.unshift(cursor);
    }
    // Include the rounded starting cell so continuous positions cannot clip corners.
    return path;
  };
  let fallback: { point: Point; distance: number; cost: number } | undefined;
  while (open.length) {
    open.sort((a, b) => g.get(grid.key(a))! + heuristic(a) - (g.get(grid.key(b))! + heuristic(b)));
    const current = open.shift()!;
    const key = grid.key(current);
    if (preferredKeys.has(key)) return pathTo(current);
    const goal = goals.get(key);
    const cost = g.get(key)!;
    if (
      goal &&
      (!fallback ||
        goal.distance < fallback.distance - 0.000001 ||
        (Math.abs(goal.distance - fallback.distance) <= 0.000001 && cost < fallback.cost))
    )
      fallback = { ...goal, cost };
    visited.add(key);
    for (const neighbor of grid.neighbors(current)) {
      const nk = grid.key(neighbor);
      if (visited.has(nk)) continue;
      const score = g.get(key)! + distance(current, neighbor);
      if (score >= (g.get(nk) ?? Infinity)) continue;
      came.set(nk, current);
      g.set(nk, score);
      if (!open.some((p) => grid.key(p) === nk)) open.push(neighbor);
    }
  }
  // The closest cells may be isolated by a wall. Use the closest reachable alternative.
  return fallback ? pathTo(fallback.point) : [];
}
