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
import { DEFAULT_SETTINGS, newGame } from '../../src/game/types';
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
  await library.load(['traveler', 'basket_empty'], () => {});
}, 60_000);
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

type SurfaceHeight = (x: number, z: number) => number;
const flat: SurfaceHeight = () => 0;
const slope: SurfaceHeight = (x, z) => 0.08 * x + 0.1 * z;
function fixture(
  height?: SurfaceHeight,
  options: { stationaryFeet?: boolean; held?: boolean } = {},
) {
  vi.stubGlobal('document', { hidden: false });
  const actor = new Actor(
    library.instantiate('traveler', 'grounded-traveler-' + serial++),
    true,
    options,
  );
  if (options.held) actor.attach(library.instantiate('basket_empty', 'grounded-held-' + serial++));
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
    stage: { atmosphere: { footstep: vi.fn() }, applySettings: vi.fn() },
    boats: [],
    people: new Map(),
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

const upperIndices = new WeakMap<Actor, number[]>();
function upperSkin(actor: Actor) {
  let indices = upperIndices.get(actor);
  if (!indices) {
    let base = 0;
    indices = actor.root.getChildMeshes().flatMap((mesh) => {
      const joints = mesh.getVerticesData('matricesIndices');
      const own = Array.from({ length: mesh.getTotalVertices() }, (_, index) => index)
        .filter(
          (index) => !mesh.skeleton?.bones[joints?.[index * 4] ?? -1]?.name.startsWith('leg_'),
        )
        .map((index) => base + index);
      base += mesh.getTotalVertices();
      return own;
    });
    upperIndices.set(actor, indices);
  }
  const skin = posedVertices(actor.root);
  return indices.map((index) => skin[index]!);
}
function skinDifference(before: readonly Vector3[], after: readonly Vector3[]) {
  return Math.max(...before.map((point, index) => Vector3.Distance(point, after[index]!)));
}
function sameUpper(current: ReturnType<typeof fixture>, control: ReturnType<typeof fixture>) {
  expect(skinDifference(upperSkin(current.actor), upperSkin(control.actor))).toBe(0);
  expect(Array.from(current.actor.model.socket('carry_socket').getWorldMatrix().m)).toEqual(
    Array.from(control.actor.model.socket('carry_socket').getWorldMatrix().m),
  );
  expect(current.actor.root.position.equals(control.actor.root.position)).toBe(true);
  expect(current.world.position).toEqual(control.world.position);
  expect(current.world.player.position.equals(control.world.player.position)).toBe(true);
  expect(current.world.state).toEqual(control.world.state);
}
const soleIndices = new WeakMap<Actor, Record<'left' | 'right', number[]>>();
function soleFaces(actor: Actor, height: SurfaceHeight) {
  let indices = soleIndices.get(actor);
  if (!indices) {
    indices = Object.fromEntries(
      (['left', 'right'] as const).map((side) => {
        const rest = actor.root.getChildMeshes().flatMap((mesh) => {
          const positions = mesh.getVerticesData('position'),
            joints = mesh.getVerticesData('matricesIndices');
          if (!positions || !joints || !mesh.skeleton) return [];
          return Array.from({ length: positions.length / 3 }, (_, index) => index)
            .filter((index) => mesh.skeleton!.bones[joints[index * 4]!]!.name === 'leg_' + side)
            .map((index) => positions[index * 3 + 1]!);
        });
        const bottom = Math.min(...rest);
        return [side, rest.flatMap((y, index) => (y < bottom + 0.0001 ? [index] : []))];
      }),
    ) as Record<'left' | 'right', number[]>;
    soleIndices.set(actor, indices);
  }
  return Object.fromEntries(
    (['left', 'right'] as const).map((side) => {
      const points = posedVertices(actor.root, 'leg_' + side);
      const gaps = indices![side].map((index) => {
        const point = points[index]!;
        return point.y - height(point.x, point.z);
      });
      return [side, { count: gaps.length, minimum: Math.min(...gaps), maximum: Math.max(...gaps) }];
    }),
  ) as Record<'left' | 'right', { count: number; minimum: number; maximum: number }>;
}
function flatPlanted(actor: Actor) {
  const feet = supported(actor, flat),
    faces = soleFaces(actor, flat);
  for (const side of ['left', 'right'] as const) {
    expect(Math.abs(feet[side])).toBeLessThan(0.000002);
    expect(faces[side].count).toBe(16);
    expect(Math.abs(faces[side].minimum)).toBeLessThan(0.000002);
    expect(Math.abs(faces[side].maximum)).toBeLessThan(0.000002);
  }
}

it.each(['Idle', 'Carry', 'MatCarry'] as const)(
  'plants the real World stationary %s sole faces without changing its upper skin, held prop or state',
  (clip) => {
    const current = fixture(undefined, { stationaryFeet: true, held: true }),
      control = fixture(undefined, { held: true });
    try {
      for (const { world, actor } of [current, control]) {
        world.activity = { playerClip: () => clip };
        actor.root.rotation.y = 0.65;
        world.poseTraveler(false, 0);
      }
      for (let step = 0; step < 12; step++) {
        current.world.poseTraveler(false, 1 / 60);
        control.world.poseTraveler(false, 1 / 60);
        flatPlanted(current.actor);
        sameUpper(current, control);
      }
      if (clip !== 'Idle')
        expect(
          clearances(control.actor, flat).left - clearances(control.actor, flat).right,
        ).toBeCloseTo(0.04886454, 6);
    } finally {
      current.dispose();
      control.dispose();
    }
  },
);

it.each(['Walk', 'Carry', 'MatCarry'] as const)(
  'resolves real World reduced-motion %s directly and preserves the frozen authored upper/held pose',
  (clip) => {
    const current = fixture(undefined, { stationaryFeet: true, held: true }),
      control = fixture(undefined, { held: true });
    try {
      for (const { world } of [current, control]) {
        world.activity = { playerClip: () => clip };
        world.poseTraveler(true, 0.24, 3.25);
        world.reducedMotion = true;
      }
      let skin: Vector3[] | undefined;
      for (let step = 0; step < 12; step++) {
        current.world.poseTraveler(true, 1 / 60, 3.25);
        control.world.poseTraveler(true, 1 / 60, 3.25);
        flatPlanted(current.actor);
        sameUpper(current, control);
        expect(current.actor.playback.frame).toBe(0);
        expect(current.actor.root.rotation.z).toBe(0);
        const now = posedVertices(current.actor.root);
        if (skin) expect(skinDifference(skin, now)).toBe(0);
        skin = now;
      }
    } finally {
      current.dispose();
      control.dispose();
    }
  },
);

it('freezes the complete real World Carry transition during pause and resumes the remaining leg motion', () => {
  const current = fixture(undefined, { stationaryFeet: true }),
    control = fixture(undefined, { stationaryFeet: true });
  try {
    for (const { world } of [current, control]) {
      world.state.campaign.carrying = 'cart-handle';
      world.poseTraveler(true, 0.3, 3.25);
      world.poseTraveler(false, 0.04);
    }
    const before = posedVertices(current.actor.root),
      upper = upperSkin(current.actor),
      frame = current.actor.playback.frame,
      state = JSON.stringify(current.world.state);
    expect(soleFaces(current.actor, flat).left.maximum).toBeGreaterThan(0.005);
    current.world.setPaused(true);
    current.world.simulate(0.7);
    expect(current.actor.playback.frame).toBe(frame);
    expect(skinDifference(before, posedVertices(current.actor.root))).toBeLessThan(0.000001);
    expect(skinDifference(upper, upperSkin(current.actor))).toBe(0);
    expect(JSON.stringify(current.world.state)).toBe(state);
    current.world.setPaused(false);
    current.world.poseTraveler(false, 0.02);
    control.world.poseTraveler(false, 0.02);
    expect(
      skinDifference(posedVertices(current.actor.root), posedVertices(control.actor.root)),
    ).toBeLessThan(0.000001);
    current.world.poseTraveler(false, 0.1);
    flatPlanted(current.actor);
  } finally {
    current.dispose();
    control.dispose();
  }
});

it('applies reduced motion immediately from paused World settings while preserving the authored upper pose', () => {
  const current = fixture(undefined, { stationaryFeet: true, held: true }),
    control = fixture(undefined, { held: true });
  try {
    for (const { world } of [current, control]) {
      world.state.campaign.carrying = 'cart-handle';
      world.poseTraveler(true, 0.3, 3.25);
      world.setPaused(true);
      world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    }
    expect(current.world.paused).toBe(true);
    expect(current.world.reducedMotion).toBe(true);
    flatPlanted(current.actor);
    sameUpper(current, control);
    const before = posedVertices(current.actor.root);
    current.world.simulate(0.4);
    expect(skinDifference(before, posedVertices(current.actor.root))).toBe(0);
  } finally {
    current.dispose();
    control.dispose();
  }
});

it.each(['keyboard', 'route'] as const)(
  'leaves stationary support through real World %s movement over rendered terrain without changing navigation or the carry grip',
  (mode) => {
    const current = fixture(slope, { stationaryFeet: true, held: true }),
      control = fixture(slope, { held: true });
    try {
      const end = { x: 0, z: 4 },
        state = JSON.stringify(current.world.state);
      for (const { world } of [current, control]) {
        world.state.campaign.carrying = 'cart-handle';
        world.poseTraveler(false, 0);
        if (mode === 'keyboard') world.keys.add('w');
        else world.path = [{ ...end }];
      }
      const saved = JSON.stringify(current.world.state);
      expect(saved).not.toBe(state);
      for (let step = 0; step < 30; step++) {
        current.world.simulate(1 / 60);
        control.world.simulate(1 / 60);
        const rendered = (x: number, z: number) => current.floor!.getHeightAtCoordinates(x, z);
        supported(current.actor, rendered);
        sameUpper(current, control);
        expect(current.world.path).toEqual(control.world.path);
        if (step >= 10)
          expect(
            skinDifference(posedVertices(current.actor.root), posedVertices(control.actor.root)),
          ).toBe(0);
      }
      expect(current.world.position.z).toBeGreaterThan(0.3);
      expect(JSON.stringify(current.world.state)).toBe(saved);
      if (mode === 'route') expect(current.world.path.at(-1)).toEqual(end);
    } finally {
      current.dispose();
      control.dispose();
    }
  },
);

it('keeps real World stopped Carry supported on curved rendered triangles and exposes its entire sole envelope', () => {
  const curved: SurfaceHeight = (x, z) => 0.1 * x * x + 0.07 * z;
  const current = fixture(curved, { stationaryFeet: true, held: true }),
    control = fixture(curved, { held: true });
  try {
    for (const { world } of [current, control]) {
      world.state.campaign.carrying = 'cart-handle';
      world.position = { x: 0.5, z: 0.3 };
      world.player.position.set(0.5, curved(0.5, 0.3), 0.3);
      world.poseTraveler(false, 0);
    }
    sameUpper(current, control);
    const rendered = (x: number, z: number) => current.floor!.getHeightAtCoordinates(x, z);
    expect(rendered(0.5, 0.3) - curved(0.5, 0.3)).toBeCloseTo(0.025, 6);
    const feet = supported(current.actor, rendered),
      faces = soleFaces(current.actor, rendered);
    for (const side of ['left', 'right'] as const) {
      expect(Math.abs(feet[side])).toBeLessThan(0.000002);
      expect(faces[side].count).toBe(16);
      expect(faces[side].minimum).toBeGreaterThan(-0.000002);
      expect(faces[side].maximum).toBeGreaterThan(0.02);
      expect(faces[side].maximum).toBeLessThan(0.04);
    }
    expect(current.world.player.position.y).toBe(curved(0.5, 0.3));
  } finally {
    current.dispose();
    control.dispose();
  }
});

it.each(['finite', 'boat', 'bench'] as const)(
  'excludes the real World %s presentation from ordinary stationary foot support',
  (mode) => {
    const current = fixture(undefined, { stationaryFeet: true, held: true }),
      control = fixture(undefined, { held: true });
    try {
      for (const { world, actor } of [current, control]) {
        world.state.campaign.carrying = 'cart-handle';
        world.poseTraveler(false, 0);
        if (mode === 'finite') actor.playOnce('Repair');
        else if (mode === 'boat') {
          actor.sampleAt('Row', 0.4);
          world.travelerBoat = { pose: vi.fn() };
          actor.root.position.set(0, 0.19, -0.45);
        } else {
          world.seatedAction = benchMotion(world.position, { x: 0, z: 1.9 }, 0);
          world.seatedAction.time =
            world.seatedAction.length / BENCH_WALK_SPEED +
            BENCH_TURN_TIME +
            actor.clipDuration('SitDown') * 0.5;
        }
      }
      const support = vi.spyOn(current.actor, 'supportFeet');
      current.world.poseTraveler(false, 0.04);
      control.world.poseTraveler(false, 0.04);
      expect(support).not.toHaveBeenCalled();
      expect(current.actor.playback).toEqual(control.actor.playback);
      expect(
        skinDifference(posedVertices(current.actor.root), posedVertices(control.actor.root)),
      ).toBe(0);
      sameUpper(current, control);
    } finally {
      current.dispose();
      control.dispose();
    }
  },
);
