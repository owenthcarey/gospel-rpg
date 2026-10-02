import { expect, it, vi } from 'vitest';
import { WalkGrid } from '../../src/game/pathfinding';
import { World } from '../../src/scene/world';
import { newGame } from '../../src/game/types';

it('places a blocked-click destination ring on the reachable endpoint of its actual route', () => {
  const marker = { position: { set: vi.fn() }, setEnabled: vi.fn() };
  const notice = vi.fn();
  const world = Object.assign(Object.create(World.prototype), {
    grid: new WalkGrid([{ x: 0, z: 0, width: 1, depth: 100 }]),
    state: newGame(),
    position: { x: 4, z: 0 },
    path: [],
    marker,
    paused: false,
    callbacks: { notice },
    showRoute: vi.fn(),
  });
  expect(world.walkTo({ x: -0.4, z: 0 })).toBe(true);
  expect(world.path.at(-1)).toEqual({ x: 1, z: 0 });
  expect(marker.position.set).toHaveBeenCalledWith(1, expect.any(Number), 0);
  expect(marker.setEnabled).toHaveBeenCalledWith(true);
  expect(notice).not.toHaveBeenCalled();
});

it('retains the current route when a new walkable destination is across an impassable wall', () => {
  const route = [{ x: 3, z: 0 }];
  const marker = { position: { set: vi.fn() }, setEnabled: vi.fn() };
  const notice = vi.fn();
  const world = Object.assign(Object.create(World.prototype), {
    grid: new WalkGrid([{ x: 0, z: 0, width: 1, depth: 100 }]),
    state: newGame(),
    position: { x: 4, z: 0 },
    path: route,
    destination: 'simon',
    marker,
    paused: false,
    callbacks: { notice },
    showRoute: vi.fn(),
  });
  expect(world.walkTo({ x: -1, z: 0 })).toBe(false);
  expect(world.path).toBe(route);
  expect(world.destination).toBe('simon');
  expect(marker.position.set).not.toHaveBeenCalled();
  expect(notice).toHaveBeenCalledWith('That path is out of reach. Try the village paths.');
});
