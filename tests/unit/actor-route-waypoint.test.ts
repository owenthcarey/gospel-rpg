import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { WalkGrid, findPath, distance } from '../../src/game/pathfinding';
import { npcSkin } from '../helpers/npc-geometry';

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
let engine: NullEngine,
  scene: Scene,
  library: AssetLibrary,
  serial = 0;
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['villager'], () => {});
});
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});
function actor() {
  return new Actor(library.instantiate('villager', 'route-waypoint-' + serial++), true);
}
function twins() {
  const a = actor(),
    b = actor();
  return {
    a,
    b,
    dispose: () => {
      a.dispose();
      b.dispose();
    },
  };
}
function same(a: Actor, b: Actor) {
  expect(a.root.position.asArray()).toEqual(b.root.position.asArray());
  expect(a.root.rotation.asArray()).toEqual(b.root.rotation.asArray());
  expect(a.snapshotPose()).toEqual(b.snapshotPose());
  // The facing comparison includes all actually posed body/head vertices, not only a scalar yaw.
  expect(npcSkin(a).coordinates).toEqual(npcSkin(b).coordinates);
}

it.each([
  { x: 2, z: 0 },
  { x: -2, z: 0 },
  { x: 0, z: 2 },
  { x: 0, z: -2 },
])(
  'keeps an already aligned villager facing its actual next leg from a real A* starting cell %o',
  (goal) => {
    const p = twins(),
      start = { x: 0, z: 0 },
      route = findPath(new WalkGrid(), start, goal),
      original = structuredClone(route);
    try {
      // Production findPath intentionally retains this point to protect continuous corner approaches.
      expect(route[0]).toEqual(start);
      expect(route.length).toBeGreaterThan(1);
      for (const a of [p.a, p.b]) {
        a.sample('Idle', 0.2);
        a.face(goal);
      }
      const heading = p.a.root.rotation.y;
      p.a.walk(route);
      p.b.walk(route.slice(1));
      p.a.tick(0.05, false);
      p.b.tick(0.05, false);
      expect(distance(start, p.a.root.position)).toBeCloseTo(1.35 * 0.05, 12);
      expect(p.a.root.rotation.y).toBe(heading);
      expect(p.a.playback.clip).toBe('Walk');
      expect(p.a.playback.frame).toBeGreaterThan(0);
      same(p.a, p.b);
      expect(route).toEqual(original);
    } finally {
      p.dispose();
    }
  },
);

it('finishes a route with a repeated destination without turning away after its actual final movement', () => {
  const p = twins(),
    goal = { x: 1, z: 0 };
  try {
    for (const a of [p.a, p.b]) a.face(goal);
    const heading = p.a.root.rotation.y;
    p.a.walk([goal, goal]);
    p.b.walk([goal]);
    p.a.tick(1, false);
    p.b.tick(1, false);
    expect(p.a.root.position.x).toBe(goal.x);
    expect(p.a.root.position.z).toBe(goal.z);
    expect(p.a.root.rotation.y).toBe(heading);
    same(p.a, p.b);
    p.a.tick(0.05, false);
    p.b.tick(0.05, false);
    expect(p.a.playback.clip).toBe('Idle');
    same(p.a, p.b);
  } finally {
    p.dispose();
  }
});

it('retains real Idle rather than phantom Walk when A* returns only the current cell', () => {
  const p = twins(),
    start = { x: 0, z: 0 },
    route = findPath(new WalkGrid(), start, start);
  try {
    expect(route).toEqual([start]);
    for (const a of [p.a, p.b]) {
      a.sample('Idle', 0.2);
      a.root.rotation.y = 0.7;
    }
    p.a.walk(route);
    p.a.tick(0.1, false);
    p.b.tick(0.1, false);
    expect(p.a.root.position.asArray()).toEqual([0, 0, 0]);
    expect(p.a.root.rotation.y).toBe(0.7);
    expect(p.a.playback.clip).toBe('Idle');
    same(p.a, p.b);
  } finally {
    p.dispose();
  }
});

it('keeps a zero-time route sample stationary with its existing rig clock and heading', () => {
  const a = actor();
  try {
    a.sample('Idle', 0.2);
    a.root.rotation.y = 0.7;
    const pose = a.snapshotPose(),
      skin = npcSkin(a);
    a.walk([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    ]);
    a.tick(0, false);
    expect(a.snapshotPose()).toEqual(pose);
    expect(a.root.position.asArray()).toEqual([0, 0, 0]);
    expect(a.root.rotation.y).toBe(0.7);
    expect(npcSkin(a).coordinates).toEqual(skin.coordinates);
  } finally {
    a.dispose();
  }
});

it('retains an actual small positive segment instead of broadening the coincident waypoint rule', () => {
  const a = actor(),
    goal = { x: 0.00000001, z: 0 };
  try {
    a.root.rotation.y = 0.7;
    a.walk([goal]);
    a.tick(0.05, false);
    expect(a.root.position.x).toBe(goal.x);
    expect(a.root.position.z).toBe(goal.z);
    expect(a.root.rotation.y).not.toBe(0.7);
    expect(a.playback.clip).toBe('Walk');
    expect(a.playback.frame).toBeGreaterThan(0);
  } finally {
    a.dispose();
  }
});

it('retains actual finite gesture playback while a coincident-only route contributes no movement', () => {
  const p = twins();
  try {
    for (const a of [p.a, p.b]) {
      a.root.rotation.y = 0.7;
      a.playOnce('Use');
    }
    p.a.walk([{ x: 0, z: 0 }]);
    p.a.tick(0.1, false);
    p.b.tick(0.1, false);
    expect(p.a.performing).toBe(true);
    expect(p.a.playback.clip).toBe('Use');
    expect(p.a.playback.frame).toBeGreaterThan(0);
    expect(p.a.root.rotation.y).toBe(0.7);
    same(p.a, p.b);
  } finally {
    p.dispose();
  }
});

it('preserves the existing reduced scripted-route endpoint and frozen Idle sampling policy', () => {
  const p = twins(),
    goal = { x: 2, z: 0 };
  try {
    for (const a of [p.a, p.b]) {
      a.sample('Idle', 0, true);
      a.face(goal);
    }
    const pose = p.a.snapshotPose(),
      heading = p.a.root.rotation.y;
    p.a.walk([{ x: 0, z: 0 }, goal]);
    p.b.walk([goal]);
    p.a.tick(0.1, true);
    p.b.tick(0.1, true);
    expect(p.a.root.position.x).toBe(goal.x);
    expect(p.a.root.position.z).toBe(goal.z);
    expect(p.a.root.rotation.y).toBe(heading);
    expect(p.a.snapshotPose()).toEqual(pose);
    same(p.a, p.b);
  } finally {
    p.dispose();
  }
});
