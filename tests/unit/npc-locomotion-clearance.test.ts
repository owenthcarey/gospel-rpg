import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { NeighborhoodActivity } from '../../src/scene/actors/neighborhood';
import { EverydayActivity } from '../../src/scene/actors/everyday';
import { RoadActivity } from '../../src/scene/actors/road';
import { World } from '../../src/scene/world';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';
import { DEFAULT_SETTINGS, type GameState } from '../../src/game/types';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { campaignLayout, groundHeight, layoutObstacles } from '../../src/content/campaign/layouts';
import { WALK_ROUTES } from '../../src/content/campaign/places';
import { companyMeeting } from '../../src/content/road/routes';
import type { RoadRegion } from '../../src/game/road/types';
import type { ActorClip } from '../../src/content/assets';
import { transition } from '../../src/game/quest';
import { action, district, gateway } from '../helpers/campaign';
import { roadAction, roadStart } from '../helpers/road';
import {
  npcFeet,
  npcGeometryError,
  npcGrip,
  npcLift,
  npcSkin,
  npcWorldStep,
  type NpcSkin,
} from '../helpers/npc-geometry';

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
const measurements: Record<string, unknown>[] = [];
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(
    ['amos', 'villager', 'traveler', 'bread_basket', 'jug', 'gate', 'handcart'],
    () => {},
  );
}, 60_000);
afterAll(() => {
  if (process.env.NPC_CLEARANCE_REPORT)
    writeFileSync(process.env.NPC_CLEARANCE_REPORT, JSON.stringify(measurements, null, 2));
  library.dispose();
  scene.dispose();
  engine.dispose();
});
type Height = (x: number, z: number) => number;
function floor(region: string) {
  const mesh = CreateGround(
    'npc-floor-' + serial++,
    { width: 100, height: 100, subdivisions: 100 },
    scene,
  );
  const p = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < p.length; i += 3) p[i + 1] = groundHeight(region, { x: p[i]!, z: p[i + 2]! });
  mesh.setVerticesData(VertexBuffer.PositionKind, p);
  mesh.refreshBoundingInfo();
  mesh.updateCoordinateHeights();
  return { mesh, height: (x: number, z: number) => mesh.getHeightAtCoordinates(x, z) };
}
function grid(state: GameState) {
  const layout = campaignLayout(state.region)!;
  return new WalkGrid(layoutObstacles(state), layout.terrain, layout.bounds.min, layout.bounds.max);
}
function stateEqual(a: unknown, b: unknown) {
  assert.equal(JSON.stringify(a), JSON.stringify(b));
}
function controllerEqual(a: unknown, b: unknown) {
  const first = a as Record<string, unknown>,
    second = b as Record<string, unknown>;
  for (const key of ['state', 'path', 'requested', 'time', 'still', 'low'])
    if (key in first) stateEqual(first[key], second[key]);
}
interface Pair {
  baseline: Actor;
  actor: Actor;
}
function pair(asset: 'amos' | 'villager', height: Height): Pair {
  return {
    baseline: new Actor(library.instantiate(asset, 'raw-' + serial++), true),
    actor: new Actor(library.instantiate(asset, 'supported-' + serial++), true, {
      locomotionClearance: { ground: height },
    }),
  };
}
function attach(p: Pair) {
  p.baseline.attach(library.instantiate('jug', 'raw-prop-' + serial++));
  p.actor.attach(library.instantiate('jug', 'supported-prop-' + serial++));
}
interface Observation {
  raw: NpcSkin;
  displayed: NpcSkin;
  clip: ActorClip;
  frame: number;
  position: number[];
  lift: number;
}
function stats() {
  return {
    samples: 0,
    eligible: 0,
    minimum: Infinity,
    rawMinimum: Infinity,
    excludedMinimum: Infinity,
    soleEnvelope: 0,
    otherSoleMinimum: 0,
    maxLift: 0,
    maxLiftStep: 0,
    skinError: 0,
    gripError: 0,
    rawWorldStep: 0,
    displayedWorldStep: 0,
    clips: new Set<ActorClip>(),
    buffers: [] as Observation[],
    previous: undefined as Observation | undefined,
    restart: undefined as Record<string, number> | undefined,
    idleBoundary: undefined as Record<string, number> | undefined,
  };
}
type Stats = ReturnType<typeof stats>;
/** Complete independent Babylon skinning, protected locals, held geometry, and roots at every observation. */
function capture(
  p: Pair,
  height: Height,
  s: Stats,
  eligible = ['Idle', 'Walk'].includes(p.actor.playback.clip) &&
    !p.actor.performing &&
    p.actor.root.isEnabled(),
) {
  assert.deepEqual(p.actor.root.position.asArray(), p.baseline.root.position.asArray());
  assert.deepEqual(p.actor.root.rotation.asArray(), p.baseline.root.rotation.asArray());
  assert.deepEqual(
    p.actor.root.computeWorldMatrix(true).asArray(),
    p.baseline.root.computeWorldMatrix(true).asArray(),
  );
  assert.deepEqual(p.actor.snapshotPose(), p.baseline.snapshotPose());
  const slot = s.samples % 2,
    reused = s.buffers[slot];
  const raw = npcSkin(p.baseline, reused?.raw),
    displayed = npcSkin(p.actor, reused?.displayed),
    lift = npcLift(p.actor);
  if (!s.samples) assert.deepEqual(displayed.topology.joints, raw.topology.joints);
  const error = npcGeometryError(raw, displayed, lift);
  assert.equal(error.local, 0);
  assert.ok(error.skin < 0.000003, 'full skin uniform translation');
  s.skinError = Math.max(s.skinError, error.skin);
  if (raw.topology.prop.length) {
    const a = npcGrip(raw),
      b = npcGrip(displayed),
      grip = Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));
    assert.ok(grip < 0.000003, 'both actual hand-to-held-prop distances');
    s.gripError = Math.max(s.gripError, grip);
  }
  const a = npcFeet(raw, height),
    b = npcFeet(displayed, height);
  assert.equal(a.left.count, 16);
  assert.equal(a.right.count, 16);
  assert.equal(b.left.count, 16);
  assert.equal(b.right.count, 16);
  const minimum = Math.min(b.left.minimum, b.right.minimum),
    rawMinimum = Math.min(a.left.minimum, a.right.minimum);
  const observation = {
    raw,
    displayed,
    lift,
    clip: p.actor.playback.clip,
    frame: p.actor.playback.frame,
    position: p.actor.root.position.asArray(),
  };
  if (s.previous) {
    const previous = s.previous,
      rawStep = npcWorldStep(previous.raw, raw),
      displayedStep = npcWorldStep(previous.displayed, displayed);
    s.rawWorldStep = Math.max(s.rawWorldStep, rawStep);
    s.displayedWorldStep = Math.max(s.displayedWorldStep, displayedStep);
    s.maxLiftStep = Math.max(s.maxLiftStep, Math.abs(previous.lift - lift));
    const trajectory = () => ({
      rawWorldStep: rawStep,
      displayedWorldStep: displayedStep,
      rawHeadY: raw.head[1]! - previous.raw.head[1]!,
      displayedHeadY: displayed.head[1]! - previous.displayed.head[1]!,
      rawBodyY: raw.bodyRoot[1]! - previous.raw.bodyRoot[1]!,
      displayedBodyY: displayed.bodyRoot[1]! - previous.displayed.bodyRoot[1]!,
      beforeLift: previous.lift,
      afterLift: lift,
    });
    if (
      previous.clip === 'Idle' &&
      observation.clip === 'Walk' &&
      Math.abs(observation.position[0]! - 4) < 1e-7 &&
      Math.abs(observation.position[2]! - 1.055) < 1e-7
    )
      s.restart = trajectory();
    if (
      previous.clip === 'Idle' &&
      observation.clip === 'Idle' &&
      previous.frame === 8 &&
      observation.frame === 10 &&
      Math.abs(observation.position[0]! - 3.9244426355853297) < 1e-7 &&
      Math.abs(observation.position[2]! - 0.9244426355853298) < 1e-7
    )
      s.idleBoundary = trajectory();
  }
  s.buffers[slot] = observation;
  s.previous = observation;
  s.samples++;
  s.clips.add(observation.clip);
  if (eligible) {
    assert.ok(minimum > -0.000002, 'all vertices of both actual sandals clear rendered floor');
    s.eligible++;
    s.minimum = Math.min(s.minimum, minimum);
    s.rawMinimum = Math.min(s.rawMinimum, rawMinimum);
    s.soleEnvelope = Math.max(s.soleEnvelope, b.left.soleMax, b.right.soleMax);
    s.otherSoleMinimum = Math.max(s.otherSoleMinimum, b.left.soleMin, b.right.soleMin);
    s.maxLift = Math.max(s.maxLift, lift);
  } else {
    assert.equal(lift, 0);
    s.excludedMinimum = Math.min(s.excludedMinimum, rawMinimum);
  }
}
function report(id: string, s: Stats, extra: Record<string, unknown> = {}) {
  const values = { ...s, buffers: undefined, previous: undefined, clips: [...s.clips] };
  measurements.push({ id, ...extra, ...values });
}
function dispose(p: Pair) {
  p.baseline.dispose();
  p.actor.dispose();
}

it.each([0, 1, 2, 'tender'] as const)(
  'clears full packed lane %s geometry across 720 actual controller ticks without changing saves',
  (which) => {
    const state = district(),
      saved = JSON.stringify(state),
      ground = floor(state.region);
    const controls = [undefined, ground.height].map(
      (height) =>
        new NeighborhoodActivity(
          library,
          new Map(),
          () => grid(state),
          () => {},
          state.region,
          height,
        ),
    );
    const everyday = [undefined, ground.height].map(
      (height) => new EverydayActivity(library, new Map(), structuredClone(state), height),
    );
    controls.forEach((c) => c.update(state));
    const crowds = controls.map((c) => (c as unknown as { crowd: { actor: Actor }[] }).crowd);
    const tenders = everyday.map(
      (e) =>
        (
          e as unknown as { stations: { actor: Actor; definition: { id: string } }[] }
        ).stations.find((v) => v.definition.id === 'water-tender')!.actor,
    );
    const p = {
      baseline: which === 'tender' ? tenders[0]! : crowds[0]![which]!.actor,
      actor: which === 'tender' ? tenders[1]! : crowds[1]![which]!.actor,
    };
    if (which === 0) attach(p);
    const s = stats();
    for (let i = 0; i < 720; i++) {
      scene.incrementRenderId();
      controls.forEach((c) => c.tick(1 / 30, state.position));
      everyday.forEach((e) => e.tick(1 / 30, state.position));
      controllerEqual(controls[0], controls[1]);
      controllerEqual(everyday[0], everyday[1]);
      capture(p, ground.height, s);
      assert.equal(JSON.stringify(state), saved);
    }
    expect(s.samples).toBe(720);
    expect(s.rawMinimum).toBeLessThan(-0.08);
    expect(s.eligible).toBe(which === 'tender' ? 312 : 720);
    if (which === 'tender') {
      while (p.actor.playback.clip !== 'Walk') {
        scene.incrementRenderId();
        everyday.forEach((e) => e.tick(1 / 30, state.position));
      }
      const time = (everyday[1] as unknown as { time: number }).time;
      everyday.forEach((e) => e.settings({ ...DEFAULT_SETTINGS, quality: 'low' }));
      expect((everyday[1] as unknown as { time: number }).time).toBe(time);
      expect(p.actor.playback.clip).toBe('Walk');
      capture(p, ground.height, stats());
      everyday.forEach((e) => e.update(state));
      expect((everyday[1] as unknown as { time: number }).time).toBe(time);
      capture(p, ground.height, stats());
      controllerEqual(everyday[0], everyday[1]);
      assert.equal(JSON.stringify(state), saved);
    }
    const frozen = npcSkin(p.actor),
      lift = npcLift(p.actor);
    for (let i = 0; i < 20; i++) {
      p.actor.sample(p.actor.playback.clip, 0);
      expect(npcLift(p.actor)).toBe(lift);
      expect(npcSkin(p.actor).coordinates).toEqual(frozen.coordinates);
    }
    controls.forEach((c) => c.tick(0, state.position));
    everyday.forEach((e) => e.tick(0, state.position));
    capture(p, ground.height, stats());
    controls.forEach((c) => c.settings({ ...DEFAULT_SETTINGS, quality: 'low' }));
    if (which === 2) {
      expect(p.actor.root.isEnabled()).toBe(false);
      expect(npcLift(p.actor)).toBe(0);
    }
    controls.forEach((c) => c.settings({ ...DEFAULT_SETTINGS, reducedMotion: true }));
    everyday.forEach((e) => e.settings({ ...DEFAULT_SETTINGS, reducedMotion: true }));
    controls.forEach((c) => c.tick(1 / 30, state.position));
    everyday.forEach((e) => e.tick(1 / 30, state.position));
    capture(p, ground.height, stats(), false);
    controls.forEach((c) => c.settings(DEFAULT_SETTINGS));
    everyday.forEach((e) => e.settings(DEFAULT_SETTINGS));
    controls.forEach((c) => c.tick(1 / 30, state.position));
    everyday.forEach((e) => e.tick(1 / 30, state.position));
    capture(p, ground.height, stats());
    report('lanes', s, { which });
    crowds.forEach((crowd) => crowd.forEach((c) => c.actor.dispose()));
    everyday.forEach((e) => e.dispose());
    ground.mesh.dispose();
  },
);

it.each(['passage', 'outer'] as const)(
  'preserves every earned Amos %s route checkpoint, sampled reset pose, and full save',
  (route) => {
    let state = action(action(district(), 'walk-accept'), 'walk-' + route);
    if (route === 'passage') state = action(action(state, 'borrow-handle'), 'open-passage');
    state = action(state, 'walk-start');
    let controlState = structuredClone(state);
    const navigation = grid(state),
      ground = floor(state.region),
      p = pair('amos', ground.height),
      checkpoints = [[], []] as number[][];
    attach(p);
    const activities = [p.baseline, p.actor].map(
      (actor, i) =>
        new NeighborhoodActivity(
          library,
          new Map([['amos', actor]]),
          () => navigation,
          () => checkpoints[i]!.push(state.campaign.walk.step),
          state.region,
          i ? ground.height : undefined,
        ),
    );
    const s = stats();
    while (state.campaign.walk.stage === 'walking') {
      const pose = p.actor.snapshotPose();
      activities[0]!.update(controlState);
      activities[1]!.update(state);
      expect(p.actor.snapshotPose()).toEqual(pose);
      capture(p, ground.height, s, s.samples > 0);
      const target = WALK_ROUTES[route][state.campaign.walk.step]!;
      let ticks = 0;
      while (distance(p.actor.root.position, target) > 0.25 && ticks++ < 3000) {
        const player = { x: p.baseline.root.position.x, z: p.baseline.root.position.z };
        scene.incrementRenderId();
        activities.forEach((c) => c.tick(1 / 30, player));
        controllerEqual(activities[0], activities[1]);
        stateEqual(checkpoints[0], checkpoints[1]);
        capture(p, ground.height, s);
      }
      expect(ticks).toBeLessThan(3000);
      for (let i = 0; i < 12; i++) {
        scene.incrementRenderId();
        activities.forEach((c) => c.tick(1 / 30, target));
        capture(p, ground.height, s);
        controllerEqual(activities[0], activities[1]);
      }
      const step = state.campaign.walk.step;
      state.position = { ...target };
      controlState.position = { ...target };
      state.campaign.walk.position = { x: p.actor.root.position.x, z: p.actor.root.position.z };
      controlState.campaign.walk.position = {
        x: p.baseline.root.position.x,
        z: p.baseline.root.position.z,
      };
      state = transition(state, { type: 'walk-step' });
      controlState = transition(controlState, { type: 'walk-step' });
      expect(state.campaign.walk.step).toBe(step + 1);
      stateEqual(state, controlState);
    }
    state = action(state, 'walk-finish');
    controlState = action(controlState, 'walk-finish');
    stateEqual(state, controlState);
    activities[0]!.update(controlState);
    activities[1]!.update(state);
    scene.incrementRenderId();
    activities.forEach((c) => c.tick(0.2, state.position));
    capture(p, ground.height, s);
    expect(p.actor.playback.clip).toBe('Idle');
    expect(s.rawMinimum).toBeLessThan(-0.08);
    activities.forEach((c) => c.settings({ ...DEFAULT_SETTINGS, reducedMotion: true }));
    scene.incrementRenderId();
    activities.forEach((c) => c.tick(1 / 30, state.position));
    capture(p, ground.height, stats(), false);
    report('Amos', s, { route, checkpoints: checkpoints[0], savesEqual: true });
    dispose(p);
    ground.mesh.dispose();
  },
);

it.each(
  (['shade', 'terrace'] as const).flatMap((route) =>
    (['roadside-farm', 'galilean-road', 'nain-gate'] as const).map(
      (observedRegion) => [route, observedRegion] as const,
    ),
  ),
)(
  'preserves full earned Neri %s route and packed %s geometry with actual same-node trajectories',
  (route, observedRegion) => {
    let state = roadAction(gateway(roadStart(), 'to-farm'), 'company-accept');
    state = transition(state, { type: 'road-route', id: route });
    state = roadAction(state, 'company-start');
    let controlState = structuredClone(state),
      region: RoadRegion | undefined,
      activities: RoadActivity[] = [],
      p: Pair | undefined,
      ground: ReturnType<typeof floor> | undefined;
    const checkpoints = [[], []] as number[][],
      records = new Map<string, Stats>();
    while (state.road.company.stage === 'walking') {
      const meeting = companyMeeting(state.road.company)!;
      if (region !== state.road.company.region) {
        if (p) dispose(p);
        ground?.mesh.dispose();
        region = state.road.company.region;
        ground = floor(region);
        const navigation = grid(state);
        activities = [undefined, ground.height].map(
          (height, i) =>
            new RoadActivity(
              library,
              region!,
              () => navigation,
              (step) => checkpoints[i]!.push(step),
              height,
            ),
        );
        p = { baseline: activities[0]!.conversationActor, actor: activities[1]!.conversationActor };
        attach(p);
        if (region === observedRegion) records.set(region, stats());
      }
      activities[0]!.update(controlState);
      activities[1]!.update(state);
      controllerEqual(activities[0], activities[1]);
      if (region === observedRegion) capture(p!, ground!.height, records.get(region!)!);
      else {
        assert.deepEqual(p!.actor.root.position.asArray(), p!.baseline.root.position.asArray());
        assert.deepEqual(p!.actor.root.rotation.asArray(), p!.baseline.root.rotation.asArray());
      }
      if (
        observedRegion === 'galilean-road' &&
        region === 'galilean-road' &&
        state.road.company.step === 2
      ) {
        const reduced = [undefined, ground!.height].map(
          (height) =>
            new RoadActivity(
              library,
              region!,
              () => grid(state),
              () => {},
              height,
            ),
        );
        reduced.forEach((c) => {
          c.update(state);
          c.settings({ ...DEFAULT_SETTINGS, reducedMotion: true });
        });
        const reducedPair = {
            baseline: reduced[0]!.conversationActor,
            actor: reduced[1]!.conversationActor,
          },
          before = reducedPair.actor.root.position.clone();
        scene.incrementRenderId();
        reduced.forEach((c) => c.tick(1 / 30, before));
        controllerEqual(reduced[0], reduced[1]);
        const excluded = stats();
        capture(reducedPair, ground!.height, excluded, false);
        expect(distance(before, reducedPair.actor.root.position)).toBeGreaterThan(0);
        expect(reducedPair.actor.playback.clip).toBe('Walk');
        expect(reducedPair.actor.playback.frame).toBe(0);
        expect(excluded.excludedMinimum).toBeLessThan(-0.09);
        report('reduced-Neri', excluded, { route, region });
        dispose(reducedPair);
      }
      let ticks = 0;
      while (distance(p!.actor.root.position, meeting) > 0.15 && ticks++ < 3000) {
        const player = { x: p!.baseline.root.position.x, z: p!.baseline.root.position.z };
        scene.incrementRenderId();
        activities.forEach((c) => c.tick(1 / 30, player));
        controllerEqual(activities[0], activities[1]);
        stateEqual(checkpoints[0], checkpoints[1]);
        if (region === observedRegion) capture(p!, ground!.height, records.get(region!)!);
        else {
          assert.deepEqual(p!.actor.root.position.asArray(), p!.baseline.root.position.asArray());
          assert.deepEqual(p!.actor.root.rotation.asArray(), p!.baseline.root.rotation.asArray());
        }
      }
      expect(ticks).toBeLessThan(3000);
      for (let i = 0; i < 12; i++) {
        scene.incrementRenderId();
        activities.forEach((c) => c.tick(1 / 30, meeting));
        if (region === observedRegion) capture(p!, ground!.height, records.get(region!)!);
        else {
          assert.deepEqual(p!.actor.root.position.asArray(), p!.baseline.root.position.asArray());
          assert.deepEqual(p!.actor.root.rotation.asArray(), p!.baseline.root.rotation.asArray());
        }
        controllerEqual(activities[0], activities[1]);
        stateEqual(checkpoints[0], checkpoints[1]);
      }
      const step = state.road.company.step;
      state.position = { x: p!.actor.root.position.x, z: p!.actor.root.position.z };
      controlState.position = { x: p!.baseline.root.position.x, z: p!.baseline.root.position.z };
      state.road.company.position = { ...state.position };
      controlState.road.company.position = { ...controlState.position };
      state = meeting.exit
        ? gateway(state, meeting.exit)
        : transition(state, { type: 'road-step', step });
      controlState = meeting.exit
        ? gateway(controlState, meeting.exit)
        : transition(controlState, { type: 'road-step', step });
      expect(state.road.company.step).toBe(step + 1);
      stateEqual(state, controlState);
    }
    expect(state.road.company.stage).toBe('arrived');
    state = roadAction(state, 'company-finish');
    controlState = roadAction(controlState, 'company-finish');
    stateEqual(state, controlState);
    expect(state.road.company.stage).toBe('complete');
    activities[0]!.update(controlState);
    activities[1]!.update(state);
    scene.incrementRenderId();
    activities.forEach((c) => c.tick(1 / 30, state.position));
    capture(p!, ground!.height, stats(), false);
    expect(p!.actor.playback.clip).toBe('Sit');
    for (const [name, s] of records) {
      expect(s.rawMinimum).toBeLessThan(-0.08);
      expect(s.maxLift).toBeLessThan(0.102);
      expect(s.soleEnvelope).toBeLessThan(0.319);
      expect(s.maxLiftStep).toBeLessThan(0.032);
      report('Neri', s, { route, region: name, checkpoints: checkpoints[0], savesEqual: true });
    }
    if (route === 'terrace' && observedRegion === 'galilean-road') {
      const s = records.get('galilean-road')!;
      expect(s.restart).toBeDefined();
      expect(s.idleBoundary).toBeDefined();
      expect(s.restart!.rawWorldStep).toBeCloseTo(0.184302, 5);
      expect(s.restart!.displayedWorldStep).toBeCloseTo(0.186012, 5);
      expect(s.restart!.rawHeadY).toBeCloseTo(-0.000767, 5);
      expect(s.restart!.displayedHeadY).toBeCloseTo(0.017945, 5);
      expect(s.idleBoundary!.rawWorldStep).toBeCloseTo(0.072242, 5);
      expect(s.idleBoundary!.displayedWorldStep).toBeCloseTo(0.074566, 5);
      expect(s.idleBoundary!.rawHeadY).toBeCloseTo(0.000058, 5);
      expect(s.idleBoundary!.displayedHeadY).toBeCloseTo(0.007611, 5);
      expect(s.rawWorldStep).toBeLessThan(0.477);
      expect(s.displayedWorldStep).toBeLessThan(0.477);
    }
    dispose(p!);
    ground!.mesh.dispose();
  },
);

it('clears every exact/finite/reset sampling path, effective ancestor disable, and default actor controls', () => {
  const ground = floor('capernaum-lanes'),
    p = pair('villager', ground.height);
  attach(p);
  const prime = () => {
    [p.baseline, p.actor].forEach((a) => {
      a.cancelAction();
      a.restorePose({ clip: 'Walk', frame: 0, elapsed: 0, oneShot: undefined });
      a.sample('Walk', 0);
    });
    expect(npcLift(p.actor)).toBeGreaterThan(0.08);
    capture(p, ground.height, stats());
  };
  const clear = (action: (a: Actor) => void) => {
    prime();
    [p.baseline, p.actor].forEach(action);
    expect(npcLift(p.actor)).toBe(0);
    capture(p, ground.height, stats(), false);
  };
  clear((a) => a.setClip('Walk'));
  clear((a) => a.sampleAt('Walk', 0.4));
  clear((a) => a.sampleActionAt('PickUp', 0.4));
  clear((a) => a.playOnce('Use'));
  clear((a) => a.restorePose({ clip: 'Walk', frame: 0, elapsed: 0, oneShot: undefined }));
  clear((a) => a.pose('Idle'));
  clear((a) => a.cancelAction());
  for (const clip of [
    'Sit',
    'BenchSit',
    'Row',
    'Kneel',
    'Repair',
    'Use',
    'Listen',
    'Carry',
    'MatCarry',
  ] as const)
    clear((a) => a.sample(clip, 0.1));
  prime();
  const parents = [p.baseline, p.actor].map((a) => {
    const node = new TransformNode('parent-' + serial++, scene);
    a.root.parent = node;
    return node;
  });
  parents.forEach((a) => a.setEnabled(false));
  expect(npcLift(p.actor)).toBe(0);
  [p.baseline, p.actor].forEach((a) => a.sample('Walk', 0.1));
  capture(p, ground.height, stats(), false);
  parents.forEach((a) => a.setEnabled(true));
  prime();
  p.actor.setLocomotionReducedMotion(true);
  expect(npcLift(p.actor)).toBe(0);
  [p.baseline, p.actor].forEach((a) => a.sample('Walk', 0.1, true));
  capture(p, ground.height, stats(), false);
  p.actor.setLocomotionReducedMotion(false);
  prime();
  p.actor.clearLocomotionPresentation();
  p.baseline.setClip('Walk');
  capture(p, ground.height, stats(), false);
  p.actor.refreshLocomotionPresentation();
  expect(npcLift(p.actor)).toBeGreaterThan(0.08);
  const unopted = new Actor(library.instantiate('villager', 'unopted-' + serial++), true);
  unopted.sampleAt('Walk', 0);
  unopted.sample('Walk', 0);
  expect(npcLift(unopted)).toBe(0);
  const unoptedFeet = npcFeet(npcSkin(unopted), ground.height);
  expect(Math.min(unoptedFeet.left.minimum, unoptedFeet.right.minimum)).toBeLessThan(-0.08);
  expect(unopted.hasFootSupport).toBe(false);
  const traveler = new Actor(
    library.instantiate('traveler', 'traveler-control-' + serial++),
    true,
    { stationaryFeet: true },
  );
  traveler.sample('Carry', 0, true);
  traveler.supportFeet({ ground: ground.height, dt: 0, stationary: true, immediate: true });
  expect(traveler.hasFootSupport).toBe(true);
  expect(npcLift(traveler)).toBe(0);
  traveler.suppressLocomotionPresentation(true);
  expect(traveler.hasFootSupport).toBe(true);
  traveler.dispose();
  unopted.dispose();
  dispose(p);
  parents.forEach((a) => a.dispose());
  ground.mesh.dispose();
});

it('suppresses before dialogue bookmarks and releases after clear/disposal with roots and headings restored', () => {
  vi.stubGlobal('document', { hidden: false });
  const p = pair('villager', () => 0),
    listener = new Actor(library.instantiate('villager', 'listener-' + serial++), true, {
      locomotionClearance: { ground: () => 0 },
    });
  listener.root.position.x = 2;
  const camera = new ArcRotateCamera('dialogue-' + serial++, -0.8, 1, 12, Vector3.Zero(), scene),
    canvas = { clientWidth: 1280, clientHeight: 720, dataset: {} } as HTMLCanvasElement,
    conversation = new ConversationPresentation(camera, canvas);
  const prime = () => {
    for (const a of [p.actor, listener]) {
      a.restorePose({ clip: 'Walk', frame: 0, elapsed: 0, oneShot: undefined });
      a.sample('Walk', 0);
      expect(npcLift(a)).toBeGreaterThan(0.08);
    }
  };
  prime();
  const heading = p.actor.root.rotation.y,
    root = p.actor.root.position.asArray(),
    snapshot = p.actor.snapshotPose();
  const bookmark = vi.spyOn(p.actor, 'snapshotPose').mockImplementation(() => {
    expect(npcLift(p.actor)).toBe(0);
    expect(npcLift(listener)).toBe(0);
    return snapshot;
  });
  conversation.select('neighbor', p.actor, listener);
  bookmark.mockRestore();
  expect(npcLift(p.actor)).toBe(0);
  p.actor.sample('Walk', 0.1);
  expect(npcLift(p.actor)).toBe(0);
  conversation.tick(0.1, false);
  conversation.clear();
  expect(p.actor.snapshotPose()).toEqual(snapshot);
  expect(p.actor.root.position.asArray()).toEqual(root);
  expect(p.actor.root.rotation.y).toBe(heading);
  prime();
  conversation.select('neighbor', p.actor, listener);
  conversation.dispose();
  prime();
  expect(p.actor.root.position.asArray()).toEqual(root);
  dispose(p);
  listener.dispose();
  camera.dispose();
  vi.unstubAllGlobals();
});

it.each(['actor', 'root', 'scene'] as const)(
  'clears before %s disposal releases meshes, detaches hooks, and drops cached references',
  async (owner) => {
    const localScene = new Scene(engine),
      localLibrary = new AssetLibrary(localScene);
    await localLibrary.load(['villager'], () => {});
    const model = localLibrary.instantiate('villager', 'dispose-' + owner),
      originalDispose = model.root.dispose;
    const actor = new Actor(model, true, { locomotionClearance: { ground: () => 0 } });
    actor.sampleAt('Walk', 0);
    actor.sample('Walk', 0);
    const internals = actor as unknown as {
        feet?: unknown;
        locomotionClearance?: {
          disposed: boolean;
          root?: unknown;
          visual?: unknown;
          scene?: unknown;
          ground?: unknown;
          sandals: unknown[];
          matrices: Map<unknown, unknown>;
          released?: unknown;
          restoreRootDispose?: unknown;
          disabledObserver?: unknown;
          sceneObserver?: unknown;
        };
      },
      helper = internals.locomotionClearance!;
    expect(npcLift(actor)).toBeGreaterThan(0.08);
    actor.footClearance();
    expect(internals.feet).toBeDefined();
    const visual = model.root.getChildTransformNodes(true).find((n) => n.name.endsWith(':visual'))!;
    let atMeshDispose = Infinity;
    model.root.getChildMeshes()[0]!.onDisposeObservable.add(() => {
      atMeshDispose = visual.position.y;
    });
    if (owner === 'actor') actor.dispose();
    else if (owner === 'root') actor.root.dispose();
    else localScene.dispose();
    expect(atMeshDispose).toBe(0);
    expect(helper.disposed).toBe(true);
    expect(internals.feet).toBeUndefined();
    expect(internals.locomotionClearance).toBeUndefined();
    expect(model.root.dispose).toBe(originalDispose);
    for (const key of [
      'root',
      'visual',
      'scene',
      'ground',
      'released',
      'restoreRootDispose',
      'disabledObserver',
      'sceneObserver',
    ] as const)
      expect(helper[key]).toBeUndefined();
    expect(helper.sandals).toEqual([]);
    expect(helper.matrices.size).toBe(0);
    localLibrary.dispose();
    localScene.dispose();
  },
);

it('uses actual World rendered floor and opts in only the named lane Amos placement', () => {
  const ground = floor('capernaum-lanes'),
    query = vi.spyOn(ground.mesh, 'getHeightAtCoordinates');
  const world = Object.assign(Object.create(World.prototype), {
    library,
    state: district(),
    actors: new Map<string, Actor>(),
    floor: ground.mesh,
    boats: [],
    layout: campaignLayout('capernaum-lanes'),
    occluders: [],
  });
  world.actorGround = (x: number, z: number) => world.renderedActorHeight(x, z);
  world.place({ asset: 'amos', x: -9, z: -5 }, 'amos');
  const named = world.actors.get('amos') as Actor;
  named.sampleAt('Walk', 0);
  named.sample('Walk', 0);
  expect(npcLift(named)).toBeGreaterThan(0.08);
  expect(query).toHaveBeenCalled();
  expect(
    query.mock.calls.some(([x, z]) => x !== named.root.position.x || z !== named.root.position.z),
  ).toBe(true);
  world.place({ asset: 'amos', x: 1, z: 0 }, 'other-amos');
  const other = world.actors.get('other-amos') as Actor;
  other.sampleAt('Walk', 0);
  other.sample('Walk', 0);
  expect(npcLift(other)).toBe(0);
  world.state.region = 'galilean-road';
  world.place({ asset: 'amos', x: 1, z: 0 }, 'amos');
  const road = world.actors.get('amos') as Actor;
  road.sampleAt('Walk', 0);
  road.sample('Walk', 0);
  expect(npcLift(road)).toBe(0);
  named.dispose();
  other.dispose();
  road.dispose();
  ground.mesh.dispose();
});

it.each([false, true])(
  'preserves same-render simulation substeps, relocation, and every NPC ownership context with reduced %s',
  (reducedMotion) => {
    const state = action(action(action(district(), 'walk-accept'), 'walk-outer'), 'walk-start');
    const ground = floor(state.region),
      amos = pair('amos', ground.height),
      navigation = grid(state);
    const neighborhoods = [amos.baseline, amos.actor].map(
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
    const everyday = [undefined, ground.height].map(
      (height) => new EverydayActivity(library, new Map(), state, height),
    );
    const crowds = neighborhoods.map((c) => (c as unknown as { crowd: { actor: Actor }[] }).crowd);
    const tenders = everyday.map(
      (e) =>
        (
          e as unknown as { stations: { actor: Actor; definition: { id: string } }[] }
        ).stations.find((v) => v.definition.id === 'water-tender')!.actor,
    );
    // Advance both authored station clocks into the real moving tender phase before grouping.
    for (const e of everyday) e.tick(10, state.position);
    let roadState = roadAction(gateway(roadStart(), 'to-farm'), 'company-accept');
    roadState = transition(roadState, { type: 'road-route', id: 'terrace' });
    roadState = roadAction(roadState, 'company-start');
    const roadGround = floor(roadState.region),
      roads = [undefined, roadGround.height].map(
        (height) =>
          new RoadActivity(
            library,
            roadState.road.company.region,
            () => grid(roadState),
            () => {},
            height,
          ),
      );
    const neri = { baseline: roads[0]!.conversationActor, actor: roads[1]!.conversationActor };
    const pairs = [
      amos,
      ...crowds[0]!.map((c, i) => ({ baseline: c.actor, actor: crowds[1]![i]!.actor })),
      { baseline: tenders[0]!, actor: tenders[1]! },
      neri,
    ];
    neighborhoods.forEach((c) => {
      c.update(state);
      c.settings({ ...DEFAULT_SETTINGS, reducedMotion });
    });
    everyday.forEach((c) => c.settings({ ...DEFAULT_SETTINGS, reducedMotion }));
    roads.forEach((c) => {
      c.update(roadState);
      c.settings({ ...DEFAULT_SETTINGS, reducedMotion });
    });
    for (let frame = 0; frame < 6; frame++) {
      scene.incrementRenderId();
      for (let step = 0; step < 6; step++) {
        if (frame === 3 && step === 3) {
          const relocated = structuredClone(state);
          relocated.campaign.walk.position = {
            x: amos.baseline.root.position.x + 0.1,
            z: amos.baseline.root.position.z + 0.15,
          };
          const pose = amos.baseline.snapshotPose();
          neighborhoods.forEach((c) => c.update(relocated));
          expect(amos.actor.snapshotPose()).toEqual(pose);
          const relocatedRoad = structuredClone(roadState);
          relocatedRoad.road.company.position = {
            x: neri.baseline.root.position.x + 0.1,
            z: neri.baseline.root.position.z + 0.15,
          };
          roads.forEach((c) => c.update(relocatedRoad));
          everyday.forEach((c) => c.update(state));
        }
        const player = { x: amos.baseline.root.position.x, z: amos.baseline.root.position.z };
        neighborhoods.forEach((c) => c.tick(1 / 60, player));
        everyday.forEach((c) => c.tick(1 / 60, state.position));
        const roadPlayer = { x: neri.baseline.root.position.x, z: neri.baseline.root.position.z };
        roads.forEach((c) => c.tick(1 / 60, roadPlayer));
        for (const p of pairs) {
          assert.deepEqual(p.actor.root.position.asArray(), p.baseline.root.position.asArray());
          assert.deepEqual(p.actor.root.rotation.asArray(), p.baseline.root.rotation.asArray());
          assert.deepEqual(p.actor.snapshotPose(), p.baseline.snapshotPose());
        }
        controllerEqual(neighborhoods[0], neighborhoods[1]);
        controllerEqual(everyday[0], everyday[1]);
        controllerEqual(roads[0], roads[1]);
      }
      pairs.forEach((p) =>
        capture(p, p === neri ? roadGround.height : ground.height, stats(), !reducedMotion),
      );
    }
    pairs.forEach(dispose);
    everyday.forEach((e) => e.dispose());
    ground.mesh.dispose();
    roadGround.mesh.dispose();
  },
);
