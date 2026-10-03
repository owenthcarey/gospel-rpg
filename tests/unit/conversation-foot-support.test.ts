import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
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
import type { ActorClip } from '../../src/content/assets';
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
  await library.load(['traveler', 'simon', 'basket_empty', 'mat_rolled'], () => {});
}, 60000);
afterAll(() => {
  vi.unstubAllGlobals();
  library.dispose();
  scene.dispose();
  engine.dispose();
});
type Height = (x: number, z: number) => number;
const flat: Height = () => 0,
  slope: Height = (x, z) => 0.08 * x + 0.1 * z;
const lowerNames = ['thigh_left', 'thigh_right', 'leg_left', 'leg_right'];
const name = (value: string) =>
  value
    .split(':')
    .at(-1)!
    .replace(/\.\d+$/, '');
function fixture(clip: ActorClip = 'Carry', height: Height = flat, support = true) {
  vi.stubGlobal('document', { hidden: false });
  const nav = new TransformNode('conversation-nav-' + serial++, scene);
  nav.position.z = 0.3;
  const actor = new Actor(
    library.instantiate('traveler', 'conversation-traveler-' + serial++),
    true,
    { stationaryFeet: support },
  );
  actor.root.parent = nav;
  actor.root.rotation.y = 0.65;
  const prop = library.instantiate(
    clip === 'MatCarry' ? 'mat_rolled' : 'basket_empty',
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
    { width: 16, height: 16, subdivisions: 16 },
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
    position: { x: 0, z: 0.3 },
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
  const ground = (x: number, z: number) => floor.getHeightAtCoordinates(x, z);
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
it.each(['Carry', 'MatCarry'] as const)(
  'keeps the final supported %s arrival pose when select bookmarked an earlier moving frame',
  (clip) => {
    const f = fixture(clip);
    try {
      f.world.setPaused(false);
      f.world.poseTraveler(true, 0.3, 3.25);
      let movingBookmark: ReturnType<Actor['snapshotPose']> | undefined;
      f.world.activity.tick = () => {};
      f.world.pace = () => 3.25;
      f.world.path = [{ x: 0, z: 0.32 }];
      f.world.destination = 'simon';
      f.world.destinations = [{ id: 'simon', x: 0, z: 1.3 }];
      f.world.callbacks.interact = (id: string) => {
        movingBookmark = f.actor.snapshotPose();
        f.world.setConversation(id, panel);
        f.world.setPaused(true);
      };
      // simulate invokes the arrival callback before its final paused poseTraveler.
      f.world.simulate(0.05);
      expect(movingBookmark!.frame).toBe(18);
      expect(f.actor.playback.frame).toBe(0);
      expect(f.world.getPosition()).toEqual({ x: 0, z: 0.32 });
      const before = bookmark(f);
      // Preserve the paused stride envelope explicitly, including its airborne right sandal.
      expect(before.feet.left.soleMax).toBeCloseTo(0.206329, 5);
      expect(before.feet.right.soleMin).toBeCloseTo(0.018404, 5);
      expect(before.feet.right.soleMax).toBeCloseTo(0.088038, 5);
      f.conversationView.tick(0.016, false);
      unchanged(f, before);
      f.world.setConversation();
      unchanged(f, before);
      expect(f.actor.snapshotPose()).not.toEqual(movingBookmark);
    } finally {
      f.dispose();
    }
  },
);
it('retains settings resolved before any conversation tick instead of restoring an earlier partial support pose', () => {
  const f = fixture();
  try {
    f.world.setPaused(false);
    f.world.poseTraveler(true, 0.3, 3.25);
    f.world.poseTraveler(false, 0.04);
    f.world.setPaused(true);
    const partial = bookmark(f);
    expect(partial.feet.left.soleMax).toBeGreaterThan(0.1);
    f.world.setConversation('simon', panel);
    f.world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    const resolved = bookmark(f);
    expect(maximumDelta(partial.skin, resolved.skin, partial.skin.topology.upper)).toBe(0);
    supportedFaces(f, flat);
    f.world.setConversation();
    unchanged(f, resolved);
    expect(f.canvas.dataset.conversationTime).toBeUndefined();
  } finally {
    f.dispose();
  }
});
it('freezes partial support through dialogue and resumes its exact remaining transition time', () => {
  const current = fixture(),
    reference = fixture();
  try {
    for (const f of [current, reference]) {
      f.world.setPaused(false);
      f.world.poseTraveler(true, 0.3, 3.25);
      f.world.poseTraveler(false, 0.04);
      f.world.setPaused(true);
    }
    const before = bookmark(current);
    current.world.setConversation('simon', panel);
    for (let step = 0; step < 60; step++) current.conversationView.tick(1 / 60, false);
    current.world.setConversation();
    unchanged(current, before);
    for (const f of [current, reference]) f.world.setPaused(false);
    for (let step = 0; step < 8; step++) {
      for (const f of [current, reference]) f.world.poseTraveler(false, 0.02);
      expect(maximumDelta(geometry(reference.actor.root), geometry(current.actor.root))).toBe(0);
      expect(current.actor.snapshotPose()).toEqual(reference.actor.snapshotPose());
    }
    supportedFaces(current, flat);
  } finally {
    current.dispose();
    reference.dispose();
  }
});
it.each(['Carry', 'MatCarry'] as const)(
  'keeps unopted %s sampling and restoration exactly authored',
  (clip) => {
    const f = fixture(clip, flat, false),
      reference = fixture(clip, flat, false);
    try {
      expect(f.actor.hasFootSupport).toBe(false);
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
      expect(f.actor.snapshotPose()).toEqual(pose);
    } finally {
      f.dispose();
      reference.dispose();
    }
  },
);
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
