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
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { ScenerySightline } from '../../src/scene/environment/occlusion';
import { stylePlugin, WIND_SHAPES } from '../../src/scene/environment/matte';
import { groundHeight } from '../../src/content/campaign/layouts';
import { obstacles, isLand, trees } from '../../src/content/region';
import { WalkGrid } from '../../src/game/pathfinding';
import { newGame, type Point } from '../../src/game/types';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    // Exercise the production importer and packed meshes; replace only network transport.
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

function setup(point: Point, still: boolean, width = 1440, height = 900) {
  engine = new NullEngine({
    renderWidth: width,
    renderHeight: height,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const scene = new Scene(engine),
    library = new AssetLibrary(scene),
    state = newGame(),
    grid = new WalkGrid(obstacles, isLand);
  state.position = { ...point };
  const fixture = Object.assign(Object.create(World.prototype), {
    scene,
    library,
    state,
    position: { ...point },
    actors: new Map(),
    boats: [],
    occluders: [],
    scenerySightline: new ScenerySightline(),
    player: new TransformNode('traveler navigation', scene),
    reducedMotion: still,
    paused: false,
    path: [{ ...point }, { x: -20, z: -3 }],
    keys: new Set(['w']),
  });
  fixture.player.position.set(point.x, groundHeight(state.region, point), point.z);
  const camera = new ArcRotateCamera(
    'settled foliage view',
    -Math.PI / 2 - 0.45,
    0.78,
    33,
    fixture.cameraTarget(),
    scene,
  );
  fixture.camera = camera;
  camera.getViewMatrix();
  const update = () => {
    if (still) fixture.updateOcclusion(0);
    else for (let frame = 0; frame < 40; frame++) fixture.updateOcclusion(0.05);
  };
  return { scene, library, fixture, camera, grid, update };
}

function torsoRay(camera: Vector3, player: Vector3, height: number, length?: number): Ray {
  const target = player.add(new Vector3(0, height, 0));
  return new Ray(
    camera,
    target.subtract(camera).normalize(),
    length ?? Vector3.Distance(camera, target),
  );
}

function hits(meshes: AbstractMesh[], camera: Vector3, player: Vector3, length?: number) {
  return [0.9, 1.6].map((height) => {
    const ray = torsoRay(camera, player, height, length);
    return meshes.some((mesh) => {
      mesh.computeWorldMatrix(true);
      const hit = ray.intersectsMesh(mesh, true);
      return hit.hit && hit.distance < ray.length - 0.05;
    });
  });
}

function geometrySnapshot(meshes: AbstractMesh[]) {
  const snapshots = meshes.map((mesh) => {
    mesh.computeWorldMatrix(true);
    return {
      mesh,
      geometry: (mesh as Mesh).geometry,
      bounds: mesh.getBoundingInfo().boundingBox,
      positions: Array.from(mesh.getVerticesData('position')!),
      indices: Array.from(mesh.getIndices()!),
      world: Array.from(mesh.getWorldMatrix().m),
      metadata: mesh.metadata,
      pickable: mesh.isPickable,
      shadow: mesh.receiveShadows,
      material: mesh.material,
    };
  });
  return () => {
    for (const saved of snapshots) {
      const mesh = saved.mesh;
      mesh.computeWorldMatrix(true);
      expect((mesh as Mesh).geometry).toBe(saved.geometry);
      expect(mesh.getBoundingInfo().boundingBox).toBe(saved.bounds);
      expect(Array.from(mesh.getVerticesData('position')!)).toEqual(saved.positions);
      expect(Array.from(mesh.getIndices()!)).toEqual(saved.indices);
      expect(Array.from(mesh.getWorldMatrix().m)).toEqual(saved.world);
      expect(mesh.metadata).toBe(saved.metadata);
      expect(mesh.isPickable).toBe(saved.pickable);
      expect(mesh.receiveShadows).toBe(saved.shadow);
      expect(mesh.material).toBe(saved.material);
    }
  };
}

describe('shipped tree sightline fading', () => {
  // Trusted Cancel contacts from the ordinary desktop/phone Miriam-proximity flows.
  // The phone stop lies outside the former 1.25m trunk cutoff, despite crown obstruction.
  const stops = [
    {
      name: 'desktop',
      point: { x: -6.737541520184315, z: -2.043743079969282 },
      width: 1440,
      height: 900,
    },
    {
      name: 'phone',
      point: { x: -6.935504862312893, z: -2.0107491896145184 },
      width: 390,
      height: 844,
    },
  ];

  for (const still of [false, true]) {
    it.each(stops)(
      `fades the blocking olive at the recorded $name stop without changing navigation; reduced motion ${still}`,
      async ({ point, width, height }) => {
        const { library, fixture, camera, grid, update } = setup(point, still, width, height);
        await library.load(['olive'], () => {});
        const tree = fixture.place(trees[0], 'nearby-olive') as TransformNode;
        const other = fixture.place(trees[4]) as TransformNode;
        const meshes = tree.getChildMeshes().filter((mesh) => mesh.getTotalVertices());
        const otherMesh = other.getChildMeshes().find((mesh) => mesh.getTotalVertices())!;
        const unchanged = geometrySnapshot(meshes);
        const savedState = structuredClone(fixture.state);
        const navigation = {
          position: { ...fixture.position },
          root: fixture.player.position.clone(),
          path: fixture.path,
          points: structuredClone(fixture.path),
          keys: fixture.keys,
          camera: camera.position.clone(),
          target: camera.target.clone(),
          orbit: [camera.alpha, camera.beta, camera.radius],
        };
        expect(grid.walkable(point)).toBe(true);
        expect(grid.walkable(trees[0]!)).toBe(false);
        expect(hits(meshes, camera.position, fixture.player.position)).toEqual([true, true]);
        expect(meshes[0]!.material).not.toBe(otherMesh.material);

        fixture.updateOcclusion(still ? 0 : 0.05);
        for (const mesh of meshes) {
          const plugin = stylePlugin(mesh.material!);
          if (still) expect(plugin.fade).toBe(0.3);
          else {
            expect(plugin.fade).toBeGreaterThan(0.3);
            expect(plugin.fade).toBeLessThan(1);
          }
        }
        update();
        for (const mesh of meshes) {
          const plugin = stylePlugin(mesh.material!);
          expect(plugin.fade).toBeCloseTo(0.3, 5);
          expect(plugin.wind).toEqual(WIND_SHAPES.olive);
        }
        expect(stylePlugin(otherMesh.material!).fade).toBe(1);
        // Dissolving the material retains real ray picking and the obstacle footprint.
        expect(hits(meshes, camera.position, fixture.player.position)).toEqual([true, true]);
        unchanged();
        expect(grid.walkable(trees[0]!)).toBe(false);
        expect(fixture.state).toEqual(savedState);
        expect(fixture.position).toEqual(navigation.position);
        expect(fixture.player.position).toEqual(navigation.root);
        expect(fixture.path).toBe(navigation.path);
        expect(fixture.path).toEqual(navigation.points);
        expect(fixture.keys).toBe(navigation.keys);
        expect([...fixture.keys]).toEqual(['w']);
        expect(fixture.paused).toBe(false);
        expect(camera.position).toEqual(navigation.camera);
        expect(camera.target).toEqual(navigation.target);
        expect([camera.alpha, camera.beta, camera.radius]).toEqual(navigation.orbit);
        library.dispose();
      },
    );

    it.each(['olive', 'cypress', 'palm'] as const)(
      `restores %s for clear, beyond, disabled and rotated views; reduced motion ${still}`,
      async (asset) => {
        const { library, fixture, camera, update } = setup({ x: 0, z: 10 }, still);
        await library.load([asset], () => {});
        camera.setPosition(new Vector3(0, 1.3, -10));
        camera.getViewMatrix();
        const tree = fixture.place({
          asset,
          x: 0,
          z: 0,
          rotation: 0.4,
          scale: 1.3,
        }) as TransformNode;
        const meshes = tree.getChildMeshes().filter((mesh) => mesh.getTotalVertices());
        const unchanged = geometrySnapshot(meshes);
        const fade = (amount: number) => {
          update();
          for (const mesh of meshes)
            expect(stylePlugin(mesh.material!).fade).toBeCloseTo(amount, 5);
        };
        expect(hits(meshes, camera.position, fixture.player.position)).toContain(true);
        fade(0.3);

        fixture.player.position.x = 8;
        expect(hits(meshes, camera.position, fixture.player.position)).toEqual([false, false]);
        fade(1);
        fixture.player.position.x = 0;
        fade(0.3);

        fixture.player.position.z = -5;
        // An extended ray reaches the tree; the actual traveler sightline ends before it.
        expect(hits(meshes, camera.position, fixture.player.position, 100)).toContain(true);
        expect(hits(meshes, camera.position, fixture.player.position)).toEqual([false, false]);
        fade(1);
        fixture.player.position.z = 10;
        fade(0.3);

        tree.setEnabled(false);
        fade(1);
        tree.setEnabled(true);
        fade(0.3);
        for (const mesh of meshes) mesh.isVisible = false;
        fade(1);
        for (const mesh of meshes) mesh.isVisible = true;
        fade(0.3);

        camera.alpha += Math.PI;
        camera.getViewMatrix();
        expect(hits(meshes, camera.position, fixture.player.position)).toEqual([false, false]);
        fade(1);
        for (const mesh of meshes)
          expect(stylePlugin(mesh.material!).wind).toEqual(WIND_SHAPES[asset]);
        unchanged();
        library.dispose();
      },
    );
  }

  it('keeps each placed tree material owned by its scene through disposal', async () => {
    const { scene, library, fixture, update } = setup(stops[1]!.point, true);
    await library.load(['olive'], () => {});
    const first = fixture.place(trees[0]) as TransformNode;
    const other = fixture.place(trees[4]) as TransformNode;
    const mesh = first.getChildMeshes().find((child) => child.getTotalVertices())!;
    const untouched = other.getChildMeshes().find((child) => child.getTotalVertices())!;
    expect((mesh as Mesh).geometry).toBe((untouched as Mesh).geometry);
    expect(mesh.material).not.toBe(untouched.material);
    const disposed = vi.fn(),
      otherDisposed = vi.fn();
    mesh.material!.onDisposeObservable.add(disposed);
    untouched.material!.onDisposeObservable.add(otherDisposed);
    update();
    expect(stylePlugin(mesh.material!).fade).toBe(0.3);
    expect(stylePlugin(untouched.material!).fade).toBe(1);
    library.dispose();
    expect(disposed).not.toHaveBeenCalled();
    expect(otherDisposed).not.toHaveBeenCalled();
    scene.dispose();
    expect(disposed).toHaveBeenCalledOnce();
    expect(otherDisposed).toHaveBeenCalledOnce();
  });
});
