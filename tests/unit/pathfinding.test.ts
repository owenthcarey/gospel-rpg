import { describe, expect, it } from 'vitest';
import { buildings, interactables, isLand, obstacles } from '../../src/content/region';
import { distance, findPath, WalkGrid } from '../../src/game/pathfinding';

describe('walkability and A*', () => {
  it('takes a shortest diagonal path across open terrain', () => {
    const grid = new WalkGrid();
    const path = findPath(grid, { x: 0, z: 0 }, { x: 4, z: 4 });
    expect(path).toHaveLength(5);
    expect(path.reduce((sum, p, i) => sum + (i ? distance(path[i - 1]!, p) : 0), 0)).toBeCloseTo(
      4 * Math.SQRT2,
    );
  });
  it('routes around a building without corner cutting', () => {
    const grid = new WalkGrid([{ x: 0, z: 0, width: 3, depth: 5 }]);
    const path = findPath(grid, { x: -4, z: 0 }, { x: 4, z: 0 });
    expect(path.length).toBeGreaterThan(8);
    for (let i = 0; i < path.length; i++) {
      expect(grid.walkable(path[i]!)).toBe(true);
      if (i) {
        const a = path[i - 1]!,
          b = path[i]!;
        expect(grid.walkable({ x: a.x, z: b.z })).toBe(true);
        expect(grid.walkable({ x: b.x, z: a.z })).toBe(true);
      }
    }
  });
  it('cannot escape the bounds or cross an impassable barrier', () => {
    const grid = new WalkGrid([{ x: 0, z: 0, width: 1, depth: 100 }]);
    expect(findPath(grid, { x: -3, z: 0 }, { x: 3, z: 0 })).toEqual([]);
    expect(findPath(grid, { x: 0, z: 0 }, { x: 1000, z: 0 })).toEqual([]);
    expect(grid.walkable({ x: -25, z: 0 })).toBe(false);
  });
  it('finds a nearby walkable cell for a blocked destination', () => {
    const grid = new WalkGrid([{ x: 0, z: 0, width: 2, depth: 2 }]);
    const path = findPath(grid, { x: -5, z: 0 }, { x: 0, z: 0 });
    expect(path.length).toBeGreaterThan(0);
    expect(grid.walkable(path.at(-1)!)).toBe(true);
  });
  it('keeps every authored interaction reachable from the arrival point', () => {
    const grid = new WalkGrid(obstacles, isLand);
    for (const target of interactables) {
      const approaches = [];
      for (let x = -2; x <= 2; x++)
        for (let z = -2; z <= 2; z++) {
          const p = { x: target.x + x, z: target.z + z };
          if (grid.walkable(p) && distance(p, target) < 2.25) approaches.push(p);
        }
      expect(
        approaches.some((p) => findPath(grid, { x: -1, z: -3 }, p).length > 0),
        target.id,
      ).toBe(true);
    }
    for (const building of buildings) expect(grid.walkable(building)).toBe(false);
    expect(grid.walkable({ x: 14, z: 0 })).toBe(false);
  });
});
