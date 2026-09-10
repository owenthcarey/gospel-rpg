import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { transition } from '../../src/game/quest';
import { newGame } from '../../src/game/types';
import {
  CHANNEL_IDS,
  newGalilee,
  REST_ENDINGS,
  REST_SITES,
  REST_SUPPLIES,
  SPRING_ENDINGS,
  type Direction,
} from '../../src/game/galilee/types';
import { ports, traceWater } from '../../src/game/galilee/channel';
import { checkArrangement } from '../../src/game/galilee/arrangement';
import { galileeActions } from '../../src/content/galilee/actions';
import { localGalileePlaces } from '../../src/content/galilee/places';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { galileeAcknowledgement } from '../../src/content/galilee/conversations';
import { galileeContext } from '../../src/ui/views/galilee';
import { practicalActions } from '../../src/content/practical';
import { makeSave, parseSave, parseSettings } from '../../src/persistence/schema';
import { WalkGrid } from '../../src/game/pathfinding';
import { approachPath, clearancePosition } from '../../src/game/navigation';
import { campaignGoal } from '../../src/game/campaign/objectives';
import { at, action, gateway } from '../helpers/campaign';
import { roadStart } from '../helpers/road';
import {
  galileeAction,
  preparedSpring,
  connectSpring,
  chosenShelter,
  arrangedShelter,
} from '../helpers/galilee';

describe('physical channel connections', () => {
  it('exhausts all 256 orientations: only the two connected routes reach basins', () => {
    let north = 0,
      south = 0;
    for (let n = 0; n < 256; n++) {
      const turns = {
        entry: (n % 4) as Direction,
        turn: (Math.floor(n / 4) % 4) as Direction,
        north: (Math.floor(n / 16) % 4) as Direction,
        south: (Math.floor(n / 64) % 4) as Direction,
      };
      const result = traceWater(turns);
      expect(result.path.length).toBeLessThanOrEqual(4);
      expect(new Set(result.path).size).toBe(result.path.length);
      if (result.outlet === 'north') {
        north++;
        expect(turns.entry % 2).toBe(1);
        expect(turns.turn).toBe(3);
        expect(turns.north).toBe(1);
      }
      if (result.outlet === 'south') {
        south++;
        expect(turns.entry % 2).toBe(1);
        expect(turns.turn).toBe(2);
        expect(turns.south).toBe(0);
      }
    }
    expect({ north, south }).toEqual({ north: 8, south: 8 });
  });
  it('reports the first closed port without wetting the disconnected section', () => {
    expect(traceWater(newGalilee().spring.turns)).toMatchObject({ path: [], outlet: null });
    const flow = traceWater({ entry: 1, turn: 3, north: 0, south: 2 });
    expect(flow.path).toEqual(['entry', 'turn']);
    expect(flow.message).toContain('north section');
    expect(ports('entry', 1)).toEqual([1, 3]);
  });
});
describe('spring journeys and interruption', () => {
  for (const outlet of ['north', 'south'] as const)
    for (const ending of SPRING_ENDINGS)
      for (const first of ['inlet', 'silt'] as const)
        it(`keeps ${first} first, ${outlet} water and ${ending} memory through every save`, () => {
          let s = roadStart();
          const old = structuredClone(s);
          for (const id of [
            'spring-start',
            'spring-note-basins',
            'spring-note-source',
            'spring-borrow',
            'spring-clear-' + first,
            'spring-clear-' + (first === 'inlet' ? 'silt' : 'inlet'),
            'spring-return',
          ])
            s = galileeAction(s, id);
          s = galileeAction(s, 'spring-test');
          expect(s.galilee.spring.stage).toBe('working');
          s = connectSpring(s, outlet);
          s = galileeAction(s, 'spring-finish-' + ending);
          expect(s.galilee.spring.stage).toBe('complete');
          expect(traceWater(s.galilee.spring.turns).outlet).toBe(outlet);
          expect(s.episode).toEqual(old.episode);
          expect(s.road.chapter).toEqual(old.road.chapter);
          expect(s.road.company).toEqual(old.road.company);
          expect(s.campaign.walk).toEqual(old.campaign.walk);
          expect(s.campaign.carrying).toBeNull();
          expect(galileeAcknowledgement('tamar', s)).toContain('water');
          const current = at(s, 'channel-turn');
          expect(
            transition(current, {
              type: 'galilee-turn',
              id: 'turn',
              expected: current.galilee.spring.turns.turn,
            }),
          ).toBe(current);
        });
  it('guards unlocks, tool requirements, remote actions and stale rotations', () => {
    const early = newGame();
    expect(transition(early, { type: 'galilee-action', id: 'spring-start' })).toBe(early);
    let s = roadStart();
    expect(transition(s, { type: 'galilee-action', id: 'spring-start' })).toBe(s);
    s = galileeAction(s, 'spring-start');
    expect(transition(s, { type: 'galilee-action', id: 'spring-clear-inlet' })).toBe(s);
    s = at(preparedSpring(), 'channel-turn');
    const event = {
      type: 'galilee-turn' as const,
      id: 'turn' as const,
      expected: s.galilee.spring.turns.turn,
    };
    const next = transition(s, event);
    expect(transition(next, event)).toBe(next);
    expect(transition(s, { type: 'galilee-action', id: 'missing' })).toBe(s);
  });
  it('invalidates a successful test when a connection is changed and preserves optional hints', () => {
    let s = connectSpring();
    s = transition(at(s, 'channel-turn'), { type: 'galilee-turn', id: 'turn', expected: 3 });
    expect(s.galilee.spring).toMatchObject({ stage: 'working', tested: false });
    for (let i = 1; i <= 3; i++) {
      s = transition(s, { type: 'galilee-hint' });
      expect(makeSave(s).state.galilee.spring.hint).toBe(i);
    }
    expect(transition(s, { type: 'galilee-hint' })).toBe(s);
  });
});
describe('resting-place arrangements', () => {
  const orders = [
    ['mat', 'water', 'screen'],
    ['mat', 'screen', 'water'],
    ['water', 'mat', 'screen'],
    ['water', 'screen', 'mat'],
    ['screen', 'mat', 'water'],
    ['screen', 'water', 'mat'],
  ] as const;
  for (const site of REST_SITES)
    for (const order of orders)
      for (const ending of REST_ENDINGS)
        it(`${site} supports ${order.join('/')} and ${ending}`, () => {
          let s = chosenShelter(roadStart(), site);
          for (const id of order) {
            s = galileeAction(s, 'shelter-take-' + id);
            s = galileeAction(s, `shelter-place-${site}-${id}`);
          }
          s = galileeAction(s, 'shelter-check-' + site);
          expect(s.galilee.shelter.stage).toBe('arranging');
          expect(checkArrangement(s.galilee.shelter).message).toContain('southern');
          while (s.galilee.shelter.screen !== 0)
            s = makeSave(
              transition(at(s, 'rest-' + site), {
                type: 'galilee-screen',
                expected: s.galilee.shelter.screen,
              }),
            ).state;
          s = galileeAction(s, 'shelter-check-' + site);
          s = galileeAction(s, 'shelter-finish-' + ending);
          expect(s.galilee.shelter).toMatchObject({ stage: 'complete', site, ending });
          expect(checkArrangement(s.galilee.shelter).ready).toBe(true);
        });
  it('supports recovery, travel, relocation and mixed-story return guidance', () => {
    let s = arrangedShelter();
    for (const id of REST_SUPPLIES) {
      s = galileeAction(s, 'shelter-recover-shade-' + id);
      s = gateway(s, 'farm-exit');
      s = makeSave(s).state;
      s = galileeAction(s, 'shelter-return-' + id);
    }
    s = galileeAction(s, 'shelter-choose-breeze');
    s = arrangedShelter(s, 1);
    expect(s.galilee.shelter.stage).toBe('ready');
  });
  it('never overwrites an object held for an older story', () => {
    let s = chosenShelter();
    s = action(s, 'table-accept');
    s = action(s, 'table-courtyard');
    s = action(s, 'take-jug');
    s = at({ ...s, tracking: 'shelter' }, 'rest-supplies');
    expect(transition(s, { type: 'galilee-action', id: 'shelter-take-mat' })).toBe(s);
    expect(campaignGoal(s)?.target).toBe('farm-exit');
    expect(galileeContext('rest-supplies', s)?.body).toContain('Find the return point');
    const a = practicalActions(s).find((a) => a.id === 'galilee:shelter-take-mat');
    expect(a?.blocker).toContain('hands');
  });
});
describe('v8 validation and regional contracts', () => {
  it('migrates every v1–v7 portable save without changing its prior fields or journal', () => {
    for (const file of readdirSync('tests/fixtures/saves').filter((f) =>
      /^v[1-7]-.*json$/.test(f),
    )) {
      const raw = JSON.parse(readFileSync('tests/fixtures/saves/' + file, 'utf8')),
        before = structuredClone(raw),
        saved = parseSave(raw);
      expect(saved.version).toBe(8);
      expect(saved.state.galilee).toEqual(newGalilee());
      expect(raw).toEqual(before);
      for (const [key, value] of Object.entries(raw.state))
        expect(saved.state[key as keyof typeof saved.state], file + '/' + key).toEqual(value);
    }
  });
  it('keeps historical standing positions valid when new furniture occupies the location', () => {
    for (const position of [
      { x: 4, z: -11 },
      { x: 8, z: -5 },
      { x: 8, z: -9 },
    ]) {
      const raw = { ...makeSave(roadStart()), version: 7 };
      raw.state.position = position;
      expect(parseSave(raw).state.position).toEqual(position);
    }
  });
  it('rejects forged completion, rotations, duplicate/held supplies and journal entries', () => {
    for (const mutate of [
      (s: ReturnType<typeof newGame>) => {
        s.galilee.spring.stage = 'complete';
        s.galilee.spring.ending = 'sharing';
      },
      (s: ReturnType<typeof newGame>) => {
        s.galilee.spring.turns.entry = 9 as Direction;
      },
      (s: ReturnType<typeof newGame>) => {
        s.galilee.shelter.stage = 'ready';
      },
      (s: ReturnType<typeof newGame>) => {
        s.campaign.carrying = 'rest-mat';
      },
      (s: ReturnType<typeof newGame>) => {
        s.journal.push('galilee-shelter-welcome');
      },
    ]) {
      const raw = makeSave(roadStart());
      mutate(raw.state);
      expect(() => parseSave(raw)).toThrow();
    }
    const raw = makeSave(arrangedShelter());
    raw.state.campaign.carrying = 'rest-mat';
    expect(() => parseSave(raw)).toThrow();
    const older = { ...makeSave(chosenShelter()), version: 7 };
    expect(() => parseSave(older)).toThrow();
    expect(parseSettings({ guidance: 'mystery' }).guidance).toBe('full');
    expect(parseSettings({ guidance: 'explore' }).guidance).toBe('explore');
  });
  it('keeps all added destinations reachable in both screen arrangements', () => {
    const states = [
      preparedSpring(),
      ...REST_SITES.flatMap((site) => [
        chosenShelter(roadStart(), site),
        arrangedShelter(chosenShelter(roadStart(), site), 0),
      ]),
    ];
    for (const s of states) {
      const layout = campaignLayout(s.region)!;
      const grid = new WalkGrid(
        layoutObstacles(s),
        layout.terrain,
        layout.bounds.min,
        layout.bounds.max,
      );
      const start = grid.nearest({ x: 0, z: -10 })!;
      for (const place of localGalileePlaces(s))
        expect(approachPath(grid, start, place).length, s.region + '/' + place.id).toBeGreaterThan(
          0,
        );
    }
  });
  it('sidesteps an erected screen while preserving reach and all four site checks', () => {
    for (const site of REST_SITES)
      for (const screen of [0, 1, 2, 3] as const) {
        const s = arrangedShelter(chosenShelter(roadStart(), site), screen);
        const layout = campaignLayout(s.region)!;
        const grid = new WalkGrid(layoutObstacles(s), layout.terrain, -16, 16);
        const anchor = site === 'shade' ? { x: -5, z: -6 } : { x: 8, z: -4 };
        expect(checkArrangement(s.galilee.shelter).ready).toBe(
          site === 'shade' ? screen === 0 || screen === 3 : screen === 0 || screen === 1,
        );
        const standing = { x: anchor.x - 1, z: anchor.z + 2 };
        const point = clearancePosition(grid, standing, anchor);
        expect(grid.walkable(point)).toBe(true);
        expect(Math.hypot(point.x - anchor.x, point.z - anchor.z)).toBeLessThan(2.6);
      }
  });
  it('keeps every action ID unique and every journal event backed by authored content', () => {
    expect(new Set(galileeActions.map((a) => a.id)).size).toBe(galileeActions.length);
    for (const id of CHANNEL_IDS) expect(ports(id, 0)).toHaveLength(2);
  });
});
