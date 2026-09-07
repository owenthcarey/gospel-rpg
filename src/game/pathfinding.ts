import type { Point } from './types';

export interface Obstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export class WalkGrid {
  readonly min = -24;
  readonly max = 24;
  private readonly blocked = new Set<string>();
  constructor(obstacles: readonly Obstacle[] = [], terrain: (p: Point) => boolean = () => true) {
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
  const goal = grid.nearest(to, 3);
  if (!start || !goal) return [];
  const open: Point[] = [start];
  const visited = new Set<string>();
  const came = new Map<string, Point>();
  const g = new Map([[grid.key(start), 0]]);
  const heuristic = (p: Point) => {
    const x = Math.abs(p.x - goal.x),
      z = Math.abs(p.z - goal.z);
    return Math.max(x, z) + (Math.SQRT2 - 1) * Math.min(x, z);
  };
  while (open.length) {
    open.sort((a, b) => g.get(grid.key(a))! + heuristic(a) - (g.get(grid.key(b))! + heuristic(b)));
    const current = open.shift()!;
    const key = grid.key(current);
    if (key === grid.key(goal)) {
      const path: Point[] = [current];
      let cursor = current;
      while (came.has(grid.key(cursor))) {
        cursor = came.get(grid.key(cursor))!;
        path.unshift(cursor);
      }
      // Include the rounded starting cell so continuous positions cannot clip corners.
      return path;
    }
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
  return [];
}
