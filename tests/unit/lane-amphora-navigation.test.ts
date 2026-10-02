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

const crossingNames = ['v11-lane-amphora-crossing-high.json', 'v11-lane-amphora-crossing-low.json'];
const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'))).state;
const earned = fixture(crossingNames[0]!);
const layout = campaignLayout(earned.region)!;
const placement = layout.decor.find((p) => p.asset === 'amphora')!;
const footprint = layoutObstacles(earned).find((o) => o.x === placement.x && o.z === placement.z)!;
const previousObstacles = (state: GameState) =>
  layoutObstacles(state).filter(
    (o) =>
      state.region !== 'capernaum-lanes' ||
      o.x !== footprint.x ||
      o.z !== footprint.z ||
      o.width !== footprint.width ||
      o.depth !== footprint.depth,
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

async function importedAmphora() {
  engine = new NullEngine();
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(['amphora'], () => {});
  // Use the original World placement path, including authored scale/rotation and ground height.
  const placedWorld = Object.assign(Object.create(World.prototype), {
    library,
    layout,
    state: earned,
  });
  const model = { root: placedWorld.place(placement) as TransformNode };
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
    path: [{ x: -4, z: 6 }],
    destination: 'to-bakehouse',
    paused: false,
    poseTraveler: vi.fn(),
    showRoute: vi.fn(),
    callbacks: { notice: vi.fn() },
  });
}

describe('the original upright lane amphora', () => {
  it('tightly encloses the actual original GLB without changing authored picking or historical save terrain', async () => {
    const jar = await importedAmphora();
    for (const p of jar.vertices) {
      expect(p.x).toBeGreaterThanOrEqual(footprint.x - footprint.width / 2 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(footprint.x + footprint.width / 2 + 1e-6);
      expect(p.z).toBeGreaterThanOrEqual(footprint.z - footprint.depth / 2 - 1e-6);
      expect(p.z).toBeLessThanOrEqual(footprint.z + footprint.depth / 2 + 1e-6);
    }
    expect(footprint.width - (jar.bounds.maxX - jar.bounds.minX)).toBeLessThan(0.03);
    expect(footprint.depth - (jar.bounds.maxZ - jar.bounds.minZ)).toBeLessThan(0.03);
    expect(Math.max(...jar.vertices.map((p) => p.y))).toBeGreaterThan(0.9);
    expect(jar.model.root.getChildMeshes().every((m) => !m.isPickable)).toBe(true);
    expect(
      new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max).walkable(
        earned.position,
      ),
    ).toBe(true);
    expect(layout.obstacles).not.toContainEqual(footprint);
    // The original living-Capernaum fixture already overlaps its table; this fix does not change that recovery.
    const original = fixture('v6-living-capernaum.json');
    expect(grid(original, true).walkable(original.position)).toBe(false);
    expect(grid(original).nearest(original.position)).toEqual(
      grid(original, true).nearest(original.position),
    );
  });

  it('changes only the one lane cell covered by the imported body and existing traveler clearance', async () => {
    const jar = await importedAmphora(),
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
          x > jar.bounds.minX - 0.42 &&
          x < jar.bounds.maxX + 0.42 &&
          z > jar.bounds.minZ - 0.42 &&
          z < jar.bounds.maxZ + 0.42
        )
          expected.push(point);
      }
    expect(changed).toEqual(expected);
    expect(changed).toHaveLength(1);
    for (const name of crossingNames)
      expect(changed).toContainEqual(before.cell(fixture(name).position));
  });

  it('routes around the solid pottery body, stops native-style manual movement and resolves a blocked body click', async () => {
    const jar = await importedAmphora(),
      terrain = grid(),
      from = { x: -8, z: 6 },
      target = { x: -4, z: 6 };
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
        position.x > jar.bounds.minX &&
          position.x < jar.bounds.maxX &&
          position.z > jar.bounds.minZ &&
          position.z < jar.bounds.maxZ,
      ).toBe(false);
    }
    expect(arrived).toBe(true);
    expect(position).toEqual(target);
    for (let frame = 0; frame < 120; frame++)
      position = slideStep(terrain, position, { x: -3.25 / 60, z: 0 });
    expect(terrain.walkable(position)).toBe(true);
    expect(position.x).toBeGreaterThan(jar.bounds.maxX);
    const world = standingWorld({ ...earned, position: target }, jar.scene, terrain);
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
          jar = await importedAmphora(),
          previous = grid(state, true),
          current = grid(state);
        expect(previous.walkable(state.position)).toBe(true);
        expect(current.walkable(state.position)).toBe(false);
        const y = 0.5,
          fromLeft = new Vector3(jar.bounds.minX - 0.25, y, state.position.z),
          fromRight = new Vector3(jar.bounds.maxX + 0.25, y, state.position.z),
          left = jar.cast(fromLeft, fromRight),
          right = jar.cast(fromRight, fromLeft);
        expect(left?.pickedPoint).toBeTruthy();
        expect(right?.pickedPoint).toBeTruthy();
        expect(left!.pickedPoint!.x).toBeLessThan(state.position.x);
        expect(right!.pickedPoint!.x).toBeGreaterThan(state.position.x);
        const world = standingWorld(state, jar.scene, mode === 'load' ? current : previous);
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
        expect(findPath(world.grid, restored, { x: -4, z: 6 }).length).toBeGreaterThan(0);
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
        const oldPath = approachPath(before, before.nearest(state.position)!, place),
          path = approachPath(after, standing, place);
        expect(oldPath.length, name + ':' + place.id).toBeGreaterThan(0);
        expect(path.length, name + ':' + place.id).toBeGreaterThan(0);
        expect(distance(oldPath.at(-1)!, place), name + ':' + place.id).toBeLessThan(2.4);
        expect(distance(path.at(-1)!, place), name + ':' + place.id).toBeLessThan(2.4);
      }
    },
  );
});
