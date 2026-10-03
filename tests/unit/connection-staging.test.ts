import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { LifeActivity } from '../../src/scene/actors/life';
import { ConnectionActivity } from '../../src/scene/actors/connection';
import { DEFAULT_SETTINGS, newGame } from '../../src/game/types';
import type { ExplorationRegion } from '../../src/game/campaign/types';
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
let engine: NullEngine | undefined;
const review: Record<string, unknown> = {};
afterEach(() => {
  if (process.env.CONNECTION_REVIEW_OUTPUT)
    writeFileSync(process.env.CONNECTION_REVIEW_OUTPUT, JSON.stringify(review));
  engine?.dispose();
});
async function setup(region: ExplorationRegion = 'capernaum') {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  const scene = new Scene(engine),
    library = new AssetLibrary(scene);
  await library.load(explorationAssets(region), () => {});
  return { scene, library };
}
describe('connected-journey exported geometry', () => {
  it.each([
    ['capernaum-lanes', 'high'],
    ['capernaum-lanes', 'low'],
    ['bakehouse', 'high'],
    ['bakehouse', 'low'],
  ] as const)(
    'faces the %s table guests toward their table at %s quality',
    async (region, quality) => {
      const { scene, library } = await setup(region);
      const state = newGame();
      state.region = region;
      state.campaign.table.stage = 'complete';
      state.campaign.table.location = region === 'capernaum-lanes' ? 'courtyard' : 'bakehouse';
      const table = campaignLayout(region)!.decor.find((p) => p.asset === 'worktable')!;
      const bench = campaignLayout(region)!.decor.find(
        (p) => p.asset === 'bench' && p.z < table.z,
      )!;
      const seat = library.instantiate('bench', 'table-guest-bench');
      seat.root.position.set(bench.x, 0, bench.z);
      const seatPoints = posedVertices(seat.root);
      const seatHeight = Math.max(...seatPoints.map((p) => p.y));
      const player = new Actor(library.instantiate('traveler', 'table-guest-traveler'));
      const activity = new LifeActivity(library, player, region);
      activity.update(state);
      activity.settings({ ...DEFAULT_SETTINGS, quality });
      activity.tick(0.1);
      const { company } = activity as unknown as { company: Actor[] };
      expect(company).toHaveLength(2);
      for (const guest of company) {
        const position = guest.root.position.clone();
        const pelvis = guest.model.socket('body').getAbsolutePosition();
        const feet = [
          ...posedVertices(guest.root, 'leg_left'),
          ...posedVertices(guest.root, 'leg_right'),
        ];
        expect(guest.root.isEnabled()).toBe(true);
        expect(Math.abs(pelvis.y - seatHeight)).toBeLessThan(0.025);
        expect(Math.abs(Math.min(...feet.map((p) => p.y)))).toBeLessThan(0.002);
        // The actual seated legs extend north under the table, not into the outer lane.
        expect(feet.reduce((sum, p) => sum + p.z - position.z, 0) / feet.length).toBeGreaterThan(
          0.2,
        );
        const head = posedVertices(guest.root, 'head');
        const front = Math.max(...head.map((p) => p.z));
        const noseIndices = head.flatMap((p, i) => (p.z >= front - 0.003 ? [i] : []));
        const faceAngle = () => {
          const points = posedVertices(guest.root, 'head');
          const nose = noseIndices
            .reduce((sum, i) => sum.addInPlace(points[i]!), Vector3.Zero())
            .scale(1 / noseIndices.length);
          const centre = guest.model.socket('head').getAbsolutePosition();
          return Math.atan2(nose.x - centre.x, nose.z - centre.z);
        };
        const forward = faceAngle();
        expect(Math.abs(forward)).toBeLessThan(0.03);
        guest.lookAt(new Vector3(position.x + 1, 1.6, table.z));
        for (let i = 0; i < 40; i++) activity.tick(0.05);
        expect(faceAngle()).toBeGreaterThan(forward + 0.1);
        expect(faceAngle()).toBeLessThan(forward + 0.75);
        expect(guest.root.position.equals(position)).toBe(true);
        activity.settings({ ...DEFAULT_SETTINGS, quality, reducedMotion: true });
        activity.tick(0.05);
        expect(faceAngle()).toBeCloseTo(forward, 2);
        activity.settings({ ...DEFAULT_SETTINGS, quality });
      }
      library.dispose();
      scene.dispose();
    },
  );
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
    expect(Math.abs(pelvis!.y - Math.max(...seat.map((p) => p.y)))).toBeLessThan(0.025);
    expect(Math.abs(Math.min(...feet.map((p) => p.y)))).toBeLessThan(0.002);
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
