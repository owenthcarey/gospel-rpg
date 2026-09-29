import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
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

let engine: NullEngine | undefined;
afterEach(() => engine?.dispose());

/** Horizontal angle of the face: from the head joint's centre toward its nose and beard. */
function faceAngle(actor: Actor): number {
  const head = posedVertices(actor.root, 'head');
  const centre = head.reduce((sum, p) => sum.addInPlace(p), Vector3.Zero()).scale(1 / head.length);
  // The face is the half of the head farthest along the body's own facing direction.
  const facing = actor.root.rotation.y - Math.PI;
  const forward = new Vector3(Math.sin(facing), 0, Math.cos(facing));
  const front = head.filter((p) => Vector3.Dot(p.subtract(centre), forward) > 0.06);
  const nose = front.reduce((sum, p) => sum.addInPlace(p), Vector3.Zero()).scale(1 / front.length);
  return Math.atan2(nose.x - centre.x, nose.z - centre.z);
}

it('turns only the head toward a nearby point, bounded, and settles back when released', async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  const scene = new Scene(engine);
  const library = new AssetLibrary(scene);
  await library.load(['traveler'], () => {});
  const actor = new Actor(library.instantiate('traveler', 'glancer'), true);
  actor.face({ x: 0, z: 5 });
  actor.sample('Idle', 0, true);
  const before = faceAngle(actor);
  const position = actor.root.position.clone();
  // A point to the actor's side: the glance should rotate the face toward it.
  const target = new Vector3(4, 1.6, 2);
  actor.lookAt(target);
  for (let i = 0; i < 40; i++) actor.sample('Idle', 0.05, false);
  const toward = Math.atan2(target.x, target.z - 0);
  const turned = faceAngle(actor);
  const delta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  expect(Math.abs(delta(turned, toward))).toBeLessThan(Math.abs(delta(before, toward)));
  expect(Math.abs(delta(turned, before))).toBeLessThanOrEqual(0.75);
  expect(actor.root.position.equals(position)).toBe(true);
  actor.lookAt(null);
  for (let i = 0; i < 60; i++) actor.sample('Idle', 0.05, false);
  // Within the Idle clip's own small glance, the head is back to its forward heading.
  expect(Math.abs(delta(faceAngle(actor), before))).toBeLessThan(0.1);
  // Reduced motion never glances.
  actor.lookAt(target);
  actor.sample('Idle', 0.05, true);
  expect(Math.abs(delta(faceAngle(actor), before))).toBeLessThan(0.02);
  library.dispose();
  scene.dispose();
});
