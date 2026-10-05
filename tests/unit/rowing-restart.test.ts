import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { TravelerBoat } from '../../src/scene/actors/boat';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { World } from '../../src/scene/world';
import { bindExplorationInput } from '../../src/scene/input';
import { PausedCadence } from '../../src/scene/presentation/cadence';
import type { Ripple } from '../../src/scene/presentation/water';
import { lakeLayouts } from '../../src/content/lake/layouts';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { DEFAULT_SETTINGS } from '../../src/game/types';
import { sail } from '../helpers/lake';

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

// The existing imported studio supplies the real rower, hull, seat and oars. Only
// environment/draw endpoints are stubbed; actual World movement and input run.
class WakeCanvas extends EventTarget {
  readonly clientWidth = 1280;
  readonly clientHeight = 720;
  readonly dataset: Record<string, string> = {};
  closest() {
    return null;
  }
}
class WakeFormControl extends EventTarget {}

function releaseStudio(f: ReturnType<typeof studio>) {
  actors.splice(actors.indexOf(f.actor), 1);
  f.actor.dispose();
  f.parent.dispose();
}
function rowSnapshot(f: ReturnType<typeof studio>) {
  return {
    ...f.pose(),
    playback: { ...f.actor.playback },
    clock: f.actor.snapshotPose(),
  };
}
function wakeStudio() {
  const f = studio(),
    state = sail(),
    input = structuredClone(state),
    layout = lakeLayouts['galilee-water'],
    canvas = new WakeCanvas(),
    events = new EventTarget(),
    documentState = { hidden: false },
    draw = vi.fn(),
    water = {
      tick: vi.fn(),
      quality: vi.fn(),
      setRipples: vi.fn<(ripples: readonly Ripple[]) => void>(),
    };
  let now = 1000;
  vi.stubGlobal('document', documentState);
  vi.stubGlobal('window', events);
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('HTMLElement', WakeCanvas);
  vi.stubGlobal('HTMLInputElement', WakeFormControl);
  vi.stubGlobal('HTMLSelectElement', WakeFormControl);
  vi.stubGlobal('HTMLTextAreaElement', WakeFormControl);
  const camera = new ArcRotateCamera('wake-camera', 0, 0.78, 44, Vector3.Zero(), scene);
  const world = Object.assign(Object.create(World.prototype), {
    state,
    layout,
    camera,
    cameraAspectScale: 1,
    canvas,
    position: { ...state.position },
    player: f.parent,
    playerModel: f.actor.root,
    actorPlayer: f.actor,
    travelerBoat: f.boat,
    water,
    grid: new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max),
    actors: new Map(),
    people: new Map(),
    boats: [],
    cutaways: [],
    occluders: [],
    destinations: [],
    marker: { position: { set: vi.fn() }, setEnabled: vi.fn() },
    routeDots: [],
    keys: new Set<string>(),
    path: [],
    walkRamp: 0,
    pendingRotation: 0,
    time: 0,
    lastRender: now,
    lastFrame: Infinity,
    cadence: new PausedCadence(),
    dataCache: new Map(),
    guidance: 'full',
    active: true,
    paused: false,
    reducedMotion: false,
    stage: { setView: vi.fn(), tick: vi.fn(), applySettings: vi.fn() },
    scene: { render: draw },
    callbacks: { notice: vi.fn(), interact: vi.fn() },
  });
  const binding = bindExplorationInput({
    scene,
    canvas: canvas as unknown as HTMLCanvasElement,
    keys: world.keys,
    paused: () => world.paused,
    walk: (point) => world.walkTo(point),
    navigate: (id) => world.navigate(id),
    nearest: () => undefined,
    resetCamera: () => world.resetCamera(),
    notice: world.callbacks.notice,
  });
  world.explorationInput = binding;
  world.setPosition(state.position, true);
  const render = (ms = 50) => {
    now += ms;
    world.renderFrame();
  };
  const send = (key: string, type = 'keydown') => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      key,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      isComposing: false,
    });
    Object.defineProperty(event, 'target', { value: canvas });
    events.dispatchEvent(event);
    return event;
  };
  const packet = () => {
    const last = water.setRipples.mock.calls.at(-1);
    expect(last).toBeDefined();
    expect(last![0]).toHaveLength(1);
    return { ...last![0][0]! };
  };
  const check = (strength: number) => {
    const ripple = packet(),
      position = world.getPosition();
    // The unparented navigation root writes translation into Babylon's Float32
    // world matrix; ripple coordinates follow that submission, not double navigation.
    expect(f.parent.parent).toBeNull();
    expect(f.parent.getWorldMatrix().m).toBeInstanceOf(Float32Array);
    expect({ x: f.parent.position.x, z: f.parent.position.z }).toEqual(position);
    expect(ripple).toEqual({
      x: Math.fround(position.x),
      z: Math.fround(position.z),
      radius: 1.5,
      strength,
    });
    expect(world.grid.walkable(position)).toBe(true);
    expect(state).toEqual(input);
    return snapshot();
  };
  const snapshot = () => ({
    row: rowSnapshot(f),
    navigation: local(f.parent),
    position: world.getPosition(),
    time: world.time,
    state: structuredClone(state),
  });
  render(0);
  return {
    ...f,
    world,
    camera,
    water,
    documentState,
    draw,
    render,
    send,
    check,
    snapshot,
    packet,
    dispose() {
      binding.dispose();
      camera.dispose();
      releaseStudio(f);
      vi.unstubAllGlobals();
    },
  };
}

function wakeReference<T>(run: (f: ReturnType<typeof wakeStudio>) => T): T {
  const f = wakeStudio();
  try {
    return run(f);
  } finally {
    f.dispose();
  }
}

it.each(['q', 'r'] as const)(
  'keeps rest wake and actual Row0 for admitted camera-only %s',
  (key) => {
    const expected = wakeReference((f) => {
        f.render();
        return f.snapshot();
      }),
      f = wakeStudio();
    try {
      const position = f.world.getPosition(),
        heading = f.parent.rotation.y,
        alpha = f.camera.alpha;
      expect(f.send(key).defaultPrevented).toBe(true);
      expect(f.world.keys.has(key)).toBe(true);
      f.render();
      expect(f.camera.alpha).not.toBe(alpha);
      expect(f.world.getPosition()).toEqual(position);
      expect(f.parent.rotation.y).toBe(heading);
      expect(f.check(0.4)).toEqual(expected);
      expect(f.world.time).toBe(0.05);
      expect(f.draw).toHaveBeenCalledTimes(2);
    } finally {
      f.dispose();
    }
  },
);

it('keeps rest wake when admitted forward input reaches the real water boundary', () => {
  const expected = wakeReference((f) => {
      f.send('w');
      for (let i = 0; i < 32; i++) {
        const before = f.world.getPosition();
        f.render();
        if (distance(before, f.world.getPosition()) === 0) break;
      }
      return Array.from({ length: 3 }, () => {
        f.render();
        return f.snapshot();
      });
    }),
    f = wakeStudio();
  try {
    const start = f.world.getPosition();
    expect(f.send('w').defaultPrevented).toBe(true);
    let blocked = false,
      positive = 0;
    for (let i = 0; i < 32; i++) {
      const before = f.world.getPosition();
      f.render();
      const moved = distance(before, f.world.getPosition());
      if (moved > 0) {
        positive++;
        f.check(0.9);
      } else {
        blocked = true;
        break;
      }
    }
    expect(positive).toBeGreaterThan(0);
    expect(blocked).toBe(true);
    expect(distance(start, f.world.getPosition())).toBeGreaterThan(1);
    const boundary = f.world.getPosition(),
      heading = f.parent.rotation.y;
    for (let i = 0; i < 3; i++) {
      f.render();
      expect(f.world.keys.has('w')).toBe(true);
      expect(f.world.getPosition()).toEqual(boundary);
      expect(f.parent.rotation.y).toBe(heading);
      expect(f.actor.playback).toEqual({ clip: 'Row', frame: 0, action: '' });
      expect(f.check(0.4)).toEqual(expected[i]);
    }
  } finally {
    f.dispose();
  }
});

it('matches actual manual rowing and settles wake on release, stop and ordinary pause', () => {
  const expected = wakeReference((f) => {
      f.send('w');
      f.render();
      f.render();
      const moving = f.snapshot();
      f.send('w', 'keyup');
      f.render(0);
      const zero = f.snapshot();
      f.render();
      const rest = f.snapshot();
      f.send('w');
      f.render();
      const restart = f.snapshot();
      f.world.stop();
      f.render(0);
      const stopped = f.snapshot();
      f.send('w');
      f.render();
      const second = f.snapshot();
      f.world.setPaused(true);
      f.world.refreshFrame(false);
      f.render();
      return { moving, zero, rest, restart, stopped, second, paused: f.snapshot() };
    }),
    f = wakeStudio();
  try {
    const start = f.world.getPosition();
    expect(f.send('w').defaultPrevented).toBe(true);
    f.render();
    f.check(0.9);
    f.render();
    expect(distance(start, f.world.getPosition())).toBeGreaterThan(0.3);
    expect(f.actor.playback.frame).toBeGreaterThan(0);
    expect(f.check(0.9)).toEqual(expected.moving);
    const at = f.world.getPosition(),
      time = f.world.time;
    f.send('w', 'keyup');
    f.render(0);
    expect(f.world.getPosition()).toEqual(at);
    expect(f.world.time).toBe(time);
    expect(f.check(0.9)).toEqual(expected.zero);
    f.render();
    expect(f.world.getPosition()).toEqual(at);
    expect(f.actor.playback).toEqual({ clip: 'Row', frame: 0, action: '' });
    expect(f.check(0.4)).toEqual(expected.rest);
    f.send('w');
    f.render();
    expect(f.check(0.9)).toEqual(expected.restart);
    f.world.stop();
    f.render(0);
    expect(f.world.keys.size).toBe(0);
    expect(f.world.path).toEqual([]);
    expect(f.check(0.4)).toEqual(expected.stopped);
    f.send('w');
    f.render();
    expect(f.check(0.9)).toEqual(expected.second);
    const pausedAt = f.world.getPosition(),
      pausedTime = f.world.time;
    f.world.setPaused(true);
    f.world.refreshFrame(false);
    f.render();
    expect(f.world.getPosition()).toEqual(pausedAt);
    expect(f.world.time).toBe(pausedTime);
    expect(f.world.keys.size).toBe(0);
    expect(f.actor.playback).toEqual({ clip: 'Row', frame: 0, action: '' });
    expect(f.check(0.4)).toEqual(expected.paused);
  } finally {
    f.dispose();
  }
});

it('uses actual route steps through final arrival and retains the last decision on a zero-dt draw', () => {
  const expected = wakeReference((f) => {
      const start = f.world.getPosition();
      expect(f.world.walkTo({ x: start.x, z: start.z + 1 })).toBe(true);
      f.render(0);
      const queued = f.snapshot();
      const steps: ReturnType<typeof f.snapshot>[] = [];
      for (let i = 0; i < 80; i++) {
        f.render();
        steps.push(f.snapshot());
        if (!f.world.path.length) break;
      }
      f.render(0);
      const zero = f.snapshot();
      f.render();
      return { queued, steps, zero, rest: f.snapshot() };
    }),
    f = wakeStudio();
  try {
    const start = f.world.getPosition(),
      target = { x: start.x, z: start.z + 1 };
    expect(f.world.walkTo(target)).toBe(true);
    expect(f.world.path.length).toBeGreaterThan(0);
    f.render(0);
    expect(f.world.getPosition()).toEqual(start);
    expect(f.check(0.4)).toEqual(expected.queued);
    let arrived = false,
      positive = 0;
    for (let i = 0; i < 80; i++) {
      const before = f.world.getPosition();
      f.render();
      const current = f.world.getPosition();
      expect(distance(before, current)).toBeGreaterThan(0);
      positive++;
      expect(f.check(0.9)).toEqual(expected.steps[i]);
      expect(f.actor.playback.frame).toBeGreaterThan(0);
      if (!f.world.path.length) {
        arrived = true;
        break;
      }
    }
    expect(positive).toBeGreaterThan(1);
    expect(arrived).toBe(true);
    expect(f.world.getPosition()).toEqual(target);
    expect(f.world.marker.setEnabled).toHaveBeenLastCalledWith(false);
    const time = f.world.time;
    f.render(0);
    expect(f.check(0.9)).toEqual(expected.zero);
    expect(f.world.time).toBe(time);
    f.render();
    expect(f.world.getPosition()).toEqual(target);
    expect(f.actor.playback).toEqual({ clip: 'Row', frame: 0, action: '' });
    expect(f.check(0.4)).toEqual(expected.rest);
  } finally {
    f.dispose();
  }
});

it('retains quality forwarding and reduced positive navigation with genuine static Row0', () => {
  const expected = wakeReference((f) => {
      f.world.applySettings(DEFAULT_SETTINGS);
      f.send('w');
      f.render();
      const normal = f.snapshot();
      f.world.applySettings({ ...DEFAULT_SETTINGS, quality: 'low', reducedMotion: true });
      f.render(0);
      const zero = f.snapshot(),
        reduced = Array.from({ length: 3 }, () => {
          f.render();
          return f.snapshot();
        });
      f.world.applySettings(DEFAULT_SETTINGS);
      f.render();
      const resumed = f.snapshot();
      f.world.setPaused(true);
      f.world.refreshFrame(false);
      f.render(0);
      return { normal, zero, reduced, resumed, paused: f.snapshot() };
    }),
    f = wakeStudio();
  try {
    f.world.applySettings(DEFAULT_SETTINGS);
    expect(f.water.quality).toHaveBeenLastCalledWith(false);
    const start = f.world.getPosition();
    f.send('w');
    f.render();
    expect(f.check(0.9)).toEqual(expected.normal);
    f.world.applySettings({ ...DEFAULT_SETTINGS, quality: 'low', reducedMotion: true });
    expect(f.water.quality).toHaveBeenLastCalledWith(true);
    f.render(0);
    expect(f.check(0.4)).toEqual(expected.zero);
    const reducedAt = f.world.getPosition();
    for (let i = 0; i < 3; i++) {
      f.render();
      expect(f.check(0.9)).toEqual(expected.reduced[i]);
      expect(f.actor.playback.frame).toBe(0);
    }
    expect(distance(reducedAt, f.world.getPosition())).toBeGreaterThan(0.4);
    expect(distance(start, f.world.getPosition())).toBeGreaterThan(0.5);
    f.world.applySettings(DEFAULT_SETTINGS);
    expect(f.water.quality).toHaveBeenLastCalledWith(false);
    f.render();
    expect(f.check(0.9)).toEqual(expected.resumed);
    f.world.setPaused(true);
    f.world.refreshFrame(false);
    f.render(0);
    expect(f.check(0.4)).toEqual(expected.paused);
  } finally {
    f.dispose();
  }
});
