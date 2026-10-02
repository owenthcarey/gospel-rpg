import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { reedRockFootprints } from '../../src/content/lake/layouts';
import { activeInteractables, obstacles, isLand } from '../../src/content/region';
import { passageObstacles } from '../../src/content/connection/presentation';
import { storedJarObstacles } from '../../src/game/harbor/arrangement';
import { EXPLORATION_REGIONS } from '../../src/game/campaign/types';
import { WalkGrid, distance, findPath } from '../../src/game/pathfinding';
import {
  approachPath,
  clearLine,
  slideStep,
  smoothPath,
  stepPath,
} from '../../src/game/navigation';
import { parseSave } from '../../src/persistence/schema';
import type { GameState, Point } from '../../src/game/types';
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

const crossingNames = ['v11-reed-rock-crossing-high.json', 'v11-reed-rock-crossing-low.json'];
const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'))).state;
const earned = fixture(crossingNames[0]!);
const layout = campaignLayout(earned.region)!;
const placement = layout.decor.find((p) => p.asset === 'split_rock')!;
const previousObstacles = (state: GameState) =>
  layoutObstacles(state).filter(
    (o) =>
      state.region !== 'reed-landing' ||
      !reedRockFootprints().some(
        (r) => r.x === o.x && r.z === o.z && r.width === o.width && r.depth === o.depth,
      ),
  );
const grid = (state = earned, previous = false) =>
  new WalkGrid(
    [...(previous ? previousObstacles(state) : layoutObstacles(state)), ...passageObstacles(state)],
    layout.terrain,
    layout.bounds.min,
    layout.bounds.max,
  );
const originalExplorationFixtures = readdirSync('tests/fixtures/saves')
  .filter((name) => name.endsWith('.json') && !crossingNames.includes(name))
  .map((name) => ({ name, state: fixture(name) }))
  .filter(({ state }) => EXPLORATION_REGIONS.some((region) => region === state.region));
let engine: NullEngine;
afterEach(() => engine?.dispose());

async function importedRock() {
  engine = new NullEngine();
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(['split_rock'], () => {});
  const model = library.instantiate(placement.asset, 'actual-reed-rock');
  model.root.position.set(placement.x, placement.y ?? 0, placement.z);
  model.root.rotation.y = placement.rotation ?? 0;
  model.root.scaling.setAll(placement.scale ?? 1);
  const vertices = posedVertices(model.root),
    meshes = model.root.getChildMeshes().filter((m) => m.getTotalVertices());
  const bounds = {
    minX: Math.min(...vertices.map((p) => p.x)),
    maxX: Math.max(...vertices.map((p) => p.x)),
    minZ: Math.min(...vertices.map((p) => p.z)),
    maxZ: Math.max(...vertices.map((p) => p.z)),
  };
  const cast = (from: Vector3, to: Vector3) =>
    meshes
      .map((mesh) =>
        new Ray(from, to.subtract(from).normalize(), Vector3.Distance(from, to)).intersectsMesh(
          mesh,
          false,
        ),
      )
      .filter((hit) => hit.hit && hit.pickedPoint && hit.faceId >= 0)
      .sort((a, b) => a.distance - b.distance)[0];
  return { scene, model, vertices, bounds, cast };
}
function standingWorld(state: GameState, scene: Scene, terrain: WalkGrid) {
  return Object.assign(Object.create(World.prototype), {
    state: structuredClone(state),
    layout,
    grid: terrain,
    position: { ...state.position },
    player: new TransformNode('standing traveler', scene),
    camera: { target: { copyFrom: vi.fn() } },
    marker: { position: { set: vi.fn() }, setEnabled: vi.fn() },
    routeDots: [{ setEnabled: vi.fn() }],
    keys: new Set(['a']),
    people: new Map(),
    path: [{ x: 10, z: 12 }],
    destination: 'reed-shore',
    paused: false,
    poseTraveler: vi.fn(),
    showRoute: vi.fn(),
    callbacks: { notice: vi.fn() },
  });
}

describe('the upright reed-landing split rock', () => {
  it('tightly encloses the actual transformed rock and distinguishes its unusable upright gap from low ground', async () => {
    const rock = await importedRock(),
      footprint = reedRockFootprints()[0]!;
    for (const p of rock.vertices) {
      expect(p.x).toBeGreaterThanOrEqual(footprint.x - footprint.width / 2 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(footprint.x + footprint.width / 2 + 1e-6);
      expect(p.z).toBeGreaterThanOrEqual(footprint.z - footprint.depth / 2 - 1e-6);
      expect(p.z).toBeLessThanOrEqual(footprint.z + footprint.depth / 2 + 1e-6);
    }
    expect(footprint.width - (rock.bounds.maxX - rock.bounds.minX)).toBeLessThan(0.01);
    expect(footprint.depth - (rock.bounds.maxZ - rock.bounds.minZ)).toBeLessThan(0.01);
    expect(Math.abs(footprint.z - (rock.bounds.maxZ + rock.bounds.minZ) / 2)).toBeLessThan(0.01);
    expect(Math.max(...rock.vertices.map((p) => p.y))).toBeGreaterThan(2);
    expect(rock.model.root.getChildMeshes().every((m) => !m.isPickable)).toBe(true);
    expect(Object.isFrozen(footprint)).toBe(true);
    // The gap at torso height cannot accommodate the existing .42m clearance per side.
    const gap = new Vector3(placement.x, 0.65, placement.z),
      left = rock.cast(gap, new Vector3(rock.bounds.minX - 1, 0.65, placement.z)),
      right = rock.cast(gap, new Vector3(rock.bounds.maxX + 1, 0.65, placement.z));
    expect(left?.pickedPoint).toBeTruthy();
    expect(right?.pickedPoint).toBeTruthy();
    expect(left!.pickedPoint!.x).toBeLessThan(gap.x);
    expect(right!.pickedPoint!.x).toBeGreaterThan(gap.x);
    expect(right!.pickedPoint!.x - left!.pickedPoint!.x).toBeLessThan(0.84);
    // Static save terrain accepts genuine old crossings; only the runtime shore grid changes.
    expect(
      new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max).walkable(
        earned.position,
      ),
    ).toBe(true);
    expect(layout.obstacles).not.toContainEqual(footprint);
    const water = fixture('v9-crossing-evidence.json');
    expect(layoutObstacles(water)).toEqual(campaignLayout(water.region)!.obstacles);
  });

  it('changes only the six shore cells covered by the imported body and existing traveler clearance', async () => {
    const rock = await importedRock(),
      before = grid(earned, true),
      after = grid(),
      changed: Point[] = [],
      expected: Point[] = [];
    for (let x = before.min; x <= before.max; x++)
      for (let z = before.min; z <= before.max; z++) {
        const point = { x, z };
        if (before.walkable(point) !== after.walkable(point)) changed.push(point);
        if (
          before.walkable(point) &&
          x > rock.bounds.minX - 0.42 &&
          x < rock.bounds.maxX + 0.42 &&
          z > rock.bounds.minZ - 0.42 &&
          z < rock.bounds.maxZ + 0.42
        )
          expected.push(point);
      }
    expect(changed).toEqual(expected);
    expect(changed).toHaveLength(6);
    for (const name of crossingNames)
      expect(changed).toContainEqual(before.cell(fixture(name).position));
  });

  it('routes around both bodies, stops native-style manual movement and resolves a blocked body click', async () => {
    const rock = await importedRock(),
      terrain = grid(),
      from = { x: 6, z: 12 },
      target = { x: 10, z: 12 };
    let position = from,
      route = smoothPath(terrain, from, findPath(terrain, from, target)),
      arrived = false;
    for (let frame = 0; frame < 600 && !arrived; frame++) {
      const step = stepPath(position, route, 1 / 60);
      expect(clearLine(terrain, position, step.position)).toBe(true);
      position = step.position;
      route = step.path;
      arrived = step.arrived;
      expect(terrain.walkable(position)).toBe(true);
      expect(
        position.x > rock.bounds.minX &&
          position.x < rock.bounds.maxX &&
          position.z > rock.bounds.minZ &&
          position.z < rock.bounds.maxZ,
      ).toBe(false);
    }
    expect(arrived).toBe(true);
    expect(position).toEqual(target);
    for (let frame = 0; frame < 120; frame++)
      position = slideStep(terrain, position, { x: -3.25 / 60, z: 0 });
    expect(terrain.walkable(position)).toBe(true);
    expect(position.x).toBeGreaterThan(rock.bounds.maxX);
    const world = standingWorld({ ...earned, position: target }, rock.scene, terrain);
    expect(world.walkTo(earned.position)).toBe(true);
    const endpoint = world.path.at(-1)!;
    expect(terrain.walkable(endpoint)).toBe(true);
    expect(terrain.walkable(earned.position)).toBe(false);
    expect(world.marker.position.set).toHaveBeenCalledWith(
      endpoint.x,
      expect.any(Number),
      endpoint.z,
    );
    expect(world.callbacks.notice).not.toHaveBeenCalled();
  });

  for (const name of crossingNames)
    it.each(['load', 'update'] as const)(
      'recovers the genuine native ' +
        name +
        ' on %s without losing earned journeys or retaining a route',
      async (mode) => {
        const state = fixture(name),
          original = structuredClone(state),
          rock = await importedRock(),
          previous = grid(state, true),
          current = grid(state);
        expect(previous.walkable(state.position)).toBe(true);
        expect(current.walkable(state.position)).toBe(false);
        const y = 0.65,
          gap = new Vector3(placement.x, y, state.position.z),
          outside = new Vector3(rock.bounds.maxX + 1, y, state.position.z),
          left = rock.cast(gap, outside),
          right = rock.cast(outside, gap);
        expect(left?.pickedPoint).toBeTruthy();
        expect(right?.pickedPoint).toBeTruthy();
        expect(left!.pickedPoint!.x).toBeLessThan(state.position.x);
        expect(right!.pickedPoint!.x).toBeGreaterThan(state.position.x);
        const world = standingWorld(state, rock.scene, mode === 'load' ? current : previous);
        if (mode === 'load') world.setPosition(state.position, true);
        else world.update(state);
        const restored = world.getPosition();
        expect(world.grid.walkable(restored)).toBe(true);
        expect(distance(restored, state.position)).toBeLessThan(2);
        expect(world.path).toEqual([]);
        expect(world.destination).toBeUndefined();
        expect(world.keys.size).toBe(0);
        expect(world.marker.setEnabled).toHaveBeenCalledWith(false);
        expect(world.routeDots[0]!.setEnabled).toHaveBeenCalledWith(false);
        expect(world.player.position.equals(new Vector3(restored.x, 0, restored.z))).toBe(true);
        expect(world.state).toEqual(original);
        expect(state).toEqual(original);
        expect(findPath(world.grid, restored, { x: 10, z: 12 }).length).toBeGreaterThan(0);
        for (const place of activeInteractables(state)) {
          const path = approachPath(world.grid, restored, place);
          expect(path.length, name + ':' + place.id).toBeGreaterThan(0);
          expect(distance(path.at(-1)!, place), name + ':' + place.id).toBeLessThan(2.4);
        }
      },
    );

  it.each(originalExplorationFixtures)(
    'preserves the standing cell and every original authored approach in $name',
    ({ name, state }) => {
      const currentLayout = campaignLayout(state.region),
        terrain = currentLayout?.terrain ?? isLand,
        bounds = currentLayout?.bounds ?? { min: -24, max: 24 },
        oldObstacles = currentLayout
          ? previousObstacles(state)
          : [...obstacles, ...storedJarObstacles(state)],
        newObstacles = currentLayout
          ? layoutObstacles(state)
          : [...obstacles, ...storedJarObstacles(state)],
        before = new WalkGrid(
          [...oldObstacles, ...passageObstacles(state)],
          terrain,
          bounds.min,
          bounds.max,
        ),
        after = new WalkGrid(
          [...newObstacles, ...passageObstacles(state)],
          terrain,
          bounds.min,
          bounds.max,
        );
      expect(after.walkable(state.position), name).toBe(before.walkable(state.position));
      const standing = after.nearest(state.position)!;
      for (const place of activeInteractables(state)) {
        const oldPath = approachPath(before, standing, place),
          path = approachPath(after, standing, place);
        expect(oldPath.length, name + ':' + place.id).toBeGreaterThan(0);
        expect(path.length, name + ':' + place.id).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, place), name + ':' + place.id).toBeLessThan(2.4);
      }
    },
  );
});
