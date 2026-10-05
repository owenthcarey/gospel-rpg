import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import type { FootSupportOptions } from '../../src/scene/actors/stationary-feet';

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
  await library.load(['traveler', 'basket_empty', 'mat_rolled'], () => {});
}, 60_000);
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

const flat: FootSupportOptions['ground'] = () => 0;
const slope = (x: number, z: number) => 0.08 * x + 0.1 * z;
const lowerNames = ['thigh_left', 'thigh_right', 'leg_left', 'leg_right'];
const name = (value: string) =>
  value
    .split(':')
    .at(-1)!
    .replace(/\.\d+$/, '');
function fixture(enabled = true, mat = false) {
  const nav = new TransformNode('foot-nav-' + serial++, scene);
  const actor = new Actor(library.instantiate('traveler', 'foot-traveler-' + serial++), true, {
    stationaryFeet: enabled,
  });
  actor.root.parent = nav;
  const prop = library.instantiate(mat ? 'mat_rolled' : 'basket_empty', 'foot-prop-' + serial++);
  actor.attach(prop);
  return {
    actor,
    nav,
    prop,
    dispose: () => {
      actor.dispose();
      nav.dispose();
    },
  };
}
type Fixture = ReturnType<typeof fixture>;

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
  return { topology: packed, coordinates };
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
function groundRoot(actor: Actor, ground = flat) {
  actor.root.position.y = 0;
  const clearances = actor.footClearance(ground);
  actor.root.position.y = Math.max(0, -Math.min(clearances.left, clearances.right));
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
function unchanged(
  before: Skin,
  after: Skin,
  beforeMatrices: ReturnType<typeof matrices>,
  actor: Actor,
) {
  expect(maximumDelta(before, after, before.topology.upper)).toBe(0);
  let difference = 0;
  const afterMatrices = matrices(actor);
  for (let index = 0; index < beforeMatrices.length; index++)
    difference = Math.max(difference, Math.abs(beforeMatrices[index]! - afterMatrices[index]!));
  expect(difference).toBe(0);
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
function planted(actor: Actor, ground = flat, skin = geometry(actor.root)) {
  const measurement = feet(skin, ground);
  for (const side of ['left', 'right'] as const) {
    expect(measurement[side].soleCount).toBe(16);
    expect(Math.abs(measurement[side].soleMin)).toBeLessThan(0.000002);
    expect(Math.abs(measurement[side].soleMax)).toBeLessThan(0.000002);
    expect(measurement[side].minimum).toBeGreaterThan(-0.000002);
  }
  return skin;
}
function compose(actor: Actor, options: Partial<FootSupportOptions> = {}) {
  actor.supportFeet({ stationary: true, dt: 0, ground: flat, ...options });
}

it.each(['Walk', 'Carry', 'MatCarry'] as const)(
  'plants both entire stationary %s sole faces and preserves every upper/held vertex and grip',
  (clip) => {
    const { actor, nav, dispose } = fixture(true, clip === 'MatCarry');
    try {
      nav.position.set(2.3, 0, -1.7);
      actor.root.rotation.y = 0.65;
      actor.sample(clip, 0, true);
      groundRoot(actor);
      const before = geometry(actor.root),
        beforeMatrices = matrices(actor),
        contact = grip(before);
      expect(feet(before).left.minimum - feet(before).right.minimum).toBeCloseTo(0.04886454, 6);
      const root = actor.root.position.clone(),
        navigation = nav.getWorldMatrix().clone();
      compose(actor);
      const after = planted(actor);
      unchanged(before, after, beforeMatrices, actor);
      expect(grip(after)).toEqual(contact);
      expect(actor.root.position.equals(root)).toBe(true);
      expect(nav.getWorldMatrix().equals(navigation)).toBe(true);
      for (const index of after.topology.lower)
        expect(after.topology.vertices[index]!.weights).toEqual([1, 0, 0, 0]);
      let minimum = Infinity;
      for (let index = 1; index < after.coordinates.length; index += 3)
        minimum = Math.min(minimum, after.coordinates[index]!);
      expect(minimum).toBeGreaterThan(-0.000002);
    } finally {
      dispose();
    }
  },
);

it('keeps support opt-in and leaves the ordinary Actor geometry exactly authored', () => {
  const { actor, dispose } = fixture(false);
  try {
    actor.sample('Carry', 0, true);
    groundRoot(actor);
    const before = geometry(actor.root);
    compose(actor);
    expect(maximumDelta(before, geometry(actor.root))).toBe(0);
    expect(feet(before).left.minimum).toBeCloseTo(0.04886454, 6);
  } finally {
    dispose();
  }
});

it.each(['Walk', 'Carry', 'MatCarry'] as const)(
  'keeps the original moving %s gait and both independent foot measurements',
  (clip) => {
    const current = fixture(),
      reference = fixture(false);
    try {
      const heights = { left: [] as number[], right: [] as number[] };
      for (let step = 0; step < 60; step++) {
        for (const { actor } of [current, reference]) {
          actor.root.rotation.z = Math.sin((step / 60) * Math.PI * 2) * 0.016;
          actor.sample(clip, 1 / 60);
          groundRoot(actor);
        }
        compose(current.actor, { stationary: false, dt: 1 / 60 });
        const after = geometry(current.actor.root);
        expect(maximumDelta(geometry(reference.actor.root), after)).toBe(0);
        const measured = feet(after),
          cached = current.actor.footClearance();
        for (const side of ['left', 'right'] as const) {
          heights[side].push(measured[side].minimum);
          expect(cached[side]).toBeCloseTo(measured[side].minimum, 6);
        }
      }
      for (const side of ['left', 'right'] as const)
        expect(Math.max(...heights[side]) - Math.min(...heights[side])).toBeGreaterThan(0.02);
    } finally {
      current.dispose();
      reference.dispose();
    }
  },
);

it.each(Array.from({ length: 16 }, (_, index) => index / 16))(
  'bounds entry and exit at moving Carry phase %s without changing upper or held geometry',
  (phase) => {
    const current = fixture(),
      reference = fixture(false);
    try {
      for (const { actor } of [current, reference]) {
        actor.sampleAt('Carry', phase);
        groundRoot(actor);
      }
      compose(current.actor, { stationary: false, dt: 1 / 60 });
      let previous = geometry(current.actor.root),
        originalPrevious = geometry(reference.actor.root);
      let entry = 0,
        exit = 0,
        originalEntry = 0,
        originalExit = 0;
      for (let step = 0; step < 60; step++) {
        const stationary = step < 30;
        for (const { actor } of [current, reference]) {
          actor.sample('Carry', 1 / 60, stationary);
          groundRoot(actor);
        }
        const untouched = geometry(current.actor.root),
          beforeMatrices = matrices(current.actor);
        compose(current.actor, { stationary, dt: 1 / 60 });
        const displayed = geometry(current.actor.root),
          original = geometry(reference.actor.root);
        unchanged(untouched, displayed, beforeMatrices, current.actor);
        const lower = displayed.topology.lower;
        const delta = maximumDelta(previous, displayed, lower),
          rawDelta = maximumDelta(originalPrevious, original, lower);
        if (stationary) {
          entry = Math.max(entry, delta);
          originalEntry = Math.max(originalEntry, rawDelta);
          if (step >= 9) planted(current.actor, flat, displayed);
        } else {
          exit = Math.max(exit, delta);
          originalExit = Math.max(originalExit, rawDelta);
          if (step >= 39) expect(maximumDelta(original, displayed)).toBe(0);
        }
        const clearance = feet(displayed);
        for (const side of ['left', 'right'] as const)
          expect(clearance[side].minimum).toBeGreaterThan(-0.000002);
        previous = displayed;
        originalPrevious = original;
      }
      // Measured prototype maxima are 69.843 mm entering and 68.690 mm leaving.
      expect(entry).toBeLessThan(0.07);
      expect(exit).toBeLessThan(0.069);
      expect(exit).toBeLessThan(originalExit);
      if (originalEntry > 0.07) expect(entry).toBeLessThan(originalEntry);
    } finally {
      current.dispose();
      reference.dispose();
    }
  },
);

it('freezes a partial transition, then resumes its remaining simulation time without snapping', () => {
  const paused = fixture(),
    reference = fixture();
  try {
    for (const { actor } of [paused, reference]) {
      actor.sampleAt('Carry', 0.375);
      groundRoot(actor);
      compose(actor, { stationary: false, dt: 1 / 60 });
      actor.sample('Carry', 0.04, true);
      groundRoot(actor);
      compose(actor, { dt: 0.04 });
    }
    const before = geometry(paused.actor.root);
    expect(feet(before).left.soleMax).toBeGreaterThan(0.005);
    for (let tick = 0; tick < 8; tick++) {
      paused.actor.sample('Carry', 0, true);
      groundRoot(paused.actor);
      compose(paused.actor, { stationary: false, dt: 3, frozen: true });
      expect(maximumDelta(before, geometry(paused.actor.root))).toBeLessThan(0.000001);
    }
    for (const { actor } of [paused, reference]) {
      actor.sample('Carry', 0.02, true);
      groundRoot(actor);
      compose(actor, { dt: 0.02 });
    }
    expect(maximumDelta(geometry(paused.actor.root), geometry(reference.actor.root))).toBeLessThan(
      0.000001,
    );
    expect(feet(geometry(paused.actor.root)).left.soleMax).toBeGreaterThan(0.002);
    paused.actor.sample('Carry', 0.1, true);
    groundRoot(paused.actor);
    compose(paused.actor, { dt: 0.1 });
    planted(paused.actor);
  } finally {
    paused.dispose();
    reference.dispose();
  }
});

it.each(['zero-time', 'immediate', 'first-pose'] as const)(
  'resolves %s stationary startup directly rather than leaving a raised frozen sandal',
  (mode) => {
    const { actor, dispose } = fixture();
    try {
      if (mode !== 'first-pose') {
        actor.sampleAt('Walk', 0.3);
        groundRoot(actor);
        compose(actor, { stationary: false, dt: 0.02 });
      }
      actor.sample('Carry', 0, true);
      groundRoot(actor);
      compose(actor, { dt: mode === 'zero-time' ? 0 : 0.02, immediate: mode === 'immediate' });
      planted(actor);
    } finally {
      dispose();
    }
  },
);

it.each(['Walk', 'Carry', 'MatCarry'] as const)(
  'supports both %s foot minima on a turned slope while retaining the measured whole-sole gap',
  (clip) => {
    const { actor, nav, dispose } = fixture(true, clip === 'MatCarry');
    try {
      nav.position.set(1.3, slope(1.3, 1.4), 1.4);
      actor.root.rotation.y = 0.65;
      actor.sample(clip, 0, true);
      groundRoot(actor, slope);
      const before = geometry(actor.root),
        beforeMatrices = matrices(actor);
      compose(actor, { ground: slope });
      const after = geometry(actor.root),
        measured = feet(after, slope);
      unchanged(before, after, beforeMatrices, actor);
      for (const side of ['left', 'right'] as const) {
        expect(Math.abs(measured[side].minimum)).toBeLessThan(0.000002);
        expect(measured[side].soleCount).toBe(16);
        expect(measured[side].soleMin).toBeGreaterThan(-0.000002);
        expect(measured[side].soleMax).toBeCloseTo(0.038882, 5);
        expect(measured[side].soleMax).toBeLessThan(0.042);
      }
    } finally {
      dispose();
    }
  },
);

it('measures support over rendered curved triangles, including every sole vertex', () => {
  const { actor, nav, dispose } = fixture();
  const floor = CreateGround(
    'stationary-curved-ground',
    { width: 10, height: 10, subdivisions: 10 },
    scene,
  );
  try {
    const analytic = (x: number, z: number) => 0.08 * x * x + 0.04 * z;
    const positions = floor.getVerticesData('position')!;
    for (let index = 0; index < positions.length; index += 3)
      positions[index + 1] = analytic(positions[index]!, positions[index + 2]!);
    floor.setVerticesData('position', positions);
    floor.updateCoordinateHeights();
    const rendered = (x: number, z: number) => floor.getHeightAtCoordinates(x, z);
    expect(rendered(0.5, 0.3) - analytic(0.5, 0.3)).toBeCloseTo(0.02, 6);
    nav.position.set(0.5, analytic(0.5, 0.3), 0.3);
    actor.sample('Carry', 0, true);
    groundRoot(actor, rendered);
    compose(actor, { ground: rendered });
    const measured = feet(geometry(actor.root), rendered),
      cached = actor.footClearance(rendered);
    for (const side of ['left', 'right'] as const) {
      expect(Math.abs(measured[side].minimum)).toBeLessThan(0.000002);
      expect(cached[side]).toBeCloseTo(measured[side].minimum, 6);
      expect(measured[side].soleMin).toBeGreaterThan(-0.000002);
      expect(measured[side].soleMax).toBeLessThan(0.04);
    }
  } finally {
    floor.dispose();
    dispose();
  }
});

function supportedPair() {
  const current = fixture(),
    reference = fixture(false);
  for (const { actor } of [current, reference]) {
    actor.sample('Carry', 0, true);
    groundRoot(actor);
  }
  compose(current.actor);
  return { current, reference };
}
function sameGeometry(current: Fixture, reference: Fixture) {
  current.actor.root.position.y = reference.actor.root.position.y;
  expect(maximumDelta(geometry(reference.actor.root), geometry(current.actor.root))).toBe(0);
}

it('restores translated sparse channels even when setClip returns for the same Carry clip', () => {
  const { current, reference } = supportedPair();
  try {
    current.actor.setClip('Carry');
    reference.actor.setClip('Carry');
    sameGeometry(current, reference);
  } finally {
    current.dispose();
    reference.dispose();
  }
});

it.each(['Repair', 'SitDown', 'BenchSit', 'Row'] as const)(
  'removes stationary support before the exact %s presentation with zero skin/socket difference',
  (clip) => {
    const { current, reference } = supportedPair();
    try {
      for (const { actor } of [current, reference]) actor.sampleAt(clip, 0.5);
      sameGeometry(current, reference);
      const before = geometry(current.actor.root);
      compose(current.actor);
      expect(maximumDelta(before, geometry(current.actor.root))).toBe(0);
      expect(current.actor.playback).toEqual(reference.actor.playback);
    } finally {
      current.dispose();
      reference.dispose();
    }
  },
);

it('clears support before playOnce and preserves the actual finite action, grip and clip blend', () => {
  const { current, reference } = supportedPair();
  try {
    for (const { actor } of [current, reference]) {
      actor.playOnce('Repair');
      actor.sample('Carry', 0.1);
    }
    sameGeometry(current, reference);
    expect(current.actor.playback).toEqual(reference.actor.playback);
    expect(current.actor.playback.action).toBe('Repair');
  } finally {
    current.dispose();
    reference.dispose();
  }
});

it('clears support before exact sampleActionAt and restores the finite action clock', () => {
  const { current, reference } = supportedPair();
  try {
    for (const { actor } of [current, reference]) actor.sampleActionAt('SitDown', 0.4);
    sameGeometry(current, reference);
    expect(current.actor.snapshotPose()).toEqual(reference.actor.snapshotPose());
    expect(current.actor.playback.action).toBe('SitDown');
  } finally {
    current.dispose();
    reference.dispose();
  }
});

it('restores an authored snapshot and clears pending leg transition without changing its action state', () => {
  const { current, reference } = supportedPair();
  try {
    const pose = reference.actor.snapshotPose();
    current.actor.restorePose(pose);
    sameGeometry(current, reference);
    expect(current.actor.snapshotPose()).toEqual(pose);
    current.actor.sample('Carry', 0.1);
    reference.actor.sample('Carry', 0.1);
    groundRoot(current.actor);
    groundRoot(reference.actor);
    compose(current.actor, { stationary: false, dt: 0.01 });
    sameGeometry(current, reference);
  } finally {
    current.dispose();
    reference.dispose();
  }
});
