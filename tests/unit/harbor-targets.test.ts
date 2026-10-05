import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSave, makeSave } from '../../src/persistence/schema';
import { activeInteractables, isLand, obstacles } from '../../src/content/region';
import { harborPlace, harborPlaces } from '../../src/content/harbor/places';
import { workTarget } from '../../src/content/exploration/work';
import { harborActions } from '../../src/content/harbor/actions';
import { harborBlocker } from '../../src/game/harbor/progress';
import { harborRevision } from '../../src/game/harbor/types';
import { transition } from '../../src/game/quest';
import { approachPath, stepPath } from '../../src/game/navigation';
import { distance, findPath, WalkGrid } from '../../src/game/pathfinding';
import type { GameState, Point } from '../../src/game/types';

const grid = new WalkGrid(obstacles, isLand);
function fixture(name: string): GameState {
  const raw = JSON.parse(readFileSync(`tests/fixtures/saves/${name}.json`, 'utf8'));
  const state = parseSave(raw).state;
  expect(state).toEqual(raw.state);
  return state;
}
function walk(s: GameState, point: Point): GameState {
  expect(grid.walkable(point)).toBe(true);
  const path = findPath(grid, s.position, point);
  expect(path.length).toBeGreaterThan(0);
  const movement = stepPath(s.position, path, 100);
  expect(movement.arrived).toBe(true);
  expect(movement.position).toEqual(point);
  return { ...s, position: movement.position };
}
function approach(s: GameState, id: string): GameState {
  const target = activeInteractables(s).find((p) => p.id === id)!;
  const path = approachPath(grid, s.position, target);
  expect(path.length).toBeGreaterThan(0);
  return walk(s, path.at(-1)!);
}

describe('physical working-landing targets from original journeys', () => {
  it('lets the already-near rack traveler turn the actual board without a southward detour', () => {
    const original = fixture('v11-landing-observed');
    const before = structuredClone(original);
    const work = workTarget(original, 'harbor-plank')!;
    expect(grid.walkable(original.position)).toBe(true);
    expect(work.near).toBe(true);
    expect(distance(original.position, work.point)).toBeLessThan(2.35);
    expect(approachPath(grid, original.position, work.point)).toEqual([original.position]);
    const action = work.actions.find((a) => a.id === 'turn')!;
    expect(action.blocker).toBeUndefined();
    expect(action.event).toEqual({
      type: 'harbor-action',
      id: 'turn',
      expected: harborRevision(original.harbor),
    });
    const changed = transition(original, action.event);
    expect(changed).toEqual({ ...before, harbor: { ...before.harbor, turn: 0 } });
    expect(makeSave(changed).state).toEqual(changed);
    expect(transition(changed, action.event)).toBe(changed);
    expect(original).toEqual(before);
  });

  it('follows an earned north placement and refuses turning it remotely from the old south stand', () => {
    const original = fixture('v11-landing-interrupted');
    const before = structuredClone(original);
    const south = approach(original, 'harbor-plank');
    const place = harborActions(south).find((a) => a.id === 'plank-north')!;
    expect(place.blocker).toBeUndefined();
    const north = transition(south, place.event);
    expect(north).toEqual({ ...south, harbor: { ...south.harbor, plank: 'north' } });
    expect(transition(north, place.event)).toBe(north);
    const near = walk(north, { x: 4, z: -10 });
    const work = workTarget(near, 'harbor-plank')!;
    expect(work.near).toBe(true);
    expect(distance(near.position, work.point)).toBeLessThan(2.35);
    expect(approachPath(grid, near.position, work.point)).toEqual([near.position]);
    const turn = work.actions.find((a) => a.id === 'turn')!;
    expect(turn.blocker).toBeUndefined();
    const changed = transition(near, turn.event);
    expect(changed).toEqual({ ...near, harbor: { ...near.harbor, turn: 0 } });
    expect(makeSave(changed).state).toEqual(changed);
    expect(transition(changed, turn.event)).toBe(changed);
    const oldStand = walk(north, before.position);
    expect(workTarget(oldStand, 'harbor-plank')?.near).toBe(false);
    expect(harborBlocker(oldStand, 'turn')).toBe('Approach this part of the landing to act.');
    expect(transition(oldStand, turn.event)).toBe(oldStand);
    expect(original).toEqual(before);
  });

  it.each([
    ['v11-landing-observed', 'nets', 'harbor-nets', { x: 1, z: -14 }],
    ['v11-landing-interrupted', 'jars', 'harbor-jars', { x: 7, z: -14 }],
  ] as const)(
    'moves %s %s cargo with physical reach, preserves progress and rejects the old revision',
    (name, cargo, id, stand) => {
      const original = fixture(name);
      const before = structuredClone(original);
      const near = walk(original, stand);
      const work = workTarget(near, id)!;
      expect(work.near).toBe(true);
      expect(distance(near.position, work.point)).toBeLessThan(2.8);
      const action = work.actions.find((a) => a.id === 'cargo-' + cargo)!;
      expect(action.blocker).toBeUndefined();
      expect(action.event).toEqual({
        type: 'harbor-action',
        id: 'cargo-' + cargo,
        expected: harborRevision(near.harbor),
      });
      const stored = transition(near, action.event);
      expect(stored).toEqual({
        ...near,
        harbor: { ...near.harbor, cargo: { ...near.harbor.cargo, [cargo]: true } },
      });
      expect(makeSave(stored).state).toEqual(stored);
      expect(transition(stored, action.event)).toBe(stored);
      const returning = approach(stored, id);
      const restore = harborActions(returning).find((a) => a.id === 'cargo-' + cargo)!;
      expect(restore.label).toContain('Return');
      expect(restore.blocker).toBeUndefined();
      expect(restore.event.expected).not.toBe(harborRevision(near.harbor));
      const restored = transition(returning, restore.event);
      expect(restored).toEqual({
        ...returning,
        harbor: { ...returning.harbor, cargo: { ...returning.harbor.cargo, [cargo]: false } },
      });
      expect(makeSave(restored).state).toEqual(restored);
      expect(original).toEqual(before);
    },
  );

  it('retains authored identities, static shore landmarks and shared framing through completed original arrangements', () => {
    const identities = structuredClone(harborPlaces);
    for (const name of ['v11-landing-north', 'v11-landing-south']) {
      const state = fixture(name);
      const before = structuredClone(state);
      for (const id of ['harbor-plank', 'harbor-nets', 'harbor-jars']) {
        const active = activeInteractables(state).find((p) => p.id === id)!;
        const authored = harborPlaces.find((p) => p.id === id)!;
        expect({ ...active, x: authored.x, z: authored.z }).toEqual(authored);
        const work = workTarget(state, id)!;
        expect(work.point).toEqual({ x: active.x, z: active.z });
        expect(work.focus).toEqual({ center: { x: 3.8, z: -13.1 }, radius: 5.4 });
        expect(work.actions).toEqual([]);
      }
      for (const id of ['eliab', 'harbor-entrance', 'harbor-water'])
        expect(harborPlace(id, state.harbor)).toEqual(harborPlace(id));
      expect(state).toEqual(before);
    }
    expect(harborPlaces).toEqual(identities);
  });
});
