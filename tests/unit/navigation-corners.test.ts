import { describe, expect, it } from 'vitest';
import genuineOpenedHigh from '../fixtures/saves/v11-opened-cart-crossing-high.json';
import { parseSave } from '../../src/persistence/schema';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { passageObstacles } from '../../src/content/connection/presentation';
import { WalkGrid, findPath, distance } from '../../src/game/pathfinding';
import { clearLine, smoothPath, stepPath } from '../../src/game/navigation';
import type { Point } from '../../src/game/types';

const without = (blocked: Point, min = -4, max = 4) =>
  new WalkGrid([], (p) => p.x !== blocked.x || p.z !== blocked.z, min, max);
const pieces = (a: Point, b: Point) =>
  [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1].map((t) => ({
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  }));

describe('straight-walk corner traversal', () => {
  const state = parseSave(genuineOpenedHigh).state;
  const layout = campaignLayout(state.region)!;
  const actualGrid = new WalkGrid(
    [...layoutObstacles(state), ...passageObstacles(state)],
    layout.terrain,
    layout.bounds.min,
    layout.bounds.max,
  );
  // Authentic High AFTER approach, preserved from the native trace; earned state
  // remains the original genuine opening fixture. These are observations, not saves.
  const nativeA = { x: -1.5303535352425595, z: 0.5303535352425595 };
  const nativeB = { x: -1.3701761716274277, z: 0.37017617162742766 };

  it('rejects the actual short native approach and its formerly accepted full leg', () => {
    expect(actualGrid.walkable(nativeA)).toBe(true);
    expect(actualGrid.walkable(nativeB)).toBe(true);
    expect(actualGrid.walkable({ x: -2, z: 0 })).toBe(false);
    for (const [a, b] of [
      [nativeA, nativeB],
      [
        { x: -2, z: 1 },
        { x: -1, z: 0 },
      ],
    ]) {
      expect(clearLine(actualGrid, a!, b!)).toBe(false);
      expect(clearLine(actualGrid, b!, a!)).toBe(false);
    }
  });

  it('keeps the legal west approach reachable using source route legs and real movement steps', () => {
    let position = { x: -2, z: 1 };
    const target = { x: 0, z: -2 };
    expect(actualGrid.walkable(target)).toBe(true);
    expect(actualGrid.walkable({ x: 1, z: -2 })).toBe(false);
    let route = smoothPath(actualGrid, position, findPath(actualGrid, position, target));
    expect(route.length).toBeGreaterThan(0);
    let anchor = position;
    for (const point of route) {
      expect(clearLine(actualGrid, anchor, point)).toBe(true);
      anchor = point;
    }
    for (let frame = 0; route.length && frame < 300; frame++) {
      const previous = position;
      const step = stepPath(position, route, 1 / 60);
      position = step.position;
      route = step.path;
      expect(actualGrid.walkable(position)).toBe(true);
      expect(clearLine(actualGrid, previous, position)).toBe(true);
    }
    expect(route).toEqual([]);
    expect(distance(position, target)).toBeLessThan(0.000001);
  });

  it.each([
    [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
      { x: 1, z: 0 },
    ],
    [
      { x: -2, z: 1 },
      { x: -1, z: 0 },
      { x: -2, z: 0 },
    ],
    [
      { x: -1, z: -1 },
      { x: 0, z: 0 },
      { x: -1, z: 0 },
    ],
    [
      { x: 1, z: -2 },
      { x: 0, z: -1 },
      { x: 0, z: -2 },
    ],
  ])('enforces closed diagonal corners at signed half-cell endpoints %j → %j', (a, b, blocked) => {
    const grid = without(blocked);
    const vertex = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    for (const [from, to] of [
      [a, b],
      [a, vertex],
      [vertex, b],
    ]) {
      expect(clearLine(grid, from!, to!)).toBe(false);
      expect(clearLine(grid, to!, from!)).toBe(false);
    }
  });

  it.each([
    [
      { x: 0, z: 0 },
      { x: 1, z: 1 - Number.EPSILON },
      { x: 0, z: 1 },
    ],
    [
      { x: 0, z: 0 },
      { x: 1, z: 1 + Number.EPSILON },
      { x: 1, z: 0 },
    ],
    [
      { x: 0, z: Number.MIN_VALUE },
      { x: 1, z: 1 },
      { x: 1, z: 0 },
    ],
    [
      { x: Number.MIN_VALUE, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ],
  ])(
    'allows a representable non-simultaneous crossing beside a blocked corner %j → %j',
    (a, b, blocked) => {
      const grid = without(blocked);
      expect(clearLine(grid, a, b)).toBe(true);
      expect(clearLine(grid, b, a)).toBe(true);
    },
  );

  it.each([
    [
      { x: -0.5, z: -1 },
      { x: -0.5, z: 1 },
      { x: -1, z: 0 },
    ],
    [
      { x: 0.5, z: -1 },
      { x: 0.5, z: 1 },
      { x: 0, z: 0 },
    ],
    [
      { x: -1, z: -0.5 },
      { x: 1, z: -0.5 },
      { x: 0, z: -1 },
    ],
    [
      { x: -1, z: 0.5 },
      { x: 1, z: 0.5 },
      { x: 0, z: 0 },
    ],
  ])('preserves boundary-aligned axial ownership %j → %j', (a, b, blocked) => {
    const grid = without(blocked);
    expect(clearLine(grid, a, b)).toBe(true);
    expect(clearLine(grid, b, a)).toBe(true);
    const divided = pieces(a, b);
    for (let i = 1; i < divided.length; i++)
      expect(clearLine(grid, divided[i - 1]!, divided[i]!)).toBe(true);
  });

  it('rejects a blocked start, including zero movement and reversed travel', () => {
    const grid = without({ x: 0, z: 0 });
    for (const endpoint of [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]) {
      expect(clearLine(grid, { x: 0, z: 0 }, endpoint)).toBe(false);
      expect(clearLine(grid, endpoint, { x: 0, z: 0 })).toBe(false);
    }
    expect(clearLine(grid, { x: 1, z: 0 }, { x: 1, z: 0 })).toBe(true);
  });

  it('preserves exact axial endpoints and bounds, and rejects non-finite inputs', () => {
    const grid = new WalkGrid([], () => true, -2, 2);
    expect(clearLine(grid, { x: -2, z: 0 }, { x: -2.5, z: 0 })).toBe(true);
    expect(clearLine(grid, { x: -2.5, z: 0 }, { x: 2.49, z: 0 })).toBe(true);
    expect(clearLine(grid, { x: 0, z: 0 }, { x: 2.5, z: 0 })).toBe(false);
    expect(clearLine(grid, { x: -2.5, z: 0 }, { x: -2.51, z: 0 })).toBe(false);
    expect(clearLine(grid, { x: 0, z: 0 }, { x: Number.NaN, z: 0 })).toBe(false);
    expect(clearLine(grid, { x: Number.POSITIVE_INFINITY, z: 0 }, { x: 0, z: 0 })).toBe(false);
  });

  it('agrees across subdivisions of legal open diagonals and blocked corner contact', () => {
    for (const grid of [new WalkGrid(), without({ x: 1, z: 0 })]) {
      const a = { x: 0, z: 0 },
        b = { x: 1, z: 1 };
      const divided = pieces(a, b);
      const accepted = divided.slice(1).every((point, i) => clearLine(grid, divided[i]!, point));
      expect(accepted).toBe(clearLine(grid, a, b));
      expect(accepted).toBe(clearLine(grid, b, a));
    }
  });

  it.each([
    [{ x: -1, z: 1 }],
    [
      { x: -1, z: 1 },
      { x: -1, z: 2 },
    ],
  ])(
    'leaves a legal mixed-tie saved start through a legal axial connector for path %j',
    (...path) => {
      const grid = without({ x: -2, z: 0 });
      const from = { x: -1.5, z: 0.5 };
      const target = path.at(-1)!;
      expect(grid.walkable(from)).toBe(true);
      expect(clearLine(grid, from, target)).toBe(false);
      const route = smoothPath(grid, from, path);
      expect(route.length).toBeGreaterThanOrEqual(2);
      expect(route.at(-1)).toEqual(target);
      let anchor = from;
      for (const point of route) {
        expect(grid.walkable(point)).toBe(true);
        expect(clearLine(grid, anchor, point)).toBe(true);
        anchor = point;
      }
      expect(route[0]!.x === from.x || route[0]!.z === from.z).toBe(true);
    },
  );

  it('preserves the legal west standing target from an exact saved half-cell vertex', () => {
    const from = { x: -1.5, z: 0.5 },
      target = { x: 0, z: -2 };
    expect(actualGrid.walkable(target)).toBe(true);
    expect(actualGrid.walkable({ x: 1, z: -2 })).toBe(false);
    expect(actualGrid.walkable(from)).toBe(true);
    const raw = findPath(actualGrid, from, target);
    expect(raw[0]).toEqual(actualGrid.cell(from));
    const route = smoothPath(actualGrid, from, raw);
    expect(route.length).toBeGreaterThan(0);
    expect(route.at(-1)).toEqual(target);
    let anchor = from;
    for (const point of route) {
      expect(clearLine(actualGrid, anchor, point)).toBe(true);
      anchor = point;
    }
    let position = from,
      remaining = route;
    for (let frame = 0; remaining.length && frame < 300; frame++) {
      const step = stepPath(position, remaining, 1 / 60);
      expect(actualGrid.walkable(step.position)).toBe(true);
      expect(clearLine(actualGrid, position, step.position)).toBe(true);
      position = step.position;
      remaining = step.path;
    }
    expect(remaining).toEqual([]);
    expect(position).toEqual(target);
  });

  it.each([
    [
      { x: Number.MIN_VALUE, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ],
    [
      { x: 0, z: Number.MIN_VALUE },
      { x: 1, z: 1 },
      { x: 1, z: 0 },
    ],
    [
      { x: Number.EPSILON, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ],
    [
      { x: 0, z: Number.EPSILON },
      { x: 1, z: 1 },
      { x: 1, z: 0 },
    ],
  ])(
    'keeps real routed movement clear when a representable near-miss can lose precision %j → %j',
    (from, target, blocked) => {
      const grid = without(blocked);
      expect(clearLine(grid, from, target)).toBe(true);
      let position = from,
        route = smoothPath(grid, from, findPath(grid, from, target));
      expect(route.at(-1)).toEqual(target);
      for (let frame = 0; route.length && frame < 180; frame++) {
        const step = stepPath(position, route, 1 / 60);
        expect(grid.walkable(step.position)).toBe(true);
        expect(
          clearLine(grid, position, step.position),
          JSON.stringify({ frame, from: position, to: step.position }),
        ).toBe(true);
        position = step.position;
        route = step.path;
      }
      expect(route).toEqual([]);
      expect(position).toEqual(target);
    },
  );

  it('retains direct diagonals on open ground even with numerically tiny offsets', () => {
    const grid = new WalkGrid();
    for (const from of [
      { x: Number.MIN_VALUE, z: 0 },
      { x: 0, z: Number.EPSILON },
    ]) {
      const target = { x: 1, z: 1 };
      expect(clearLine(grid, from, target)).toBe(true);
      expect(smoothPath(grid, from, [target])).toEqual([target]);
    }
  });
});
