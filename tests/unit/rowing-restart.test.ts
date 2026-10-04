import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { TravelerBoat } from '../../src/scene/actors/boat';

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
const actors: Actor[] = [];
beforeAll(async () => {
  engine = new NullEngine();
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['traveler', 'boat', 'oar'], () => {});
});
afterAll(() => {
  actors.forEach((actor) => actor.dispose());
  library?.dispose();
  scene?.dispose();
  engine?.dispose();
});

function local(node: TransformNode) {
  return [
    ...node.position.asArray(),
    ...node.scaling.asArray(),
    ...(node.rotationQuaternion?.asArray() ?? [...node.rotation.asArray(), 0]),
  ];
}
function tree(root: TransformNode) {
  return [root, ...root.getChildTransformNodes(false)].map((node) => ({
    name:
      node === root
        ? '$placement-root'
        : node.name
            .split(':')
            .at(-1)!
            .replace(/\.\d+$/, ''),
    values: local(node),
  }));
}
function studio() {
  const parent = new TransformNode('row-navigation-' + serial, scene);
  parent.position.set(4, 0.21, -3);
  parent.rotation.y = 0.74;
  const actor = new Actor(library.instantiate('traveler', 'rower-' + serial++));
  actors.push(actor);
  const boat = new TravelerBoat(library, parent, actor);
  const oars = parent
    .getChildren()
    .filter(
      (node): node is TransformNode =>
        node instanceof TransformNode && node.name.startsWith('traveler-oar-'),
    );
  expect(oars).toHaveLength(2);
  expect(actor.root.parent).toBe(parent);
  expect(boat.model.root.parent).toBe(parent);
  expect(oars.every((oar) => oar.parent === parent)).toBe(true);
  const navigation = local(parent);
  const pose = () => ({
    rig: tree(actor.root),
    hull: tree(boat.model.root),
    oars: oars.map(tree),
    frame: actor.playback.frame,
  });
  return { parent, actor, boat, pose, navigation };
}

it('restarts actual rower and oars from the visible Row0 pose instead of hidden old phase', () => {
  const resumed = studio(),
    fresh = studio();
  resumed.boat.pose(true, 0.31, false);
  resumed.boat.pose(false, 0, false);
  fresh.boat.pose(false, 0, false);
  expect(resumed.pose()).toEqual(fresh.pose());
  resumed.boat.pose(true, 0.05, false);
  fresh.boat.pose(true, 0.05, false);
  expect(resumed.pose()).toEqual(fresh.pose());
  expect(local(resumed.parent)).toEqual(resumed.navigation);
  expect(local(fresh.parent)).toEqual(fresh.navigation);
});

it('keeps Row0 on a zero-elapsed resume and repeated real rest calls', () => {
  const actual = studio();
  actual.boat.pose(true, 0.37, false);
  actual.boat.pose(false, 0, false);
  const stopped = actual.pose();
  actual.boat.pose(false, 0.4, false);
  expect(actual.pose()).toEqual(stopped);
  actual.boat.pose(true, 0, false);
  expect(actual.pose()).toEqual(stopped);
  expect(local(actual.parent)).toEqual(actual.navigation);
});

it('gives the same fresh stroke after different prior normal rowing histories', () => {
  const first = studio(),
    second = studio();
  first.boat.pose(true, 0.19, false);
  second.boat.pose(true, 0.87, false);
  first.boat.pose(false, 0, false);
  second.boat.pose(false, 0, false);
  first.boat.pose(true, 0.04, false);
  second.boat.pose(true, 0.04, false);
  expect(first.pose()).toEqual(second.pose());
});

it('preserves the existing normal uninterrupted stroke across equal dt partitions', () => {
  const one = studio(),
    many = studio();
  one.boat.pose(true, 0.12, false);
  for (let i = 0; i < 3; i++) many.boat.pose(true, 0.04, false);
  const a = one.pose(),
    b = many.pose();
  expect(a.rig.map((node) => node.name)).toEqual(b.rig.map((node) => node.name));
  expect(a.frame).toBeCloseTo(b.frame, 12);
  const values = (pose: typeof a) =>
    [...pose.rig, ...pose.hull, ...pose.oars.flat()].flatMap((node) => node.values);
  const left = values(a),
    right = values(b);
  expect(left).toHaveLength(right.length);
  for (let i = 0; i < left.length; i++) expect(left[i]).toBeCloseTo(right[i]!, 12);
});

it('keeps reduced Row0 geometry exact and restarts normally from that actually displayed pose', () => {
  const resumed = studio(),
    fresh = studio();
  resumed.boat.pose(true, 0.31, false);
  resumed.boat.pose(true, 0.2, true);
  fresh.boat.pose(true, 0, true);
  const reduced = resumed.pose();
  expect(reduced).toEqual(fresh.pose());
  resumed.boat.pose(true, 1.1, true);
  expect(resumed.pose()).toEqual(reduced);
  resumed.boat.pose(true, 0.05, false);
  fresh.boat.pose(true, 0.05, false);
  expect(resumed.pose()).toEqual(fresh.pose());
  expect(local(resumed.parent)).toEqual(resumed.navigation);
});

it('preserves hull, seat support and navigation while only sampled rower/oar transforms change', () => {
  const actual = studio();
  actual.boat.pose(false, 0, false);
  const hull = actual.pose().hull;
  const seat = actual.parent.getChildren().find((node) => node.name === 'rower-seat');
  expect(seat).toBeInstanceOf(TransformNode);
  const support = local(seat as TransformNode);
  for (const dt of [0.03, 0.04, 0.05, 0.03]) {
    actual.boat.pose(true, dt, false);
    expect(actual.pose().hull).toEqual(hull);
    expect(local(seat as TransformNode)).toEqual(support);
    expect(local(actual.parent)).toEqual(actual.navigation);
  }
  actual.boat.pose(false, 0, false);
  expect(actual.pose().hull).toEqual(hull);
  expect(local(seat as TransformNode)).toEqual(support);
  expect(local(actual.parent)).toEqual(actual.navigation);
});
