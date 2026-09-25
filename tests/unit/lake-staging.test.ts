import { nearestDistance } from '../helpers/posed-geometry';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StormRegion } from '../../src/scene/regions/storm';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { TravelerBoat } from '../../src/scene/actors/boat';
import { stormStart } from '../helpers/lake';

// Use the real importer, shipped geometry, skins, clips and scene compositions.
// Only transport and the canvas are replaced; no GPU is needed to measure contact.
vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (source: string, scene: import('@babylonjs/core/scene').Scene) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { pluginExtension: '.glb' },
      ),
  };
});

let engine: NullEngine | undefined;
let scene: Scene | undefined;
afterEach(() => {
  scene?.dispose();
  engine?.dispose();
});
function vertices(root: TransformNode, joint: string): Vector3[] {
  for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
  const result: Vector3[] = [];
  for (const mesh of root.getChildMeshes().filter((m) => m.skeleton)) {
    mesh.skeleton!.prepare(true);
    const points = mesh.getPositionData(true)!;
    const joints = mesh.getVerticesData('matricesIndices')!;
    for (let i = 0; i < points.length / 3; i++) {
      if (mesh.skeleton!.bones[joints[i * 4]!]!.name !== joint) continue;
      result.push(
        Vector3.TransformCoordinates(
          Vector3.FromArray(points, i * 3),
          mesh.computeWorldMatrix(true),
        ),
      );
    }
  }
  expect(result.length).toBeGreaterThan(0);
  return result;
}

function points(root: TransformNode): Vector3[] {
  for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
  return [...(root instanceof Mesh ? [root] : []), ...root.getChildMeshes()].flatMap((mesh) => {
    mesh.skeleton?.prepare(true);
    const data = mesh.getPositionData(Boolean(mesh.skeleton));
    return data
      ? Array.from({ length: data.length / 3 }, (_, i) =>
          Vector3.TransformCoordinates(
            Vector3.FromArray(data, i * 3),
            mesh.computeWorldMatrix(true),
          ),
        )
      : [];
  });
}
function bounds(pts: Vector3[]) {
  return {
    min: [
      Math.min(...pts.map((p) => p.x)),
      Math.min(...pts.map((p) => p.y)),
      Math.min(...pts.map((p) => p.z)),
    ],
    max: [
      Math.max(...pts.map((p) => p.x)),
      Math.max(...pts.map((p) => p.y)),
      Math.max(...pts.map((p) => p.z)),
    ],
  };
}
function setup(): NullEngine {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  engine.getRenderingCanvas = () => ({ clientWidth: 1440, clientHeight: 900 }) as HTMLCanvasElement;
  return engine;
}
function baked(scene: Scene) {
  return scene.meshes
    .filter((m) => m.isEnabled() && m.isVisible && m.getTotalVertices())
    .map((mesh) => {
      mesh.skeleton?.prepare(true);
      const data = mesh.getPositionData(Boolean(mesh.skeleton))!;
      const xyz = Array.from({ length: data.length / 3 }, (_, i) => {
        const p = Vector3.TransformCoordinates(
          Vector3.FromArray(data, i * 3),
          mesh.computeWorldMatrix(true),
        );
        return [p.x, -p.z, p.y];
      });
      const mat = mesh.material as unknown as { diffuseColor?: { asArray(): number[] } };
      return {
        name: mesh.name,
        faceColors: Array.from({ length: mesh.getTotalIndices() / 3 }, (_, i) => {
          const material = mesh.subMeshes
            .find((sub) => i * 3 >= sub.indexStart && i * 3 < sub.indexStart + sub.indexCount)
            ?.getMaterial() as unknown as {
            albedoColor?: { asArray(): number[] };
            diffuseColor?: { asArray(): number[] };
          };
          return material?.albedoColor?.asArray() ?? material?.diffuseColor?.asArray() ?? [1, 1, 1];
        }),
        vertices: xyz,
        indices: Array.from(mesh.getIndices()!),
        colors: Array.from(mesh.getVerticesData('color') ?? []),
        color: mat?.diffuseColor?.asArray() ?? [1, 1, 1],
      };
    });
}
const review: Record<string, unknown> = {};
afterEach(() => {
  if (process.env.LAKE_REVIEW_OUTPUT)
    writeFileSync(process.env.LAKE_REVIEW_OUTPUT, JSON.stringify(review));
});

describe('actual imported lake geometry', () => {
  it('supports the rower’s seat and feet, and keeps both hands on exported oars throughout the stroke', async () => {
    scene = new Scene(setup());
    const lib = new AssetLibrary(scene);
    await lib.load(['boat', 'traveler', 'oar'], () => {});
    const actor = new Actor(lib.instantiate('traveler', 'rower'));
    const parent = new TransformNode('parent', scene),
      boat = new TravelerBoat(lib, parent, actor);
    const distances: number[] = [];
    const bladeHeights: number[] = [];
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      boat.pose(true, phase === 0 ? 0 : 0.3, false);
      for (const side of ['left', 'right'] as const) {
        const hand = vertices(actor.root, 'forearm_' + side);
        const oar = points(
          scene.getTransformNodeByName('traveler-oar-' + (side === 'left' ? -1 : 1))!,
        );
        const nearest = nearestDistance(hand, oar);
        distances.push(nearest);
        if (side === 'left') bladeHeights.push(Math.min(...oar.map((p) => p.y)));
        expect(nearest, side + ' hand touches its oar at ' + phase).toBeLessThan(0.1);
      }
      const seat = bounds(points(scene.getMeshByName('rower-seat')!));
      const pelvis = actor.model.socket('body').getAbsolutePosition();
      expect(Math.abs(pelvis.y - seat.max[1]!)).toBeLessThan(0.04);
      expect(pelvis.z).toBeGreaterThan(seat.min[2]!);
      expect(pelvis.z).toBeLessThan(seat.max[2]!);
      // The ordinary hull floor is at +0.07, above the flat exploration water; soles rest against it.
      for (const side of ['left', 'right'])
        expect(Math.abs(bounds(vertices(actor.root, 'leg_' + side)).min[1]! - 0.07)).toBeLessThan(
          0.05,
        );
    }
    expect(Math.min(...bladeHeights)).toBeLessThan(0);
    expect(Math.max(...bladeHeights)).toBeGreaterThan(0);
    review.oarBladeHeights = bladeHeights;
    boat.pose(false, 0, true);
    review.rower = baked(scene);
    review.handOarDistances = distances;
    lib.dispose();
  });
  it('supports Jesus’ head on the cushion and torso on the stern platform, with disciples clear of the reclining figure', async () => {
    const region = new StormRegion(setup(), stormStart());
    scene = region.scene;
    await region.load(() => {});
    const jesus = scene.getTransformNodeByName('storm-jesus')!;
    const head = bounds(vertices(jesus, 'head')),
      body = bounds(vertices(jesus, 'body'));
    const cushion = bounds(points(scene.getTransformNodeByName('stern-cushion')!));
    const platform = bounds(points(scene.getMeshByName('stern-platform')!));
    expect(Math.abs(head.min[1]! - cushion.max[1]!)).toBeLessThan(0.025);
    expect(head.min[2]).toBeLessThan(cushion.max[2]!);
    expect(head.max[2]).toBeGreaterThan(cushion.min[2]!);
    expect(Math.abs(body.min[1]! - platform.max[1]!)).toBeLessThan(0.025);
    for (const name of ['storm-simon', 'storm-john']) {
      const other = bounds(vertices(scene.getTransformNodeByName(name)!, 'body'));
      expect(other.max[2]!).toBeLessThan(body.min[2]! - 0.3);
    }
    review.stern = baked(scene);
    review.sleepingContact = { head, cushion, body, platform };
    region.dispose();
  });
});

it('reserves enough navigable clearance for the imported hull at every heading and cell edge', async () => {
  const { lakeLayouts } = await import('../../src/content/lake/layouts');
  const { waterGrid } = await import('../../src/game/lake/navigation');
  scene = new Scene(setup());
  const lib = new AssetLibrary(scene);
  await lib.load(['boat', 'split_rock', 'cove_headland'], () => {});
  const boat = lib.instantiate('boat', 'clearance-boat');
  boat.root.scaling.set(1.35, 1, 1.25);
  const radius = Math.max(...points(boat.root).map((p) => Math.hypot(p.x, p.z)));
  const rocks = lakeLayouts['galilee-water'].decor
    .filter((p) => p.asset === 'split_rock' || p.asset === 'cove_headland')
    .map((p) => {
      const rock = lib.instantiate(p.asset, 'clearance-' + p.asset);
      rock.root.position.set(p.x, 0, p.z);
      rock.root.scaling.setAll(p.scale ?? 1);
      return bounds(points(rock.root));
    });
  const grid = waterGrid();
  for (let x = grid.min; x <= grid.max; x++)
    for (let z = grid.min; z <= grid.max; z++) {
      if (!grid.walkable({ x, z })) continue;
      for (const rock of rocks) {
        const dx = Math.max(rock.min[0]! - x, 0, x - rock.max[0]!);
        const dz = Math.max(rock.min[2]! - z, 0, z - rock.max[2]!);
        // Minimum separation between the whole square cell and the rock bounds.
        expect(
          Math.hypot(Math.max(0, dx - 0.5), Math.max(0, dz - 0.5)),
          `water cell ${x},${z}`,
        ).toBeGreaterThan(radius);
      }
      expect(22 - Math.abs(x) - 0.5).toBeGreaterThan(radius);
    }
  lib.dispose();
});
