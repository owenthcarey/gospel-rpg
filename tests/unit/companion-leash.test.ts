import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Actor } from '../../src/scene/actors/actor';
import { AssetLibrary } from '../../src/scene/assets';
import { NeighborhoodActivity } from '../../src/scene/actors/neighborhood';
import { RoadActivity } from '../../src/scene/actors/road';
import { DEFAULT_SETTINGS, type GameState, type Point } from '../../src/game/types';
import { WalkGrid, distance, findPath } from '../../src/game/pathfinding';
import { stepPath } from '../../src/game/navigation';
import { transition } from '../../src/game/quest';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { WALK_ROUTES } from '../../src/content/campaign/places';
import { action, district, gateway } from '../helpers/campaign';
import { roadAction, roadStart } from '../helpers/road';

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
  await library.load(['amos', 'villager', 'bread_basket', 'jug', 'gate', 'handcart'], () => {});
});
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

function earned(route: 'outer' | 'passage' = 'outer') {
  let state = action(action(district(), 'walk-accept'), 'walk-' + route);
  if (route === 'passage') state = action(action(state, 'borrow-handle'), 'open-passage');
  state = action(state, 'walk-start');
  expect(state.campaign.walk.stage).toBe('walking');
  expect(state.campaign.walk.route).toBe(route);
  return state;
}
function gridFor(state: GameState) {
  const layout = campaignLayout(state.region)!;
  return new WalkGrid(layoutObstacles(state), layout.terrain, layout.bounds.min, layout.bounds.max);
}
function fixture(state = earned(), reducedMotion = false, grid = gridFor(state)) {
  const originalRoots = new Set(scene.rootNodes);
  const actor = new Actor(library.instantiate('amos', 'leash-control-' + serial++), true);
  let player = { ...state.position };
  const checkpoints: { actor: Point; player: Point }[] = [];
  const activity = new NeighborhoodActivity(
    library,
    new Map([['amos', actor]]),
    () => grid,
    () => checkpoints.push({ actor: activity.position()!, player: { ...player } }),
    state.region,
  );
  activity.update(state);
  activity.settings({ ...DEFAULT_SETTINGS, reducedMotion });
  const ownedRoots = scene.rootNodes.filter((root) => !originalRoots.has(root));
  return {
    actor,
    activity,
    grid,
    checkpoints,
    tick(point: Point, dt = 0.05) {
      player = { ...point };
      activity.tick(dt, player);
    },
    atGap(gap: number) {
      const p = activity.position()!;
      return { x: p.x + gap, z: p.z };
    },
    snapshot(input = state) {
      const result = structuredClone(input);
      result.campaign.walk.position = activity.position()!;
      return result;
    },
    dispose() {
      activity.dispose();
      actor.dispose();
      ownedRoots.forEach((root) => {
        if (!root.isDisposed()) root.dispose();
      });
    },
  };
}
type Fixture = ReturnType<typeof fixture>;
function wait(f: Fixture) {
  const before = f.activity.position()!;
  f.tick(f.atGap(5));
  expect(f.activity.position()).toEqual(before);
  expect(f.actor.playback.clip).toBe('Idle');
  return before;
}
function moving(f: Fixture, gap: number) {
  const before = f.activity.position()!;
  f.tick(f.atGap(gap));
  expect(distance(before, f.activity.position()!)).toBeGreaterThan(0);
  expect(f.actor.playback.clip).toBe('Walk');
}

it('retains the real route and speed for a fresh escort already inside the outer limit', () => {
  const state = earned(),
    f = fixture(state);
  try {
    const before = f.activity.position()!;
    const target = WALK_ROUTES[state.campaign.walk.route!][state.campaign.walk.step]!;
    const expected = stepPath(before, findPath(f.grid, before, target), 0.05 * 0.52);
    moving(f, 4.9);
    expect(f.activity.position()).toEqual(expected.position);
    expect(state).toEqual(earned());
    expect(f.checkpoints).toEqual([]);
  } finally {
    f.dispose();
  }
});

it('keeps the exact 5 m stop and requires a gap below 4.5 m to restart', () => {
  const f = fixture();
  try {
    const before = wait(f);
    for (const gap of [5.01, 4.99, 4.6, 4.5]) {
      f.tick(f.atGap(gap));
      expect(f.activity.position()).toEqual(before);
      expect(f.actor.playback.clip).toBe('Idle');
    }
    moving(f, 4.49);
    moving(f, 4.99);
    wait(f);
  } finally {
    f.dispose();
  }
});

it('does not alternate clips under repeated crossings of the old single threshold', () => {
  const f = fixture();
  try {
    const before = wait(f);
    for (let i = 0; i < 20; i++) {
      f.tick(f.atGap(i % 2 ? 4.99 : 5.01));
      expect(f.activity.position()).toEqual(before);
      expect(f.actor.playback.clip).toBe('Idle');
    }
    moving(f, 4.49);
  } finally {
    f.dispose();
  }
});

it('retains a wait through ordinary current-position snapshots and settings changes', () => {
  const f = fixture();
  try {
    const before = wait(f);
    const current = f.snapshot();
    for (const reducedMotion of [true, false, true, false]) {
      f.activity.update(current);
      f.activity.settings({ ...DEFAULT_SETTINGS, reducedMotion });
      f.tick(f.atGap(4.9));
      expect(f.activity.position()).toEqual(before);
      expect(f.actor.playback.clip).toBe('Idle');
      expect(current).toEqual(f.snapshot(current));
    }
    moving(f, 4.49);
  } finally {
    f.dispose();
  }
});

it('freezes physical waiting without controller ticks and retains the band after resuming', () => {
  const f = fixture();
  try {
    const before = wait(f),
      pose = f.actor.snapshotPose();
    // This is a controller no-tick control. Actual World.setPaused ordering remains
    // a separate existing World regression/native gate, not inferred here.
    f.activity.settings(DEFAULT_SETTINGS);
    f.activity.update(f.snapshot());
    expect(f.activity.position()).toEqual(before);
    expect(f.actor.snapshotPose()).toEqual(pose);
    f.tick(f.atGap(4.9));
    expect(f.activity.position()).toEqual(before);
    moving(f, 4.49);
  } finally {
    f.dispose();
  }
});

it('starts a fresh interval after a real saved-position restoration', () => {
  const saved = earned(),
    f = fixture(saved);
  try {
    moving(f, 0);
    wait(f);
    expect(f.activity.position()).not.toEqual(saved.campaign.walk.position);
    f.activity.update(saved);
    expect(f.activity.position()).toEqual(saved.campaign.walk.position);
    moving(f, 4.9);
    const loaded = fixture(saved);
    try {
      moving(loaded, 4.9);
    } finally {
      loaded.dispose();
    }
  } finally {
    f.dispose();
  }
});

it.each([false, true] as const)(
  'keeps the physical wait history through a zero-time tick with waiting %s',
  (waiting) => {
    const f = fixture();
    try {
      if (waiting) wait(f);
      const before = f.activity.position()!,
        pose = f.actor.snapshotPose(),
        saved = f.snapshot();
      f.tick(f.atGap(waiting ? 4.49 : 5), 0);
      expect(f.activity.position()).toEqual(before);
      expect(f.actor.snapshotPose()).toEqual(pose);
      expect(f.snapshot()).toEqual(saved);
      if (waiting) {
        f.tick(f.atGap(4.9));
        expect(f.activity.position()).toEqual(before);
        expect(f.actor.playback.clip).toBe('Idle');
        moving(f, 4.49);
      } else moving(f, 4.9);
    } finally {
      f.dispose();
    }
  },
);

it.each(['outer', 'passage'] as const)(
  'keeps legal %s route checkpoints and complete reducer state',
  (route) => {
    let state = earned(route);
    const f = fixture(state);
    try {
      while (state.campaign.walk.stage === 'walking') {
        const step = state.campaign.walk.step;
        const target = WALK_ROUTES[route][step]!;
        let ticks = 0;
        while (distance(f.activity.position()!, target) > 0.25 && ticks++ < 1200)
          f.tick(f.activity.position()!);
        expect(ticks).toBeLessThan(1200);
        f.tick(target);
        expect(f.checkpoints).toHaveLength(step + 1);
        expect(distance(f.checkpoints[step]!.actor, target)).toBeLessThanOrEqual(1.2);
        expect(distance(f.checkpoints[step]!.player, target)).toBeLessThanOrEqual(2.6);
        const before = f.snapshot(state);
        before.position = { ...target };
        const expected = transition(before, { type: 'walk-step' });
        expect(expected.campaign.walk.step).toBe(step + 1);
        // Enter waiting before the real step change: the new step must restart even
        // if the physical player comes back only into the old 5 m band.
        wait(f);
        state = expected;
        const saved = structuredClone(state);
        f.activity.update(state);
        expect(state).toEqual(saved);
        if (state.campaign.walk.stage === 'walking') moving(f, 4.9);
      }
      expect(state.campaign.walk.stage).toBe('arrived');
      const before = f.activity.position()!;
      f.tick(before);
      expect(f.actor.playback.clip).toBe('Idle');
      expect(f.activity.position()).toEqual(before);
    } finally {
      f.dispose();
    }
  },
);

it('makes the same physical wait/restart decisions with reduced motion and holds Walk frame 0', () => {
  const state = earned(),
    normal = fixture(state),
    reduced = fixture(state, true);
  try {
    for (const gap of [4.9, 5, 4.99, 4.5, 4.49, 4.99, 5]) {
      normal.tick(normal.atGap(gap));
      reduced.tick(reduced.atGap(gap));
      expect(reduced.activity.position()).toEqual(normal.activity.position());
      expect(reduced.actor.playback.clip).toBe(normal.actor.playback.clip);
      expect(reduced.actor.playback.frame).toBe(0);
      expect(reduced.checkpoints).toEqual(normal.checkpoints);
    }
  } finally {
    normal.dispose();
    reduced.dispose();
  }
});

it('does not fabricate a route or a walk when the destination is unreachable', () => {
  const f = fixture(earned(), false, new WalkGrid([], () => false));
  try {
    const before = f.activity.position()!;
    f.tick(f.atGap(0));
    expect(f.activity.position()).toEqual(before);
    expect(f.actor.playback.clip).toBe('Idle');
    expect(f.checkpoints).toEqual([]);
  } finally {
    f.dispose();
  }
});

it('never revives movement from nonfinite player coordinates or crosses a stage exclusion', () => {
  const f = fixture();
  try {
    const before = f.activity.position()!;
    for (const player of [
      { x: NaN, z: 0 },
      { x: Infinity, z: 0 },
    ]) {
      f.tick(player);
      expect(f.activity.position()).toEqual(before);
      expect(f.actor.playback.clip).toBe('Idle');
      expect(f.checkpoints).toEqual([]);
    }
  } finally {
    f.dispose();
  }
  const invited = fixture(action(district(), 'walk-accept'));
  try {
    const before = invited.activity.position()!;
    invited.tick(before);
    expect(invited.activity.position()).toEqual(before);
    expect(invited.actor.playback.clip).toBe('Idle');
    expect(invited.checkpoints).toEqual([]);
  } finally {
    invited.dispose();
  }
});

it('leaves Road Neri’s existing range and explicit approach stop unchanged', () => {
  const state = roadAction(
    transition(roadAction(gateway(roadStart(), 'to-farm'), 'company-accept'), {
      type: 'road-route',
      id: 'terrace',
    }),
    'company-start',
  );
  expect(state.road.company).toMatchObject({
    stage: 'walking',
    route: 'terrace',
    region: 'roadside-farm',
  });
  const grid = gridFor(state);
  const road = new RoadActivity(
    library,
    'roadside-farm',
    () => grid,
    () => {},
  );
  road.update(state);
  road.settings(DEFAULT_SETTINGS);
  const actor = road.conversationActor;
  try {
    const before = road.position()!;
    road.tick(0.05, { x: before.x + 5, z: before.z });
    expect(road.position()).toEqual(before);
    road.tick(0.05, { x: before.x + 4.99, z: before.z });
    expect(distance(road.position()!, before)).toBeGreaterThan(0);
    const after = road.position()!;
    road.tick(0.05, after, true);
    expect(road.position()).toEqual(after);
    expect(actor.playback.clip).toBe('Idle');
  } finally {
    actor.dispose();
  }
});
