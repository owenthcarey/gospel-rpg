import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Ray } from '@babylonjs/core/Culling/ray';
import { AssetLibrary } from '../../src/scene/assets';
import { ScenerySightline } from '../../src/scene/environment/occlusion';
import { stylePlugin } from '../../src/scene/environment/matte';
import { World } from '../../src/scene/world';
import { PausedCadence } from '../../src/scene/presentation/cadence';
import { newGame } from '../../src/game/types';
import { obstacles, isLand } from '../../src/content/region';
import { WalkGrid } from '../../src/game/pathfinding';
import type { Placement } from '../../src/content/region';

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
afterEach(() => {
  vi.unstubAllGlobals();
  engine?.dispose();
});
function studio() {
  engine = new NullEngine();
  return new Scene(engine);
}

describe('house sightlines', () => {
  it.each([0.95, 1.3])('detects a narrow obstruction of the torso or head at %sm', (height) => {
    const scene = studio();
    const box = CreateBox('narrow obstruction', { width: 2, depth: 1, height: 0.12 }, scene);
    box.position.y = height;
    const sightline = new ScenerySightline();
    expect(sightline.blocks([box], new Vector3(0, 1, -10), new Vector3(0, 0, 10))).toBe(true);
    box.position.x = 3;
    expect(sightline.blocks([box], new Vector3(0, 1, -10), new Vector3(0, 0, 10))).toBe(false);
  });

  it('ignores a rotated bounding-box corner and geometry beyond the traveler', () => {
    const scene = studio();
    const box = CreateBox('diagonal wall', { width: 8, depth: 0.3, height: 3 }, scene);
    box.position.y = 1.5;
    box.rotation.y = Math.PI / 4;
    const sightline = new ScenerySightline();
    const camera = new Vector3(2.85, 1, -5);
    const player = new Vector3(2.85, 0, -2.9);
    box.computeWorldMatrix(true);
    const to = player.add(new Vector3(0, 0.9, 0));
    const delta = to.subtract(camera);
    const ray = new Ray(camera, delta.normalize(), Vector3.Distance(camera, to));
    const bounds = box.getBoundingInfo().boundingBox;
    expect(ray.intersectsBoxMinMax(bounds.minimumWorld, bounds.maximumWorld)).toBe(true);
    expect(sightline.blocks([box], camera, player)).toBe(false);
    expect(sightline.blocks([box], new Vector3(0, 1, -10), new Vector3(0, 0, 10))).toBe(true);
    expect(sightline.blocks([box], new Vector3(0, 1, -10), new Vector3(0, 0, -5))).toBe(false);
  });

  it('follows parent rotation, scale and elevation, and ignores disabled scenery', () => {
    const scene = studio();
    const root = new TransformNode('placed house', scene);
    const box = CreateBox('wall', { width: 2, depth: 5, height: 3 }, scene);
    box.parent = root;
    box.position.y = 1.5;
    root.position.set(5, 2, 0);
    root.rotation.y = Math.PI / 2;
    root.scaling.setAll(1.3);
    const sightline = new ScenerySightline();
    const camera = new Vector3(5, 3, -10);
    const player = new Vector3(5, 2, 10);
    expect(sightline.blocks([box], camera, player)).toBe(true);
    root.position.x = 10;
    expect(sightline.blocks([box], camera, player)).toBe(false);
    root.position.x = 5;
    root.setEnabled(false);
    expect(sightline.blocks([box], camera, player)).toBe(false);
  });
});

describe('shipped exterior house fading', () => {
  it('uses a reduced-motion camera reset on its first rendered frame', async () => {
    const scene = studio();
    const library = new AssetLibrary(scene);
    await library.load(['house_large'], () => {});
    vi.stubGlobal('document', { hidden: false });
    const camera = new ArcRotateCamera('reset view', 0.4, 0.78, 33, new Vector3(-13, 0, 2), scene);
    const fixture = Object.assign(Object.create(World.prototype), {
      engine,
      scene,
      library,
      camera,
      canvas: { dataset: {} },
      state: newGame(),
      actors: new Map(),
      boats: [],
      cutaways: [],
      occluders: [],
      scenerySightline: new ScenerySightline(),
      player: new TransformNode('traveler', scene),
      actorPlayer: { playback: { clip: 'Idle', frame: 0, action: '' } },
      stage: { setView() {}, tick() {} },
      dataCache: new Map(),
      cadence: new PausedCadence(),
      keys: new Set(),
      reducedMotion: true,
      active: false,
      paused: false,
      pendingRotation: 0,
      lastRender: 0,
      lastFrame: Infinity,
      simulate() {},
      fitCamera() {},
      tickArrival() {},
      hullRipples: () => [],
    });
    fixture.player.position.set(-13, 0, 0);
    const house = fixture.place({
      asset: 'house_large',
      x: -13,
      z: -4,
      rotation: -Math.PI / 2,
    }) as TransformNode;
    const mesh = house.getChildMeshes().find((m) => m.getTotalVertices())!;
    const render = vi.spyOn(scene, 'render').mockImplementation(() => {});
    fixture.renderFrame();
    expect(stylePlugin(mesh.material!).fade).toBe(1);
    camera.alpha = -Math.PI / 2;
    fixture.renderFrame();
    expect(stylePlugin(mesh.material!).fade).toBe(0.18);
    camera.alpha = 0.4;
    fixture.renderFrame();
    expect(stylePlugin(mesh.material!).fade).toBe(1);
    render.mockRestore();
    library.dispose();
  });

  it.each([false, true])(
    'restores each house after player/camera movement; reduced motion %s',
    async (still) => {
      const scene = studio();
      const library = new AssetLibrary(scene);
      await library.load(['house_large'], () => {});
      const fixture = Object.assign(Object.create(World.prototype), {
        scene,
        library,
        state: newGame(),
        actors: new Map(),
        boats: [],
        occluders: [],
        scenerySightline: new ScenerySightline(),
        player: new TransformNode('traveler', scene),
        camera: { position: new Vector3(-23.095, 23.46, -18.898) },
        reducedMotion: still,
      });
      const place = (p: Placement, id?: string): TransformNode => fixture.place(p, id);
      const blocked = place(
        { asset: 'house_large', x: -13, z: -4, rotation: -Math.PI / 2 },
        'house-target',
      );
      const other = place({ asset: 'house_large', x: 3, z: 13, rotation: 0.08, scale: 1.3 });
      const mesh = blocked.getChildMeshes().find((m) => m.getTotalVertices())!;
      const untouched = other.getChildMeshes().find((m) => m.getTotalVertices())!;
      const bounds = mesh.getBoundingInfo().boundingBox;
      const positions = mesh.getVerticesData('position')!;
      const geometry = (mesh as import('@babylonjs/core/Meshes/mesh').Mesh).geometry;
      const picking = { flag: mesh.isPickable, metadata: mesh.metadata };
      fixture.player.position.set(-13, 0, 0);
      const update = () => {
        for (let i = 0; i < 20; i++) fixture.updateOcclusion(0.05);
      };
      expect(mesh.material).not.toBe(untouched.material);
      expect(fixture.occluders.map((o: { kind: string }) => o.kind)).toEqual(['solid', 'solid']);
      update();
      expect(stylePlugin(mesh.material!).fade).toBeCloseTo(0.18, 2);
      expect(stylePlugin(untouched.material!).fade).toBe(1);

      // Ray picking still hits the unchanged opaque geometry while the shader dissolves it.
      const origin = fixture.camera.position;
      const target = fixture.player.position.add(new Vector3(0, 0.9, 0));
      const delta = target.subtract(origin);
      expect(
        new Ray(origin, delta.normalize(), Vector3.Distance(origin, target)).intersectsMesh(
          mesh,
          true,
        ).hit,
      ).toBe(true);
      expect({ flag: mesh.isPickable, metadata: mesh.metadata }).toEqual(picking);
      expect((mesh as import('@babylonjs/core/Meshes/mesh').Mesh).geometry).toBe(geometry);
      expect(mesh.getVerticesData('position')).toEqual(positions);
      expect(mesh.getBoundingInfo().boundingBox).toBe(bounds);
      const grid = new WalkGrid(obstacles, isLand);
      expect(grid.walkable({ x: -13, z: 0 })).toBe(true);
      expect(grid.walkable({ x: -13, z: -4 })).toBe(false);

      fixture.player.position.set(-19, 0, 0);
      update();
      expect(stylePlugin(mesh.material!).fade).toBeCloseTo(1, 2);
      fixture.player.position.set(-13, 0, 0);
      update();
      expect(stylePlugin(mesh.material!).fade).toBeCloseTo(0.18, 2);
      fixture.camera.position.set(-13, 20, 20);
      update();
      expect(stylePlugin(mesh.material!).fade).toBeCloseTo(1, 2);
      if (still) {
        fixture.camera.position.set(-23.095, 23.46, -18.898);
        fixture.updateOcclusion(0);
        expect(stylePlugin(mesh.material!).fade).toBe(0.18);
      }
      library.dispose();
    },
  );
});
