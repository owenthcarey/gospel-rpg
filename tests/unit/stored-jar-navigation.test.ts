import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { AssetLibrary } from '../../src/scene/assets';
import { HarborPresentation } from '../../src/scene/harbor';
import { World } from '../../src/scene/world';
import { activeInteractables, obstacles, isLand } from '../../src/content/region';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { passageObstacles } from '../../src/content/connection/presentation';
import { cargoPosition, storedJarObstacles } from '../../src/game/harbor/arrangement';
import { EXPLORATION_REGIONS } from '../../src/game/campaign/types';
import { WalkGrid, distance, findPath } from '../../src/game/pathfinding';
import {
  approachPath,
  clearLine,
  slideStep,
  smoothPath,
  stepPath,
} from '../../src/game/navigation';
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

const crossingNames = ['v11-stored-jar-crossing-high.json', 'v11-stored-jar-crossing-low.json'];
const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'))).state;
const complete = fixture('v11-landing-south.json');
const beforeGrid = (state: GameState) =>
  new WalkGrid([...obstacles, ...passageObstacles(state)], isLand);
const grid = (state: GameState) =>
  new WalkGrid([...obstacles, ...storedJarObstacles(state), ...passageObstacles(state)], isLand);
const originalExplorationFixtures = readdirSync('tests/fixtures/saves')
  .filter((name) => name.endsWith('.json') && !crossingNames.includes(name))
  .map((name) => ({ name, state: fixture(name) }))
  .filter(({ state }) => EXPLORATION_REGIONS.some((region) => region === state.region));
let engine: NullEngine;
afterEach(() => engine?.dispose());

async function importedCargo(state = complete) {
  engine = new NullEngine();
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(['amphora', 'net_folded', 'crossing_plank', 'quay_stones'], () => {});
  const presentation = new HarborPresentation(scene, library);
  presentation.update(state.harbor);
  const jar = scene.getTransformNodeByName('working-jar-cargo')!,
    vertices = posedVertices(jar);
  return {
    scene,
    presentation,
    jar,
    vertices,
    mesh: jar.getChildMeshes().find((mesh) => mesh.getTotalVertices())!,
  };
}

function standingWorld(state: GameState, scene: Scene, terrain: WalkGrid) {
  return Object.assign(Object.create(World.prototype), {
    state: structuredClone(state),
    grid: terrain,
    layout: undefined,
    position: { ...state.position },
    player: new TransformNode('standing traveler', scene),
    camera: { target: { copyFrom: vi.fn() } },
    marker: { position: { set: vi.fn() }, setEnabled: vi.fn() },
    routeDots: [{ setEnabled: vi.fn() }],
    keys: new Set(['w']),
    people: new Map(),
    path: [{ x: 5, z: -17 }],
    destination: 'harbor-jars',
    paused: false,
    poseTraveler: vi.fn(),
    showRoute: vi.fn(),
    callbacks: { notice: vi.fn() },
  });
}

describe('the stored landing jar', () => {
  it('tightly encloses the actual scaled amphora and leaves original low cargo without new collision', async () => {
    const cargo = await importedCargo();
    const footprint = storedJarObstacles(complete)[0]!;
    for (const p of cargo.vertices) {
      expect(p.x).toBeGreaterThanOrEqual(footprint.x - footprint.width / 2 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(footprint.x + footprint.width / 2 + 1e-6);
      expect(p.z).toBeGreaterThanOrEqual(footprint.z - footprint.depth / 2 - 1e-6);
      expect(p.z).toBeLessThanOrEqual(footprint.z + footprint.depth / 2 + 1e-6);
    }
    const width =
      Math.max(...cargo.vertices.map((p) => p.x)) - Math.min(...cargo.vertices.map((p) => p.x));
    const depth =
      Math.max(...cargo.vertices.map((p) => p.z)) - Math.min(...cargo.vertices.map((p) => p.z));
    expect(footprint.width - width).toBeLessThan(0.02);
    expect(footprint.depth - depth).toBeLessThan(0.02);
    expect(Math.max(...cargo.vertices.map((p) => p.y))).toBeGreaterThan(0.65);
    expect(
      cargo.jar
        .getChildMeshes()
        .every((mesh) => mesh.isPickable && mesh.metadata.interactionId === 'harbor-jars'),
    ).toBe(true);
    const otherShore = fixture('v9-cove-berthed.json');
    expect(storedJarObstacles({ ...otherShore, harbor: complete.harbor })).toEqual([]);
    const north = fixture('v11-landing-north.json');
    cargo.presentation.update(north.harbor);
    const net = posedVertices(cargo.scene.getTransformNodeByName('working-net-cargo')!);
    expect(Math.max(...net.map((p) => p.y))).toBeLessThan(0.1);
    expect(storedJarObstacles(north)).toEqual([]);
  });

  it.each(['observed', 'interrupted', 'north', 'south'] as const)(
    'changes only the actual stored-jar cell in the genuine %s pose',
    (pose) => {
      const state = fixture('v11-landing-' + pose + '.json'),
        before = beforeGrid(state),
        after = grid(state),
        changed = [];
      for (let x = before.min; x <= before.max; x++)
        for (let z = before.min; z <= before.max; z++)
          if (before.walkable({ x, z }) !== after.walkable({ x, z })) changed.push({ x, z });
      const genuineCrossingCell = before.cell(fixture(crossingNames[0]!).position);
      expect(changed).toEqual(state.harbor.cargo.jars ? [genuineCrossingCell] : []);
    },
  );

  it('routes and manually stops outside the actual stored pottery, including a blocked click', async () => {
    const cargo = await importedCargo(),
      terrain = grid(complete),
      from = { x: 5, z: -18 },
      target = { x: 6, z: -16 };
    let position = from,
      route = smoothPath(terrain, from, findPath(terrain, from, target)),
      arrived = false;
    const minX = Math.min(...cargo.vertices.map((p) => p.x)),
      maxX = Math.max(...cargo.vertices.map((p) => p.x));
    const minZ = Math.min(...cargo.vertices.map((p) => p.z)),
      maxZ = Math.max(...cargo.vertices.map((p) => p.z));
    for (let frame = 0; frame < 600 && !arrived; frame++) {
      const step = stepPath(position, route, 1 / 60);
      expect(clearLine(terrain, position, step.position)).toBe(true);
      position = step.position;
      route = step.path;
      arrived = step.arrived;
      expect(position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ).toBe(
        false,
      );
    }
    expect(arrived).toBe(true);
    expect(position).toEqual(target);
    position = from;
    for (let frame = 0; frame < 120; frame++)
      position = slideStep(terrain, position, { x: 0, z: 3.25 / 60 });
    expect(position.z).toBeLessThan(minZ);
    expect(terrain.walkable(position)).toBe(true);
    const world = standingWorld({ ...complete, position: from }, cargo.scene, terrain);
    expect(world.walkTo(cargoPosition(complete.harbor, 'jars'))).toBe(true);
    const endpoint = world.path.at(-1)!;
    expect(terrain.walkable(endpoint)).toBe(true);
    expect(endpoint.z).toBeLessThan(minZ);
    expect(world.marker.position.set).toHaveBeenCalledWith(
      endpoint.x,
      expect.any(Number),
      endpoint.z,
    );
    expect(world.callbacks.notice).not.toHaveBeenCalled();
  });

  for (const name of crossingNames)
    it.each(['load', 'update'] as const)(
      'recovers the genuine native ' + name + ' on %s without changing earned state',
      async (mode) => {
        const state = fixture(name),
          original = structuredClone(state),
          cargo = await importedCargo(state);
        const previous = beforeGrid(state),
          current = grid(state);
        expect(previous.walkable(state.position)).toBe(true);
        expect(current.walkable(state.position)).toBe(false);
        const y = 0.35,
          left = new Vector3(state.position.x - 0.6, y, state.position.z),
          right = new Vector3(state.position.x + 0.6, y, state.position.z);
        const a = new Ray(left, Vector3.Right(), 1.2).intersectsMesh(cargo.mesh, false),
          b = new Ray(right, Vector3.Left(), 1.2).intersectsMesh(cargo.mesh, false);
        expect(a.hit).toBe(true);
        expect(b.hit).toBe(true);
        expect(a.pickedPoint!.x).toBeLessThan(state.position.x);
        expect(b.pickedPoint!.x).toBeGreaterThan(state.position.x);
        const world = standingWorld(state, cargo.scene, mode === 'load' ? current : previous);
        if (mode === 'load') world.setPosition(state.position, true);
        else world.update(state);
        const recovered = world.getPosition();
        expect(world.grid.walkable(recovered)).toBe(true);
        expect(distance(recovered, state.position)).toBeLessThan(2);
        expect(world.path).toEqual([]);
        expect(world.destination).toBeUndefined();
        expect(world.keys.size).toBe(0);
        expect(world.marker.setEnabled).toHaveBeenCalledWith(false);
        expect(world.routeDots[0]!.setEnabled).toHaveBeenCalledWith(false);
        expect(world.player.position.equals(new Vector3(recovered.x, 0, recovered.z))).toBe(true);
        expect(world.state).toEqual(original);
        expect(state).toEqual(original);
        expect(findPath(world.grid, recovered, { x: 4, z: -17 }).length).toBeGreaterThan(0);
        for (const place of activeInteractables(state)) {
          const path = approachPath(world.grid, recovered, place);
          expect(path.length, name + ':' + place.id).toBeGreaterThan(0);
          expect(distance(path.at(-1)!, place)).toBeLessThan(2.4);
        }
      },
    );

  it.each(originalExplorationFixtures)(
    'preserves the original standing cell and every authored approach in $name',
    ({ name, state }) => {
      const layout = campaignLayout(state.region),
        terrain = layout?.terrain ?? isLand,
        bounds = layout?.bounds ?? { min: -24, max: 24 };
      const base = [...(layout ? layoutObstacles(state) : obstacles), ...passageObstacles(state)];
      const before = new WalkGrid(base, terrain, bounds.min, bounds.max),
        after = new WalkGrid(
          [...base, ...(!layout ? storedJarObstacles(state) : [])],
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
