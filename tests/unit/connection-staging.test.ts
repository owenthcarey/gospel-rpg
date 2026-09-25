import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { LifeActivity } from '../../src/scene/actors/life';
import { ConnectionActivity } from '../../src/scene/actors/connection';
import { DEFAULT_SETTINGS } from '../../src/game/types';
import { explorationAssets } from '../../src/content/inventories';
import { homeAt, completedJourney } from '../helpers/connection';
import { passageMarkers, passageObstacles } from '../../src/content/connection/presentation';
import { homePlaces } from '../../src/content/connection/home';
import { obstacles, isLand } from '../../src/content/region';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { WalkGrid } from '../../src/game/pathfinding';
import { approachPath } from '../../src/game/navigation';
import { posedVertices, bakedGeometry, nearestDistance } from '../helpers/posed-geometry';

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
let engine: NullEngine | undefined;
const review: Record<string, unknown> = {};
afterEach(() => {
  if (process.env.CONNECTION_REVIEW_OUTPUT)
    writeFileSync(process.env.CONNECTION_REVIEW_OUTPUT, JSON.stringify(review));
  engine?.dispose();
});
async function setup() {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(explorationAssets('capernaum'), () => {});
  return { scene, library };
}
describe('connected-journey exported geometry', () => {
  it('reconstructs bounded return company and grounds both travelers at High and Low', async () => {
    const { scene, library } = await setup();
    const s = homeAt(completedJourney(), 'shore');
    const activity = new ConnectionActivity(library, s);
    const people = [0, 1].map((i) => scene.getTransformNodeByName('home-company-' + i)!);
    expect(people.every((p) => !p.isEnabled())).toBe(true);
    s.connection.home.reflection = 'remain';
    activity.update(s);
    activity.settings({ ...DEFAULT_SETTINGS, quality: 'high', reducedMotion: true });
    activity.tick(0.5);
    expect(people.every((p) => p.isEnabled())).toBe(true);
    for (const person of people) {
      const feet = [...posedVertices(person, 'leg_left'), ...posedVertices(person, 'leg_right')];
      expect(feet.length).toBeGreaterThan(0);
      expect(Math.abs(Math.min(...feet.map((p) => p.y)))).toBeLessThan(0.06);
    }
    review.company = bakedGeometry(scene);
    activity.settings({ ...DEFAULT_SETTINGS, quality: 'low' });
    expect(people.filter((p) => p.isEnabled())).toHaveLength(1);
    s.connection.home.reflection = null;
    activity.update(s);
    expect(people.every((p) => !p.isEnabled())).toBe(true);
  });
  it('fits marker geometry inside its collision footprint and leaves every return encounter reachable', async () => {
    const { scene, library } = await setup();
    const s = homeAt(completedJourney(), 'shore');
    new ConnectionActivity(library, s);
    for (const marker of passageMarkers(s)) {
      const points = posedVertices(scene.getTransformNodeByName('passage-marker-' + marker.id)!);
      expect(points.length).toBeGreaterThan(0);
      expect(
        points.every((p) => Math.abs(p.x - marker.x) <= 0.301 && Math.abs(p.z - marker.z) <= 0.281),
      ).toBe(true);
    }
    for (const place of homePlaces) {
      const state = homeAt(s, place.visit),
        layout = campaignLayout(state.region);
      const walls = [...(layout ? layoutObstacles(state) : obstacles), ...passageObstacles(state)];
      const grid = layout
        ? new WalkGrid(walls, layout.terrain, layout.bounds.min, layout.bounds.max)
        : new WalkGrid(walls, isLand);
      const path = approachPath(grid, grid.nearest({ x: 0, z: -4 })!, place);
      expect(path.length, place.id).toBeGreaterThan(0);
      expect(
        Vector3.Distance(
          new Vector3(path.at(-1)!.x, 0, path.at(-1)!.z),
          new Vector3(place.x, 0, place.z),
        ),
      ).toBeLessThan(2.8);
    }
  });
  it('supports the existing seated shore neighbor and preserves actual hand contact with the carried pouch', async () => {
    const { scene, library } = await setup();
    const s = homeAt(completedJourney(), 'shore');
    s.life.bench.stage = 'complete';
    s.life.bench.method = 'brace';
    s.life.bench.cleared = true;
    const player = new Actor(library.instantiate('traveler', 'connection-traveler'));
    const activity = new LifeActivity(library, player, 'capernaum');
    s.campaign.carrying = 'sewing-pouch';
    activity.update(s);
    player.sampleAt('Carry', 0);
    activity.settings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    activity.tick(0);
    const held = posedVertices(scene.getTransformNodeByName('held-sewing-pouch')!);
    for (const side of ['left', 'right']) {
      const hand = posedVertices(player.root, 'forearm_' + side);
      expect(nearestDistance(hand, held)).toBeLessThan(0.22);
    }
    const seated = scene.getTransformNodeByName('life-resting-neighbor')!;
    const body = seated
      .getChildTransformNodes()
      .find((n) => n.name.replace(/\.\d+$/, '').endsWith('body'));
    expect(seated.isEnabled()).toBe(true);
    const seat = posedVertices(scene.getTransformNodeByName('life-bench_braced')!);
    const pelvis = body?.getAbsolutePosition();
    const feet = [...posedVertices(seated, 'leg_left'), ...posedVertices(seated, 'leg_right')];
    expect(pelvis).toBeDefined();
    expect(seat.length).toBeGreaterThan(0);
    expect(Math.abs(pelvis!.y - Math.max(...seat.map((p) => p.y)))).toBeLessThan(0.15);
    expect(Math.abs(Math.min(...feet.map((p) => p.y)))).toBeLessThan(0.12);
    review.holding = bakedGeometry(scene);
    s.campaign.carrying = null;
    s.life.bench.stage = 'fitted';
    activity.update(s);
    player.root.position.set(2.6, 0, 7.7);
    player.root.rotation.y = 0;
    player.sampleAt('Repair', 0.55);
    review.working = bakedGeometry(scene);
  });
});
