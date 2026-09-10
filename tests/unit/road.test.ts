import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { transition } from '../../src/game/quest';
import { newGame } from '../../src/game/types';
import {
  COMPANY_ROUTES,
  NAIN_REFLECTIONS,
  NAIN_SCENES,
  TRAIL_ENDINGS,
  newRoad,
} from '../../src/game/road/types';
import { COMPANY_PATHS, companyMeeting } from '../../src/content/road/routes';
import { nainBeats } from '../../src/content/road/scenes';
import { nainVerses } from '../../src/content/road/scripture';
import { roadJournal } from '../../src/content/road/journal';
import { roadJournalIds } from '../../src/game/road/progress';
import { roadStart, roadAction, roadAt, completedRoof } from '../helpers/road';
import { gateway, district } from '../helpers/campaign';
import { makeSave, parseSave } from '../../src/persistence/schema';
import { roadLayouts } from '../../src/content/road/layouts';
import { roadGateways, roadPlaces } from '../../src/content/road/places';
import { groundHeight } from '../../src/content/campaign/layouts';
import { WalkGrid, distance, findPath } from '../../src/game/pathfinding';
import { approachPath } from '../../src/game/navigation';
import { localTarget } from '../../src/game/campaign/objectives';

describe('Road unlock and durable investigation', () => {
  it('migrates every v1–v6 fixture without changing any existing state field or earned memory', () => {
    for (const name of readdirSync('tests/fixtures/saves').filter((name) =>
      /^v[1-6]-.*\.json$/.test(name),
    )) {
      const raw = JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'));
      const before = structuredClone(raw);
      const migrated = parseSave(raw);
      expect(raw, name).toEqual(before);
      expect(migrated.state.road, name).toEqual(newRoad());
      for (const [key, value] of Object.entries(raw.state))
        expect(migrated.state[key as keyof typeof migrated.state], name + '/' + key).toEqual(value);
    }
  });
  it('requires the completed roof reflection, leaves earlier stories intact and starts v7 empty', () => {
    expect(newGame().road).toEqual(newRoad());
    expect(gateway(district(), 'to-road').region).toBe('capernaum-lanes');
    const before = completedRoof(),
      after = gateway(before, 'to-road');
    expect(after.region).toBe('galilean-road');
    expect(after.road.chapter.stage).toBe('exploring');
    expect(after.episode).toEqual(before.episode);
    expect(after.campaign.roof).toEqual(before.campaign.roof);
    expect(makeSave(after).version).toBe(8);
    expect(gateway(after, 'road-to-lanes').region).toBe('capernaum-lanes');
  });
  for (const order of [
    ['spring', 'terrace'],
    ['terrace', 'spring'],
  ] as const)
    for (const ending of TRAIL_ENDINGS)
      it(`remembers evidence in ${order.join('/')} order and the ${ending} ending`, () => {
        let s = roadAction(roadStart(), 'trail-accept');
        expect(transition(s, { type: 'road-interpret', id: 'shelter' })).toBe(s);
        for (const id of order) {
          s = transition(roadAt(s, 'road-' + id), { type: 'road-evidence', id });
          s = makeSave(s).state;
          const atMarker = roadAt(s, 'road-' + id);
          expect(transition(atMarker, { type: 'road-evidence', id })).toBe(atMarker);
        }
        for (const id of ['ridge', 'spring'] as const) {
          s = transition(roadAt(s, 'tamar'), { type: 'road-interpret', id });
          expect(s.road.trail.stage).toBe('exploring');
          expect(makeSave(s).state.road.trail.evidence).toEqual([...order]);
        }
        for (let i = 1; i <= 3; i++) {
          s = transition(s, { type: 'road-hint' });
          expect(s.road.trail.hint).toBe(i);
        }
        expect(transition(s, { type: 'road-hint' })).toBe(s);
        s = transition(s, { type: 'road-interpret', id: 'shelter' });
        s = gateway(s, 'to-farm');
        s = roadAction(s, 'trail-arrive');
        s = gateway(s, 'farm-exit');
        s = transition(roadAt(s, 'tamar'), { type: 'road-ending', id: ending });
        expect(s.road.trail.stage).toBe('complete');
        expect(makeSave(s).state.road.trail.ending).toBe(ending);
        expect(s.road.chapter.stage).toBe('exploring');
        expect(s.journal).toContain('trail-ending-' + ending);
      });
  it('rejects remote actions and unknown event IDs', () => {
    const s = roadStart();
    expect(transition(s, { type: 'road-action', id: 'trail-accept' })).toBe(s);
    expect(transition(s, { type: 'road-action', id: 'unknown' } as never)).toBe(s);
    expect(transition(s, { type: 'nain-next', checkpoint: 'wonder' })).toBe(s);
  });
});

describe('A companion across region boundaries', () => {
  for (const route of COMPANY_ROUTES)
    it(`walks the ${route} route, saves actual position, and only crosses together`, () => {
      let s = roadAction(gateway(roadStart(), 'to-farm'), 'company-accept');
      s = transition(s, { type: 'road-route', id: route });
      s = roadAction(s, 'company-start');
      const length = COMPANY_PATHS[route].length;
      while (s.road.company.stage === 'walking') {
        const node = companyMeeting(s.road.company)!;
        const before = structuredClone(s.road.company);
        if (node.exit) {
          // Being at the exit without the companion cannot bring him through.
          s.road.company.position = { x: node.x + 4, z: node.z };
          const alone = gateway(s, node.exit);
          expect(alone.road.company.region).toBe(node.region);
          expect(alone.road.company.step).toBe(before.step);
          s.road.company.position = { x: node.x, z: node.z };
          s = gateway(s, node.exit);
          expect(s.road.company.region).toBe(s.region);
          expect(s.position).toEqual(s.road.company.position);
        } else {
          s.position = { x: node.x, z: node.z };
          expect(transition(s, { type: 'road-step', step: s.road.company.step + 1 })).toBe(s);
          s.road.company.position = { ...s.position };
          s = transition(s, { type: 'road-step', step: s.road.company.step });
        }
        s = makeSave(s).state;
      }
      expect(s.road.company.step).toBe(length);
      s = roadAction(s, 'company-finish');
      expect(makeSave(s).state.road.company.stage).toBe('complete');
      expect(s.journal).toContain('company-route-' + route);
      expect(gateway(s, 'nain-exit').road.company).toEqual(s.road.company);
    });
  it('guides a traveler back to the independently saved companion', () => {
    let s = roadAction(gateway(roadStart(), 'to-farm'), 'company-accept');
    s = gateway(s, 'farm-exit');
    expect(localTarget(s, 'neri')).toBe('to-farm');
    s = gateway(s, 'road-to-lanes');
    expect(localTarget(s, 'neri')).toBe('to-road');
    expect(makeSave(s).state.road.company.region).toBe('roadside-farm');
  });
});

describe('At the gate', () => {
  for (const reflection of NAIN_REFLECTIONS)
    it(`supports every checkpoint, leave/resume and the ${reflection} reflection independently`, () => {
      let s = roadAction(gateway(roadStart(), 'to-nain'), 'nain-enter');
      for (const checkpoint of NAIN_SCENES) {
        expect(s.road.chapter.checkpoint).toBe(checkpoint);
        const paused = makeSave(s).state;
        s = transition(s, { type: 'nain-leave' });
        expect(s.region).toBe('nain-gate');
        s = roadAction(s, 'nain-enter');
        expect(s.road.chapter).toEqual(paused.road.chapter);
        s = transition(s, { type: 'nain-next', checkpoint });
      }
      expect(s.road.chapter.stage).toBe('aftermath');
      expect(transition(s, { type: 'nain-reflect', id: reflection })).toBe(s);
      for (const id of ['nain-after-courtyard', 'nain-after-neighbor', 'nain-after-gate'] as const)
        s = roadAction(s, id);
      s = transition(roadAt(s, 'nain-viewpoint'), { type: 'nain-reflect', id: reflection });
      expect(makeSave(s).state.road.chapter.stage).toBe('complete');
      expect(s.road.trail.stage).toBe('not-started');
      expect(s.road.company.stage).toBe('not-started');
      expect(roadJournalIds(s.road).every((id) => roadJournal[id])).toBe(true);
    });
  it('makes the whole source available and guards stale summary requests', () => {
    expect(new Set(nainBeats.flatMap((b) => b.verses))).toEqual(new Set(Object.keys(nainVerses)));
    let s = roadAction(gateway(roadStart(), 'to-nain'), 'nain-enter');
    expect(transition(s, { type: 'nain-summary', checkpoint: 'wonder' })).toBe(s);
    s = transition(s, { type: 'nain-summary', checkpoint: 'approach' });
    expect(s.journal.filter((id) => id.startsWith('nain-scene-'))).toHaveLength(6);
    expect(makeSave(s).state.road.chapter.stage).toBe('aftermath');
  });
});

describe('Road save validation and terrain', () => {
  it('migrates v6 with no invented progress', () => {
    const legacy = { ...makeSave(completedRoof()), version: 6 };
    const s = parseSave(legacy).state;
    expect(s.road).toEqual(newRoad());
    expect(s.journal).toEqual(legacy.state.journal);
  });
  it.each([
    (s: ReturnType<typeof roadStart>) => {
      s.road.visited = {};
    },
    (s: ReturnType<typeof roadStart>) => {
      s.road.trail.stage = 'complete';
    },
    (s: ReturnType<typeof roadStart>) => {
      s.road.company.region = 'nain-gate';
    },
    (s: ReturnType<typeof roadStart>) => {
      s.road.company.position.x = Infinity;
    },
    (s: ReturnType<typeof roadStart>) => {
      s.road.trail.hint = 4 as never;
    },
    (s: ReturnType<typeof roadStart>) => {
      s.road.chapter.checkpoint = 'command';
    },
    (s: ReturnType<typeof roadStart>) => {
      s.position = { x: -5, z: 1 };
    },
    (s: ReturnType<typeof roadStart>) => {
      s.road.visited['roadside-farm'] = { x: 15, z: 15 };
    },
    (s: ReturnType<typeof roadStart>) => {
      s.journal.push('company-complete');
    },
    (s: ReturnType<typeof roadStart>) => {
      s.campaign.visited['nain-gate'] = { x: 0, z: -9 };
    },
  ])('rejects inconsistent progress and unreachable imported positions %#', (mutate) => {
    const save = makeSave(roadStart());
    mutate(save.state);
    expect(() => parseSave(save)).toThrow();
  });
  for (const [region, layout] of Object.entries(roadLayouts))
    it(`connects every ${region} destination and meeting point with bounded slopes`, () => {
      const grid = new WalkGrid(layout.obstacles, layout.terrain, -16, 16),
        start = { x: 0, z: -9 };
      for (const p of [
        ...roadPlaces[region as keyof typeof roadPlaces],
        ...roadGateways.filter((g) => g.from === region),
      ]) {
        const route = approachPath(grid, start, p);
        expect(route.length, p.id).toBeGreaterThan(0);
        expect(distance(route[route.length - 1]!, p), p.id).toBeLessThan(2.8);
      }
      for (const p of Object.values(COMPANY_PATHS)
        .flat()
        .filter((p) => p.region === region)) {
        expect(grid.walkable(p), p.name).toBe(true);
        expect(findPath(grid, start, p).length, p.name).toBeGreaterThan(0);
      }
      for (let x = -13; x <= 13; x++)
        for (let z = -13; z <= 13; z++) {
          const h = groundHeight(region, { x, z });
          expect(Number.isFinite(h)).toBe(true);
          expect(Math.abs(h - groundHeight(region, { x: x + 1, z }))).toBeLessThan(0.2);
          expect(Math.abs(h - groundHeight(region, { x, z: z + 1 }))).toBeLessThan(0.2);
        }
    });
});
