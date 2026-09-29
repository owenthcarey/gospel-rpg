import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { ACTOR_ASSETS } from '../../src/content/assets';
import type { ActorClip } from '../../src/content/assets';
import { posedVertices } from '../helpers/posed-geometry';

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

let engine: NullEngine;
let scene: Scene;
let library: AssetLibrary;
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load([...ACTOR_ASSETS], () => {});
}, 60_000);
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

const centre = (points: Vector3[]) =>
  points.reduce((sum, p) => sum.addInPlace(p), Vector3.Zero()).scale(1 / points.length);

/** The head's centre and the lowest foot point, posed at evenly spaced phases of a clip. */
function trace(actor: Actor, clip: ActorClip, steps = 12) {
  return Array.from({ length: steps }, (_, i) => {
    actor.sampleAt(clip, i / steps);
    const feet = [
      ...posedVertices(actor.root, 'leg_left'),
      ...posedVertices(actor.root, 'leg_right'),
    ];
    return {
      head: centre(posedVertices(actor.root, 'head')),
      floor: Math.min(...feet.map((p) => p.y)),
    };
  });
}
const range = (values: number[]) => Math.max(...values) - Math.min(...values);

// Measured on the exported files: the walk has a visible vertical bob, and the idle has a small,
// continuous breath that never lifts the feet. Each actor is checked separately, so a rebuilt
// character whose clips collapse to a still pose (or an exaggerated bounce) fails by name.
it.each(ACTOR_ASSETS)('%s walks with a bob and breathes at rest', (id) => {
  const actor = new Actor(library.instantiate(id, 'motion-' + id), true);
  actor.face({ x: 0, z: 5 });
  const walk = trace(actor, 'Walk');
  const idle = trace(actor, 'Idle');
  const walkBob = range(walk.map((s) => s.head.y));
  const idleHead = Math.max(...idle.map((s) => Vector3.Distance(s.head, idle[0]!.head)));
  expect(walkBob, 'walk bob').toBeGreaterThan(0.015);
  expect(walkBob, 'walk bob').toBeLessThan(0.08);
  expect(idleHead, 'idle breath').toBeGreaterThan(0.002);
  expect(idleHead, 'idle breath').toBeLessThan(0.03);
  expect(walkBob).toBeGreaterThan(range(idle.map((s) => s.head.y)) * 2);
  // Idle keeps both feet planted within a few millimetres.
  expect(range(idle.map((s) => s.floor)), 'planted feet').toBeLessThan(0.01);
  actor.root.dispose();
});
