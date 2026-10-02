import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { World } from '../../src/scene/world';
import { WalkGrid } from '../../src/game/pathfinding';
import { newGame } from '../../src/game/types';
import { ACTOR_ASSETS } from '../../src/content/assets';
import type { ActorClip } from '../../src/content/assets';
import { posedVertices } from '../helpers/posed-geometry';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (
      source: string,
      scene: import('@babylonjs/core/scene').Scene,
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

it('keeps walking and carrying cadence proportional to actual movement', () => {
  for (const clip of ['Walk', 'Carry', 'MatCarry'] as const) {
    const actor = new Actor(library.instantiate('traveler', 'pace-' + clip));
    actor.setStrideSpeed(3.25);
    actor.sample(clip, 0.1);
    const first = actor.playback.frame;
    actor.sample(clip, 0.1);
    const full = actor.playback.frame - first;
    actor.setStrideSpeed(1.625);
    actor.sample(clip, 0.1);
    const half = actor.playback.frame - first - full;
    expect(half).toBeCloseTo(full / 2, 5);
    actor.setStrideSpeed(0);
    const stopped = actor.playback.frame;
    actor.sample(clip, 0.1);
    expect(actor.playback.frame).toBe(stopped);
    actor.dispose();
  }
});

it('finishes practical gestures at their own pace while the traveler is stationary', () => {
  const actor = new Actor(library.instantiate('traveler', 'stationary-work'));
  actor.setStrideSpeed(0);
  actor.playOnce('Repair');
  actor.sample('Idle', 0.1);
  const start = actor.playback.frame;
  actor.sample('Idle', 0.1);
  expect(actor.playback.clip).toBe('Repair');
  expect(actor.playback.frame).toBeGreaterThan(start);
  actor.dispose();
});

function actionWorld() {
  vi.stubGlobal('document', { hidden: false });
  const actor = new Actor(library.instantiate('traveler', 'work-to-walk'), true);
  const player = new TransformNode('work-to-walk-root', scene);
  actor.root.parent = player;
  const camera = new ArcRotateCamera(
    'work-to-walk-camera',
    -Math.PI / 2,
    0.8,
    24,
    Vector3.Zero(),
    scene,
  );
  const world = Object.assign(Object.create(World.prototype), {
    state: newGame(),
    position: { x: 0, z: 0.3 },
    player,
    playerModel: actor.root,
    actorPlayer: actor,
    actors: new Map(),
    camera,
    keys: new Set<string>(),
    path: [],
    grid: new WalkGrid(),
    routeDots: [],
    marker: { setEnabled: vi.fn() },
    stage: { atmosphere: { footstep: vi.fn() } },
    showRoute: vi.fn(),
    callbacks: { interact: vi.fn() },
    paused: false,
    reducedMotion: false,
    time: 0,
    strideTime: 0,
    walkRamp: 0,
    destinations: [],
  });
  actor.playOnce('Repair');
  actor.sample('Idle', 0.1);
  const dispose = () => {
    actor.dispose();
    player.dispose();
    camera.dispose();
    vi.unstubAllGlobals();
  };
  return { world, actor, dispose };
}

it.each(['keyboard', 'route', 'carrying'] as const)(
  'resumes the actual locomotion clip after %s movement interrupts a practical gesture',
  (mode) => {
    const { world, actor, dispose } = actionWorld();
    try {
      if (mode === 'route') world.path = [{ x: 0, z: 2 }];
      else world.keys.add('w');
      if (mode === 'carrying') world.state.campaign.carrying = 'cart-handle';
      const position = { ...world.position };
      world.simulate(0.1);
      expect(world.position).not.toEqual(position);
      expect(actor.performing).toBe(false);
      expect(actor.playback.action).toBe('');
      expect(actor.playback.clip).toBe(mode === 'carrying' ? 'Carry' : 'Walk');
      expect(actor.playback.frame).toBeGreaterThan(0);
    } finally {
      dispose();
    }
  },
);

it.each(['stationary', 'blocked', 'paused', 'seated'] as const)(
  'keeps the practical gesture intact while %s',
  (mode) => {
    const { world, actor, dispose } = actionWorld();
    try {
      if (mode !== 'stationary') world.keys.add('w');
      if (mode === 'blocked') world.grid = new WalkGrid([], (point) => point.z <= 0);
      if (mode === 'paused') world.paused = true;
      if (mode === 'seated') {
        world.seatedAction = { time: 1.2, x: 0.3, z: 0.2, started: true };
        actor.playOnce('SitDown');
      }
      const position = { ...world.position };
      const frame = actor.playback.frame;
      world.simulate(0.1);
      expect(world.position).toEqual(position);
      expect(actor.performing).toBe(true);
      expect(actor.playback.action).toBe(mode === 'seated' ? 'SitDown' : 'Repair');
      if (mode === 'paused') expect(actor.playback.frame).toBe(frame);
      else expect(actor.playback.frame).toBeGreaterThan(frame);
    } finally {
      dispose();
    }
  },
);

/** Keep the same physical nose vertices as the traveler turns and the imported skin moves. */
function trackFaceDirection(actor: Actor): () => Vector3 {
  actor.sampleAt('Idle', 0);
  const head = posedVertices(actor.root, 'head');
  const front = Math.min(...head.map((p) => p.z));
  const noseIndices = head.flatMap((p, i) => (p.z <= front + 0.003 ? [i] : []));
  const joint = actor.model.socket('head');
  expect(noseIndices.length).toBeGreaterThan(0);
  return () => {
    const points = posedVertices(actor.root, 'head');
    const nose = noseIndices
      .reduce((sum, i) => sum.addInPlace(points[i]!), Vector3.Zero())
      .scale(1 / noseIndices.length);
    const forward = nose.subtract(joint.getAbsolutePosition());
    forward.y = 0;
    return forward.normalize();
  };
}

it.each([
  { phase: 'approach', time: 0.2, x: -1.2, z: 0.6 },
  { phase: 'approach', time: 0.2, x: 0.6, z: -1.2 },
  { phase: 'approach', time: 0.2, x: 0, z: 1.2 },
  { phase: 'retreat', time: 3.5, x: -1.2, z: 0.6 },
  { phase: 'retreat', time: 3.5, x: 0.6, z: -1.2 },
  { phase: 'retreat', time: 3.5, x: 0, z: 1.2 },
])('faces actual bench $phase travel from offset ($x, $z)', ({ time, x, z }) => {
  const { world, actor, dispose } = actionWorld();
  try {
    const faceDirection = trackFaceDirection(actor);
    const navigationPosition = { ...world.position };
    world.seatedAction = { time, x, z, started: true };
    world.simulate(0.05);
    actor.root.computeWorldMatrix(true);
    const before = actor.root.getAbsolutePosition().clone();
    world.simulate(0.1);
    actor.root.computeWorldMatrix(true);
    const movement = actor.root.getAbsolutePosition().subtract(before).normalize();
    expect(movement.lengthSquared()).toBeGreaterThan(0);
    expect(Vector3.Dot(faceDirection(), movement)).toBeGreaterThan(0.99);
    expect(actor.playback.clip).toBe('Walk');
    expect(world.position).toEqual(navigationPosition);
  } finally {
    dispose();
  }
});

it('keeps the bench sitting heading while starting the sitting gesture', () => {
  const { world, actor, dispose } = actionWorld();
  try {
    const faceDirection = trackFaceDirection(actor);
    const navigationPosition = { ...world.position };
    world.seatedAction = { time: 1.2, x: -1.2, z: 0.6, started: false };
    world.simulate(0.1);
    expect(Vector3.Dot(faceDirection(), new Vector3(0, 0, 1))).toBeGreaterThan(0.99);
    expect(actor.root.position.asArray()).toEqual([-1.2, 0, 0.6]);
    expect(actor.root.rotation.y).toBe(Math.PI);
    expect(actor.playback.action).toBe('SitDown');
    expect(world.position).toEqual(navigationPosition);
  } finally {
    dispose();
  }
});

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
