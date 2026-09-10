import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { NainRegion } from '../../src/scene/regions/nain';
import { roadStart, roadAction } from '../helpers/road';
import { gateway } from '../helpers/campaign';
import { transition } from '../../src/game/quest';
import { NAIN_SCENES } from '../../src/game/road/types';

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
let region: NainRegion | undefined;
afterEach(() => {
  region?.dispose();
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

describe('Nain imported-geometry staging', () => {
  it('puts both hands of all four bearers and Jesus’ right hand against the supported rails', async () => {
    engine = new NullEngine();
    // NullEngine's default uniform limit is intentionally tiny; this is CPU geometry inspection.
    engine.getCaps().maxVertexUniformVectors = 1024;
    engine.getRenderingCanvas = () =>
      ({ clientWidth: 1440, clientHeight: 900 }) as HTMLCanvasElement;
    let state = roadAction(gateway(roadStart(), 'to-nain'), 'nain-enter');
    for (const checkpoint of NAIN_SCENES.slice(0, 3))
      state = transition(state, { type: 'nain-next', checkpoint });
    region = new NainRegion(engine, state);
    await region.load(() => {});
    for (const [name, side, joints] of [
      ['bearer-0', -1, ['forearm_left', 'forearm_right']],
      ['bearer-1', 1, ['forearm_left', 'forearm_right']],
      ['bearer-2', -1, ['forearm_left', 'forearm_right']],
      ['bearer-3', 1, ['forearm_left', 'forearm_right']],
      ['jesus', -1, ['forearm_right']],
    ] as const) {
      const root = region.scene.getTransformNodeByName(name)!;
      for (const joint of joints) {
        const points = vertices(root, joint).filter((p) => Math.abs(p.z) <= 1.65);
        const nearest = Math.min(...points.map((p) => Math.hypot(p.x - side * 0.6, p.y - 0.84)));
        expect(nearest, name + '/' + joint + ' touches the rail').toBeLessThan(0.09);
      }
    }
  });
});
