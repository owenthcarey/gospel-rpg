import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { activeInteractables, obstacles, isLand } from '../../src/content/region';
import { EXPLORATION_REGIONS } from '../../src/game/campaign/types';
import { distance, findPath, WalkGrid } from '../../src/game/pathfinding';
import { approachPath, slideStep, smoothPath, stepPath } from '../../src/game/navigation';
import type { GameState } from '../../src/game/types';
import { parseSave } from '../../src/persistence/schema';
import { posedVertices } from '../helpers/posed-geometry';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (
      source: string,
      scene: Scene,
      options?: import('@babylonjs/core/Loading/sceneLoader').LoadAssetContainerOptions,
    ) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { ...options, pluginExtension: '.glb' },
      ),
  };
});

const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'))).state;
// The genuine old crossing intentionally becomes blocked and has its own recovery cases below.
const originalExplorationFixtures = readdirSync('tests/fixtures/saves')
  .filter((name) => name.endsWith('.json') && name !== 'v11-lanes-crate-crossing.json')
  .map((name) => ({ name, state: fixture(name) }))
  .filter(({ state }) => EXPLORATION_REGIONS.some((region) => region === state.region));
const earned = fixture('v6-living-capernaum.json');
const layout = campaignLayout(earned.region)!;
const crate = layout.decor.find((p) => p.asset === 'crate')!;
const from = { x: crate.x, z: crate.z - 2 };
const target = { x: crate.x, z: crate.z + 2 };
const previousObstacles = (state: GameState) =>
  layoutObstacles(state).filter((o) => o.x !== crate.x || o.z !== crate.z);
const grid = (state = earned) =>
  new WalkGrid(layoutObstacles(state), layout.terrain, layout.bounds.min, layout.bounds.max);
let engine: NullEngine;
afterEach(() => engine?.dispose());

async function importedCrate() {
  engine = new NullEngine();
  const scene = new Scene(engine);
  const library = new AssetLibrary(scene);
  await library.load(['crate'], () => {});
  const world = Object.assign(Object.create(World.prototype), { library, layout, state: earned });
  const model = world.place(crate) as TransformNode;
  const points = posedVertices(model);
  return {
    model,
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

function standingWorld(state: GameState) {
  const scene = new Scene(engine);
  return Object.assign(Object.create(World.prototype), {
    state: structuredClone(state),
    layout,
    grid: grid(state),
    position: { ...state.position },
    player: new TransformNode('standing traveler', scene),
    camera: { target: { copyFrom: vi.fn() } },
    marker: { position: { set: vi.fn() }, setEnabled: vi.fn() },
    routeDots: [],
    keys: new Set<string>(),
    people: new Map(),
    path: [target],
    destination: 'lane-note',
    paused: false,
    poseTraveler: vi.fn(),
    showRoute: vi.fn(),
    callbacks: { notice: vi.fn() },
  });
}

describe('the solid outer-lane crate', () => {
  it('uses a tight footprint for the imported crate while keeping historical terrain unchanged', async () => {
    const model = await importedCrate();
    const footprint = layoutObstacles(earned).find((o) => o.x === crate.x && o.z === crate.z)!;
    expect(footprint.x - footprint.width / 2 - 1e-6).toBeLessThanOrEqual(model.minX);
    expect(footprint.x + footprint.width / 2 + 1e-6).toBeGreaterThanOrEqual(model.maxX);
    expect(footprint.z - footprint.depth / 2 - 1e-6).toBeLessThanOrEqual(model.minZ);
    expect(footprint.z + footprint.depth / 2 + 1e-6).toBeGreaterThanOrEqual(model.maxZ);
    expect(footprint.width - (model.maxX - model.minX)).toBeLessThan(0.06);
    expect(footprint.depth - (model.maxZ - model.minZ)).toBeLessThan(0.06);
    expect(model.model.getChildMeshes().every((mesh) => !mesh.isPickable)).toBe(true);
    expect(layout.obstacles.some((o) => o.x === crate.x && o.z === crate.z)).toBe(false);
    expect(grid().walkable(crate)).toBe(false);
  });

  it('routes along the original outer lane without entering imported wood and reaches the clicked point', async () => {
    const model = await importedCrate();
    const terrain = grid();
    let position = from,
      path = smoothPath(terrain, from, findPath(terrain, from, target)),
      arrived = false;
    for (let frame = 0; frame < 600 && !arrived; frame++) {
      const step = stepPath(position, path, 1 / 60);
      position = step.position;
      path = step.path;
      arrived = step.arrived;
      expect(terrain.walkable(position)).toBe(true);
      expect(
        position.x > model.minX &&
          position.x < model.maxX &&
          position.z > model.minZ &&
          position.z < model.maxZ,
      ).toBe(false);
    }
    expect(arrived).toBe(true);
    expect(position).toEqual(target);
  });

  it('stops manual forward movement before the original crate boards', async () => {
    const model = await importedCrate();
    const terrain = grid();
    let position = from;
    for (let frame = 0; frame < 120; frame++)
      position = slideStep(terrain, position, { x: 0, z: 3.25 / 60 });
    expect(position.z).toBeLessThan(model.minZ);
    expect(terrain.walkable(position)).toBe(true);
  });

  it('shows a reachable endpoint when the original crate center is clicked', async () => {
    await importedCrate();
    const world = standingWorld({ ...earned, position: from });
    expect(world.walkTo(crate)).toBe(true);
    const end = world.path.at(-1)!;
    expect(world.grid.walkable(end)).toBe(true);
    expect(end).not.toEqual({ x: crate.x, z: crate.z });
    expect(world.marker.position.set).toHaveBeenCalledWith(end.x, expect.any(Number), end.z);
    expect(world.callbacks.notice).not.toHaveBeenCalled();
  });

  it.each(['load', 'update'] as const)(
    'recovers a genuine saved crate crossing on %s without changing earned stories',
    async (mode) => {
      const model = await importedCrate();
      const previous = new WalkGrid(
        previousObstacles(earned),
        layout.terrain,
        layout.bounds.min,
        layout.bounds.max,
      );
      const state = fixture('v11-lanes-crate-crossing.json');
      const position = state.position;
      expect(previous.walkable(position)).toBe(true);
      expect(position.x).toBeGreaterThan(model.minX);
      expect(position.x).toBeLessThan(model.maxX);
      expect(position.z).toBeGreaterThan(model.minZ);
      expect(position.z).toBeLessThan(model.maxZ);
      const before = structuredClone(state);
      const world = standingWorld(state);
      expect(world.grid.walkable(state.position)).toBe(false);
      if (mode === 'load') world.setPosition(state.position, true);
      else world.update(state);
      expect(world.grid.walkable(world.getPosition())).toBe(true);
      expect(distance(world.getPosition(), position)).toBeLessThan(2);
      expect(world.path).toEqual([]);
      expect(world.destination).toBeUndefined();
      expect(world.marker.setEnabled).toHaveBeenCalledWith(false);
      expect(state).toEqual(before);
      expect(world.state).toEqual(before);
      expect(findPath(world.grid, world.getPosition(), target).length).toBeGreaterThan(0);
      for (const place of activeInteractables(state)) {
        const path = approachPath(world.grid, world.getPosition(), place);
        expect(path.length, place.id).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, place), place.id).toBeLessThan(2.4);
      }
    },
  );

  it.each(originalExplorationFixtures)(
    'preserves standing cells and every authored destination approach in $name',
    ({ name, state }) => {
      const currentLayout = campaignLayout(state.region);
      const shape = currentLayout?.terrain ?? isLand;
      const original =
        state.region === 'capernaum'
          ? obstacles
          : state.region === 'capernaum-lanes'
            ? previousObstacles(state)
            : layoutObstacles(state);
      const bounds = currentLayout?.bounds ?? { min: -24, max: 24 };
      const before = new WalkGrid(original, shape, bounds.min, bounds.max);
      const after = new WalkGrid(
        state.region === 'capernaum' ? obstacles : layoutObstacles(state),
        shape,
        bounds.min,
        bounds.max,
      );
      expect(after.walkable(state.position), name).toBe(before.walkable(state.position));
      const standing = after.nearest(state.position)!;
      for (const place of activeInteractables(state)) {
        const oldPath = approachPath(before, standing, place);
        const path = approachPath(after, standing, place);
        expect(oldPath.length, `${name}:${place.id}`).toBeGreaterThan(0);
        expect(path.length, `${name}:${place.id}`).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, place), `${name}:${place.id}`).toBeLessThan(2.4);
      }
    },
  );
});
