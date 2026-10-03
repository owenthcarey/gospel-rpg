import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { World } from '../../src/scene/world';
import { benchMotion, BENCH_TURN_TIME, BENCH_WALK_SPEED } from '../../src/scene/bench-motion';
import { WalkGrid } from '../../src/game/pathfinding';
import { newGame } from '../../src/game/types';
import { posedVertices } from '../helpers/posed-geometry';

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

let engine: NullEngine, scene: Scene, library: AssetLibrary;
let serial = 0;
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['traveler'], () => {});
}, 60_000);
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

type SurfaceHeight = (x: number, z: number) => number;
const flat: SurfaceHeight = () => 0;
const slope: SurfaceHeight = (x, z) => 0.08 * x + 0.1 * z;
function fixture(height?: SurfaceHeight) {
  vi.stubGlobal('document', { hidden: false });
  const actor = new Actor(library.instantiate('traveler', 'grounded-traveler-' + serial++), true);
  const player = new TransformNode('grounded-navigation', scene);
  player.position.z = 0.3;
  actor.root.parent = player;
  const camera = new ArcRotateCamera(
    'grounded-camera',
    -Math.PI / 2,
    0.8,
    24,
    Vector3.Zero(),
    scene,
  );
  const floor = height
    ? CreateGround('grounded-floor', { width: 16, height: 16, subdivisions: 16 }, scene)
    : undefined;
  if (floor) {
    const positions = floor.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < positions.length; i += 3)
      positions[i + 1] = height!(positions[i]!, positions[i + 2]!);
    floor.setVerticesData(VertexBuffer.PositionKind, positions);
    floor.refreshBoundingInfo();
    floor.updateCoordinateHeights();
  }
  const world = Object.assign(Object.create(World.prototype), {
    state: newGame(),
    position: { x: 0, z: 0.3 },
    player,
    playerModel: actor.root,
    actorPlayer: actor,
    actors: new Map(),
    camera,
    floor,
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
  return {
    world,
    actor,
    floor,
    dispose: () => {
      actor.dispose();
      player.dispose();
      camera.dispose();
      floor?.dispose();
      vi.unstubAllGlobals();
    },
  };
}

/** Full Babylon skin deformation, independent of the cached rigid-vertex query. */
function clearances(actor: Actor, height: SurfaceHeight) {
  return Object.fromEntries(
    (['left', 'right'] as const).map((side) => [
      side,
      Math.min(...posedVertices(actor.root, 'leg_' + side).map((p) => p.y - height(p.x, p.z))),
    ]),
  ) as { left: number; right: number };
}
function supported(actor: Actor, height: SurfaceHeight) {
  const feet = clearances(actor, height),
    cached = actor.footClearance(height);
  expect(cached.left).toBeCloseTo(feet.left, 6);
  expect(cached.right).toBeCloseTo(feet.right, 6);
  expect(feet.left, 'left foot terrain clearance').toBeGreaterThanOrEqual(-0.000002);
  expect(feet.right, 'right foot terrain clearance').toBeGreaterThanOrEqual(-0.000002);
  // One foot may be in the air during an authored stride; measure both rather than hiding it.
  expect(Math.min(feet.left, feet.right)).toBeLessThan(0.01);
  expect(Math.max(feet.left, feet.right)).toBeLessThan(0.16);
  return feet;
}

it.each(['Idle', 'Walk', 'Carry', 'MatCarry'] as const)(
  'supports the displayed %s skin on flat ground and retains each foot measurement',
  (clip) => {
    const { world, actor, dispose } = fixture();
    try {
      world.activity = { playerClip: () => clip };
      const nav = { ...world.position },
        root = world.player.position.clone(),
        state = JSON.stringify(world.state);
      const soles: { left: number; right: number }[] = [];
      const heads: number[] = [];
      for (let step = 0; step < 120; step++) {
        world.poseTraveler(clip !== 'Idle', 1 / 60, 3.25);
        expect(actor.playback.clip).toBe(clip);
        soles.push(supported(actor, flat));
        heads.push(actor.model.socket('head').getAbsolutePosition().y);
      }
      if (clip !== 'Idle') {
        for (const side of ['left', 'right'] as const) {
          const heights = soles.map((feet) => feet[side]);
          expect(
            Math.max(...heights) - Math.min(...heights),
            side + ' still steps',
          ).toBeGreaterThan(0.02);
        }
        const bob = Math.max(...heads) - Math.min(...heads);
        expect(bob, 'authored motion remains visible').toBeGreaterThan(0.005);
        expect(bob, 'grounding does not create an excessive vertical bounce').toBeLessThan(0.12);
      }
      expect(world.position).toEqual(nav);
      expect(world.player.position.equals(root)).toBe(true);
      expect(JSON.stringify(world.state)).toBe(state);
    } finally {
      dispose();
    }
  },
);

it.each(['Idle', 'Walk', 'Carry', 'MatCarry'] as const)(
  'measures terrain under both %s feet after roll and a translated/turned navigation parent',
  (clip) => {
    const { world, actor, dispose } = fixture(slope);
    try {
      world.activity = { playerClip: () => clip };
      world.position = { x: 1.3, z: 1.4 };
      world.player.position.set(1.3, slope(1.3, 1.4), 1.4);
      actor.root.rotation.y = Math.PI / 3;
      const nav = { ...world.position },
        root = world.player.position.clone();
      for (let step = 0; step < 100; step++) {
        world.poseTraveler(clip !== 'Idle', 1 / 60, clip === 'Idle' ? 0 : 1.625);
        supported(actor, slope);
      }
      expect(world.position).toEqual(nav);
      expect(world.player.position.equals(root)).toBe(true);
    } finally {
      dispose();
    }
  },
);

it('uses the rendered sloping triangles rather than only analytic or navigation-root height', () => {
  const curved: SurfaceHeight = (x, z) => 0.1 * x * x + 0.07 * z;
  const { world, actor, floor, dispose } = fixture(curved);
  try {
    world.position = { x: 0.5, z: 0.3 };
    world.player.position.set(0.5, curved(0.5, 0.3), 0.3);
    const rendered = (x: number, z: number) => floor!.getHeightAtCoordinates(x, z);
    expect(rendered(0.5, 0.3) - curved(0.5, 0.3)).toBeCloseTo(0.025, 6);
    for (let step = 0; step < 100; step++) {
      world.poseTraveler(true, 1 / 60, 3.25);
      supported(actor, rendered);
    }
    expect(world.player.position.y).toBe(curved(0.5, 0.3));
  } finally {
    dispose();
  }
});

it.each(['Idle', 'Carry'] as const)('keeps the actual Walk→%s blend clear of terrain', (next) => {
  const { world, actor, dispose } = fixture(slope);
  try {
    world.poseTraveler(true, 0.3, 3.25);
    const before = actor.playback.frame;
    world.activity = { playerClip: () => next };
    for (let step = 0; step < 12; step++) {
      world.poseTraveler(next === 'Carry', 0.02, 1.3);
      expect(actor.playback.clip).toBe(next);
      supported(actor, slope);
    }
    expect(actor.playback.frame).not.toBe(before);
  } finally {
    dispose();
  }
});

it.each(['Walk', 'Carry', 'MatCarry'] as const)(
  'grounds reduced-motion %s while exposing its unchanged frozen two-foot gap',
  (clip) => {
    const { world, actor, dispose } = fixture();
    try {
      world.reducedMotion = true;
      world.activity = { playerClip: () => clip };
      let frame: number | undefined;
      for (let step = 0; step < 10; step++) {
        world.poseTraveler(true, 0.1, 3.25);
        const feet = supported(actor, flat);
        expect(feet.right).toBeCloseTo(0, 6);
        expect(feet.left - feet.right).toBeCloseTo(0.04886454, 6);
        expect(actor.root.rotation.z).toBe(0);
        if (frame !== undefined) expect(actor.playback.frame).toBe(frame);
        frame = actor.playback.frame;
      }
    } finally {
      dispose();
    }
  },
);

it('holds stationary Carry frame zero, preserves its uneven soles, and remains frozen when paused', () => {
  const { world, actor, dispose } = fixture();
  try {
    world.state.campaign.carrying = 'cart-handle';
    world.poseTraveler(false, 0.2);
    const feet = supported(actor, flat);
    expect(feet.right).toBeCloseTo(0, 6);
    expect(feet.left).toBeCloseTo(0.04886454, 6);
    const before = actor.root.position.clone(),
      frame = actor.playback.frame,
      nav = { ...world.position };
    world.setPaused(true);
    world.simulate(0.3);
    expect(actor.playback.clip).toBe('Carry');
    expect(actor.playback.frame).toBe(frame);
    expect(actor.root.position.equals(before)).toBe(true);
    expect(world.position).toEqual(nav);
    expect(clearances(actor, flat)).toEqual(feet);
  } finally {
    dispose();
  }
});

it('keeps both stationary Carry clearances frozen on a slope while paused', () => {
  const { world, actor, dispose } = fixture(slope);
  try {
    world.state.campaign.carrying = 'cart-handle';
    world.poseTraveler(false, 0.2);
    const feet = supported(actor, slope),
      before = actor.root.position.clone(),
      frame = actor.playback.frame;
    world.setPaused(true);
    world.simulate(0.3);
    expect(actor.playback.frame).toBe(frame);
    expect(actor.root.position.equals(before)).toBe(true);
    expect(clearances(actor, slope)).toEqual(feet);
  } finally {
    dispose();
  }
});

it.each(['keyboard', 'route'] as const)(
  'grounds real %s movement without changing route endpoints or saved state',
  (mode) => {
    const { world, actor, dispose } = fixture(slope);
    try {
      const state = JSON.stringify(world.state),
        end = { x: 0, z: 2 };
      if (mode === 'keyboard') world.keys.add('w');
      else world.path = [{ ...end }];
      for (let step = 0; step < 20; step++) {
        world.simulate(1 / 60);
        supported(actor, slope);
      }
      expect(world.position.z).toBeGreaterThan(0.3);
      expect(world.position.x).toBeCloseTo(0, 5);
      expect(world.player.position.x).toBe(world.position.x);
      expect(world.player.position.z).toBe(world.position.z);
      expect(world.player.position.y).toBe(0);
      if (mode === 'route') expect(world.path.at(-1)).toEqual(end);
      expect(JSON.stringify(world.state)).toBe(state);
    } finally {
      dispose();
    }
  },
);

it('does not apply ordinary grounding to a finite action overriding nominal Carry', () => {
  const { world, actor, dispose } = fixture(slope);
  try {
    world.state.campaign.carrying = 'cart-handle';
    actor.playOnce('Repair');
    const query = vi.spyOn(actor, 'footClearance');
    world.poseTraveler(false, 0.2);
    expect(actor.playback.clip).toBe('Repair');
    expect(actor.playback.action).toBe('Repair');
    expect(query).not.toHaveBeenCalled();
    expect(actor.root.position.y).toBe(0);
  } finally {
    dispose();
  }
});

it.each(['boat', 'bench'] as const)(
  'leaves the supported %s presentation in charge of its own root',
  (mode) => {
    const { world, actor, dispose } = fixture(slope);
    try {
      if (mode === 'boat') {
        world.travelerBoat = { pose: vi.fn() };
        actor.root.position.set(0, 0.19, -0.45);
      } else {
        world.seatedAction = benchMotion(world.position, { x: 0, z: 1.9 }, 0);
        world.seatedAction.time =
          world.seatedAction.length / BENCH_WALK_SPEED +
          BENCH_TURN_TIME +
          actor.clipDuration('SitDown') * 0.5;
      }
      const query = vi.spyOn(actor, 'footClearance');
      world.poseTraveler(false, 0);
      expect(query).not.toHaveBeenCalled();
      expect(actor.root.position.y).toBe(mode === 'boat' ? 0.19 : 0);
    } finally {
      dispose();
    }
  },
);
