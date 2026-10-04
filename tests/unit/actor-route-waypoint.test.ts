import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { WalkGrid, findPath, distance } from '../../src/game/pathfinding';
import { npcGeometryError, npcSkin } from '../helpers/npc-geometry';

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

/** Read the actual imported group; these controls do not assume a packed clip's FPS or range. */
function importedClip(a: Actor, name: 'Walk' | 'Use') {
  const group = a.model.animations.find((value) => value.name.split(':').at(-1) === name);
  if (!group) throw new Error('Imported villager is missing ' + name);
  const fps = group.targetedAnimations[0]?.animation.framePerSecond;
  if (!fps || fps <= 0 || !Number.isFinite(fps))
    throw new Error('Imported clip has no finite positive FPS');
  expect(group.targetedAnimations.length).toBeGreaterThan(0);
  expect(group.targetedAnimations.every(({ animation }) => animation.getKeys().length > 0)).toBe(
    true,
  );
  expect(Number.isFinite(group.from) && Number.isFinite(group.to)).toBe(true);
  expect(group.to).toBeGreaterThan(group.from);
  return { group, fps };
}

it('samples only the actual final partial A* leg before returning to Idle on the next callback', () => {
  const p = twins(),
    goal = { x: 0, z: 2 },
    route = findPath(new WalkGrid(), { x: 0, z: 0 }, goal),
    original = structuredClone(route),
    dt = 0.05;
  try {
    const { group, fps } = importedClip(p.a, 'Walk');
    expect(route[0]).toEqual({ x: 0, z: 0 });
    expect(route.at(-1)).toEqual(goal);
    for (const a of [p.a, p.b]) {
      a.face(goal);
      a.walk(route);
    }
    // Ordinary capped callbacks reach the final leg without seeking or writing the actor's root.
    for (let i = 0; i < 29; i++) {
      const before = p.a.snapshotPose();
      p.a.tick(dt, false);
      p.b.tick(dt, false);
      expect(p.a.playback.clip).toBe('Walk');
      expect(p.a.snapshotPose().elapsed).toBeCloseTo(
        (before.clip === 'Walk' ? before.elapsed : 0) + (dt * 1.35) / 3.25,
        12,
      );
      same(p.a, p.b);
    }
    const at = p.a.root.position.clone(),
      remaining = distance(at, goal),
      before = p.a.snapshotPose(),
      heading = p.a.root.rotation.y;
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(dt * 1.35);
    p.a.tick(dt, false);
    // Independent public reference spends only the physical time needed for that same last leg.
    p.b.tick(remaining / 1.35, false);
    expect(p.a.root.position.asArray()).toEqual([goal.x, 0, goal.z]);
    expect(distance(at, p.a.root.position)).toBe(remaining);
    expect(p.a.root.rotation.y).toBe(heading);
    expect(p.b.root.rotation.y).toBe(heading);
    expect(p.a.playback.clip).toBe('Walk');
    expect(p.a.snapshotPose().elapsed - before.elapsed).toBeCloseTo(remaining / 3.25, 12);
    expect(p.a.playback.frame).toBeCloseTo(
      group.from + (((before.elapsed + remaining / 3.25) * fps) % (group.to - group.from)),
      12,
    );
    expect(p.a.snapshotPose().elapsed).toBeCloseTo(p.b.snapshotPose().elapsed, 12);
    expect(p.a.playback.frame).toBeCloseTo(p.b.playback.frame, 12);
    // The completed exploration blend lets the imported whole body validate the phase reference.
    const error = npcGeometryError(npcSkin(p.b), npcSkin(p.a), 0);
    expect(error.skin).toBeLessThan(3e-6);
    expect(error.local).toBeLessThan(3e-6);
    expect(route).toEqual(original);
    p.a.tick(dt, false);
    expect(p.a.playback.clip).toBe('Idle');
    expect(p.a.root.position.asArray()).toEqual([goal.x, 0, goal.z]);
    expect(p.a.root.rotation.y).toBe(heading);
    expect(p.a.snapshotPose().elapsed).toBe(dt);
  } finally {
    p.dispose();
  }
});

it('accounts for both traveled corner legs rather than the shorter final displacement chord', () => {
  const a = actor(),
    dt = 0.05;
  try {
    const { group, fps } = importedClip(a, 'Walk');
    a.face({ x: 2, z: 0 });
    a.walk(findPath(new WalkGrid(), { x: 0, z: 0 }, { x: 2, z: 0 }));
    for (let i = 0; i < 20; i++) a.tick(dt, false);
    const start = { x: a.root.position.x, z: a.root.position.z },
      corner = { x: start.x + 0.02, z: start.z },
      goal = { x: corner.x, z: corner.z + 0.02 },
      route = [start, corner, goal, goal],
      original = structuredClone(route),
      traveled = distance(start, corner) + distance(corner, goal),
      chord = distance(start, goal),
      before = a.snapshotPose();
    expect(traveled).toBeGreaterThan(chord);
    expect(traveled).toBeLessThan(dt * 1.35);
    a.walk(route);
    a.tick(dt, false);
    expect(a.root.position.asArray()).toEqual([goal.x, 0, goal.z]);
    expect(a.playback.clip).toBe('Walk');
    expect(a.snapshotPose().elapsed - before.elapsed).toBeCloseTo(traveled / 3.25, 12);
    expect(a.playback.frame).toBeCloseTo(
      group.from + (((before.elapsed + traveled / 3.25) * fps) % (group.to - group.from)),
      12,
    );
    expect(route).toEqual(original);
    const heading = a.root.rotation.y;
    a.tick(dt, false);
    expect(a.playback.clip).toBe('Idle');
    expect(a.root.position.asArray()).toEqual([goal.x, 0, goal.z]);
    expect(a.root.rotation.y).toBe(heading);
  } finally {
    a.dispose();
  }
});

it('keeps finite Use time and the imported body identical across partial and full movement budgets', () => {
  const p = twins(),
    dt = 0.05,
    partial = { x: 0.005, z: 0 },
    full = { x: 2, z: 0 };
  try {
    const { group, fps } = importedClip(p.a, 'Use');
    expect(p.a.clipDuration('Use')).toBeGreaterThan(2 * dt);
    for (const a of [p.a, p.b]) {
      a.face(full);
      a.playOnce('Use');
    }
    p.a.walk([partial]);
    p.b.walk([full]);
    p.a.tick(dt, false);
    p.b.tick(dt, false);
    expect(p.a.root.position.asArray()).toEqual([partial.x, 0, partial.z]);
    expect(distance({ x: 0, z: 0 }, p.b.root.position)).toBe(dt * 1.35);
    expect(p.a.root.rotation.asArray()).toEqual(p.b.root.rotation.asArray());
    expect(p.a.performing).toBe(true);
    expect(p.b.performing).toBe(true);
    expect(p.a.snapshotPose().oneShot).toEqual({ name: 'Use', time: dt });
    expect(p.a.playback.frame).toBe(group.from + dt * fps);
    expect(p.a.snapshotPose()).toEqual(p.b.snapshotPose());
    // Placement differs legitimately; compare every actually skinned vertex after that translation.
    const partialSkin = npcSkin(p.a),
      fullSkin = npcSkin(p.b),
      partialRoot = p.a.root.position.asArray(),
      fullRoot = p.b.root.position.asArray();
    expect(partialSkin.coordinates.length).toBe(fullSkin.coordinates.length);
    expect(partialSkin.coordinates.length).toBeGreaterThan(0);
    let error = 0;
    for (let i = 0; i < partialSkin.coordinates.length; i++)
      error = Math.max(
        error,
        Math.abs(
          partialSkin.coordinates[i]! -
            partialRoot[i % 3]! -
            (fullSkin.coordinates[i]! - fullRoot[i % 3]!),
        ),
      );
    expect(error).toBeLessThan(3e-6);
    p.a.tick(dt, false);
    p.b.tick(dt, false);
    expect(p.a.performing).toBe(true);
    expect(p.a.snapshotPose().oneShot).toEqual({ name: 'Use', time: 2 * dt });
    expect(p.a.snapshotPose()).toEqual(p.b.snapshotPose());
  } finally {
    p.dispose();
  }
});
