import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { groundHeight } from '../../src/content/campaign/layouts';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { World } from '../../src/scene/world';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';
import { newGame, DEFAULT_SETTINGS } from '../../src/game/types';
import { WalkGrid } from '../../src/game/pathfinding';
import { roadStart } from '../helpers/road';
import { chosenShelter, galileeAction } from '../helpers/galilee';
import type { ActorClip } from '../../src/content/assets';
import type { FootSupportContinuation } from '../../src/scene/actors/stationary-feet';
vi.mock('../../src/content/campaign/layouts', async (original) => {
  const actual = await original<typeof import('../../src/content/campaign/layouts')>();
  return {
    ...actual,
    groundHeight: (region: string, p: { x: number; z: number }) =>
      region === 'prototype-slope' ? 0.08 * p.x + 0.1 * p.z : actual.groundHeight(region, p),
  };
});
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
  await library.load(
    ['traveler', 'simon', 'basket_empty', 'mat_rolled', 'channel_scoop', 'resting_mat'],
    () => {},
  );
}, 60_000);
afterAll(() => {
  if (process.env.HELD_SETTLEMENT_REPORT)
    writeFileSync(process.env.HELD_SETTLEMENT_REPORT, JSON.stringify(observations, null, 2));
  vi.unstubAllGlobals();
  library.dispose();
  scene.dispose();
  engine.dispose();
});
type Height = (x: number, z: number) => number;
const flat: Height = () => 0,
  slope: Height = (x, z) => 0.08 * x + 0.1 * z;
const lowerNames = ['thigh_left', 'thigh_right', 'leg_left', 'leg_right'];
const observations: unknown[] = [];
const name = (value: string) =>
  value
    .split(':')
    .at(-1)!
    .replace(/\.\d+$/, '');
function fixture(
  clip: ActorClip = 'Carry',
  height: Height = flat,
  support = true,
  origin = { x: 0, z: 0.3 },
  heading = 0.65,
  held?: 'channel_scoop' | 'resting_mat',
) {
  vi.stubGlobal('document', { hidden: false });
  const nav = new TransformNode('conversation-nav-' + serial++, scene);
  nav.position.set(origin.x, height(origin.x, origin.z), origin.z);
  const actor = new Actor(
    library.instantiate('traveler', 'conversation-traveler-' + serial++),
    true,
    { stationaryFeet: support },
  );
  actor.root.parent = nav;
  actor.root.rotation.y = heading;
  const prop = library.instantiate(
    held ?? (clip === 'MatCarry' ? 'mat_rolled' : 'basket_empty'),
    'conversation-held-' + serial++,
  );
  actor.attach(prop);
  const speaker = new Actor(library.instantiate('simon', 'conversation-speaker-' + serial++));
  speaker.root.position.set(0, 0, 2.3);
  const camera = new ArcRotateCamera(
    'conversation-camera-' + serial++,
    -1.5,
    0.85,
    28,
    Vector3.Zero(),
    scene,
  );
  const canvas = { clientWidth: 1440, clientHeight: 900, dataset: {} } as HTMLCanvasElement;
  const floor = CreateGround(
    'conversation-floor-' + serial++,
    { width: 100, height: 100, subdivisions: 100 },
    scene,
  );
  const p = floor.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < p.length; i += 3) p[i + 1] = height(p[i]!, p[i + 2]!);
  floor.setVerticesData(VertexBuffer.PositionKind, p);
  floor.refreshBoundingInfo();
  floor.updateCoordinateHeights();
  const conversationView = new ConversationPresentation(camera, canvas);
  const world = Object.assign(Object.create(World.prototype), {
    state: newGame(),
    position: { ...origin },
    player: nav,
    playerModel: actor.root,
    actorPlayer: actor,
    actors: new Map([['simon', speaker]]),
    camera,
    canvas,
    floor,
    conversationView,
    keys: new Set(),
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
    activity: { playerClip: () => clip, conversationActor: () => undefined },
  });
  const ground = vi.fn((x: number, z: number) => floor.getHeightAtCoordinates(x, z));
  world.poseTraveler(false, 0);
  world.setPaused(true);
  return {
    world,
    actor,
    nav,
    prop,
    speaker,
    camera,
    canvas,
    floor,
    conversationView,
    ground,
    dispose: () => {
      conversationView.dispose();
      actor.dispose();
      speaker.dispose();
      nav.dispose();
      camera.dispose();
      floor.dispose();
    },
  };
}
const panel = { left: 300, right: 1100, top: 550, bottom: 880 };
function listenerScope(view: ConversationPresentation): FootSupportContinuation {
  const listener = (view as unknown as { listener?: { settling?: FootSupportContinuation } })
    .listener;
  expect(listener?.settling).toBeDefined();
  return listener!.settling!;
}
type Side = 'left' | 'right';
interface Topology {
  nodes: TransformNode[];
  protectedNodes: TransformNode[];
  meshes: { mesh: AbstractMesh; offset: number }[];
  vertices: { joint: string; restY: number; weights: number[] }[];
  all: number[];
  upper: number[];
  lower: number[];
  prop: number[];
  feet: Record<Side, number[]>;
  soles: Record<Side, number[]>;
  hands: Record<Side, number[]>;
}
interface Skin {
  topology: Topology;
  coordinates: Float64Array;
  protectedMatrices: Float64Array;
}
const topologies = new WeakMap<TransformNode, Topology>();
function topology(root: TransformNode): Topology {
  const cached = topologies.get(root);
  if (cached) return cached;
  const vertices: Topology['vertices'] = [];
  const meshes = root.getChildMeshes().map((mesh) => {
    const offset = vertices.length * 3;
    const rest = mesh.getPositionData(false) ?? [];
    const joints = mesh.getVerticesData('matricesIndices');
    const weights = mesh.getVerticesData('matricesWeights');
    for (let index = 0; index < rest.length / 3; index++)
      vertices.push({
        joint: joints ? name(mesh.skeleton!.bones[joints[index * 4]!]!.name) : '',
        restY: rest[index * 3 + 1]!,
        weights: weights ? Array.from(weights.slice(index * 4, index * 4 + 4)) : [],
      });
    return { mesh, offset };
  });
  const all = vertices.map((_, index) => index);
  const lower = all.filter((index) => vertices[index]!.joint.startsWith('leg_'));
  const upper = all.filter((index) => !vertices[index]!.joint.startsWith('leg_'));
  const prop = all.filter((index) => !vertices[index]!.joint);
  const feet = { left: [] as number[], right: [] as number[] };
  const soles = { left: [] as number[], right: [] as number[] };
  const hands = { left: [] as number[], right: [] as number[] };
  for (const side of ['left', 'right'] as const) {
    feet[side] = all.filter((index) => vertices[index]!.joint === 'leg_' + side);
    const bottom = Math.min(...feet[side].map((index) => vertices[index]!.restY));
    soles[side] = feet[side].filter((index) => vertices[index]!.restY < bottom + 0.0001);
    const forearm = all.filter((index) => vertices[index]!.joint === 'forearm_' + side);
    const wrist = Math.min(...forearm.map((index) => vertices[index]!.restY));
    hands[side] = forearm.filter((index) => vertices[index]!.restY < wrist + 0.13);
  }
  const nodes = [root, ...root.getChildTransformNodes()];
  const value = {
    nodes,
    meshes,
    vertices,
    all,
    upper,
    lower,
    prop,
    feet,
    soles,
    hands,
    protectedNodes: nodes.filter((node) => !lowerNames.includes(name(node.name))),
  };
  topologies.set(root, value);
  return value;
}
function refresh(topology: Topology) {
  for (const node of topology.nodes) node.computeWorldMatrix(true);
}
/** Full Babylon skinning remains independent of the production rigid-foot cache. */
function geometry(root: TransformNode): Skin {
  const packed = topology(root);
  refresh(packed);
  const coordinates = new Float64Array(packed.vertices.length * 3),
    point = Vector3.Zero();
  for (const { mesh, offset } of packed.meshes) {
    mesh.skeleton?.prepare(true);
    const posed = mesh.getPositionData(Boolean(mesh.skeleton)) ?? [];
    const world = mesh.computeWorldMatrix(true);
    for (let index = 0; index < posed.length; index += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(
        posed[index]!,
        posed[index + 1]!,
        posed[index + 2]!,
        world,
        point,
      );
      coordinates[offset + index] = point.x;
      coordinates[offset + index + 1] = point.y;
      coordinates[offset + index + 2] = point.z;
    }
  }
  return { topology: packed, coordinates, protectedMatrices: matrices({ root } as Actor) };
}
function feet(skin: Skin, ground = flat) {
  const result = {} as Record<
    Side,
    { minimum: number; soleMin: number; soleMax: number; soleCount: number }
  >;
  for (const side of ['left', 'right'] as const) {
    let minimum = Infinity,
      soleMin = Infinity,
      soleMax = -Infinity;
    for (const index of skin.topology.feet[side]) {
      const at = index * 3;
      minimum = Math.min(
        minimum,
        skin.coordinates[at + 1]! - ground(skin.coordinates[at]!, skin.coordinates[at + 2]!),
      );
    }
    for (const index of skin.topology.soles[side]) {
      const at = index * 3;
      const gap =
        skin.coordinates[at + 1]! - ground(skin.coordinates[at]!, skin.coordinates[at + 2]!);
      soleMin = Math.min(soleMin, gap);
      soleMax = Math.max(soleMax, gap);
    }
    result[side] = { minimum, soleMin, soleMax, soleCount: skin.topology.soles[side].length };
  }
  return result;
}
function matrices(actor: Actor) {
  const packed = topology(actor.root);
  refresh(packed);
  const result = new Float64Array(packed.protectedNodes.length * 16);
  packed.protectedNodes.forEach((node, index) => result.set(node.getWorldMatrix().m, index * 16));
  return result;
}
function maximumDelta(before: Skin, after: Skin, indices = before.topology.all) {
  if (before.coordinates.length !== after.coordinates.length) return Infinity;
  let squared = 0;
  for (const index of indices) {
    const at = index * 3;
    const x = before.coordinates[at]! - after.coordinates[at]!,
      y = before.coordinates[at + 1]! - after.coordinates[at + 1]!,
      z = before.coordinates[at + 2]! - after.coordinates[at + 2]!;
    squared = Math.max(squared, x * x + y * y + z * z);
  }
  return Math.sqrt(squared);
}
function grip(skin: Skin) {
  return (['left', 'right'] as const).map((side) => {
    let nearest = Infinity;
    for (const a of skin.topology.hands[side])
      for (const b of skin.topology.prop) {
        const x = skin.coordinates[a * 3]! - skin.coordinates[b * 3]!,
          y = skin.coordinates[a * 3 + 1]! - skin.coordinates[b * 3 + 1]!,
          z = skin.coordinates[a * 3 + 2]! - skin.coordinates[b * 3 + 2]!;
        nearest = Math.min(nearest, x * x + y * y + z * z);
      }
    return Math.sqrt(nearest);
  });
}
function bookmark(f: ReturnType<typeof fixture>) {
  return {
    skin: geometry(f.actor.root),
    feet: feet(geometry(f.actor.root), f.ground),
    grip: grip(geometry(f.actor.root)),
    pose: f.actor.snapshotPose(),
    nav: Array.from(f.nav.computeWorldMatrix(true).m),
    position: f.world.getPosition(),
    state: JSON.stringify(f.world.state),
  };
}
function unchanged(f: ReturnType<typeof fixture>, before: ReturnType<typeof bookmark>) {
  const after = geometry(f.actor.root);
  expect(maximumDelta(before.skin, after)).toBe(0);
  expect(after.protectedMatrices).toEqual(before.skin.protectedMatrices);
  expect(grip(after)).toEqual(before.grip);
  expect(feet(after, f.ground)).toEqual(before.feet);
  expect(f.actor.snapshotPose()).toEqual(before.pose);
  expect(Array.from(f.nav.computeWorldMatrix(true).m)).toEqual(before.nav);
  expect(f.world.getPosition()).toEqual(before.position);
  expect(JSON.stringify(f.world.state)).toBe(before.state);
  expect(f.actor.hasFootSupport).toBe(true);
}
function supportedFaces(f: ReturnType<typeof fixture>, height: Height) {
  const complete = feet(geometry(f.actor.root), f.ground),
    cached = f.actor.footClearance(f.ground);
  for (const side of ['left', 'right'] as const) {
    expect(complete[side].soleCount).toBe(16);
    expect(cached[side]).toBeCloseTo(complete[side].minimum, 6);
    expect(Math.abs(complete[side].soleMin)).toBeLessThan(0.000002);
    if (height === flat) expect(Math.abs(complete[side].soleMax)).toBeLessThan(0.000002);
    // Horizontal soles keep an explicit support envelope on slopes; no foot tilt is composed.
    else expect(complete[side].soleMax).toBeCloseTo(0.038882, 5);
  }
}
function realArrival(f: ReturnType<typeof fixture>, region = 'capernaum', finalHeading?: number) {
  f.world.state.region = region;
  f.speaker.root.position.set(f.world.position.x, f.nav.position.y, f.world.position.z + 2.3);
  f.world.setPaused(false);
  f.world.poseTraveler(true, 0.3, 3.25);
  let movingBookmark: ReturnType<Actor['snapshotPose']> | undefined;
  const end = { x: f.world.position.x, z: f.world.position.z + 0.02 };
  f.world.activity.tick = () => {};
  f.world.pace = () => 3.25;
  f.world.path = [end];
  f.world.destination = 'simon';
  const target =
    finalHeading === undefined
      ? { x: end.x, z: end.z + 1 }
      : {
          x: end.x + Math.sin(finalHeading - Math.PI) * 2.2,
          z: end.z + Math.cos(finalHeading - Math.PI) * 2.2,
        };
  f.world.destinations = [{ id: 'simon', ...target }];
  f.speaker.root.position.set(target.x, f.nav.position.y, target.z);
  f.world.callbacks.interact = (id: string) => {
    movingBookmark = f.actor.snapshotPose();
    f.world.setConversation(id, panel);
    f.world.setPaused(true);
  };
  f.world.simulate(0.05);
  expect(movingBookmark!.frame).toBe(18);
  expect(f.actor.playback.frame).toBe(0);
  expect(f.world.getPosition()).toEqual(end);
  return bookmark(f);
}
function invariantUpper(f: ReturnType<typeof fixture>, before: ReturnType<typeof bookmark>) {
  const skin = geometry(f.actor.root);
  expect(maximumDelta(before.skin, skin, before.skin.topology.upper)).toBe(0);
  expect(maximumDelta(before.skin, skin, before.skin.topology.prop)).toBe(0);
  expect(skin.protectedMatrices).toEqual(before.skin.protectedMatrices);
  expect(grip(skin)).toEqual(before.grip);
  expect(f.actor.snapshotPose()).toEqual(before.pose);
  expect(Array.from(f.nav.computeWorldMatrix(true).m)).toEqual(before.nav);
  expect(f.world.getPosition()).toEqual(before.position);
  expect(JSON.stringify(f.world.state)).toBe(before.state);
  expect(f.world.time).toBe(0.05);
  return skin;
}
const roadHeight: Height = (x, z) => groundHeight('galilean-road', { x, z });
const farmHeight: Height = (x, z) => groundHeight('roadside-farm', { x, z });
it.each([
  ['Carry', flat],
  ['Carry', slope],
  ['MatCarry', flat],
  ['MatCarry', slope],
] as const)(
  'retains full supported %s skin through dialogue, pause, layout and clear on %s',
  (clip, height) => {
    const f = fixture(clip, height);
    try {
      supportedFaces(f, height);
      const before = bookmark(f);
      f.world.setConversation('simon', panel);
      unchanged(f, before);
      for (let step = 0; step < 60; step++) {
        f.conversationView.tick(1 / 60, false);
        f.world.simulate(1 / 60);
      }
      unchanged(f, before);
      expect(f.canvas.dataset.conversationTime).toBe('1.00');
      f.world.setConversation('simon', panel, true);
      f.conversationView.tick(0.1, false);
      unchanged(f, before);
      f.world.setConversation('simon', { ...panel, top: 430 }, true);
      f.conversationView.tick(0.1, false);
      unchanged(f, before);
      vi.stubGlobal('document', { hidden: true });
      f.conversationView.tick(9, false);
      unchanged(f, before);
      vi.stubGlobal('document', { hidden: false });
      f.world.setConversation('simon', panel, false);
      f.conversationView.tick(0.1, true);
      unchanged(f, before);
      f.world.setConversation();
      unchanged(f, before);
      f.world.setConversation('simon', panel);
      f.conversationView.tick(0.016, false);
      unchanged(f, before);
      f.world.setConversation('missing', panel);
      unchanged(f, before);
      expect(f.conversationView.active).toBe(false);
    } finally {
      f.dispose();
    }
  },
);
it.each([
  ['Carry', flat, 'capernaum', { x: 0, z: 0.3 }, 0.65],
  ['MatCarry', flat, 'capernaum', { x: 0, z: 0.3 }, 0.65],
  ['Carry', slope, 'prototype-slope', { x: 0, z: 0.3 }, 0.65],
  ['MatCarry', slope, 'prototype-slope', { x: 0, z: 0.3 }, 0.65],
  ['Carry', roadHeight, 'galilean-road', { x: -1, z: -8.02 }, 2.0344439357957027],
  ['Carry', farmHeight, 'roadside-farm', { x: -3, z: 0.98 }, 2.677945044588987],
] as const)(
  'settles genuine %s arrival continuously on %s in %s',
  (clip, height, region, origin, heading) => {
    const held =
      region === 'galilean-road'
        ? 'channel_scoop'
        : region === 'roadside-farm'
          ? 'resting_mat'
          : undefined;
    const f = fixture(clip, height, true, origin, heading, held);
    if (held) {
      let state = roadStart();
      if (held === 'channel_scoop')
        for (const id of [
          'spring-start',
          'spring-note-source',
          'spring-note-basins',
          'spring-borrow',
        ])
          state = galileeAction(state, id);
      else state = galileeAction(chosenShelter(state), 'shelter-take-mat');
      f.world.state = state;
    }
    try {
      const before = realArrival(
        f,
        region,
        ['galilean-road', 'roadside-farm'].includes(region) ? heading : undefined,
      );
      const phase: unknown[] = [{ elapsed: 0, feet: before.feet, change: 0 }];
      expect(Math.max(before.feet.left.soleMax, before.feet.right.soleMax)).toBeGreaterThan(0.07);
      const pose = f.actor.snapshotPose();
      let previous = before.skin,
        largest = 0;
      f.conversationView.tick(0, false);
      unchanged(f, before);
      for (let step = 1; step <= 80; step++) {
        f.conversationView.tick(0.005, false);
        f.world.simulate(0.005);
        const skin = invariantUpper(f, before);
        const delta = maximumDelta(previous, skin);
        const heads = before.skin.topology.all.filter(
          (index) => before.skin.topology.vertices[index]!.joint === 'head',
        );
        expect(heads.length).toBeGreaterThan(0);
        expect(maximumDelta(before.skin, skin, heads)).toBe(0);
        largest = Math.max(largest, delta);
        if (step === 1) expect(delta).toBeLessThan(0.005);
        expect(delta).toBeLessThan(0.06);
        const soles = feet(skin, f.ground);
        for (const side of ['left', 'right'] as const) {
          expect(soles[side].soleCount).toBe(16);
          expect(soles[side].minimum).toBeGreaterThan(-0.000002);
        }
        phase.push({
          elapsed: step * 0.005,
          feet: soles,
          change: delta,
          lowerChange: maximumDelta(before.skin, skin),
        });
        previous = skin;
      }
      expect(phase).toHaveLength(81);
      const final = bookmark(f);
      expect(f.actor.snapshotPose()).toEqual(pose);
      for (const side of ['left', 'right'] as const) {
        expect(Math.abs(final.feet[side].soleMin)).toBeLessThan(0.000002);
        if (height === flat) expect(Math.abs(final.feet[side].soleMax)).toBeLessThan(0.000002);
        else {
          const indices = final.skin.topology.soles[side];
          const terrain = indices.map((index) =>
            f.ground(final.skin.coordinates[index * 3]!, final.skin.coordinates[index * 3 + 2]!),
          );
          const y = indices.map((index) => final.skin.coordinates[index * 3 + 1]!);
          expect(Math.max(...y) - Math.min(...y)).toBeLessThan(0.000002);
          expect(final.feet[side].soleMax).toBeCloseTo(
            Math.max(...terrain) - Math.min(...terrain),
            6,
          );
        }
      }
      expect(f.canvas.dataset.conversationTime).toBe('0.40');
      f.world.setConversation();
      unchanged(f, final);
      observations.push({
        clip,
        region,
        origin,
        heading,
        before: before.feet,
        final: final.feet,
        largestStep: largest,
        phase,
        stateInvariant: true,
        upperAndPropMaximumDelta: 0,
        headMaximumDelta: 0,
      });
    } finally {
      f.dispose();
    }
  },
);
it('freezes partial settlement on pause, hidden tab and paused layout, then resumes exactly', () => {
  const f = fixture(),
    reference = fixture();
  try {
    realArrival(f);
    realArrival(reference);
    for (const current of [f, reference]) current.conversationView.tick(0.04, false);
    const partial = bookmark(f);
    f.world.setConversation('simon', panel, true);
    const time = f.canvas.dataset.conversationTime;
    f.conversationView.tick(0.1, false);
    unchanged(f, partial);
    f.world.setConversation('simon', { ...panel, top: 430 }, true);
    f.conversationView.tick(0.1, false);
    unchanged(f, partial);
    expect(f.canvas.dataset.conversationTime).toBe(time);
    vi.stubGlobal('document', { hidden: true });
    f.conversationView.tick(9, false);
    unchanged(f, partial);
    vi.stubGlobal('document', { hidden: false });
    f.world.setConversation('simon', panel, false);
    for (let step = 0; step < 15; step++) {
      for (const current of [f, reference]) current.conversationView.tick(0.02, false);
      expect(maximumDelta(geometry(f.actor.root), geometry(reference.actor.root))).toBe(0);
    }
    supportedFaces(f, flat);
    expect(f.canvas.dataset.conversationTime).toBe('0.34');
  } finally {
    f.dispose();
    reference.dispose();
  }
});
it('resolves real reduced settings before any tick and keeps that exact settled pose', () => {
  const f = fixture();
  try {
    const original = realArrival(f);
    f.world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    invariantUpper(f, original);
    supportedFaces(f, flat);
    const resolved = bookmark(f);
    f.conversationView.tick(0.1, true);
    unchanged(f, resolved);
    f.world.setConversation();
    unchanged(f, resolved);
  } finally {
    f.dispose();
  }
});
it('releases the old callback scope on clear and reselects a new current continuation', () => {
  const f = fixture();
  try {
    realArrival(f);
    const old = listenerScope(f.conversationView);
    f.conversationView.tick(0.04, false);
    const partial = bookmark(f);
    f.world.setConversation();
    unchanged(f, partial);
    f.ground.mockClear();
    expect(old.step(0.1)).toBe(false);
    expect(f.ground).not.toHaveBeenCalled();
    f.world.setConversation('simon', panel);
    expect(listenerScope(f.conversationView)).not.toBe(old);
    for (let step = 0; step < 16; step++) f.conversationView.tick(0.02, false);
    supportedFaces(f, flat);
    const current = listenerScope(f.conversationView);
    f.conversationView.dispose();
    f.ground.mockClear();
    expect(current.step(0.1)).toBe(false);
    expect(f.ground).not.toHaveBeenCalled();
  } finally {
    f.dispose();
  }
});
it.each(['Repair', 'SitDown', 'BenchSit', 'Row', 'Kneel'] as const)(
  'invalidates a continuation before exact finite %s',
  (clip) => {
    const f = fixture();
    try {
      realArrival(f);
      const scope = listenerScope(f.conversationView);
      f.actor.sampleActionAt(clip, 0.4);
      const exact = geometry(f.actor.root),
        pose = f.actor.snapshotPose();
      expect(f.actor.hasFootSupport).toBe(false);
      f.ground.mockClear();
      expect(scope.step(0.1)).toBe(false);
      expect(f.ground).not.toHaveBeenCalled();
      expect(maximumDelta(exact, geometry(f.actor.root))).toBe(0);
      expect(f.actor.snapshotPose()).toEqual(pose);
      f.actor.supportFeet({ stationary: true, dt: 0, ground: f.ground });
      expect(maximumDelta(exact, geometry(f.actor.root))).toBe(0);
    } finally {
      f.dispose();
    }
  },
);
it('invalidates and releases the retained floor callback on Actor disposal', () => {
  const f = fixture();
  try {
    realArrival(f);
    const scope = f.actor.footSupportContinuation()!;
    f.actor.dispose();
    f.floor.dispose();
    f.ground.mockClear();
    expect(scope.step(0.1)).toBe(false);
    expect(f.ground).not.toHaveBeenCalled();
    expect(
      (f.actor as unknown as { stationaryFeet?: { ground?: unknown } }).stationaryFeet?.ground,
    ).toBeUndefined();
  } finally {
    f.dispose();
  }
});
it.each(['Carry', 'MatCarry'] as const)(
  'keeps unopted %s listener sampling and restoration authored',
  (clip) => {
    const f = fixture(clip, flat, false),
      reference = fixture(clip, flat, false);
    try {
      expect(f.actor.footSupportContinuation()).toBeUndefined();
      for (const actor of [f.actor, reference.actor]) {
        actor.setStrideSpeed(3.25);
        actor.sampleAt(clip, 0.4);
      }
      const pose = reference.actor.snapshotPose();
      f.world.setConversation('simon', panel);
      for (let step = 0; step < 10; step++) {
        f.conversationView.tick(0.016, false);
        reference.actor.sample(clip, 0.016, clip === 'Carry');
        expect(maximumDelta(geometry(reference.actor.root), geometry(f.actor.root))).toBe(0);
        expect(f.actor.snapshotPose()).toEqual(reference.actor.snapshotPose());
      }
      f.world.setConversation();
      reference.actor.restorePose(pose);
      expect(maximumDelta(geometry(reference.actor.root), geometry(f.actor.root))).toBe(0);
    } finally {
      f.dispose();
      reference.dispose();
    }
  },
);
it('keeps actual World boat conversation suppression and Row pose unchanged', () => {
  const f = fixture();
  try {
    f.actor.sampleAt('Row', 0.4);
    const exact = geometry(f.actor.root),
      pose = f.actor.snapshotPose();
    f.world.travelerBoat = { pose: vi.fn() };
    f.world.setConversation('simon', panel);
    expect(f.conversationView.active).toBe(false);
    expect(f.actor.footSupportContinuation()).toBeUndefined();
    f.conversationView.tick(0.1, false);
    expect(maximumDelta(exact, geometry(f.actor.root))).toBe(0);
    expect(f.actor.snapshotPose()).toEqual(pose);
  } finally {
    f.dispose();
  }
});
it('releases a partial lease before ordinary World sampling resumes without a pose reset', () => {
  const current = fixture(),
    reference = fixture();
  try {
    for (const f of [current, reference]) {
      realArrival(f);
      f.conversationView.tick(0.04, false);
    }
    const partial = bookmark(current);
    const lease = listenerScope(current.conversationView);
    for (const f of [current, reference]) {
      f.world.setConversation();
      f.world.setPaused(false);
    }
    unchanged(current, partial);
    expect(lease.step(0.1)).toBe(false);
    let previous = partial.skin;
    for (let step = 0; step < 36; step++) {
      for (const f of [current, reference]) f.world.poseTraveler(false, 0.005);
      const skin = geometry(current.actor.root);
      expect(maximumDelta(skin, geometry(reference.actor.root))).toBe(0);
      expect(maximumDelta(previous, skin)).toBeLessThan(0.06);
      previous = skin;
    }
    supportedFaces(current, flat);
  } finally {
    current.dispose();
    reference.dispose();
  }
});
it('bounds running continuation time and leaves nonpositive or invalid steps inert', () => {
  const current = fixture(),
    reference = fixture();
  try {
    const before = realArrival(current);
    realArrival(reference);
    const scope = current.actor.footSupportContinuation()!;
    const other = reference.actor.footSupportContinuation()!;
    current.ground.mockClear();
    for (const dt of [0, -1, NaN, Infinity]) expect(scope.step(dt)).toBe(true);
    expect(current.ground).not.toHaveBeenCalled();
    unchanged(current, before);
    scope.step(9);
    other.step(0.1);
    expect(maximumDelta(geometry(current.actor.root), geometry(reference.actor.root))).toBe(0);
    scope.release();
    other.release();
  } finally {
    current.dispose();
    reference.dispose();
  }
});
it.each(['Idle', 'Walk'] as const)(
  'keeps supported ordinary %s outside the held-only lease API',
  (clip) => {
    const f = fixture(clip);
    try {
      const before = bookmark(f);
      expect(f.actor.hasFootSupport).toBe(true);
      expect(f.actor.footSupportContinuation()).toBeUndefined();
      unchanged(f, before);
    } finally {
      f.dispose();
    }
  },
);
it('stops floor queries and rig recomposition after the held continuation completes', () => {
  const f = fixture();
  try {
    realArrival(f);
    for (let step = 0; step < 20; step++) f.conversationView.tick(0.02, false);
    supportedFaces(f, flat);
    const settled = bookmark(f);
    f.ground.mockClear();
    for (let step = 0; step < 60; step++) f.conversationView.tick(1 / 60, false);
    expect(f.ground).not.toHaveBeenCalled();
    unchanged(f, settled);
  } finally {
    f.dispose();
  }
});
it('never revives an old scope when finite invalidation is followed by compatible fresh support', () => {
  const f = fixture();
  try {
    realArrival(f);
    const old = f.actor.footSupportContinuation()!;
    f.actor.sampleActionAt('Repair', 0.4);
    f.actor.sampleAt('Carry', 0);
    f.actor.supportFeet({ stationary: true, dt: 0, ground: f.ground });
    expect(f.actor.hasFootSupport).toBe(true);
    expect(f.actor.performing).toBe(false);
    const supported = bookmark(f);
    f.ground.mockClear();
    expect(old.step(0.1)).toBe(false);
    expect(f.ground).not.toHaveBeenCalled();
    unchanged(f, supported);
    const fresh = f.actor.footSupportContinuation()!;
    expect(fresh.step(0.1)).toBe(true);
    fresh.release();
  } finally {
    f.dispose();
  }
});
it.each(['Repair', 'SitDown'] as const)(
  'retains default restoration after finite %s invalidates supported holding',
  (clip) => {
    const f = fixture(),
      reference = fixture();
    try {
      const pose = f.actor.snapshotPose();
      expect(f.actor.hasFootSupport).toBe(true);
      f.world.setConversation('simon', panel);
      for (const actor of [f.actor, reference.actor]) actor.sampleActionAt(clip, 0.4);
      expect(f.actor.hasFootSupport).toBe(false);
      expect(f.actor.performing).toBe(true);
      const finite = geometry(f.actor.root);
      f.actor.supportFeet({ stationary: true, dt: 0, ground: f.ground });
      expect(maximumDelta(finite, geometry(f.actor.root))).toBe(0);
      f.world.setConversation();
      reference.actor.restorePose(pose);
      expect(maximumDelta(geometry(reference.actor.root), geometry(f.actor.root))).toBe(0);
      expect(f.actor.snapshotPose()).toEqual(pose);
      expect(f.actor.hasFootSupport).toBe(false);
    } finally {
      f.dispose();
      reference.dispose();
    }
  },
);
