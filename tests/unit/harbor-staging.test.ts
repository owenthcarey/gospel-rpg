import { afterEach, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { HarborPresentation, dressVillage } from '../../src/scene/harbor';
import { EverydayActivity } from '../../src/scene/actors/everyday';
import { Actor } from '../../src/scene/actors/actor';
import { newGame, DEFAULT_SETTINGS } from '../../src/game/types';
import { explorationAssets } from '../../src/content/inventories';
import {
  HARBOR_CELLS,
  harborPosition,
  plankPosition,
  cargoPosition,
} from '../../src/game/harbor/arrangement';
import { clearHarbor, harborAction } from '../helpers/harbor';
import { posedVertices, bakedGeometry } from '../helpers/posed-geometry';
import type { ExplorationRegion } from '../../src/game/campaign/types';
import { capernaumScenery } from '../../src/content/harbor/scenery';
import { campaignLayout } from '../../src/content/campaign/layouts';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (source: string, scene: Scene) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { pluginExtension: '.glb' },
      ),
  };
});
let engine: NullEngine;
const review: Record<string, unknown> = {};
afterEach(() => {
  if (process.env.HARBOR_REVIEW_OUTPUT)
    writeFileSync(process.env.HARBOR_REVIEW_OUTPUT, JSON.stringify(review));
  engine?.dispose();
});
async function setup(region: ExplorationRegion) {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(explorationAssets(region), () => {});
  return { scene, library };
}
it('imports the physical grid and both supported plank orientations without mirrored coordinates', async () => {
  const { scene, library } = await setup('capernaum');
  const presentation = new HarborPresentation(scene, library);
  for (const route of ['north', 'south'] as const) {
    const h = clearHarbor(route).harbor;
    presentation.update(h);
    const plank = scene.getTransformNodeByName('working-crossing-plank')!;
    const vertices = posedVertices(plank),
      p = plankPosition(h);
    expect(plank.position.x).toBe(p.x);
    expect(plank.position.z).toBe(p.z);
    expect(
      Math.max(...vertices.map((v) => v.x)) - Math.min(...vertices.map((v) => v.x)),
    ).toBeCloseTo(1.3, 2);
    const stoneHalf = 1.06 / 2,
      left = harborPosition({ x: 0, z: route === 'north' ? 2 : 0 }),
      right = harborPosition({ x: 2, z: route === 'north' ? 2 : 0 });
    expect(Math.min(...vertices.map((v) => v.x))).toBeLessThan(left.x + stoneHalf);
    expect(Math.max(...vertices.map((v) => v.x))).toBeGreaterThan(right.x - stoneHalf);
    for (const cargo of ['nets', 'jars'] as const) {
      const model = scene.getTransformNodeByName(
        cargo === 'nets' ? 'working-net-cargo' : 'working-jar-cargo',
      )!;
      const pos = cargoPosition(h, cargo);
      expect(model.position.x).toBe(pos.x);
      expect(model.position.z).toBe(pos.z);
    }
    review[route] = bakedGeometry(scene);
  }
  const stones = scene.getMeshByName('scenery-batch:quay_stones')!;
  const data = stones.getPositionData()!;
  for (const cell of HARBOR_CELLS.filter((c) => c.x !== 1)) {
    const p = harborPosition(cell);
    expect(
      Array.from({ length: data.length / 3 }, (_, i) => Vector3.FromArray(data, i * 3)).some(
        (v) => Math.abs(v.x - p.x) < 0.54 && Math.abs(v.z - p.z) < 0.54,
      ),
    ).toBe(true);
  }
});
it('reconstructs and disposes state-gated ordinary work without moving named targets', async () => {
  const { scene, library } = await setup('capernaum');
  dressVillage(scene, library, 'capernaum');
  const eliab = new Actor(library.instantiate('villager', 'eliab'));
  eliab.root.position.set(0.1, 0, -9.7);
  const actors = new Map([['eliab', eliab]]),
    s = newGame(),
    activity = new EverydayActivity(library, actors, s);
  expect(activity.owns('eliab')).toBe(true);
  const original = eliab.root.position.clone();
  activity.tick(1, { x: 0, z: -9 });
  expect(eliab.playback.clip).toBe('Idle');
  expect(eliab.root.position.equals(original)).toBe(true);
  activity.update(harborAction(clearHarbor(), 'remember-patience'));
  activity.settings({ ...DEFAULT_SETTINGS, reducedMotion: true, quality: 'low' });
  expect(eliab.playback.clip).toBe('Use');
  const frame = eliab.playback.frame;
  activity.tick(50, s.position);
  expect(eliab.playback.frame).toBe(frame);
  expect(eliab.root.position.equals(original)).toBe(true);
  const netBench = posedVertices(scene.getTransformNodeByName('village-detail:net_workbench')!);
  for (const side of ['left', 'right']) {
    const hands = posedVertices(eliab.root, 'forearm_' + side);
    expect(
      Math.min(...hands.flatMap((p) => netBench.map((q) => Vector3.Distance(p, q)))),
    ).toBeLessThan(0.25);
  }
  review['net-work'] = bakedGeometry(scene);
  activity.dispose();
  expect(eliab.root.isDisposed()).toBe(false);
});
it.each(['capernaum-lanes', 'bakehouse', 'gathering-house'] as const)(
  'imports %s work compositions and keeps feet supported',
  async (region) => {
    const { scene, library } = await setup(region);
    const s = newGame();
    s.region = region;
    s.campaign.roof.stage = 'complete';
    s.campaign.table.stage = 'complete';
    s.campaign.table.location = 'courtyard';
    for (const p of campaignLayout(region)!.decor.filter((p) => !p.cutaway)) {
      const m = library.instantiate(p.asset, 'base-' + p.asset);
      m.root.position.set(p.x, p.y ?? 0, p.z);
      m.root.rotation.y = p.rotation ?? 0;
    }
    dressVillage(scene, library, region);
    const activity = new EverydayActivity(library, new Map(), s);
    activity.settings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    const people = scene.transformNodes.filter(
      (n) => n.name.startsWith('everyday-') && !n.name.includes(':'),
    );
    expect(people.length).toBeGreaterThan(0);
    for (const person of people) {
      const feet = [...posedVertices(person, 'leg_left'), ...posedVertices(person, 'leg_right')];
      expect(Math.abs(Math.min(...feet.map((p) => p.y))), person.name).toBeLessThan(0.06);
    }
    if (region === 'bakehouse') {
      const person = people[0]!;
      const board = posedVertices(scene.getTransformNodeByName('village-detail:bread_board')!);
      for (const side of ['left', 'right']) {
        const hands = posedVertices(person, 'forearm_' + side);
        expect(
          Math.min(...hands.flatMap((p) => board.map((q) => Vector3.Distance(p, q)))),
          side + ' bread-working hand',
        ).toBeLessThan(0.25);
      }
    }
    review[region] = bakedGeometry(scene);
    activity.dispose();
    expect(people.every((p) => p.isDisposed())).toBe(true);
  },
);

it('faces each destination with the actual imported working hands, including after a walking step', async () => {
  const { library } = await setup('capernaum');
  const actor = new Actor(library.instantiate('traveler', 'heading-check'));
  for (const target of [
    { x: 4, z: 0 },
    { x: -4, z: 0 },
    { x: 0, z: 4 },
    { x: 0, z: -4 },
  ]) {
    actor.root.position.setAll(0);
    actor.face(target);
    actor.sampleAt('Use', 0);
    const hands = posedVertices(actor.root, 'forearm_left');
    const projection =
      hands.reduce((sum, p) => sum + (p.x * target.x + p.z * target.z) / 4, 0) / hands.length;
    expect(projection).toBeGreaterThan(0.15);
    actor.walk([target]);
    actor.tick(0.1, false);
    actor.sampleAt('Use', 0);
    const next = posedVertices(actor.root, 'forearm_right');
    expect(
      next.reduce(
        (sum, p) =>
          sum +
          ((p.x - actor.root.position.x) * target.x + (p.z - actor.root.position.z) * target.z) / 4,
        0,
      ) / next.length,
    ).toBeGreaterThan(0.15);
  }
});

it('projects doorway shade outside the southern facade instead of into the house', async () => {
  const { library } = await setup('capernaum-lanes');
  const awning = library.instantiate('door_awning', 'awning-front-check');
  awning.root.rotation.y = capernaumScenery['capernaum-lanes']!.find(
    (p) => p.asset === 'door_awning',
  )!.rotation!;
  const points = posedVertices(awning.root);
  expect(-Math.min(...points.map((p) => p.z))).toBeGreaterThan(Math.max(...points.map((p) => p.z)));
});
