import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3, type Quaternion } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { ActorClip, AssetId } from '../../src/content/assets';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';

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
  disposalScene: Scene,
  disposalLibrary: AssetLibrary,
  serial = 0;
const actors: Actor[] = [],
  views: ConversationPresentation[] = [],
  cameras: ArcRotateCamera[] = [],
  parents: TransformNode[] = [];
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  disposalScene = new Scene(engine);
  disposalLibrary = new AssetLibrary(disposalScene);
  await library.load(['amos', 'villager', 'traveler'], () => {});
  await disposalLibrary.load(['villager'], () => {});
}, 60_000);
beforeEach(() => vi.stubGlobal('document', { hidden: false }));
afterEach(() => {
  for (const view of views.splice(0)) view.dispose();
  for (const actor of actors.splice(0)) actor.dispose();
  for (const camera of cameras.splice(0)) camera.dispose();
  for (const parent of parents.splice(0)) if (!parent.isDisposed()) parent.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => {
  library.dispose();
  disposalLibrary.dispose();
  if (!disposalScene.isDisposed) disposalScene.dispose();
  scene.dispose();
  engine.dispose();
});
interface ActorState {
  current?: AnimationGroup;
  elapsed: number;
  blendTime: number;
  strideRate: number;
  lookYaw: number;
  lookTarget: Vector3 | null;
  previousPose: {
    target: TransformNode;
    position: Vector3;
    scaling: Vector3;
    rotation: Quaternion | null;
  }[];
  route: { x: number; z: number }[];
  idle: ActorClip;
  moving: boolean;
}
const internal = (actor: Actor) => actor as unknown as ActorState;
const label = (node: TransformNode) => node.name.split(':').at(-1)!;
function values(actor: Actor) {
  return [actor.root, ...actor.root.getChildTransformNodes()].map((node) => ({
    name: node === actor.root ? '$placement-root' : label(node),
    position: node.position.asArray(),
    scaling: node.scaling.asArray(),
    euler: node.rotation.asArray(),
    quaternion: node.rotationQuaternion?.asArray() ?? null,
  }));
}
function playback(actor: Actor) {
  const state = internal(actor);
  return {
    ...actor.snapshotPose(),
    blendTime: state.blendTime,
    strideRate: state.strideRate,
    lookYaw: state.lookYaw,
    lookTarget: state.lookTarget?.asArray() ?? null,
    previous: state.previousPose.map((p) => ({
      name: label(p.target),
      position: p.position.asArray(),
      scaling: p.scaling.asArray(),
      quaternion: p.rotation?.asArray() ?? null,
    })),
  };
}
function nav(actor: Actor) {
  const state = internal(actor);
  return {
    position: actor.root.position.asArray(),
    route: state.route.map((p) => ({ ...p })),
    idle: state.idle,
    moving: state.moving,
  };
}
function ownerCounts() {
  return {
    meshes: scene.meshes.length,
    groups: scene.animationGroups.length,
    skeletons: scene.skeletons.length,
    transformNodes: scene.transformNodes.length,
  };
}
function actor(
  asset: 'amos' | 'villager' | 'traveler' = 'villager',
  blend = true,
  ground?: (x: number, z: number) => number,
  support = false,
) {
  const value = new Actor(library.instantiate(asset, 'blend-' + serial++), blend, {
    stationaryFeet: support,
    ...(ground ? { locomotionClearance: { ground } } : {}),
  });
  value.root.rotation.y = Math.PI;
  actors.push(value);
  return value;
}
function viewFor(source: Actor, supportedListener = false) {
  const listener = actor('traveler', true, undefined, supportedListener);
  listener.root.position.x = 2;
  const camera = new ArcRotateCamera(
    'blend-camera-' + serial++,
    -Math.PI / 2,
    1.05,
    10,
    new Vector3(0, 1, 0),
    scene,
  );
  cameras.push(camera);
  scene.activeCamera = camera;
  const canvas = { clientWidth: 640, clientHeight: 480, dataset: {} } as HTMLCanvasElement;
  const view = new ConversationPresentation(camera, canvas);
  views.push(view);
  return {
    view,
    listener,
    camera,
    canvas,
    select: () => view.select('ordinary-source', source, listener),
  };
}
function ordinary(source: Actor, dt = 0) {
  // Genuine constructor Idle -> Walk. No restorePose/sampleAt/source primer.
  source.sample('Walk', dt);
  assert.ok(internal(source).previousPose.length > 0);
  assert.ok(internal(source).blendTime < 0.16);
  assert.equal(source.performing, false);
}
function point(x: number, y: number, z: number, m: ArrayLike<number>) {
  const w = x * m[3]! + y * m[7]! + z * m[11]! + m[15]!;
  return [
    (x * m[0]! + y * m[4]! + z * m[8]! + m[12]!) / w,
    (x * m[1]! + y * m[5]! + z * m[9]! + m[13]!) / w,
    (x * m[2]! + y * m[6]! + z * m[10]! + m[14]!) / w,
  ];
}
/** Read every genuine body vertex from the just-rendered caches. No prepare/compute/sample/seek. */
function skin(source: Actor): number[] {
  const asset = source.root.getChildMeshes().find((m) => m.getTotalVertices())?.metadata
    ?.assetId as AssetId;
  const container = (
    library as unknown as { containers: Map<AssetId, { meshes: AbstractMesh[] }> }
  ).containers.get(asset);
  assert.ok(container);
  const expected = new Map<unknown, number>();
  for (const mesh of container.meshes)
    if (mesh.getTotalVertices())
      expected.set(
        (mesh as unknown as { geometry: unknown }).geometry,
        (expected.get((mesh as unknown as { geometry: unknown }).geometry) ?? 0) + 1,
      );
  const active = scene.getActiveMeshes(),
    present = new Set(active.data.slice(0, active.length));
  const counts = new Map<unknown, number>(),
    output: number[] = [];
  for (const mesh of source.root.getChildMeshes()) {
    if (!mesh.getTotalVertices()) continue;
    assert.equal(mesh.metadata.assetId, asset);
    assert.equal(mesh.metadata.placement, source.root.name);
    assert.equal(mesh.getScene(), scene);
    assert.ok(mesh.isEnabled() && !mesh.isDisposed() && present.has(mesh));
    assert.equal(mesh.metadata.renderedFrame, scene.getFrameId());
    const cache = mesh as unknown as {
      geometry: unknown;
      _worldMatrix: { m: ArrayLike<number> };
      _bonesTransformMatrices?: Float32Array;
    };
    assert.ok(expected.has(cache.geometry));
    counts.set(cache.geometry, (counts.get(cache.geometry) ?? 0) + 1);
    const positions = mesh.getVerticesData('position')!,
      indices = mesh.getVerticesData('matricesIndices')!,
      weights = mesh.getVerticesData('matricesWeights')!;
    const skeleton = mesh.skeleton as unknown as {
      needInitialSkinMatrix: boolean;
      _transformMatrices: Float32Array;
      _isDirty: boolean;
    };
    assert.ok(skeleton && positions && indices && weights);
    assert.equal(skeleton._isDirty, false);
    assert.ok(mesh.computeBonesUsingShaders && mesh.numBoneInfluencers <= 4);
    const bones = skeleton.needInitialSkinMatrix
      ? cache._bonesTransformMatrices
      : skeleton._transformMatrices;
    assert.ok(bones?.length);
    assert.equal(positions.length, mesh.getTotalVertices() * 3);
    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3]!,
        y = positions[i * 3 + 1]!,
        z = positions[i * 3 + 2]!,
        local = [0, 0, 0];
      for (let j = 0; j < 4; j++) {
        const weight = weights[i * 4 + j]!;
        if (!weight) continue;
        const b = indices[i * 4 + j]! * 16,
          posed = point(x, y, z, bones.subarray(b, b + 16));
        for (let axis = 0; axis < 3; axis++) local[axis]! += weight * posed[axis]!;
      }
      output.push(...point(local[0]!, local[1]!, local[2]!, cache._worldMatrix.m));
    }
  }
  assert.deepEqual(counts, expected);
  assert.ok(output.length > 6_000 && output.every(Number.isFinite));
  return output;
}
function sameSkin(actual: readonly number[], expected: readonly number[], lift = 0) {
  assert.equal(actual.length, expected.length);
  let error = 0;
  for (let i = 0; i < actual.length; i++)
    error = Math.max(error, Math.abs(actual[i]! - expected[i]! - (i % 3 === 1 ? lift : 0)));
  assert.ok(error < 0.000003, 'complete current body skin error: ' + error);
}

it('restores the real unprimed Idle-to-Walk0 body without sampling the source at clear', async () => {
  const source = actor(),
    fixture = viewFor(source);
  await scene.whenReadyAsync();
  source.walk([
    { x: 4, z: 1 },
    { x: 6, z: 1 },
  ]);
  ordinary(source);
  scene.render();
  const before = values(source),
    body = skin(source),
    pose = playback(source),
    navigation = nav(source),
    group = internal(source).current!,
    frame = group.getCurrentFrame(),
    runtimes = [...group.animatables],
    counts = ownerCounts(),
    seek = vi.spyOn(group, 'goToFrame');
  fixture.select();
  fixture.view.tick(0.05, false);
  scene.render();
  const sceneFrame = scene.getFrameId(),
    sceneTime = (scene as unknown as { _animationTime: number })._animationTime;
  fixture.view.clear();
  assert.equal(scene.getFrameId(), sceneFrame);
  assert.equal((scene as unknown as { _animationTime: number })._animationTime, sceneTime);
  scene.render();
  // This actual geometry assertion is the baseline reproduction; no new API is called by this test.
  sameSkin(skin(source), body);
  assert.deepEqual(values(source), before);
  assert.deepEqual(playback(source), pose);
  assert.deepEqual(nav(source), navigation);
  assert.equal(internal(source).current, group);
  assert.equal(group.getCurrentFrame(), frame);
  assert.deepEqual(group.animatables, runtimes);
  assert.ok(group.isStarted && !group.isPlaying);
  expect(seek).not.toHaveBeenCalled();
  assert.deepEqual(ownerCounts(), counts);
  assert.equal(source.model.animations.filter((g) => g.isStarted).length, 1);
});

it.each([0.02, 0.07, 0.12])(
  'continues the remaining real blend at %ss with stride and gaze intact',
  async (dt) => {
    const source = actor('amos'),
      reference = actor('amos'),
      fixture = viewFor(source);
    await scene.whenReadyAsync();
    for (const value of [source, reference]) {
      value.setStrideSpeed(2.1);
      value.lookAt(new Vector3(1.1, 1.6, 4));
      ordinary(value, dt);
    }
    assert.ok(internal(source).lookYaw > 0);
    scene.render();
    const body = skin(source),
      state = playback(source),
      navigation = nav(source);
    fixture.select();
    fixture.view.tick(0.05, false);
    fixture.view.tick(0.04, false);
    scene.render();
    fixture.view.clear();
    scene.render();
    sameSkin(skin(source), body);
    assert.deepEqual(playback(source), state);
    assert.deepEqual(values(source), values(reference));
    assert.deepEqual(nav(source), navigation);
    for (let i = 0; i < 6; i++) {
      source.sample('Walk', 1 / 60);
      reference.sample('Walk', 1 / 60);
      scene.render();
      assert.deepEqual(playback(source), playback(reference));
      assert.deepEqual(values(source), values(reference));
      sameSkin(skin(source), skin(reference));
      assert.equal(
        internal(source).current!.getCurrentFrame(),
        internal(reference).current!.getCurrentFrame(),
      );
      assert.deepEqual(nav(source), navigation);
    }
  },
);

it('also restores and resumes a genuine Walk-to-Idle blend', () => {
  const source = actor(),
    reference = actor(),
    fixture = viewFor(source);
  for (const value of [source, reference]) {
    value.sample('Walk', 0.2);
    value.sample('Idle', 0.03);
  }
  assert.ok(internal(source).previousPose.length > 0);
  fixture.select();
  fixture.view.tick(0.08, false);
  fixture.view.clear();
  assert.deepEqual(playback(source), playback(reference));
  assert.deepEqual(values(source), values(reference));
  source.sample('Idle', 0.04);
  reference.sample('Idle', 0.04);
  assert.deepEqual(playback(source), playback(reference));
  assert.deepEqual(values(source), values(reference));
});

it('consumes the owned scope once without a seek, clone or later pose write', () => {
  const source = actor();
  ordinary(source, 0.03);
  const pose = playback(source),
    locals = values(source),
    counts = ownerCounts(),
    group = internal(source).current!,
    seek = vi.spyOn(group, 'goToFrame'),
    clone = vi.spyOn(group, 'clone'),
    scope = source.conversationPoseScope();
  source.suppressLocomotionPresentation(true);
  scope.sample('Greet', 0.04);
  assert.ok(group.isStarted && !group.isPlaying);
  assert.equal(scope.restore(source.root.rotation.y), true);
  assert.deepEqual(playback(source), pose);
  assert.deepEqual(values(source), locals);
  source.sample('Idle', 0.02);
  const current = playback(source),
    after = values(source);
  assert.equal(scope.restore(Math.PI / 4), false);
  scope.sample('Respond', 10);
  scope.release();
  assert.equal(scope.active, false);
  assert.deepEqual(playback(source), current);
  assert.deepEqual(values(source), after);
  expect(seek).not.toHaveBeenCalled();
  expect(clone).not.toHaveBeenCalled();
  assert.deepEqual(ownerCounts(), counts);
});

it.each([
  ['public ordinary sample', (value: Actor) => value.sample('Idle', 0.04)],
  ['exact sample', (value: Actor) => value.sampleAt('Listen', 0.4)],
  ['exact finite sample', (value: Actor) => value.sampleActionAt('Greet', 0.4)],
  ['explicit restore', (value: Actor) => value.restorePose(value.snapshotPose())],
  ['finite action', (value: Actor) => value.playOnce('Greet')],
  ['action reset', (value: Actor) => value.cancelAction()],
  ['clip reset', (value: Actor) => value.setClip('Idle')],
  ['base pose reset', (value: Actor) => value.pose('Sit')],
  ['stride change', (value: Actor) => value.setStrideSpeed(1.8)],
  ['route change', (value: Actor) => value.walk([{ x: 1, z: 0 }])],
  ['unsuppress', (value: Actor) => value.suppressLocomotionPresentation(false)],
] as const)('revokes a retained source on %s, including while suppressed', (_name, update) => {
  const source = actor();
  ordinary(source, 0.03);
  const scope = source.conversationPoseScope(),
    group = internal(source).current!,
    ended = vi.fn();
  group.onAnimationGroupEndObservable.add(ended);
  source.suppressLocomotionPresentation(true);
  scope.sample('Greet', 0.04);
  update(source);
  const pose = playback(source),
    locals = values(source),
    navigation = nav(source),
    active = source.model.animations.reduce((sum, g) => sum + g.animatables.length, 0),
    seek = vi.spyOn(group, 'goToFrame');
  assert.equal(scope.active, false);
  assert.equal(scope.restore(0), false);
  scope.sample('Respond', 10);
  scope.release();
  assert.deepEqual(playback(source), pose);
  assert.deepEqual(values(source), locals);
  assert.deepEqual(nav(source), navigation);
  assert.equal(
    source.model.animations.reduce((sum, g) => sum + g.animatables.length, 0),
    active,
  );
  expect(seek).not.toHaveBeenCalled();
  expect(ended).not.toHaveBeenCalled();
});

it.each([
  ['ordinary external controller sample', (value: Actor) => value.sample('Idle', 0.04)],
  [
    'new finite action',
    (value: Actor) => {
      value.playOnce('Greet');
      value.sample('Idle', 0.02);
    },
  ],
] as const)(
  'Conversation.clear preserves %s instead of restoring the retired source',
  (_name, update) => {
    const source = actor(),
      fixture = viewFor(source);
    ordinary(source, 0.03);
    fixture.select();
    fixture.view.tick(0.04, false);
    update(source);
    source.root.rotation.y = 0.4;
    source.lookAt(new Vector3(-1, 2, 4));
    const pose = playback(source),
      locals = values(source),
      navigation = nav(source),
      restore = vi.spyOn(source, 'restorePose'),
      sample = vi.spyOn(source, 'sample');
    fixture.view.tick(0.05, false);
    fixture.view.clear();
    assert.deepEqual(playback(source), pose);
    assert.deepEqual(values(source), locals);
    assert.deepEqual(nav(source), navigation);
    expect(restore).not.toHaveBeenCalled();
    expect(sample).not.toHaveBeenCalled();
  },
);

it.each([
  'root disable',
  'ancestor disable',
  'root reparent',
  'rig reparent',
  'rig disable',
] as const)('rejects %s and remains retired after re-enable/reattach', (boundary) => {
  const source = actor(),
    fixture = viewFor(source),
    ancestor = new TransformNode('blend-parent-' + serial++, scene);
  parents.push(ancestor);
  source.root.parent = ancestor;
  ordinary(source, 0.03);
  const scope = source.conversationPoseScope();
  source.suppressLocomotionPresentation(true);
  scope.sample('Greet', 0.04);
  const target = internal(source).previousPose[0]!.target,
    originalParent = target.parent;
  if (boundary === 'root disable') source.root.setEnabled(false);
  if (boundary === 'ancestor disable') ancestor.setEnabled(false);
  if (boundary === 'root reparent') source.root.parent = null;
  if (boundary === 'rig reparent') target.parent = source.root;
  if (boundary === 'rig disable') target.setEnabled(false);
  assert.equal(scope.active, false);
  source.root.setEnabled(true);
  ancestor.setEnabled(true);
  source.root.parent = ancestor;
  target.parent = originalParent;
  target.setEnabled(true);
  const state = playback(source),
    locals = values(source),
    navigation = nav(source),
    seek = vi.spyOn(internal(source).current!, 'goToFrame');
  assert.equal(scope.restore(Math.PI / 3), false);
  scope.sample('Respond', 10);
  assert.deepEqual(playback(source), state);
  assert.deepEqual(values(source), locals);
  assert.deepEqual(nav(source), navigation);
  expect(seek).not.toHaveBeenCalled();
  fixture.view.clear();
  ancestor.dispose();
});

it.each(['root', 'Actor'] as const)('makes a scope inert after actual %s disposal', (boundary) => {
  const source = actor();
  ordinary(source, 0.03);
  const scope = source.conversationPoseScope(),
    group = internal(source).current!;
  scope.sample('Greet', 0.04);
  if (boundary === 'root') source.root.dispose();
  else source.dispose();
  const seek = vi.spyOn(group, 'goToFrame');
  assert.equal(scope.active, false);
  assert.equal(scope.restore(0), false);
  scope.sample('Respond', 10);
  scope.release();
  expect(seek).not.toHaveBeenCalled();
});

it('makes the owned scope inert after actual scene disposal', () => {
  const source = new Actor(disposalLibrary.instantiate('villager', 'blend-scene-disposal'), true);
  ordinary(source, 0.03);
  const scope = source.conversationPoseScope(),
    group = internal(source).current!;
  scope.sample('Greet', 0.04);
  disposalScene.dispose();
  const seek = vi.spyOn(group, 'goToFrame');
  assert.equal(scope.active, false);
  assert.equal(scope.restore(0), false);
  scope.sample('Respond', 10);
  scope.release();
  expect(seek).not.toHaveBeenCalled();
  source.dispose();
});

it.each([
  ['constructor pose', () => {}, true],
  ['blend disabled', (value: Actor) => value.sample('Walk', 0.03), false],
  ['exact frame', (value: Actor) => value.sampleAt('Walk', 0.2), true],
  ['still/reduced sample', (value: Actor) => value.sample('Walk', 0, true), true],
  [
    'finite source',
    (value: Actor) => {
      value.playOnce('Greet');
      value.sample('Idle', 0.03);
    },
    true,
  ],
  ['finished blend', (value: Actor) => value.sample('Walk', 0.2), true],
] as const)(
  'keeps %s on the existing fallback without claiming a value bookmark',
  (_name, setup, blend) => {
    const source = actor('villager', blend);
    setup(source);
    const scope = source.conversationPoseScope();
    scope.sample('Listen', 0.02);
    const now = playback(source),
      locals = values(source);
    assert.equal(scope.restore(0), undefined);
    assert.equal(scope.active, false);
    assert.equal(scope.restore(0), false);
    assert.deepEqual(playback(source), now);
    assert.deepEqual(values(source), locals);
  },
);

it('preserves ordinary exact-pose fallback through the real Conversation.clear', () => {
  const source = actor(),
    fixture = viewFor(source);
  source.sampleAt('Walk', 0.2);
  const before = source.snapshotPose(),
    restore = vi.spyOn(source, 'restorePose');
  fixture.select();
  fixture.view.tick(0.03, false);
  fixture.view.clear();
  expect(restore).toHaveBeenCalledTimes(1);
  assert.deepEqual(source.snapshotPose(), before);
});

it('same selection retains its owned scope and replacement consumes only the old one', () => {
  const source = actor(),
    replacement = actor('amos'),
    fixture = viewFor(source);
  ordinary(source, 0.03);
  ordinary(replacement, 0.02);
  const before = playback(source),
    next = playback(replacement);
  fixture.select();
  fixture.view.tick(0.04, false);
  const current = playback(source);
  fixture.select();
  assert.deepEqual(playback(source), current);
  fixture.view.select('next-source', replacement, fixture.listener);
  assert.deepEqual(playback(source), before);
  fixture.view.tick(0.04, false);
  fixture.view.clear();
  assert.deepEqual(playback(replacement), next);
});

function footMinimum(
  source: Actor,
  coordinates: readonly number[],
  ground: (x: number, z: number) => number,
) {
  let offset = 0,
    minimum = Infinity,
    count = 0;
  for (const mesh of source.root.getChildMeshes()) {
    if (!mesh.getTotalVertices()) continue;
    const indices = mesh.getVerticesData('matricesIndices')!,
      weights = mesh.getVerticesData('matricesWeights')!;
    for (let i = 0; i < mesh.getTotalVertices(); i++) {
      const joint = mesh.skeleton!.bones[indices[i * 4]!]!.name.split(':').at(-1);
      if (joint !== 'leg_left' && joint !== 'leg_right') continue;
      assert.equal(weights[i * 4], 1, 'current rigid authored sandal/leg oracle domain');
      const at = offset + i * 3;
      minimum = Math.min(
        minimum,
        coordinates[at + 1]! - ground(coordinates[at]!, coordinates[at + 2]!),
      );
      count++;
    }
    offset += mesh.getTotalVertices() * 3;
  }
  assert.ok(count > 0 && Number.isFinite(minimum));
  return minimum;
}

it.each(['flat', 'slope'] as const)(
  'restores actual blend values then recomposes only current %s-floor clearance',
  async (terrain) => {
    let datum = 0,
      queries = 0;
    const height = (x: number, z: number) =>
        datum + (terrain === 'slope' ? x * 0.025 + z * 0.018 : 0),
      ground = (x: number, z: number) => {
        queries++;
        return height(x, z);
      };
    const source = actor('amos', true, ground),
      raw = actor('amos'),
      fixture = viewFor(source);
    await scene.whenReadyAsync();
    for (const value of [source, raw]) {
      value.root.position.set(1, height(1, 1), 1);
      ordinary(value, 0.07);
    }
    scene.render();
    const navigation = nav(source),
      state = playback(source);
    fixture.select();
    const scope = (
      fixture.view as unknown as { speaker: { pose: ReturnType<Actor['conversationPoseScope']> } }
    ).speaker.pose;
    fixture.view.tick(0.04, false);
    datum = 0.23;
    const beforeQueries = queries;
    fixture.view.clear();
    assert.ok(
      queries > beforeQueries,
      'genuine current terrain queried during legitimate recomposition',
    );
    scene.render();
    const unlifted = skin(raw),
      displayed = skin(source),
      rawMinimum = footMinimum(raw, unlifted, height),
      visual = source.root
        .getChildTransformNodes()
        .find((node) => node.parent === source.root && node.name.endsWith(':visual'))!,
      lift = visual.position.y;
    assert.ok(lift > 0);
    assert.ok(Math.abs(lift - Math.max(0, -rawMinimum)) < 0.000003);
    sameSkin(displayed, unlifted, lift);
    assert.ok(Math.abs(footMinimum(source, displayed, height)) < 0.000003);
    assert.deepEqual(playback(source), state);
    assert.deepEqual(nav(source), navigation);
    const a = values(source),
      b = values(raw);
    for (let i = 0; i < a.length; i++) {
      if (a[i]!.name.endsWith('visual')) b[i]!.position[1] = lift;
    }
    assert.deepEqual(a, b);
    const consumedQueries = queries,
      current = playback(source),
      locals = values(source);
    assert.equal(scope.restore(0), false);
    scope.sample('Respond', 1);
    scope.release();
    assert.equal(queries, consumedQueries);
    assert.deepEqual(playback(source), current);
    assert.deepEqual(values(source), locals);
  },
);

it('retains actual held support and its existing continuation rather than restoring a value bookmark', () => {
  const source = actor(),
    fixture = viewFor(source, true),
    listener = fixture.listener;
  ordinary(source, 0.03);
  listener.sample('Carry', 0.07);
  listener.supportFeet({ stationary: true, dt: 0, ground: () => 0 });
  assert.equal(listener.hasFootSupport, true);
  const before = listener.snapshotPose(),
    navigation = nav(listener),
    group = internal(listener).current!,
    seek = vi.spyOn(group, 'goToFrame'),
    restore = vi.spyOn(listener, 'restorePose'),
    socket = listener.model.socket('carry_socket'),
    socketPosition = socket.position.asArray(),
    socketRotation = socket.rotationQuaternion?.asArray() ?? socket.rotation.asArray();
  fixture.select();
  fixture.view.tick(0.04, false);
  fixture.view.clear();
  assert.equal(listener.hasFootSupport, true);
  assert.deepEqual(listener.snapshotPose(), before);
  assert.deepEqual(nav(listener), navigation);
  assert.equal(internal(listener).current, group);
  assert.deepEqual(socket.position.asArray(), socketPosition);
  assert.deepEqual(
    socket.rotationQuaternion?.asArray() ?? socket.rotation.asArray(),
    socketRotation,
  );
  expect(seek).not.toHaveBeenCalled();
  expect(restore).not.toHaveBeenCalled();
});

it('keeps a policy-only reduced setting owned until a genuine external source sample', async () => {
  const height = () => 0,
    source = actor('amos', true, height),
    fixture = viewFor(source);
  await scene.whenReadyAsync();
  ordinary(source, 0.03);
  scene.render();
  const before = playback(source),
    body = skin(source),
    locals = values(source),
    navigation = nav(source),
    group = internal(source).current!,
    frame = group.getCurrentFrame(),
    runtimes = [...group.animatables],
    visual = source.root
      .getChildTransformNodes()
      .find((node) => node.parent === source.root && node.name.endsWith(':visual')),
    seek = vi.spyOn(group, 'goToFrame');
  assert.ok(visual);
  fixture.select();
  assert.equal(visual.position.y, 0);
  fixture.view.tick(0.04, false);
  assert.equal(visual.position.y, 0);
  source.setLocomotionReducedMotion(true);
  assert.equal(visual.position.y, 0);
  fixture.view.tick(0.03, true);
  assert.equal(source.playback.clip, 'Listen');
  assert.equal(source.playback.frame, 0);
  scene.render();
  assert.equal(visual.position.y, 0);
  skin(source); // Require the genuine current body domain even during suppressed Listen.
  fixture.view.clear();
  scene.render();
  assert.deepEqual(playback(source), before);
  assert.equal(internal(source).current, group);
  assert.equal(group.getCurrentFrame(), frame);
  assert.deepEqual(group.animatables, runtimes);
  assert.ok(group.isStarted && !group.isPlaying);
  assert.ok(internal(source).previousPose.length > 0 && internal(source).blendTime < 0.16);
  assert.deepEqual(values(source), locals);
  assert.deepEqual(nav(source), navigation);
  const restored = skin(source),
    minimum = footMinimum(source, restored, height),
    lift = visual.position.y;
  sameSkin(restored, body);
  assert.ok(
    minimum >= -0.000002,
    'complete current restored lower envelope must clear the actual floor',
  );
  // This upright, unit-scale fixture has an identity visual wrapper, so its world-Y lift
  // subtracts directly from the complete displayed lower minimum without any pose seek.
  assert.ok(Math.abs(lift - Math.max(0, lift - minimum)) < 0.000003);
  expect(seek).not.toHaveBeenCalled();
  const next = source.conversationPoseScope();
  source.sample('Walk', 0, true);
  assert.equal(next.active, false);
  assert.equal(next.restore(0), false);
  assert.equal(source.playback.frame, 0);
  assert.deepEqual(internal(source).previousPose, []);
});
