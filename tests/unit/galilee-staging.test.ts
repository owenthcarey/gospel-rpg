import { Actor } from '../../src/scene/actors/actor';
import { LifeActivity } from '../../src/scene/actors/life';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from '../../src/scene/assets';
import { GalileeActivity } from '../../src/scene/actors/galilee';
import { CHANNEL_IDS, type Direction } from '../../src/game/galilee/types';
import { ports, traceWater } from '../../src/game/galilee/channel';
import { preparedSpring, connectSpring, arrangedShelter } from '../helpers/galilee';
import { galileeAction } from '../helpers/galilee';
import { explorationAssets } from '../../src/content/inventories';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (source: string, scene: Scene) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { pluginExtension: '.glb' },
      ),
  };
});
let engine: NullEngine | undefined;
afterEach(() => engine?.dispose());
function vertices(root: TransformNode): Vector3[] {
  root.computeWorldMatrix(true);
  for (const n of root.getChildTransformNodes()) n.computeWorldMatrix(true);
  return root.getChildMeshes().flatMap((mesh) => {
    const p = mesh.getVerticesData('position') ?? [],
      matrix = mesh.computeWorldMatrix(true),
      result: Vector3[] = [];
    for (let i = 0; i < p.length; i += 3)
      result.push(Vector3.TransformCoordinates(Vector3.FromArray(p, i), matrix));
    return result;
  });
}
describe('Living Galilee shipped geometry', () => {
  it('keeps both hands within reach of each carried practical prop', async () => {
    engine = new NullEngine();
    engine.getCaps().maxVertexUniformVectors = 1024;
    const scene = new Scene(engine),
      library = new AssetLibrary(scene),
      state = preparedSpring();
    await library.load(explorationAssets('galilean-road'), () => {});
    const player = new Actor(library.instantiate('traveler', 'contact-traveler'));
    const activity = new LifeActivity(library, player, 'galilean-road');
    player.sampleAt('Carry', 0);
    for (const id of ['channel-scoop', 'rest-mat', 'rest-water', 'rest-screen'] as const) {
      state.campaign.carrying = id;
      activity.update(state);
      const prop = scene.getTransformNodeByName('held-' + id)!;
      const points = vertices(prop);
      const bounds = {
        min: new Vector3(
          ...((['x', 'y', 'z'] as const).map((k) => Math.min(...points.map((p) => p[k]))) as [
            number,
            number,
            number,
          ]),
        ),
        max: new Vector3(
          ...((['x', 'y', 'z'] as const).map((k) => Math.max(...points.map((p) => p[k]))) as [
            number,
            number,
            number,
          ]),
        ),
      };
      for (const joint of ['forearm_left', 'forearm_right']) {
        const distances: number[] = [];
        for (const mesh of player.root.getChildMeshes().filter((m) => m.skeleton)) {
          for (const n of player.root.getChildTransformNodes()) n.computeWorldMatrix(true);
          mesh.skeleton!.prepare(true);
          const positions = mesh.getPositionData(true)!,
            joints = mesh.getVerticesData('matricesIndices')!;
          for (let i = 0; i < positions.length / 3; i++) {
            if (mesh.skeleton!.bones[joints[i * 4]!]!.name !== joint) continue;
            const v = Vector3.TransformCoordinates(
              Vector3.FromArray(positions, i * 3),
              mesh.computeWorldMatrix(true),
            );
            distances.push(Vector3.Distance(v, Vector3.Clamp(v, bounds.min, bounds.max)));
          }
        }
        expect(distances.length).toBeGreaterThan(0);
        expect(Math.min(...distances), id + '/' + joint).toBeLessThan(
          id === 'channel-scoop' ? 0.3 : 0.16,
        );
      }
    }
  });

  it('matches every rendered channel port to its solver direction', async () => {
    engine = new NullEngine();
    const scene = new Scene(engine),
      library = new AssetLibrary(scene),
      state = preparedSpring();
    await library.load(explorationAssets('galilean-road'), () => {});
    const activity = new GalileeActivity(library, scene, 'galilean-road');
    for (let turn = 0; turn < 4; turn++) {
      for (const id of CHANNEL_IDS) state.galilee.spring.turns[id] = turn as Direction;
      activity.update(state);
      for (const id of CHANNEL_IDS) {
        const root = scene.getTransformNodeByName('galilee-' + id)!;
        const points = vertices(root).map((p) => p.subtract(root.position));
        const actual = [
          points.some((p) => p.z > 0.95),
          points.some((p) => p.x > 0.95),
          points.some((p) => p.z < -0.95),
          points.some((p) => p.x < -0.95),
        ];
        expect(actual, id + '/' + turn).toEqual(
          [0, 1, 2, 3].map((d) => ports(id, turn as Direction).includes(d as Direction)),
        );
      }
    }
  });
  it('only wets the tested connected route, and resets it when an orientation changes', async () => {
    engine = new NullEngine();
    const scene = new Scene(engine),
      library = new AssetLibrary(scene),
      state = connectSpring();
    await library.load(explorationAssets('galilean-road'), () => {});
    const activity = new GalileeActivity(library, scene, 'galilean-road');
    activity.update(state);
    const wet = () =>
      scene.meshes
        .filter((m) => m.name.startsWith('galilee-water-') && m.isEnabled())
        .map((m) => m.name);
    const flow = traceWater(state.galilee.spring.turns);
    for (const id of CHANNEL_IDS)
      for (let d = 0; d < 4; d++)
        expect(wet().includes(`galilee-water-${id}-${d}`)).toBe(
          flow.path.includes(id) &&
            ports(id, state.galilee.spring.turns[id]).includes(d as Direction),
        );
    const basin = scene.getTransformNodeByName('galilee-north-basin')!;
    const basinPoints = vertices(basin).map((p) => p.subtract(basin.position));
    expect(Math.min(...basinPoints.map((p) => p.x))).toBeLessThan(-1);
    expect(Math.max(...basinPoints.map((p) => p.x))).toBeLessThan(0.9);
    expect(wet()).toContain('galilee-water-north-basin');
    expect(wet()).not.toContain('galilee-water-south-basin');
    state.galilee.spring.turns.turn = 0;
    state.galilee.spring.tested = false;
    state.galilee.spring.stage = 'working';
    activity.update(state);
    expect(wet()).toEqual([]);
  });
  it('reconstructs a completed resting place with visible company and an open southern approach', async () => {
    engine = new NullEngine();
    const scene = new Scene(engine),
      library = new AssetLibrary(scene);
    const state = galileeAction(arrangedShelter(), 'shelter-finish-welcome');
    await library.load(explorationAssets('roadside-farm'), () => {});
    const activity = new GalileeActivity(library, scene, 'roadside-farm');
    activity.update(state);
    const screen = scene.getTransformNodeByName('galilee-shade-screen')!;
    expect(screen.position.z).toBeGreaterThan(-6);
    expect(scene.getTransformNodeByName('galilee-breeze-screen')!.isEnabled()).toBe(false);
    expect(scene.getTransformNodeByName('galilee-resting-traveler-0')!.isEnabled()).toBe(true);
    expect(scene.getTransformNodeByName('galilee-resting-traveler-1')!.isEnabled()).toBe(true);
    expect(scene.getTransformNodeByName('galilee-stored-mat')!.isEnabled()).toBe(false);
  });
});
