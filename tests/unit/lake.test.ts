import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { transition } from '../../src/game/quest';
import { newGame, type GameState } from '../../src/game/types';
import {
  newLake,
  BERTHS,
  LAKE_REGIONS,
  LAKE_ENDINGS,
  STORM_SCENES,
  STORM_REFLECTIONS,
} from '../../src/game/lake/types';
import {
  LANDINGS,
  normalizeHeading,
  WATER_OBSTACLES,
  waterGrid,
  waterPosition,
} from '../../src/game/lake/navigation';
import { lakeGateways, lakePlaces, localLakePlaces } from '../../src/content/lake/places';
import { lakeJournalIds } from '../../src/game/lake/progress';
import { lakeJournal } from '../../src/content/lake/journal';
import { lakeLayouts } from '../../src/content/lake/layouts';
import { stormBeats } from '../../src/content/lake/scenes';
import { stormVerses } from '../../src/content/lake/scripture';
import { explorationAssets } from '../../src/content/inventories';
import { STORM_ASSETS } from '../../src/scene/regions/storm';
import { lakeGoal } from '../../src/game/lake/objectives';
import { localTarget } from '../../src/game/campaign/objectives';
import { nextGateway } from '../../src/content/campaign/places';
import { makeSave, parseSave } from '../../src/persistence/schema';
import { reachableLakePosition } from '../../src/persistence/lake';
import { distance, WalkGrid } from '../../src/game/pathfinding';
import { approachPath } from '../../src/game/navigation';
import {
  lakeStart,
  lakeAt,
  lakeAction,
  sail,
  dock,
  coveStart,
  stormStart,
  stormAftermath,
  crossingInterpreted,
  completedNain,
} from '../helpers/lake';
import { roadStart } from '../helpers/road';
import { chosenShelter, galileeAction } from '../helpers/galilee';
import { accountFor } from '../../src/game/presentation';
import { trackedChapter } from '../../src/content/campaign/chapters';

describe('Lake unlock, boating and geographic continuity', () => {
  it('opens only after the Nain reflection, preserving the earlier three chapters', () => {
    const locked = newGame();
    expect(localLakePlaces(locked)).toEqual([]);
    expect(transition(locked, { type: 'lake-action', id: 'accept' })).toBe(locked);
    const before = lakeStart(),
      after = sail(before);
    expect(before.lake).toEqual(newLake());
    expect(trackedChapter(before).id).toBe('storm');
    expect(lakeGoal(before)?.title).toBe(trackedChapter(before).title);
    expect(after.region).toBe('galilee-water');
    expect(after.lake.boat).toMatchObject({
      mode: 'afloat',
      berth: null,
      position: LANDINGS.capernaum.water,
    });
    expect(after.lake.chapter.stage).toBe('exploring');
    for (const key of ['episode', 'road', 'galilee'] as const)
      expect(after[key]).toEqual(before[key]);
    expect(makeSave(after).state.lake).toEqual(after.lake);
    const early = {
      ...roadStart(),
      region: 'capernaum' as const,
      position: LANDINGS.capernaum.land,
    };
    expect(transition(early, { type: 'journey', gateway: 'board-capernaum' })).toBe(early);
  });
  it('requires a nearby landing and keeps an independently docked boat through every return', () => {
    let s = sail();
    expect(transition(s, { type: 'journey', gateway: 'dock-sheltered-cove' })).toBe(s);
    for (const berth of BERTHS) {
      s = dock(s, berth);
      expect(s.region).toBe(berth);
      expect(s.lake.boat).toMatchObject({ mode: 'ashore', berth, position: LANDINGS[berth].water });
      expect(makeSave(s).state.lake).toEqual(s.lake);
      s = sail(s);
      expect(s.position).toEqual(LANDINGS[berth].water);
    }
    expect(Object.keys(s.lake.visited).sort()).toEqual([...LAKE_REGIONS].sort());
  });
  it('preserves a fractional afloat position and normalized heading with no saved movement command', () => {
    const s = sail();
    s.position = { x: -10.25, z: -8.125 };
    s.lake.boat.position = { ...s.position };
    s.lake.boat.heading = normalizeHeading(-1.125);
    const restored = parseSave(JSON.parse(JSON.stringify(makeSave(s)))).state;
    expect(restored.position).toEqual(s.position);
    expect(restored.lake.boat.heading).toBe(s.lake.boat.heading);
    expect(Object.keys(restored.lake.boat).sort()).toEqual([
      'berth',
      'heading',
      'mode',
      'position',
    ]);
  });
  it('routes back through the right boarding and docking points from every shore', () => {
    expect(nextGateway('sheltered-cove', 'capernaum')).toBe('board-sheltered-cove');
    expect(nextGateway('galilee-water', 'nain-gate')).toBe('dock-capernaum');
    expect(nextGateway('reed-landing', 'sheltered-cove')).toBe('board-reed-landing');
    expect(localTarget(lakeStart(), lakeGoal({ ...lakeStart(), tracking: 'storm' })!.target)).toBe(
      'board-capernaum',
    );
    const reed = dock(sail(), 'reed-landing');
    expect(localTarget(reed, lakeGoal({ ...reed, tracking: 'storm' })!.target)).toBe(
      'board-reed-landing',
    );
  });
});

describe('A sheltered way is optional, persistent and recoverable', () => {
  for (const order of [
    ['reeds', 'split-rock'],
    ['split-rock', 'reeds'],
  ])
    for (const ending of LAKE_ENDINGS)
      it(`supports ${order.join('/')} evidence and the ${ending} ending`, () => {
        let s = lakeAction(lakeStart(), 'accept', 'joel');
        expect(transition(s, { type: 'lake-interpret', id: 'sheltered' })).toBe(s);
        s = sail(s);
        for (const id of order) {
          s = lakeAction(s, 'evidence-' + id, 'lake-' + id);
          s = makeSave(s).state;
          const again = lakeAt(s, 'lake-' + id);
          expect(transition(again, { type: 'lake-action', id: 'evidence-' + id })).toBe(again);
        }
        for (const id of ['exposed', 'island'] as const) {
          s = transition(s, { type: 'lake-interpret', id });
          expect(s.lake.trail.stage).toBe('exploring');
          expect(makeSave(s).state.lake.trail.interpretation).toBe(id);
        }
        for (let hint = 1; hint <= 3; hint++) {
          s = transition(s, { type: 'lake-hint' });
          expect(s.lake.trail.hint).toBe(hint);
        }
        expect(transition(s, { type: 'lake-hint' })).toBe(s);
        s = transition(s, { type: 'lake-interpret', id: 'sheltered' });
        s = lakeAction(dock(s, 'sheltered-cove'), 'arrive', 'cove-shore');
        expect(transition(s, { type: 'lake-ending', id: ending })).toBe(s);
        s = transition(lakeAt(dock(sail(s), 'capernaum'), 'joel'), {
          type: 'lake-ending',
          id: ending,
        });
        expect(makeSave(s).state.lake.trail).toMatchObject({
          stage: 'complete',
          ending,
          evidence: order,
          hint: 3,
        });
        expect(s.lake.chapter.stage).toBe('exploring');
        expect(lakeJournalIds(s.lake).every((id) => lakeJournal[id])).toBe(true);
      });
  it('rejects remote/unknown actions and permits either shore before accepting Joel’s story', () => {
    let s = sail();
    expect(transition(s, { type: 'lake-action', id: 'evidence-reeds' })).toBe(s);
    expect(transition(s, { type: 'lake-action', id: 'unknown' })).toBe(s);
    s = lakeAction(dock(s, 'reed-landing'), 'reed-shore', 'reed-shore');
    s = lakeAction(dock(sail(s), 'sheltered-cove'), 'cove-shore', 'cove-shore');
    expect(makeSave(s).state.lake.notes).toEqual(['reed-shore', 'cove-shore']);
    expect(s.lake.trail.stage).toBe('not-started');
  });
});

describe('Peace, be still is a separate complete Gospel account', () => {
  for (const reflection of STORM_REFLECTIONS)
    it(`restores every checkpoint, leaves/resumes and earns ${reflection} without the optional story`, () => {
      let s = stormStart();
      const boat = structuredClone(s.lake.boat);
      for (const checkpoint of STORM_SCENES) {
        expect(s.lake.chapter.checkpoint).toBe(checkpoint);
        const paused = makeSave(s).state;
        expect(transition(s, { type: 'storm-next', checkpoint: 'stale' } as never)).toBe(s);
        s = transition(s, { type: 'storm-leave' });
        expect(s.region).toBe('sheltered-cove');
        s = stormStart(s);
        expect(s.lake.chapter).toEqual(paused.lake.chapter);
        s = transition(s, { type: 'storm-next', checkpoint });
      }
      expect(s.region).toBe('sheltered-cove');
      expect(s.lake.boat).toEqual(boat);
      expect(transition(s, { type: 'storm-reflect', id: reflection })).toBe(s);
      for (const [id, target] of [
        ['landing', 'cove-shore'],
        ['lookout', 'cove-lookout'],
        ['neighbor', 'dalia'],
      ] as const)
        s = lakeAction(s, 'after-' + id, target);
      s = transition(lakeAt(s, 'storm-viewpoint'), { type: 'storm-reflect', id: reflection });
      expect(makeSave(s).state.lake.chapter).toMatchObject({ stage: 'complete', reflection });
      expect(s.lake.trail.stage).toBe('not-started');
      expect(lakeJournalIds(s.lake).every((id) => lakeJournal[id])).toBe(true);
    });
  it('includes every verse, preserves the account in the summary, and prioritizes the actual presentation', () => {
    expect(stormBeats.map((b) => b.verse)).toEqual([
      '4:35',
      '4:36',
      '4:37',
      '4:38',
      '4:39',
      '4:40',
      '4:41',
    ]);
    expect(new Set(stormBeats.map((b) => b.verse))).toEqual(new Set(Object.keys(stormVerses)));
    const s = stormStart();
    expect(transition(s, { type: 'storm-summary', checkpoint: 'question' })).toBe(s);
    const after = transition(s, { type: 'storm-summary', checkpoint: 'evening' });
    expect(after.journal.filter((id) => id.startsWith('storm-scene-'))).toHaveLength(7);
    expect(makeSave(after).state.lake.chapter.stage).toBe('aftermath');
    expect(accountFor({ ...s, region: 'nain-account' })).toBe('nain');
    expect(accountFor({ ...s, region: 'roof-account' })).toBe('roof');
  });
  it('keeps a held farm supply and waiting road companion untouched throughout the crossing and account', () => {
    const waiting = parseSave(
      JSON.parse(readFileSync('tests/fixtures/saves/v7-companion-waiting.json', 'utf8')),
    ).state;
    const carried = galileeAction(chosenShelter(waiting), 'shelter-take-screen');
    const s = stormAftermath(stormStart(coveStart(lakeStart(completedNain(carried)))));
    const restored = makeSave(s).state;
    expect(restored.campaign.carrying).toBe('rest-screen');
    expect(restored.road.company).toEqual(waiting.road.company);
    expect(restored.galilee).toEqual(carried.galilee);
  });
});

describe('v9 imports and navigation contracts', () => {
  it('migrates every v1–v8 fixture without changing a prior state field or earned journal entry', () => {
    for (const name of readdirSync('tests/fixtures/saves').filter((n) =>
      /^v[1-8]-.*\.json$/.test(n),
    )) {
      const raw = JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8'));
      const original = structuredClone(raw),
        saved = parseSave(raw);
      expect(raw, name).toEqual(original);
      expect(saved.version).toBe(10);
      expect(saved.state.lake, name).toEqual(newLake());
      for (const [key, value] of Object.entries(raw.state))
        expect(saved.state[key as keyof GameState], name + '/' + key).toEqual(value);
    }
  });
  it('accepts reordered JSON keys and strips unknown lake fields', () => {
    const s = makeSave(newGame());
    s.state.lake = Object.fromEntries(
      Object.entries(s.state.lake).reverse(),
    ) as typeof s.state.lake;
    Object.assign(s.state.lake, { ignored: 'untrusted' });
    expect(parseSave(s).state.lake).toEqual(newLake());
  });
  it.each([
    (s: GameState) => {
      s.lake.boat.berth = 'capernaum';
    },
    (s: GameState) => {
      s.lake.boat.heading = Infinity;
    },
    (s: GameState) => {
      s.lake.boat.heading = Math.PI * 2;
    },
    (s: GameState) => {
      s.lake.boat.position.x += 1;
    },
    (s: GameState) => {
      s.position = s.lake.boat.position = { x: -5, z: 3 };
    },
    (s: GameState) => {
      s.lake.visited = {};
    },
    (s: GameState) => {
      s.lake.trail.stage = 'complete';
    },
    (s: GameState) => {
      s.lake.trail.hint = 4;
    },
    (s: GameState) => {
      s.lake.trail.evidence = ['reeds', 'reeds'];
    },
    (s: GameState) => {
      s.lake.chapter.checkpoint = 'command';
    },
    (s: GameState) => {
      s.lake.chapter.aftermath = ['neighbor'];
    },
    (s: GameState) => {
      s.lake.notes = ['cove-shore'];
    },
    (s: GameState) => {
      s.campaign.visited['galilee-water'] = { ...s.position };
    },
    (s: GameState) => {
      s.journal.push('storm-complete');
    },
    (s: GameState) => {
      s.journal = s.journal.filter((id) => id !== 'storm-invitation');
    },
    (s: GameState) => {
      s.lake.visited['reed-landing'] = { x: -5, z: 7 };
    },
  ])('rejects forged or unreachable lake progress %#', (mutate) => {
    const save = makeSave(sail());
    mutate(save.state);
    expect(() => parseSave(save)).toThrow();
  });
  it('rejects misplaced shore travelers, boat berths, and forged legacy lake progress', () => {
    for (const change of [
      (s: GameState) => {
        s.position = { x: 11, z: -2 };
      },
      (s: GameState) => {
        s.lake.boat.berth = 'reed-landing';
      },
    ]) {
      const save = makeSave(coveStart());
      change(save.state);
      expect(() => parseSave(save)).toThrow();
    }
    const legacy = { ...makeSave(coveStart()), version: 8 };
    expect(() => parseSave(legacy)).toThrow();
  });
  for (const region of LAKE_REGIONS)
    it(`connects every ${region} landmark and landing with legal clear routes`, () => {
      const layout = lakeLayouts[region],
        grid = new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max);
      const start = region === 'galilee-water' ? LANDINGS.capernaum.water : { x: 0, z: -6 };
      for (const p of [...lakePlaces[region], ...lakeGateways.filter((g) => g.from === region)]) {
        const route = approachPath(grid, start, p);
        expect(route.length, p.id).toBeGreaterThan(0);
        expect(distance(route.at(-1)!, p), p.id).toBeLessThan(2.8);
        for (const point of route) expect(reachableLakePosition(region, point), p.id).toBe(true);
      }
    });
  it('keeps all landing routes outside rocks and limits each new region’s model payload', () => {
    for (const obstacle of WATER_OBSTACLES) expect(waterGrid().walkable(obstacle)).toBe(false);
    for (const p of Object.values(LANDINGS)) expect(waterPosition(p.water)).toBe(true);
    for (const list of [...LAKE_REGIONS.map(explorationAssets), STORM_ASSETS]) {
      const bytes = list.reduce(
        (sum, id) => sum + statSync('public/assets/models/' + id + '.glb').size,
        0,
      );
      expect(bytes).toBeLessThanOrEqual(2.5 * 1024 * 1024);
    }
    expect(makeSave(crossingInterpreted()).state.lake.trail.stage).toBe('interpreted');
  });
});
