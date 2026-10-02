import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { World } from '../../src/scene/world';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { activeInteractables, isLand, obstacles } from '../../src/content/region';
import { WALK_ROUTES } from '../../src/content/campaign/places';
import { passageObstacles } from '../../src/content/connection/presentation';
import { storedJarObstacles } from '../../src/game/harbor/arrangement';
import { EXPLORATION_REGIONS } from '../../src/game/campaign/types';
import { distance, findPath, WalkGrid } from '../../src/game/pathfinding';
import {
  approachPath,
  clearLine,
  slideStep,
  smoothPath,
  stepPath,
} from '../../src/game/navigation';
import { parseSave } from '../../src/persistence/schema';
import type { GameState, Point } from '../../src/game/types';
import highRaw from '../fixtures/saves/v11-opened-cart-crossing-high.json';
import lowRaw from '../fixtures/saves/v11-opened-cart-crossing-low.json';

// These are unmodified earned states exported after real native opening and manual movement.
// The separate actual-GLB audit isolated the solid cart bed at both saved X/Z positions;
// it sampled bounded actor poses rather than reconstructing the exact High native frame.
const crossings = [
  { quality: 'high', raw: highRaw },
  { quality: 'low', raw: lowRaw },
];
const crossingNames = ['v11-opened-cart-crossing-high.json', 'v11-opened-cart-crossing-low.json'];
const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'))).state;
const earned = parseSave(highRaw).state;
const layout = campaignLayout(earned.region)!;
const from = { x: 1, z: -2 },
  escape = { x: 4, z: -2 };
const movedCart = layoutObstacles(earned).find((o) => o.x === 2.4 && o.z === -2)!;
const previousObstacles = (state: GameState) =>
  layoutObstacles(state).filter(
    (o) => state.region !== 'capernaum-lanes' || o.x !== movedCart.x || o.z !== movedCart.z,
  );
const grid = (state: GameState, previous = false) => {
  const shape = campaignLayout(state.region);
  const bounds = shape?.bounds ?? { min: -24, max: 24 };
  const local = shape
    ? previous
      ? previousObstacles(state)
      : layoutObstacles(state)
    : [...obstacles, ...storedJarObstacles(state)];
  return new WalkGrid(
    [...local, ...passageObstacles(state)],
    shape?.terrain ?? isLand,
    bounds.min,
    bounds.max,
  );
};

// Real World position/update/stop methods; adapters cover scene presentation only.
// No engine, Scene, model, actor or GPU is constructed by these recovery checks.
function standingWorld(state: GameState) {
  return Object.assign(Object.create(World.prototype), {
    state: structuredClone(state),
    layout,
    grid: grid(state),
    position: { ...state.position },
    player: { position: { set: vi.fn() } },
    camera: { target: { copyFrom: vi.fn() } },
    marker: { position: { set: vi.fn() }, setEnabled: vi.fn() },
    routeDots: [{ setEnabled: vi.fn() }],
    keys: new Set(['KeyD']),
    people: new Map(),
    path: [escape],
    destination: 'passage',
    paused: false,
    poseTraveler: vi.fn(),
    showRoute: vi.fn(),
    callbacks: { notice: vi.fn() },
  });
}

describe('the moved handcart after the passage opens', () => {
  it.each(crossings)('accepts and blocks the genuine $quality saved body crossing', ({ raw }) => {
    const original = structuredClone(raw),
      state = parseSave(raw).state;
    expect(state).toEqual(raw.state);
    expect(raw).toEqual(original);
    expect(state.region).toBe('capernaum-lanes');
    expect(state.campaign.walk.gateOpen).toBe(true);
    expect(grid(state, true).walkable(state.position)).toBe(true);
    expect(grid(state).walkable(state.position)).toBe(false);
    expect(layout.terrain(state.position)).toBe(true);
    expect(layout.obstacles).not.toContainEqual(movedCart);
  });

  it('stops the original eastward manual crossing and retains an escape route', () => {
    const before = grid(earned, true),
      after = grid(earned);
    expect(clearLine(before, from, escape)).toBe(true);
    expect(clearLine(after, from, escape)).toBe(false);
    let oldPosition = from,
      position = from;
    for (let frame = 0; frame < 90; frame++) {
      const movement = { x: 3.25 / 60, z: 0 };
      oldPosition = slideStep(before, oldPosition, movement);
      position = slideStep(after, position, movement);
      expect(after.walkable(position)).toBe(true);
    }
    for (const { raw } of crossings) {
      expect(oldPosition.x).toBeGreaterThan(raw.state.position.x);
      expect(position.x).toBeLessThan(raw.state.position.x);
    }
    expect(distance(position, from)).toBeLessThan(0.6);
    expect(findPath(after, position, escape).length).toBeGreaterThan(0);
  });

  it('routes around the cart and arrives at the original opposite click', () => {
    const terrain = grid(earned);
    let position = from,
      path = smoothPath(terrain, from, findPath(terrain, from, escape)),
      arrived = false;
    expect(path.length).toBeGreaterThan(1);
    for (let frame = 0; frame < 600 && !arrived; frame++) {
      const previous = position,
        step = stepPath(position, path, 1 / 60);
      position = step.position;
      path = step.path;
      arrived = step.arrived;
      expect(terrain.walkable(position)).toBe(true);
      expect(clearLine(terrain, previous, position)).toBe(true);
    }
    expect(arrived).toBe(true);
    expect(position).toEqual(escape);
  });

  it('shows a reachable endpoint when the moved cart point is clicked', () => {
    const world = standingWorld({ ...earned, position: from });
    const target = { x: movedCart.x, z: movedCart.z };
    expect(world.walkTo(target)).toBe(true);
    const end = world.path.at(-1)!;
    expect(world.grid.walkable(end)).toBe(true);
    expect(end).not.toEqual(target);
    expect(distance(end, target)).toBeLessThan(2);
    expect(world.marker.position.set).toHaveBeenCalledWith(end.x, expect.any(Number), end.z);
    expect(world.callbacks.notice).not.toHaveBeenCalled();
  });

  for (const mode of ['load', 'update'] as const)
    it.each(crossings)(
      'recovers the genuine $quality crossing on ' + mode + ' without changing earned progress',
      ({ raw }) => {
        const state = parseSave(raw).state,
          original = structuredClone(state),
          world = standingWorld(state);
        if (mode === 'load') world.setPosition(state.position, true);
        else world.update(state);
        const position = world.getPosition();
        expect(world.grid.walkable(position)).toBe(true);
        expect(distance(position, original.position)).toBeLessThan(2);
        expect(position).not.toEqual(original.position);
        expect(world.path).toEqual([]);
        expect(world.destination).toBeUndefined();
        expect(world.keys.size).toBe(0);
        expect(world.marker.setEnabled).toHaveBeenCalledWith(false);
        expect(world.routeDots[0]!.setEnabled).toHaveBeenCalledWith(false);
        expect(world.player.position.set).toHaveBeenCalledWith(position.x, 0, position.z);
        expect(world.state).toEqual(original);
        expect(state).toEqual(original);
        expect(parseSave(raw).state).toEqual(original);
        expect(findPath(world.grid, position, escape).length).toBeGreaterThan(0);
        for (const place of activeInteractables(state)) {
          const path = approachPath(world.grid, position, place);
          expect(path.length, place.id).toBeGreaterThan(0);
          expect(distance(path.at(-1)!, place), place.id).toBeLessThan(2.4);
        }
      },
    );

  it('keeps the closed barrier, opened passage and both original escort routes usable', () => {
    const closed = fixture('v6-living-capernaum.json'),
      outer = fixture('v5-interrupted-walk.json');
    expect(closed.campaign.walk.gateOpen).toBe(false);
    expect(grid(closed).walkable({ x: 0, z: 0 })).toBe(false);
    expect(grid(closed).walkable({ x: movedCart.x, z: movedCart.z })).toBe(true);
    expect(layoutObstacles(closed)).toContainEqual({ x: 0, z: 0, width: 3.4, depth: 1 });
    expect(grid(earned).walkable({ x: 0, z: 0 })).toBe(true);
    expect(clearLine(grid(earned), { x: 0, z: -2 }, { x: 0, z: 2 })).toBe(true);
    for (const [state, route] of [
      [earned, 'passage'],
      [outer, 'outer'],
    ] as const) {
      expect(state.campaign.walk.route).toBe(route);
      const terrain = grid(state);
      let position: Point = state.campaign.walk.position;
      for (const target of WALK_ROUTES[route]) {
        const path = findPath(terrain, position, target);
        expect(path.length, route + JSON.stringify(target)).toBeGreaterThan(0);
        expect(path.at(-1)).toEqual(target);
        expect(terrain.walkable(target)).toBe(true);
        position = target;
      }
    }
  });

  it('preserves historical terrain, old standing cells and every original destination approach', () => {
    for (const name of readdirSync('tests/fixtures/saves').filter(
      (name) => name.endsWith('.json') && !crossingNames.includes(name),
    )) {
      const state = fixture(name),
        original = structuredClone(state);
      if (!EXPLORATION_REGIONS.some((region) => region === state.region)) continue;
      const before = grid(state, true),
        after = grid(state);
      expect(after.walkable(state.position), name).toBe(before.walkable(state.position));
      for (const place of activeInteractables(state)) {
        const oldPath = approachPath(before, before.nearest(state.position)!, place),
          path = approachPath(after, after.nearest(state.position)!, place);
        expect(oldPath.length, name + ':' + place.id).toBeGreaterThan(0);
        expect(path.length, name + ':' + place.id).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, place), name + ':' + place.id).toBeLessThan(2.4);
      }
      expect(state).toEqual(original);
      expect(fixture(name)).toEqual(original);
    }
  });
});
