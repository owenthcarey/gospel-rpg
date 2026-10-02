import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { bakehouseLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { neighborhoodPlaces } from '../../src/content/campaign/places';
import { activeInteractables } from '../../src/content/region';
import { distance, WalkGrid } from '../../src/game/pathfinding';
import { approachPath, smoothPath, stepPath } from '../../src/game/navigation';
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

const state = parseSave(
  JSON.parse(readFileSync('tests/fixtures/saves/v6-interrupted-repair.json', 'utf8')),
).state;
const layout = bakehouseLayout;
const oven = layout.decor.find((p) => p.asset === 'oven')!;
const note = neighborhoodPlaces.bakehouse.find((p) => p.id === 'oven-note')!;
const grid = new WalkGrid(
  layoutObstacles(state),
  layout.terrain,
  layout.bounds.min,
  layout.bounds.max,
);
let engine: NullEngine;
let model: TransformNode;
let mesh: Mesh;
let positions: Vector3[];
let colors: number[];
let colorStride: number;

// The joined export distinguishes its dark aperture from the terracotta body and stone hearth.
const openingColor = (vertex: number) =>
  Math.max(...colors.slice(vertex * colorStride, vertex * colorStride + 3)) < 0.4;

beforeAll(async () => {
  engine = new NullEngine();
  const library = new AssetLibrary(new Scene(engine));
  await library.load(['oven'], () => {});
  const world = Object.assign(Object.create(World.prototype), { library, layout, state });
  model = world.place(oven) as TransformNode;
  positions = posedVertices(model);
  mesh = model.getChildMeshes().find((mesh) => mesh.getTotalVertices())! as Mesh;
  colors = Array.from(mesh.getVerticesData('color')!);
  colorStride = colors.length / mesh.getTotalVertices();
});
afterAll(() => engine?.dispose());

function firstHit(from: Vector3, target: Vector3) {
  const delta = target.subtract(from);
  const length = delta.length() + 0.01;
  const hit = new Ray(from, delta.normalize(), length).intersectsMesh(mesh, false);
  return { hit: hit.hit, opening: hit.hit && openingColor(mesh.getIndices()![hit.faceId * 3]!) };
}

describe('the warm oven in Hannah’s bakehouse', () => {
  it('shows its actual dark opening toward the legal room-side inspection approach', () => {
    const aperture = positions.filter((_, i) => openingColor(i));
    expect(aperture.length).toBeGreaterThan(0);
    const front = Math.min(...aperture.map((p) => p.z));
    expect(Math.max(...aperture.map((p) => p.z))).toBeLessThan(oven.z);
    const height =
      (Math.min(...aperture.map((p) => p.y)) + Math.max(...aperture.map((p) => p.y))) / 2;
    const approach = grid.nearest({ x: note.x, z: note.z - 1 })!;
    expect(grid.walkable(approach)).toBe(true);
    expect(
      firstHit(new Vector3(approach.x, height, approach.z), new Vector3(oven.x, height, front)),
    ).toEqual({
      hit: true,
      opening: true,
    });
    expect(
      firstHit(new Vector3(oven.x, height, oven.z + 1.1), new Vector3(oven.x, height, front)),
    ).toEqual({
      hit: true,
      opening: false,
    });
  });

  it('keeps its solid body within the existing blocked floor cells and leaves the low hearth traversable', () => {
    const body = positions.filter((p) => p.y > 0.15);
    expect(body.length).toBeGreaterThan(0);
    for (const p of body) expect(grid.walkable(p)).toBe(false);
    const hearth = positions.filter((p) => p.y > 0 && p.y <= 0.15);
    expect(hearth.some((p) => grid.walkable(p))).toBe(true);
    expect(model.getChildMeshes().every((mesh) => !mesh.isPickable)).toBe(true);
    expect(grid.walkable({ x: note.x, z: note.z - 1 })).toBe(true);
  });

  it('keeps every authored bakehouse destination reachable from the original interrupted repair', () => {
    expect(grid.walkable(state.position)).toBe(true);
    for (const place of activeInteractables(state)) {
      let position = { ...state.position };
      let path = smoothPath(grid, position, approachPath(grid, position, place));
      expect(path.length, place.id).toBeGreaterThan(0);
      let arrived = false;
      for (let frame = 0; frame < 600 && !arrived; frame++) {
        const step = stepPath(position, path, 1 / 60);
        position = step.position;
        path = step.path;
        arrived = step.arrived;
        expect(grid.walkable(position), place.id).toBe(true);
      }
      expect(arrived, place.id).toBe(true);
      expect(distance(position, place), place.id).toBeLessThan(2.35);
    }
  });
});
