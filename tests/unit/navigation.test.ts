import { expect, it } from 'vitest';
import { approachPath, stepPath } from '../../src/game/navigation';
import { WalkGrid, distance } from '../../src/game/pathfinding';
it('consumes remaining travel time across cells without frame-dependent slowdown', () => {
  const path = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
  ];
  const oneFrame = stepPath({ x: 0, z: 0 }, path, 0.5);
  let manyFrames = { position: { x: 0, z: 0 }, path };
  for (let i = 0; i < 10; i++) manyFrames = stepPath(manyFrames.position, manyFrames.path, 0.05);
  expect(distance(oneFrame.position, manyFrames.position)).toBeLessThan(0.00001);
  expect(oneFrame.position.x).toBeCloseTo(1.625);
  expect(oneFrame.path).toEqual([{ x: 2, z: 0 }]);
  expect(path).toHaveLength(3);
});
it('stops at the final point without extending movement beyond the destination', () => {
  const result = stepPath({ x: 0, z: 0 }, [{ x: 0, z: 1 }], 4);
  expect(result.position).toEqual({ x: 0, z: 1 });
  expect(result.arrived).toBe(true);
  expect(result.path).toEqual([]);
  expect(stepPath(result.position, result.path, 1).moving).toBe(false);
});
it('approaches an obstacle from a reachable side', () => {
  const grid = new WalkGrid([{ x: 0, z: 0, width: 2, depth: 2 }]);
  const path = approachPath(grid, { x: -5, z: 0 }, { x: 0, z: 0 });
  expect(path.length).toBeGreaterThan(0);
  expect(distance(path.at(-1)!, { x: 0, z: 0 })).toBeLessThan(2.25);
  expect(path.at(-1)!.x).toBeLessThan(0);
  expect(approachPath(grid, { x: -5, z: 0 }, { x: 100, z: 100 })).toEqual([]);
});
