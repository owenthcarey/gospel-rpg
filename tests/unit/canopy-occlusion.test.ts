import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AssetLibrary, sceneAssets } from '../../src/scene/assets';
import { dressVillage } from '../../src/scene/harbor';
import { World } from '../../src/scene/world';
import { ScenerySightline } from '../../src/scene/environment/occlusion';
import { stylePlugin, WIND_SHAPES } from '../../src/scene/environment/matte';
import { campaignLayout, groundHeight } from '../../src/content/campaign/layouts';
import { villageAssets } from '../../src/content/harbor/scenery';
import { obstacles, isLand } from '../../src/content/region';
import { WalkGrid } from '../../src/game/pathfinding';
import { newGame, type Point } from '../../src/game/types';
import type { ExplorationRegion } from '../../src/game/campaign/types';

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

function setup(region: ExplorationRegion, point: Point, still: boolean) {
  engine = new NullEngine();
  const scene = new Scene(engine),
    library = new AssetLibrary(scene),
    state = newGame(),
    layout = campaignLayout(region);
  state.region = region;
  const fixture = Object.assign(Object.create(World.prototype), {
    scene,
    library,
    state,
    layout,
    position: point,
    actors: new Map(),
    boats: [],
    occluders: [],
    scenerySightline: new ScenerySightline(),
    player: new TransformNode('traveler', scene),
    reducedMotion: still,
  });
  fixture.player.position.set(point.x, groundHeight(region, point), point.z);
  fixture.camera = new ArcRotateCamera(
    'canopy view',
    -Math.PI / 2 - 0.45,
    layout?.camera.beta ?? 0.78,
    layout?.camera.radius ?? 33,
    fixture.cameraTarget(),
    scene,
  );
  fixture.camera.getViewMatrix();
  const grid = layout
    ? new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max)
    : new WalkGrid(obstacles, isLand);
  expect(grid.walkable(point)).toBe(true);
  const update = () => {
    if (still) fixture.updateOcclusion(0);
    else for (let frame = 0; frame < 20; frame++) fixture.updateOcclusion(0.05);
  };
  return { scene, library, fixture, grid, update };
}

function torsoRay(camera: Vector3, player: Vector3, height = 0.9): Ray {
  const target = player.add(new Vector3(0, height, 0));
  return new Ray(camera, target.subtract(camera).normalize(), Vector3.Distance(camera, target));
}

function geometrySnapshot(mesh: AbstractMesh) {
  mesh.computeWorldMatrix(true);
  const geometry = (mesh as Mesh).geometry,
    bounds = mesh.getBoundingInfo().boundingBox,
    positions = Array.from(mesh.getVerticesData('position')!),
    indices = Array.from(mesh.getIndices()!),
    metadata = mesh.metadata,
    pickable = mesh.isPickable;
  return () => {
    expect((mesh as Mesh).geometry).toBe(geometry);
    expect(mesh.getBoundingInfo().boundingBox).toBe(bounds);
    expect(Array.from(mesh.getVerticesData('position')!)).toEqual(positions);
    expect(Array.from(mesh.getIndices()!)).toEqual(indices);
    expect(mesh.metadata).toBe(metadata);
    expect(mesh.isPickable).toBe(pickable);
  };
}

describe('shipped fabric canopy fading', () => {
  for (const still of [false, true]) {
    it.each([
      { asset: 'market', region: 'capernaum', placed: { x: -7, z: 2 }, point: { x: -5, z: 4 } },
      {
        asset: 'farm_shelter',
        region: 'roadside-farm',
        placed: { x: 5, z: 6.5 },
        point: { x: 5, z: 7 },
      },
    ] as const)(
      `clears $asset at a reachable position and restores it; reduced motion ${still}`,
      async ({ asset, region, placed, point }) => {
        const { library, fixture, grid, update } = setup(region, point, still);
        await library.load([asset], () => {});
        const canopy = fixture.place({ asset, ...placed }, 'canopy-target') as TransformNode;
        const mesh = canopy.getChildMeshes().find((m) => m.getTotalVertices())!;
        const unchanged = geometrySnapshot(mesh),
          plugin = stylePlugin(mesh.material!);
        expect(canopy.position.y).toBe(groundHeight(region, placed));
        expect(plugin.wind).toEqual(WIND_SHAPES[asset]);
        expect(
          torsoRay(fixture.camera.position, fixture.player.position).intersectsMesh(mesh).hit,
        ).toBe(true);
        expect(
          torsoRay(fixture.camera.position, fixture.player.position, 1.6).intersectsMesh(mesh).hit,
        ).toBe(asset === 'farm_shelter');

        update();
        expect(plugin.fade).toBeCloseTo(0.18, 2);
        expect(
          torsoRay(fixture.camera.position, fixture.player.position).intersectsMesh(mesh).hit,
        ).toBe(true);
        unchanged();

        const clearPoint = asset === 'market' ? { x: -1, z: -3 } : { x: 5, z: 3 };
        expect(grid.walkable(clearPoint)).toBe(true);
        fixture.player.position.set(clearPoint.x, groundHeight(region, clearPoint), clearPoint.z);
        update();
        expect(plugin.fade).toBeCloseTo(1, 2);
        fixture.player.position.set(point.x, groundHeight(region, point), point.z);
        update();
        expect(plugin.fade).toBeCloseTo(0.18, 2);
        // From beneath the shelter, a low view through its open front clears the roof.
        if (asset === 'farm_shelter') fixture.camera.beta = 1.32;
        else fixture.camera.alpha += Math.PI;
        fixture.camera.getViewMatrix();
        update();
        expect(plugin.fade).toBeCloseTo(1, 2);
        expect(plugin.wind).toEqual(WIND_SHAPES[asset]);
        unchanged();
        library.dispose();
      },
    );

    it(`clears only the blocking doorway awning while retaining other dressing batches; reduced motion ${still}`, async () => {
      const { scene, library, fixture, grid, update } = setup('capernaum', { x: -5, z: -8 }, still);
      await library.load(villageAssets('capernaum'), () => {});
      const inventory = [...scene.metadata.assetInventory],
        awnings = dressVillage(scene, library, 'capernaum');
      expect(awnings).toHaveLength(2);
      for (const awning of awnings) fixture.registerOccluder('door_awning', awning);
      const blocked = awnings.find((a) => a.position.x === -5)!,
        other = awnings.find((a) => a.position.x === -8)!,
        mesh = blocked.getChildMeshes().find((m) => m.getTotalVertices())!,
        untouched = other.getChildMeshes().find((m) => m.getTotalVertices())!,
        unchanged = geometrySnapshot(mesh),
        plugin = stylePlugin(mesh.material!),
        otherPlugin = stylePlugin(untouched.material!);
      expect(mesh.material).not.toBe(untouched.material);
      for (const height of [0.9, 1.6])
        expect(
          torsoRay(fixture.camera.position, fixture.player.position, height).intersectsMesh(mesh)
            .hit,
        ).toBe(true);
      update();
      expect(plugin.fade).toBeCloseTo(0.18, 2);
      expect(otherPlugin.fade).toBe(1);
      expect(plugin.wind).toEqual(WIND_SHAPES.door_awning);
      expect(otherPlugin.wind).toEqual(WIND_SHAPES.door_awning);
      unchanged();

      fixture.player.position.x = -1;
      expect(grid.walkable({ x: -1, z: -8 })).toBe(true);
      update();
      expect(plugin.fade).toBeCloseTo(1, 2);
      fixture.player.position.x = -5;
      update();
      expect(plugin.fade).toBeCloseTo(0.18, 2);
      fixture.camera.alpha += Math.PI;
      fixture.camera.getViewMatrix();
      update();
      expect(plugin.fade).toBeCloseTo(1, 2);
      expect(otherPlugin.fade).toBe(1);
      unchanged();

      expect(scene.metadata.assetInventory).toEqual(inventory);
      expect(sceneAssets(scene).door_awning?.placed).toBe(2);
      expect(scene.getMeshByName('scenery-batch:door_awning')).toBeNull();
      for (const asset of ['stone_threshold', 'wall_footing', 'harbor_bollard']) {
        expect(scene.getMeshByName('scenery-batch:' + asset)).not.toBeNull();
        expect(sceneAssets(scene)[asset]?.placed).toBe(1);
      }
      library.dispose();
    });
  }
});
