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

/** Compare almost coincident boundary crossings without widening either blocked cell. */
function crossingOrder(a: Point, b: Point, x: number, z: number, stableRoute: boolean): number {
  const tx = Math.abs((x - a.x) / (b.x - a.x));
  const tz = Math.abs((z - a.z) / (b.z - a.z));
  // For the geometric predicate, this bound selects exact arithmetic without widening
  // corners. Smoothing avoids a blocked corner when interpolation could erase its
  // representable near-miss offset; ordinary open diagonals remain direct.
  if (Math.abs(tx - tz) > 8 * Number.EPSILON * Math.max(tx, tz)) return tx < tz ? -1 : 1;
  if (stableRoute) return 0;
  const bits = new DataView(new ArrayBuffer(8));
  // Every finite IEEE-754 value is an integer multiple of 2^-1074. Only the ambiguous
  // comparison takes this path; integer cross-products preserve even subnormal offsets.
  const units = (value: number): bigint => {
    bits.setFloat64(0, value);
    const encoded = bits.getBigUint64(0);
    const exponent = Number((encoded >> 52n) & 0x7ffn);
    const fraction = encoded & 0xfffffffffffffn;
    const magnitude = exponent ? (fraction | 0x10000000000000n) << BigInt(exponent - 1) : fraction;
    return encoded >> 63n ? -magnitude : magnitude;
  };
  const abs = (value: bigint) => (value < 0n ? -value : value);
  const ax = units(a.x),
    az = units(a.z);
  const left = abs(units(x) - ax) * abs(units(b.z) - az);
  const right = abs(units(z) - az) * abs(units(b.x) - ax);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Traverse the half-cell boundaries crossed by a straight walk. Diagonal movement
 * may not touch a blocked grid corner, including at either endpoint; an exact vertex
 * cannot evade the corner rule by splitting the same diagonal into two shorter walks.
 * Purely axial movement keeps Math.round's half-open boundary ownership.
 */
function traversableLine(grid: WalkGrid, a: Point, b: Point, stableRoute: boolean): boolean {
  if (![a.x, a.z, b.x, b.z].every(Number.isFinite) || !grid.walkable(a) || !grid.walkable(b))
    return false;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const sx = Math.sign(dx),
    sz = Math.sign(dz);
  if (!sx && !sz) return true;
  if (sx && sz) {
    for (const point of [a, b]) {
      const x = Math.floor(point.x),
        z = Math.floor(point.z);
      if (point.x === x + 0.5 && point.z === z + 0.5)
        for (const cell of [
          { x, z },
          { x: x + 1, z },
          { x, z: z + 1 },
          { x: x + 1, z: z + 1 },
        ])
          if (!grid.walkable(cell)) return false;
    }
  }
  let cell = grid.cell(a);
  const end = grid.cell(b);
  // Each iteration consumes at least one boundary; closed endpoints add at most two.
  const limit = Math.abs(end.x - cell.x) + Math.abs(end.z - cell.z) + 2;
  for (let crossings = 0; crossings < limit; crossings++) {
    const x = cell.x + sx * 0.5,
      z = cell.z + sz * 0.5;
    const crossesX = !!sx && (sx > 0 ? x <= b.x : x >= b.x);
    const crossesZ = !!sz && (sz > 0 ? z <= b.z : z >= b.z);
    if (!crossesX && !crossesZ) return true;
    const order = crossesX && crossesZ ? crossingOrder(a, b, x, z, stableRoute) : crossesX ? -1 : 1;
    if (!order) {
      const next = { x: cell.x + sx, z: cell.z + sz };
      if (
        !grid.walkable({ x: next.x, z: cell.z }) ||
        !grid.walkable({ x: cell.x, z: next.z }) ||
        !grid.walkable(next)
      )
        return false;
      if (x === b.x && z === b.z) return true;
      cell = next;
    } else {
      // A negative axial crossing at the endpoint belongs to its current rounded cell.
      // Both endpoint ownership and any diagonal endpoint corner were checked above.
      if (order < 0 ? x === b.x : z === b.z) return true;
      cell = order < 0 ? { x: cell.x + sx, z: cell.z } : { x: cell.x, z: cell.z + sz };
      if (!grid.walkable(cell)) return false;
    }
  }
  return false;
}

/** Exact cell/corner legality; near misses retain their mathematical side. */
export function clearLine(grid: WalkGrid, a: Point, b: Point): boolean {
  return traversableLine(grid, a, b, false);
}

/** Let manual movement follow a wall when its diagonal direction is blocked. */
export function slideStep(grid: WalkGrid, from: Point, movement: Point): Point {
  const next = { x: from.x + movement.x, z: from.z + movement.z };
  if (clearLine(grid, from, next)) return next;
  const axes = [
    { x: next.x, z: from.z },
    { x: from.x, z: next.z },
  ];
  if (Math.abs(movement.z) > Math.abs(movement.x)) axes.reverse();
  return axes.find((point) => clearLine(grid, from, point)) ?? from;
}
/**
 * String-pull a cell path into the fewest straight legs with a clear line, so the traveler
 * walks diagonally across open ground instead of zig-zagging between cell centres. The
 * final point is unchanged, so arrival and reach are exactly those of the original route.
 */
export function smoothPath(grid: WalkGrid, from: Point, path: readonly Point[]): Point[] {
  const out: Point[] = [];
  let anchor = from;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j >= i && !traversableLine(grid, anchor, path[j]!, true)) j--;
    if (j < i) {
      const target = path[i]!;
      // A legal continuous start can be a mixed half-cell vertex beside a blocked
      // cell. Leave it axially before walking toward its centre; validate both legs.
      const connector = [
        { x: target.x, z: anchor.z },
        { x: anchor.x, z: target.z },
      ].find(
        (point) =>
          traversableLine(grid, anchor, point, true) && traversableLine(grid, point, target, true),
      );
      if (!connector) return [];
      out.push(connector);
      anchor = connector;
      j = i;
    }
    out.push({ ...path[j]! });
    anchor = path[j]!;
    i = j + 1;
  }
  return out;
}
