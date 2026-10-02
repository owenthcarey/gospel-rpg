import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Actor } from '../../src/scene/actors/actor';
import { EverydayActivity } from '../../src/scene/actors/everyday';
import { NeighborhoodActivity } from '../../src/scene/actors/neighborhood';
import { RoadActivity } from '../../src/scene/actors/road';
import { AssetLibrary } from '../../src/scene/assets';
import { newGame, DEFAULT_SETTINGS } from '../../src/game/types';
import { distance, WalkGrid } from '../../src/game/pathfinding';

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

let engine: NullEngine;
let scene: Scene;
let library: AssetLibrary;
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['amos', 'villager', 'bread_basket', 'jug', 'gate', 'handcart'], () => {});
});
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

/** Measure the shipped clip rather than assuming an animation's frame rate or duration. */
function framePerMetre(): number {
  const reference = new Actor(library.instantiate('amos', 'stride-reference'));
  reference.setStrideSpeed(3.25);
  reference.sample('Walk', 0.1);
  const start = reference.playback.frame;
  reference.sample('Walk', 0.1);
  const rate = (reference.playback.frame - start) / 0.325;
  reference.dispose();
  return rate;
}

it('matches Amos and Neri foot cadence to their slower companion movement', () => {
  const rate = framePerMetre();
  const grid = new WalkGrid();
  const state = newGame();
  state.region = 'capernaum-lanes';
  state.campaign.walk.stage = 'walking';
  state.campaign.walk.route = 'passage';
  const amos = new Actor(library.instantiate('amos', 'companion-amos'), true);
  const neighborhood = new NeighborhoodActivity(
    library,
    new Map([['amos', amos]]),
    () => grid,
    () => {},
    'capernaum-lanes',
  );
  neighborhood.update(state);
  neighborhood.tick(0.1, amos.root.position);
  const amosFrame = amos.playback.frame;
  const amosPosition = amos.root.position.clone();
  neighborhood.tick(0.1, amosPosition);
  expect(amos.playback.frame - amosFrame).toBeCloseTo(
    distance(amosPosition, amos.root.position) * rate,
    5,
  );

  state.region = 'roadside-farm';
  state.road.company.stage = 'walking';
  state.road.company.route = 'shade';
  const road = new RoadActivity(
    library,
    'roadside-farm',
    () => grid,
    () => {},
  );
  road.update(state);
  const neri = road.conversationActor;
  road.tick(0.1, neri.root.position);
  const neriFrame = neri.playback.frame;
  const neriPosition = neri.root.position.clone();
  road.tick(0.1, neriPosition);
  expect(neri.playback.frame - neriFrame).toBeCloseTo(
    distance(neriPosition, neri.root.position) * rate,
    5,
  );

  // Stopping the story walk must settle Amos instead of freezing his last stride.
  state.campaign.walk.position = { x: amos.root.position.x, z: amos.root.position.z };
  state.campaign.walk.stage = 'arrived';
  neighborhood.update(state);
  const waiting = amos.root.position.clone();
  neighborhood.tick(0.1, waiting);
  expect(amos.playback.clip).toBe('Idle');
  expect(amos.root.position.equals(waiting)).toBe(true);
  const idleFrame = amos.playback.frame;
  neighborhood.tick(0.1, waiting);
  expect(amos.playback.frame).toBeGreaterThan(idleFrame);
});

it('keeps lane neighbors and the water tender strides at their actual unhurried pace', () => {
  const rate = framePerMetre();
  const state = newGame();
  state.region = 'capernaum-lanes';
  const neighborhood = new NeighborhoodActivity(
    library,
    new Map(),
    () => new WalkGrid(),
    () => {},
    state.region,
  );
  neighborhood.update(state);
  const crowd = neighborhood as unknown as { crowd: { actor: Actor }[] };
  neighborhood.tick(0.1, state.position);
  const before = crowd.crowd.map(({ actor }) => ({
    frame: actor.playback.frame,
    position: actor.root.position.clone(),
  }));
  neighborhood.tick(0.1, state.position);
  for (const [i, { actor }] of crowd.crowd.entries())
    expect(actor.playback.frame - before[i]!.frame).toBeCloseTo(
      distance(before[i]!.position, actor.root.position) * rate,
      5,
    );

  const everyday = new EverydayActivity(library, new Map(), state);
  const stations = everyday as unknown as { stations: { actor: Actor }[] };
  const tender = stations.stations[0]!.actor;
  everyday.tick(9.6, state.position);
  expect(tender.playback.clip).toBe('Walk');
  const start = { frame: tender.playback.frame, position: tender.root.position.clone() };
  everyday.tick(0.1, state.position);
  expect(tender.playback.frame - start.frame).toBeCloseTo(
    distance(start.position, tender.root.position) * rate,
    5,
  );
  everyday.dispose();
});

it('preserves companion travel with reduced motion while holding a stable animation frame', () => {
  const state = newGame();
  state.region = 'capernaum-lanes';
  state.campaign.walk.stage = 'walking';
  state.campaign.walk.route = 'passage';
  const amos = new Actor(library.instantiate('amos', 'reduced-amos'), true);
  const neighborhood = new NeighborhoodActivity(
    library,
    new Map([['amos', amos]]),
    () => new WalkGrid(),
    () => {},
    state.region,
  );
  neighborhood.update(state);
  neighborhood.settings({ ...DEFAULT_SETTINGS, reducedMotion: true });
  neighborhood.tick(0.1, amos.root.position);
  const start = { frame: amos.playback.frame, position: amos.root.position.clone() };
  neighborhood.tick(0.1, start.position);
  expect(distance(start.position, amos.root.position)).toBeGreaterThan(0.1);
  expect(amos.playback.frame).toBe(start.frame);

  state.region = 'roadside-farm';
  state.road.company.stage = 'walking';
  state.road.company.route = 'shade';
  const road = new RoadActivity(
    library,
    state.region,
    () => new WalkGrid(),
    () => {},
  );
  road.update(state);
  road.settings({ ...DEFAULT_SETTINGS, reducedMotion: true });
  const neri = road.conversationActor;
  road.tick(0.1, neri.root.position);
  const neriStart = { frame: neri.playback.frame, position: neri.root.position.clone() };
  road.tick(0.1, neriStart.position);
  expect(distance(neriStart.position, neri.root.position)).toBeGreaterThan(0.1);
  expect(neri.playback.frame).toBe(neriStart.frame);
});
