import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { activeInteractables, obstacles, props, isLand } from '../../src/content/region';
import { distance, findPath, WalkGrid } from '../../src/game/pathfinding';
import { approachPath, slideStep, smoothPath, stepPath } from '../../src/game/navigation';
import { newGame, type Point } from '../../src/game/types';
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

let engine: NullEngine;
afterEach(() => engine?.dispose());
const crates = props.filter((p) => p.asset === 'crate');
const grid = () => new WalkGrid(obstacles, isLand);
const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'))).state;

async function placedCrates() {
  engine = new NullEngine();
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(['crate'], () => {});
  const world = Object.assign(Object.create(World.prototype), {
    library,
    state: newGame(),
  });
  return crates.map((placement) => {
    const model = world.place(placement) as TransformNode;
    const points = posedVertices(model);
    return {
      placement,
      model,
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minZ: Math.min(...points.map((p) => p.z)),
      maxZ: Math.max(...points.map((p) => p.z)),
    };
  });
}

function standingWorld(position: Point) {
  engine = new NullEngine();
  const scene = new Scene(engine);
  return Object.assign(Object.create(World.prototype), {
    state: newGame(),
    grid: grid(),
    position: { ...position },
    player: new TransformNode('standing traveler', scene),
    camera: { target: { copyFrom: vi.fn() } },
    marker: { position: { set: vi.fn() }, setEnabled: vi.fn() },
    routeDots: [],
    keys: new Set<string>(),
    people: new Map(),
    path: [{ x: 7, z: 2 }],
    destination: 'simon',
    paused: false,
    poseTraveler: vi.fn(),
    showRoute: vi.fn(),
    callbacks: { notice: vi.fn() },
  });
}

describe('Capernaum solid crate navigation', () => {
  it('encloses each shipped crate at its actual placement and scale without widening the prop', async () => {
    for (const crate of await placedCrates()) {
      const footprint = obstacles.find(
        (o) => o.x === crate.placement.x && o.z === crate.placement.z,
      )!;
      // Imported vertex transforms use Float32 matrices; allow their sub-micron rounding.
      const tolerance = 1e-6;
      expect(footprint.x - footprint.width / 2 - tolerance).toBeLessThanOrEqual(crate.minX);
      expect(footprint.x + footprint.width / 2 + tolerance).toBeGreaterThanOrEqual(crate.maxX);
      expect(footprint.z - footprint.depth / 2 - tolerance).toBeLessThanOrEqual(crate.minZ);
      expect(footprint.z + footprint.depth / 2 + tolerance).toBeGreaterThanOrEqual(crate.maxZ);
      expect(footprint.width - (crate.maxX - crate.minX)).toBeLessThan(0.06);
      expect(footprint.depth - (crate.maxZ - crate.minZ)).toBeLessThan(0.06);
      expect(crate.model.getChildMeshes().every((mesh) => !mesh.isPickable)).toBe(true);
    }
  });

  it('routes around the original shore crates and arrives without walking through imported wood', async () => {
    const placed = await placedCrates(),
      terrain = grid(),
      from = { x: 7, z: -2 },
      target = { x: 7, z: 2 };
    let position = from,
      path = smoothPath(terrain, from, findPath(terrain, from, target)),
      arrived = false;
    expect(path.length).toBeGreaterThan(0);
    for (let frame = 0; frame < 600 && !arrived; frame++) {
      const step = stepPath(position, path, 1 / 60);
      position = step.position;
      path = step.path;
      arrived = step.arrived;
      expect(terrain.walkable(position)).toBe(true);
      for (const crate of placed)
        expect(
          position.x > crate.minX &&
            position.x < crate.maxX &&
            position.z > crate.minZ &&
            position.z < crate.maxZ,
        ).toBe(false);
    }
    expect(arrived).toBe(true);
    expect(position).toEqual(target);
  });

  it('keeps manual forward movement outside the solid shore crate', async () => {
    const placed = await placedCrates(),
      terrain = grid();
    let position = { x: 7, z: -2 };
    for (let frame = 0; frame < 120; frame++)
      position = slideStep(terrain, position, { x: 0, z: 3.25 / 60 });
    const crate = placed.find((p) => p.placement.x === 7.2)!;
    expect(position.z).toBeLessThan(crate.minZ);
    expect(terrain.walkable(position)).toBe(true);
  });

  it('places a blocked crate click on a reachable route endpoint', () => {
    const world = standingWorld({ x: 7, z: -2 });
    const crate = crates.find((p) => p.x === 7.2)!;
    expect(world.walkTo(crate)).toBe(true);
    const end = world.path.at(-1)!;
    expect(world.grid.walkable(end)).toBe(true);
    expect(world.marker.position.set).toHaveBeenCalledWith(end.x, expect.any(Number), end.z);
    expect(world.callbacks.notice).not.toHaveBeenCalled();
  });

  it('retains all authored shore destinations and existing saved standing cells', () => {
    const terrain = grid();
    const locations = new Set(crates.map((p) => `${p.x},${p.z}`));
    const prior = new WalkGrid(
      obstacles.filter((o) => !locations.has(`${o.x},${o.z}`)),
      isLand,
    );
    const states = [
      newGame(),
      ...readdirSync('tests/fixtures/saves')
        .filter((name) => name.endsWith('.json') && name !== 'v11-capernaum-crate-crossing.json')
        .map(fixture)
        .filter((state) => state.region === 'capernaum'),
    ];
    for (const state of states) {
      expect(terrain.walkable(state.position)).toBe(prior.walkable(state.position));
      for (const place of activeInteractables(state)) {
        const path = approachPath(terrain, state.position, place);
        expect(path.length, place.id).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, place), place.id).toBeLessThan(2.4);
      }
    }
  });

  it.each(['load', 'update'] as const)(
    'clears a genuine old crate-crossing save on %s while retaining its earned state',
    (mode) => {
      const state = fixture('v11-capernaum-crate-crossing.json');
      const before = structuredClone(state);
      const world = standingWorld(state.position);
      world.state = structuredClone(state);
      expect(world.grid.walkable(state.position)).toBe(false);
      if (mode === 'load') world.setPosition(state.position, true);
      else world.update(state);
      const at = world.getPosition();
      expect(world.grid.walkable(at)).toBe(true);
      expect(distance(at, state.position)).toBeLessThan(2);
      expect(world.path).toEqual([]);
      expect(world.destination).toBeUndefined();
      expect(world.marker.setEnabled).toHaveBeenCalledWith(false);
      expect(world.player.position.equals(new Vector3(at.x, 0, at.z))).toBe(true);
      expect(state).toEqual(before);
      expect(world.state).toEqual(before);
      expect(state.connection.route).toBeNull();
    },
  );
});
