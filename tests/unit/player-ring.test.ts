import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Actor } from '../../src/scene/actors/actor';
import { TravelerBoat } from '../../src/scene/actors/boat';
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { BENCH_TURN_TIME, BENCH_WALK_SPEED } from '../../src/scene/bench-motion';
import { WalkGrid } from '../../src/game/pathfinding';
import { DEFAULT_SETTINGS } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { action, completedEpisode } from '../helpers/campaign';
import { posedVertices } from '../helpers/posed-geometry';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    // Keep the production importer and packed models; replace only network transport.
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

let engine: NullEngine, scene: Scene, library: AssetLibrary;
let serial = 0;
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['traveler', 'boat', 'oar'], () => {});
}, 60_000);
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

function fixture(height?: (x: number, z: number) => number) {
  vi.stubGlobal('document', { hidden: false });
  const actor = new Actor(library.instantiate('traveler', 'ring-traveler-' + serial++), true);
  const player = new TransformNode('ring-navigation', scene);
  const position = { x: 3, z: 5.4 };
  const floor = height
    ? CreateGround('ring-floor', { width: 24, height: 24, subdivisions: 24 }, scene)
    : undefined;
  if (floor) {
    const vertices = floor.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < vertices.length; i += 3)
      vertices[i + 1] = height!(vertices[i]!, vertices[i + 2]!);
    floor.setVerticesData(VertexBuffer.PositionKind, vertices);
    floor.refreshBoundingInfo();
    floor.updateCoordinateHeights();
  }
  player.position.set(
    position.x,
    floor?.getHeightAtCoordinates(position.x, position.z) ?? 0,
    position.z,
  );
  actor.root.parent = player;
  const ring = CreateTorus(
    'player-ring',
    { diameter: 0.92, thickness: 0.025, tessellation: 40 },
    scene,
  );
  ring.parent = player;
  ring.position.y = 0.045;
  ring.isPickable = false;
  const camera = new ArcRotateCamera(
    'ring-camera',
    -Math.PI / 2,
    0.8,
    24,
    new Vector3(position.x, 0, position.z + 2),
    scene,
  );
  let earned = completedEpisode();
  for (const id of [
    'life-bench-inspect',
    'life-method-lashing',
    'life-clear-bench',
    'life-take-lashing',
    'life-fit-lashing',
  ])
    earned = action(earned, id);
  const state = transition(
    { ...earned, position },
    { type: 'campaign-action', id: 'life-test-bench' },
  );
  expect(state.life.bench.stage).toBe('complete');
  const world = Object.assign(Object.create(World.prototype), {
    state,
    position: { ...position },
    player,
    playerModel: actor.root,
    actorPlayer: actor,
    playerRing: ring,
    camera,
    cameraAspectScale: 1,
    floor,
    actors: new Map(),
    boats: [],
    people: new Map(),
    keys: new Set<string>(),
    path: [],
    grid: new WalkGrid(),
    routeDots: [],
    marker: { position: Vector3.Zero(), setEnabled: vi.fn() },
    stage: { atmosphere: { footstep: vi.fn() }, applySettings: vi.fn() },
    showRoute: vi.fn(),
    callbacks: { interact: vi.fn() },
    paused: false,
    reducedMotion: false,
    time: 0,
    strideTime: 0,
    walkRamp: 0,
    destinations: [{ id: 'landing-bench', x: 3, z: 7 }],
  });
  const snapshot = () => ({
    position: { ...world.position },
    navigation: player.position.asArray(),
    rotation: player.rotation.asArray(),
    cameraTarget: camera.target.asArray(),
    state: structuredClone(world.state),
  });
  const pose = (phase: 'approach' | 'turn' | 'seated' | 'retreat') => {
    world.performInteraction('SitDown', 'landing-bench');
    const motion = world.seatedAction!;
    const approach = motion.length / BENCH_WALK_SPEED;
    const sitting = approach + BENCH_TURN_TIME;
    const duration = actor.clipDuration('SitDown');
    motion.time = {
      approach: approach * 0.5,
      turn: approach + BENCH_TURN_TIME * 0.5,
      seated: sitting + duration * 0.5,
      retreat: sitting + duration + approach * 0.5,
    }[phase];
    world.poseTraveler(false, 0);
  };
  const aligned = () => {
    actor.root.computeWorldMatrix(true);
    ring.computeWorldMatrix(true);
    const displayed = actor.root.getAbsolutePosition();
    // Measure the actual torus geometry center, not a test-only marker coordinate.
    const center = ring.getBoundingInfo().boundingBox.centerWorld;
    expect(center.x).toBeCloseTo(displayed.x, 6);
    expect(center.z).toBeCloseTo(displayed.z, 6);
    expect(center.y).toBeCloseTo(
      (floor?.getHeightAtCoordinates(displayed.x, displayed.z) ?? 0) + 0.045,
      6,
    );
    expect(ring.parent).toBe(player);
    expect(ring.isPickable).toBe(false);
    return center.clone();
  };
  return {
    world,
    actor,
    player,
    ring,
    camera,
    floor,
    pose,
    aligned,
    snapshot,
    dispose: () => {
      actor.dispose();
      player.dispose();
      camera.dispose();
      floor?.dispose();
      vi.unstubAllGlobals();
    },
  };
}

it.each(['approach', 'turn', 'seated', 'retreat'] as const)(
  'keeps the real player torus under the packed actor during %s, without moving gameplay anchors',
  (phase) => {
    const { actor, ring, pose, aligned, snapshot, dispose } = fixture();
    try {
      const before = snapshot();
      pose(phase);
      expect(actor.playback.clip).toBe(
        phase === 'seated' ? 'SitDown' : phase === 'turn' ? 'Idle' : 'Walk',
      );
      const skin = posedVertices(actor.root);
      expect(skin.length).toBeGreaterThan(100);
      expect(skin.every((p) => p.asArray().every(Number.isFinite))).toBe(true);
      const center = aligned();
      expect(center.x).toBeGreaterThanOrEqual(Math.min(...skin.map((p) => p.x)));
      expect(center.x).toBeLessThanOrEqual(Math.max(...skin.map((p) => p.x)));
      expect(ring.position.length()).toBeGreaterThan(0.05);
      expect(snapshot()).toEqual(before);
    } finally {
      dispose();
    }
  },
);

it('follows the complete cosmetic clock and returns the ring to its original local position', () => {
  const { world, ring, actor, aligned, snapshot, dispose } = fixture();
  try {
    const before = snapshot();
    world.performInteraction('SitDown', 'landing-bench');
    const finish =
      (world.seatedAction.length / BENCH_WALK_SPEED) * 2 +
      BENCH_TURN_TIME +
      actor.clipDuration('SitDown');
    for (let time = 0; time <= finish + 0.05; time += 0.05) {
      world.poseTraveler(false, 0.05);
      aligned();
      expect(snapshot()).toEqual(before);
    }
    expect(world.seatedAction).toBeUndefined();
    expect(ring.position.asArray()).toEqual([0, 0.045, 0]);
  } finally {
    dispose();
  }
});

it('freezes ring and actor together on pause and resumes the same finite clock', () => {
  const { world, actor, ring, pose, aligned, snapshot, dispose } = fixture();
  try {
    pose('seated');
    const before = snapshot(),
      at = ring.position.clone(),
      actorAt = actor.root.position.clone();
    const frame = actor.playback.frame,
      time = world.seatedAction.time;
    world.setPaused(true);
    world.simulate(0.5);
    expect(ring.position.equals(at)).toBe(true);
    expect(actor.root.position.equals(actorAt)).toBe(true);
    expect(actor.playback.frame).toBe(frame);
    expect(world.seatedAction.time).toBe(time);
    world.setPaused(false);
    world.simulate(0.05);
    expect(world.seatedAction.time).toBeCloseTo(time + 0.05, 8);
    expect(actor.playback.frame).toBeGreaterThan(frame);
    aligned();
    expect(snapshot()).toEqual(before);
  } finally {
    dispose();
  }
});

it.each(['clear', 'cancel', 'walk', 'position', 'other action'] as const)(
  'synchronously restores the ring when %s clears the cosmetic seat',
  (reason) => {
    const { world, ring, pose, aligned, snapshot, dispose } = fixture();
    try {
      pose('seated');
      const before = snapshot();
      expect(ring.position.x).not.toBe(0);
      if (reason === 'clear') world.clearSeatedAction();
      else if (reason === 'cancel') world.stop();
      else if (reason === 'walk') expect(world.walkTo({ x: 1, z: 5.4 })).toBe(true);
      else if (reason === 'position') world.setPosition({ ...world.position });
      else world.performInteraction('Repair');
      // No extra render or animation sample is allowed to repair a stale ring here.
      expect(world.seatedAction).toBeUndefined();
      expect(ring.position.asArray()).toEqual([0, 0.045, 0]);
      aligned();
      expect(snapshot()).toEqual(before);
    } finally {
      dispose();
    }
  },
);

it('keeps the current cosmetic ring and actor paired when the camera is reset', () => {
  const { world, actor, ring, camera, pose, aligned, snapshot, dispose } = fixture();
  try {
    pose('seated');
    const before = snapshot(),
      at = ring.position.clone(),
      actorAt = actor.root.position.clone();
    camera.alpha = 0.2;
    world.resetCamera();
    expect(camera.alpha).toBe(-Math.PI / 2 - 0.45);
    expect(ring.position.equals(at)).toBe(true);
    expect(actor.root.position.equals(actorAt)).toBe(true);
    aligned();
    expect(snapshot()).toEqual(before);
  } finally {
    dispose();
  }
});

it.each(['existing seat', 'new seat'] as const)(
  'retains the ordinary ring with reduced motion and %s',
  (mode) => {
    const { world, ring, pose, aligned, snapshot, dispose } = fixture();
    try {
      const before = snapshot();
      if (mode === 'existing seat') pose('seated');
      world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
      if (mode === 'new seat') world.performInteraction('SitDown', 'landing-bench');
      expect(world.seatedAction).toBeUndefined();
      expect(ring.position.asArray()).toEqual([0, 0.045, 0]);
      aligned();
      expect(snapshot()).toEqual(before);
    } finally {
      dispose();
    }
  },
);

it('reads rendered sloping triangles at the displayed actor, independently of its vertical pose', () => {
  const curve = (x: number, z: number) => 0.025 * x * x + 0.06 * z;
  const { world, actor, ring, player, floor, pose, aligned, snapshot, dispose } = fixture(curve);
  try {
    const before = snapshot();
    for (const phase of ['approach', 'turn', 'seated', 'retreat'] as const) {
      pose(phase);
      const center = aligned();
      expect(center.y).not.toBeCloseTo(player.position.y + 0.045, 3);
      expect(snapshot()).toEqual(before);
    }
    actor.root.position.y += 0.8;
    world.syncPlayerRing();
    const center = aligned();
    expect(center.y).toBeCloseTo(floor!.getHeightAtCoordinates(center.x, center.z) + 0.045, 6);
    expect(ring.position.y).not.toBe(actor.root.position.y + 0.045);
  } finally {
    dispose();
  }
});

it('keeps the real rower ring centered on its hull navigation parent at its established scale', () => {
  const { world, actor, ring, player, snapshot, dispose } = fixture();
  try {
    world.travelerBoat = new TravelerBoat(library, player, actor);
    player.rotation.y = 0.4;
    ring.scaling.setAll(2.2);
    const before = snapshot();
    for (let step = 0; step < 12; step++) {
      world.poseTraveler(true, 0.05, 3.25);
      expect(actor.playback.clip).toBe('Row');
      expect(actor.root.position.asArray()).toEqual([0, 0.19, -0.45]);
      expect(ring.position.asArray()).toEqual([0, 0.045, 0]);
      expect(ring.scaling.asArray()).toEqual([2.2, 2.2, 2.2]);
      expect(ring.parent).toBe(player);
      expect(snapshot()).toEqual(before);
    }
  } finally {
    dispose();
  }
});
