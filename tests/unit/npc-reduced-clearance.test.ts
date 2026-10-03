import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { NeighborhoodActivity } from '../../src/scene/actors/neighborhood';
import { RoadActivity } from '../../src/scene/actors/road';
import { World } from '../../src/scene/world';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';
import { PausedCadence } from '../../src/scene/presentation/cadence';
import { DEFAULT_SETTINGS, type GameState } from '../../src/game/types';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { campaignLayout, groundHeight, layoutObstacles } from '../../src/content/campaign/layouts';
import { companyMeeting } from '../../src/content/road/routes';
import { transition } from '../../src/game/quest';
import { action, district, gateway } from '../helpers/campaign';
import { roadAction, roadStart } from '../helpers/road';
import { npcFeet, npcGeometryError, npcLift, npcSkin, type NpcSkin } from '../helpers/npc-geometry';

// Every test and hook uses the repository default deadline; no ignored evidence is an input.
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
    ['amos', 'traveler', 'jug', 'villager', 'bread_basket', 'gate', 'handcart'],
    () => {},
  );
});
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});
type Height = (x: number, z: number) => number;
const flat: Height = () => 0;
const slope: Height = (x, z) => 0.08 * x + 0.1 * z;
function pair(height: Height) {
  const raw = new Actor(library.instantiate('amos', 'reduced-raw-' + serial++), true),
    actor = new Actor(library.instantiate('amos', 'reduced-supported-' + serial++), true, {
      locomotionClearance: { ground: height },
    });
  for (const a of [raw, actor]) {
    a.root.position.set(4, height(4, 1), 1);
    a.root.rotation.y = 0.7;
    a.attach(library.instantiate('jug', 'reduced-socket-control-' + serial++));
  }
  return {
    raw,
    actor,
    dispose: () => {
      raw.dispose();
      actor.dispose();
    },
  };
}
function minimum(skin: NpcSkin, height: Height) {
  const feet = npcFeet(skin, height);
  expect([feet.left.count, feet.right.count]).toEqual([16, 16]);
  return Math.min(feet.left.minimum, feet.right.minimum);
}
function sameRig(raw: Actor, actor: Actor, height: Height) {
  expect(actor.snapshotPose()).toEqual(raw.snapshotPose());
  expect(actor.root.position.asArray()).toEqual(raw.root.position.asArray());
  expect(actor.root.rotation.asArray()).toEqual(raw.root.rotation.asArray());
  const before = npcSkin(raw),
    after = npcSkin(actor),
    lift = npcLift(actor),
    error = npcGeometryError(before, after, lift);
  expect(error.local).toBe(0);
  // All body, head and diagnostic attached-jug vertices must move by the same scalar.
  expect(error.skin).toBeLessThan(0.000003);
  expect(lift).toBeCloseTo(Math.max(0, -minimum(before, height)), 6);
  expect(minimum(after, height)).toBeGreaterThanOrEqual(-0.000002);
  return { before, after, lift };
}
function terrain(region: string) {
  const mesh = CreateGround(
    'reduced-floor-' + serial++,
    { width: 100, height: 100, subdivisions: 100 },
    scene,
  );
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < positions.length; i += 3)
    positions[i + 1] = groundHeight(region, { x: positions[i]!, z: positions[i + 2]! });
  mesh.setVerticesData(VertexBuffer.PositionKind, positions);
  mesh.refreshBoundingInfo();
  mesh.updateCoordinateHeights();
  return { mesh, height: (x: number, z: number) => mesh.getHeightAtCoordinates(x, z) };
}
function grid(state: GameState) {
  const layout = campaignLayout(state.region)!;
  return new WalkGrid(layoutObstacles(state), layout.terrain, layout.bounds.min, layout.bounds.max);
}
function controller(activity: object) {
  const value = activity as Record<string, unknown>;
  return Object.fromEntries(
    ['state', 'path', 'requested', 'time', 'still', 'low']
      .filter((key) => key in value)
      .map((key) => [key, value[key] === undefined ? undefined : structuredClone(value[key])]),
  );
}
function earnedRoad() {
  let state = roadAction(gateway(roadStart(), 'to-farm'), 'company-accept');
  state = transition(state, { type: 'road-route', id: 'terrace' });
  state = roadAction(state, 'company-start');
  while (state.road.company.step < 4) {
    const meeting = companyMeeting(state.road.company)!,
      step = state.road.company.step;
    state.position = { x: meeting.x, z: meeting.z };
    state.road.company.position = { ...state.position };
    state = meeting.exit
      ? gateway(state, meeting.exit)
      : transition(state, { type: 'road-step', step });
    expect(state.road.company.step).toBe(step + 1);
  }
  expect(state.region).toBe('galilean-road');
  return state;
}

it.each([
  ['flat', flat],
  ['slope', slope],
] as const)(
  'grounds the whole legacy Amos frozen Walk0 and stopped Idle rig on %s terrain',
  (_name, height) => {
    const p = pair(height);
    try {
      for (const a of [p.raw, p.actor]) {
        a.setLocomotionReducedMotion(true);
        a.sample('Walk', 0.1, true);
      }
      expect(p.actor.playback).toMatchObject({ clip: 'Walk', frame: 0 });
      const walk = sameRig(p.raw, p.actor, height);
      expect(walk.lift).toBeGreaterThan(0.06);
      const pose = p.actor.snapshotPose(),
        root = p.actor.root.position.asArray();
      for (let i = 0; i < 6; i++) {
        for (const a of [p.raw, p.actor]) {
          a.setLocomotionReducedMotion(true);
          a.sample('Walk', 0.05, true);
        }
        expect(p.actor.snapshotPose()).toEqual(pose);
        expect(p.actor.root.position.asArray()).toEqual(root);
        expect(sameRig(p.raw, p.actor, height).after.coordinates).toEqual(walk.after.coordinates);
      }
      for (const a of [p.raw, p.actor]) a.sample('Idle', 0.1, true);
      const idle = sameRig(p.raw, p.actor, height),
        stopped = p.actor.snapshotPose();
      expect(p.actor.playback).toMatchObject({ clip: 'Idle', frame: 0 });
      for (let i = 0; i < 6; i++) {
        for (const a of [p.raw, p.actor]) a.sample('Idle', 0.05, true);
        expect(p.actor.snapshotPose()).toEqual(stopped);
        expect(sameRig(p.raw, p.actor, height).after.coordinates).toEqual(idle.after.coordinates);
      }
    } finally {
      p.dispose();
    }
  },
);

it('keeps actual earned reduced Amos navigation/controller/reducer state while grounding moving and stopped rigs', () => {
  const state = action(action(action(district(), 'walk-accept'), 'walk-outer'), 'walk-start'),
    saved = structuredClone(state),
    ground = terrain(state.region),
    p = pair(ground.height),
    navigation = grid(state),
    activities = [p.raw, p.actor].map(
      (actor, i) =>
        new NeighborhoodActivity(
          library,
          new Map([['amos', actor]]),
          () => navigation,
          () => {},
          state.region,
          i ? ground.height : undefined,
        ),
    );
  try {
    activities.forEach((c) => {
      c.update(state);
      c.settings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    });
    const before = p.actor.root.position.clone();
    activities.forEach((c) => c.tick(1 / 30, before));
    expect(distance(before, p.actor.root.position)).toBeGreaterThan(0);
    expect(p.actor.playback).toMatchObject({ clip: 'Walk', frame: 0 });
    expect(sameRig(p.raw, p.actor, ground.height).lift).toBeGreaterThan(0.06);
    expect(controller(activities[1]!)).toEqual(controller(activities[0]!));
    // An out-of-range player genuinely stops the earned controller; no fabricated actor Idle command.
    const away = { x: before.x + 12, z: before.z };
    activities.forEach((c) => c.tick(1 / 30, away));
    expect(p.actor.playback).toMatchObject({ clip: 'Idle', frame: 0 });
    const stopped = sameRig(p.raw, p.actor, ground.height),
      pose = p.actor.snapshotPose(),
      root = p.actor.root.position.asArray();
    for (let i = 0; i < 6; i++) {
      activities.forEach((c) => c.tick(1 / 30, away));
      expect(p.actor.root.position.asArray()).toEqual(root);
      expect(p.actor.snapshotPose()).toEqual(pose);
      expect(sameRig(p.raw, p.actor, ground.height).after.coordinates).toEqual(
        stopped.after.coordinates,
      );
      expect(controller(activities[1]!)).toEqual(controller(activities[0]!));
    }
    expect(state).toEqual(saved);
  } finally {
    // Neighborhood owns its crowd but deliberately does not dispose region-owned actors.
    activities.forEach((c) => {
      const crowds = (c as unknown as { crowd: { actor: Actor }[] }).crowd;
      crowds.forEach(({ actor }) => actor.dispose());
      c.dispose();
    });
    p.dispose();
    ground.mesh.dispose();
  }
});

it('recomposes the existing mid-blend Walk during paused mode toggles without resampling it', () => {
  const p = pair(flat);
  try {
    for (const a of [p.raw, p.actor]) {
      a.sample('Idle', 0.2);
      a.sample('Walk', 0.035);
    }
    // This deliberately retains a genuine in-progress exploration blend; no restorePose round trip.
    const before = sameRig(p.raw, p.actor, flat),
      pose = p.actor.snapshotPose();
    for (const value of [true, true, false, false]) {
      for (const a of [p.raw, p.actor]) a.setLocomotionReducedMotion(value);
      expect(p.actor.snapshotPose()).toEqual(pose);
      expect(sameRig(p.raw, p.actor, flat).after.coordinates).toEqual(before.after.coordinates);
    }
  } finally {
    p.dispose();
  }
});

it('grounds actual World reduced Walk0 and preserves paused/first-fresh-normal state and clocks', () => {
  let now = 100;
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('document', { hidden: false });
  const state = earnedRoad(),
    saved = structuredClone(state),
    ground = terrain(state.region),
    navigation = grid(state),
    road = new RoadActivity(
      library,
      'galilean-road',
      () => navigation,
      () => {},
      ground.height,
    ),
    actor = road.conversationActor,
    raw = new Actor(library.instantiate('amos', 'reduced-world-raw-' + serial++), true),
    camera = new ArcRotateCamera(
      'reduced-world-camera-' + serial++,
      -Math.PI / 2,
      0.65,
      18,
      Vector3.Zero(),
      scene,
    ),
    player = new TransformNode('reduced-world-player-' + serial++, scene),
    marker = new TransformNode('reduced-world-marker-' + serial++, scene);
  road.update(state);
  actor.attach(library.instantiate('jug', 'reduced-world-socket-' + serial++));
  raw.attach(library.instantiate('jug', 'reduced-world-raw-socket-' + serial++));
  player.position.copyFrom(actor.root.position);
  const world = Object.assign(Object.create(World.prototype), {
    canvas: { dataset: {}, clientWidth: 1440, clientHeight: 900 },
    camera,
    cameraAspectScale: 1,
    layout: campaignLayout(state.region),
    active: true,
    paused: false,
    reducedMotion: false,
    lastRender: 0,
    lastFrame: Infinity,
    cadence: new PausedCadence(),
    time: 17,
    pendingRotation: 0,
    keys: new Set(),
    boats: [],
    people: new Map(),
    cutaways: [],
    occluders: [],
    destinations: [],
    player,
    position: { ...state.position },
    path: [],
    routeDots: [],
    marker,
    actors: new Map(),
    dataCache: new Map(),
    state,
    road,
    engine,
    scene,
    stage: { applySettings: () => {}, setView: () => {}, tick: () => {} },
    actorPlayer: { playback: { clip: 'Idle', frame: 0, action: 'Idle' }, performing: false },
  });
  const fullSkin = () => {
    const skin = npcSkin(actor);
    expect(minimum(skin, ground.height)).toBeGreaterThanOrEqual(-0.000002);
    expect(state).toEqual(saved);
    return skin;
  };
  try {
    world.renderFrame();
    world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    now += 1000 / 30;
    world.renderFrame();
    expect(actor.playback).toMatchObject({ clip: 'Walk', frame: 0 });
    // Frozen Walk0 is exact, so an unopted authored snapshot is a valid independent raw oracle.
    raw.root.position.copyFrom(actor.root.position);
    raw.root.rotation.copyFrom(actor.root.rotation);
    raw.restorePose(actor.snapshotPose());
    expect(sameRig(raw, actor, ground.height).lift).toBeGreaterThan(0.08);
    world.setPaused(true);
    world.refreshFrame();
    world.renderFrame();
    const frozen = fullSkin(),
      pose = actor.snapshotPose(),
      root = actor.root.position.asArray(),
      rotation = actor.root.rotation.asArray(),
      time = world.time,
      roadControl = controller(road),
      lift = npcLift(actor);
    for (const reducedMotion of [true, true, false, false]) {
      world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion });
      world.refreshFrame();
      world.renderFrame();
      expect(fullSkin().coordinates).toEqual(frozen.coordinates);
      expect(npcLift(actor)).toBe(lift);
      expect(actor.snapshotPose()).toEqual(pose);
      expect(actor.root.position.asArray()).toEqual(root);
      expect(actor.root.rotation.asArray()).toEqual(rotation);
      expect(world.time).toBe(time);
      expect({ ...controller(road), still: roadControl.still }).toEqual(roadControl);
    }
    world.refreshFrame();
    world.setPaused(false);
    const priorRender = scene.getRenderId();
    world.renderFrame();
    expect(scene.getRenderId()).toBeGreaterThan(priorRender);
    expect(fullSkin().coordinates).toEqual(frozen.coordinates);
    expect(actor.snapshotPose()).toEqual(pose);
    expect(world.time).toBe(time);
    for (let i = 0; i < 6; i++) {
      now += 1000 / 30;
      world.renderFrame();
      expect(actor.playback.clip).toBe('Walk');
      expect(actor.playback.frame).toBeGreaterThan(0);
      fullSkin();
      expect(world.time).toBeCloseTo(time + (i + 1) / 30, 10);
    }
    // The production World passes this genuine transient person destination to Road.tick.
    // Approaching Neri stops his navigation and selects reduced Idle, rather than Walk.
    world.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    world.destination = 'neri';
    now += 1000 / 30;
    world.renderFrame();
    expect(actor.playback).toMatchObject({ clip: 'Idle', frame: 0 });
    const stopped = fullSkin(),
      stoppedPose = actor.snapshotPose(),
      stoppedRoot = actor.root.position.asArray(),
      stoppedTime = world.time;
    for (let i = 0; i < 6; i++) {
      now += 1000 / 30;
      world.renderFrame();
      expect(actor.snapshotPose()).toEqual(stoppedPose);
      expect(actor.root.position.asArray()).toEqual(stoppedRoot);
      expect(fullSkin().coordinates).toEqual(stopped.coordinates);
      expect(world.time).toBeCloseTo(stoppedTime + (i + 1) / 30, 10);
    }
  } finally {
    actor.dispose();
    raw.dispose();
    camera.dispose();
    player.dispose();
    marker.dispose();
    ground.mesh.dispose();
    vi.unstubAllGlobals();
  }
});

it('restores a genuine reduced ordinary dialogue source across settings without extending bookmark eligibility', () => {
  vi.stubGlobal('document', { hidden: false });
  const p = pair(flat),
    listener = new Actor(library.instantiate('amos', 'reduced-listener-' + serial++), true),
    camera = new ArcRotateCamera(
      'reduced-dialogue-camera-' + serial++,
      -0.8,
      1,
      12,
      Vector3.Zero(),
      scene,
    ),
    canvas = { clientWidth: 1280, clientHeight: 720, dataset: {} } as HTMLCanvasElement,
    view = new ConversationPresentation(camera, canvas);
  listener.root.position.x = 2;
  try {
    for (const a of [p.raw, p.actor]) {
      a.setLocomotionReducedMotion(true);
      a.sample('Walk', 0, true);
    }
    const before = sameRig(p.raw, p.actor, flat),
      pose = p.actor.snapshotPose(),
      root = p.actor.root.position.asArray(),
      heading = p.actor.root.rotation.y;
    view.select('neri', p.actor, listener);
    view.tick(0.1, true);
    expect(npcLift(p.actor)).toBe(0);
    p.actor.setLocomotionReducedMotion(false);
    p.actor.setLocomotionReducedMotion(true);
    expect(npcLift(p.actor)).toBe(0);
    view.setPaused(true);
    view.tick(0.1, true);
    view.clear();
    expect(p.actor.snapshotPose()).toEqual(pose);
    expect(p.actor.root.position.asArray()).toEqual(root);
    expect(p.actor.root.rotation.y).toBe(heading);
    expect(sameRig(p.raw, p.actor, flat).after.coordinates).toEqual(before.after.coordinates);
    // A source reset while suppressed intentionally prevents the old bookmark from reviving it.
    const scope = p.actor.bookmarkLocomotionPresentation();
    expect(scope).toBeDefined();
    p.actor.suppressLocomotionPresentation(true);
    p.actor.sampleAt('Walk', 0);
    p.actor.restorePose(pose, scope);
    p.actor.suppressLocomotionPresentation(false);
    scope?.restore();
    expect(npcLift(p.actor)).toBe(0);
  } finally {
    view.dispose();
    p.dispose();
    listener.dispose();
    camera.dispose();
    vi.unstubAllGlobals();
  }
});

it.each([
  'normal-still',
  'clip-only',
  'exact',
  'finite',
  'disabled',
  'suppressed',
  'default',
] as const)('does not revive %s source through reduced settings or a refresh', (excluded) => {
  const actor = new Actor(
    library.instantiate('amos', 'reduced-excluded-' + serial++),
    true,
    excluded === 'default' ? {} : { locomotionClearance: { ground: flat } },
  );
  try {
    // Prime authored Walk before ordinary sampling, avoiding an unprimed blend snapshot fixture.
    actor.sampleAt('Walk', 0);
    actor.sample('Walk', 0);
    if (excluded === 'normal-still') actor.sample('Walk', 0, true);
    else if (excluded === 'clip-only') actor.setClip('Walk');
    else if (excluded === 'exact') actor.sampleAt('Walk', 0);
    else if (excluded === 'finite') actor.sampleActionAt('Use', 0.2);
    else if (excluded === 'disabled') actor.root.setEnabled(false);
    else if (excluded === 'suppressed') actor.suppressLocomotionPresentation(true);
    const pose = actor.snapshotPose(),
      root = actor.root.position.asArray();
    for (const value of [true, true, false, false]) {
      actor.setLocomotionReducedMotion(value);
      actor.refreshLocomotionPresentation();
      expect(npcLift(actor)).toBe(0);
      expect(actor.snapshotPose()).toEqual(pose);
      expect(actor.root.position.asArray()).toEqual(root);
    }
    if (excluded === 'disabled') {
      actor.root.setEnabled(true);
      actor.refreshLocomotionPresentation();
      expect(npcLift(actor)).toBe(0);
    }
    if (excluded === 'exact') {
      actor.setLocomotionReducedMotion(true);
      actor.sample('Walk', 0, true);
      expect(npcLift(actor)).toBeGreaterThan(0.06);
      actor.sampleAt('Walk', 0);
      actor.setLocomotionReducedMotion(false);
      expect(npcLift(actor)).toBe(0);
    }
  } finally {
    actor.dispose();
  }
});

it('keeps existing production reduced traveler grounding and stopped support without an NPC visual lift', () => {
  const model = library.instantiate('traveler', 'reduced-traveler-' + serial++),
    actor = new Actor(model, true, { stationaryFeet: true }),
    nav = new TransformNode('reduced-traveler-navigation-' + serial++, scene),
    state = district(),
    saved = structuredClone(state);
  model.root.parent = nav;
  const world = Object.assign(Object.create(World.prototype), {
    playerModel: model.root,
    actorPlayer: actor,
    player: nav,
    state,
    reducedMotion: true,
    paused: false,
    strideTime: 0,
    time: 17,
    stage: { atmosphere: { footstep: () => {} } },
  }) as { poseTraveler(moving: boolean, dt: number, speed?: number): void; time: number };
  try {
    // Invoke the real World grounding/support path; this is a focused unit, not a full world fixture.
    world.poseTraveler(true, 0.1, 3.25);
    expect(actor.playback).toMatchObject({ clip: 'Walk', frame: 0 });
    expect(model.root.position.y).toBeGreaterThan(0.06);
    expect(npcLift(actor)).toBe(0);
    const feet = npcFeet(npcSkin(actor), flat);
    for (const side of ['left', 'right'] as const) {
      expect(feet[side].count).toBe(16);
      expect(feet[side].minimum).toBeGreaterThanOrEqual(-0.000002);
      expect(feet[side].soleMin).toBeGreaterThanOrEqual(-0.000002);
      expect(feet[side].soleMin).toBeLessThanOrEqual(0.000002);
    }
    world.poseTraveler(false, 0);
    const stopped = npcSkin(actor),
      pose = actor.snapshotPose(),
      root = nav.position.asArray(),
      lift = model.root.position.y;
    expect(actor.playback).toMatchObject({ clip: 'Idle', frame: 0 });
    for (let i = 0; i < 6; i++) {
      world.poseTraveler(false, 0.05);
      expect(actor.snapshotPose()).toEqual(pose);
      expect(npcSkin(actor).coordinates).toEqual(stopped.coordinates);
      expect(model.root.position.y).toBe(lift);
      expect(npcLift(actor)).toBe(0);
      expect(nav.position.asArray()).toEqual(root);
      expect(world.time).toBe(17);
      expect(state).toEqual(saved);
      expect(minimum(npcSkin(actor), flat)).toBeGreaterThanOrEqual(-0.000002);
    }
  } finally {
    actor.dispose();
    nav.dispose();
  }
});
