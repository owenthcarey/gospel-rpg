import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { newGame } from '../../src/game/types';
import { newHarbor, harborRevision } from '../../src/game/harbor/types';
import { traceHarbor, harborCellBlocked } from '../../src/game/harbor/arrangement';
import { transition } from '../../src/game/quest';
import { makeSave, parseSave } from '../../src/persistence/schema';
import { harborPlace, harborPlaces } from '../../src/content/harbor/places';
import { harborAction, preparedHarbor, clearHarbor } from '../helpers/harbor';
import { harborBlocker, harborJournalIds } from '../../src/game/harbor/progress';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { approachPath } from '../../src/game/navigation';
import { obstacles, isLand, activeInteractables } from '../../src/content/region';
import { stationPose, VILLAGE_STATIONS, stationActive } from '../../src/game/harbor/activity';
import { explorationAssets } from '../../src/content/inventories';
import type { ExplorationRegion } from '../../src/game/campaign/types';
import { campaignGoal } from '../../src/game/campaign/objectives';
import { parseHarbor } from '../../src/persistence/harbor';

describe('working landing', () => {
  it('solves every combination from actual connectivity, with two equal routes', () => {
    for (const plank of ['rack', 'north', 'south'] as const)
      for (const turn of [0, 1] as const)
        for (const cleared of [false, true])
          for (const nets of [false, true])
            for (const jars of [false, true]) {
              const h = { ...newHarbor(), plank, turn, cleared, cargo: { nets, jars } };
              const route =
                cleared && turn === 0 && (plank === 'north' ? nets : plank === 'south' && jars)
                  ? plank
                  : null;
              const result = traceHarbor(h);
              expect(result.route).toBe(route);
              if (route) {
                expect(result.path[0]).toEqual({ x: 0, z: 1 });
                expect(result.path.at(-1)).toEqual({ x: 2, z: 1 });
                result.path.forEach((c, i) => {
                  expect(harborCellBlocked(h, c)).toBe(false);
                  if (i) expect(distance(c, result.path[i - 1]!)).toBe(1);
                });
              }
            }
  });
  it.each(['north', 'south'] as const)(
    'finishes %s with either reflection and survives every interruption',
    (route) => {
      for (const ending of ['patience', 'room']) {
        const before = newGame();
        let s = clearHarbor(route);
        expect(s.harbor.stage).toBe('ready');
        s = harborAction(s, 'remember-' + ending);
        expect(s.harbor.stage).toBe('complete');
        expect(s.harbor.ending).toBe(ending);
        expect(s.journal.filter((id) => id.startsWith('harbor-'))).toEqual(
          harborJournalIds(s.harbor),
        );
        expect(s.episode).toEqual(before.episode);
        expect(s.campaign).toEqual(before.campaign);
        expect(parseSave(makeSave(s)).state).toEqual(s);
        expect(
          transition(s, { type: 'harbor-action', id: 'turn', expected: harborRevision(s.harbor) }),
        ).toBe(s);
      }
    },
  );
  it('reports failed tests, permits changes and invalidates a previously successful test', () => {
    let s = preparedHarbor();
    s = harborAction(s, 'test');
    expect(traceHarbor(s.harbor).message).toContain('rope');
    s = harborAction(s, 'clear');
    s = harborAction(s, 'plank-north');
    s = harborAction(s, 'test');
    expect(traceHarbor(s.harbor).message).toContain('Turn');
    s = harborAction(s, 'turn');
    s = harborAction(s, 'test');
    expect(traceHarbor(s.harbor).message).toContain('net cargo');
    s = harborAction(s, 'cargo-nets');
    s = harborAction(s, 'test');
    expect(s.harbor.stage).toBe('ready');
    s = harborAction(s, 'plank-rack');
    expect(s.harbor.tested).toBe(false);
    expect(s.harbor.stage).toBe('working');
  });
  it('accepts observations in either order and refuses remote, stale, carried or premature actions', () => {
    let s = harborAction(newGame(), 'accept');
    s = harborAction(s, 'observe-passage');
    s = harborAction(s, 'observe-water');
    s.position = { ...harborPlace('harbor-plank')! };
    const event = {
      type: 'harbor-action' as const,
      id: 'turn',
      expected: harborRevision(s.harbor),
    };
    expect(transition(s, { ...event, expected: 'stale' })).toBe(s);
    const changed = transition(s, event);
    expect(changed).not.toBe(s);
    expect(transition(changed, event)).toBe(changed);
    s.position = { x: -15, z: 10 };
    expect(transition(s, event)).toBe(s);
    s.position = { ...harborPlace('harbor-plank')! };
    s.episode.carrying = 'empty-basket';
    expect(harborBlocker(s, 'turn')).toContain('Put down');
    expect(transition(newGame(), event).harbor).toEqual(newHarbor());
    expect(harborBlocker(s, 'invented')).toBeDefined();
  });
  it('offers graduated bounded hints without solving the arrangement', () => {
    let s = preparedHarbor();
    const before = structuredClone(s.harbor);
    for (let i = 0; i < 3; i++) s = harborAction(s, 'hint');
    expect(s.harbor).toEqual({ ...before, hint: 3 });
    expect(transition(s, { type: 'harbor-action', id: 'hint' })).toBe(s);
  });
  it('keeps every shore target reachable around the footprint and preserves the main story default', () => {
    const s = newGame(),
      grid = new WalkGrid(obstacles, isLand);
    expect(s.tracking).toBe('main');
    for (const target of [...activeInteractables(s), ...harborPlaces]) {
      const path = approachPath(grid, s.position, target);
      expect(path.length, target.id).toBeGreaterThan(0);
      expect(distance(path.at(-1)!, target), target.id).toBeLessThan(2.8);
    }
    expect(campaignGoal({ ...s, tracking: 'harbor' })?.target).toBe('eliab');
  });
});
describe('v11 persistence', () => {
  it('rejects arrays that stringify to valid stage or plank names', () => {
    const h = preparedHarbor().harbor;
    for (const change of [{ stage: ['working'] }, { plank: ['north'] }])
      expect(() => parseHarbor({ ...h, ...change })).toThrow();
  });
  it('migrates every historical fixture without changing its existing story records', () => {
    const dir = 'tests/fixtures/saves/';
    for (const file of readdirSync(dir).filter((f) => /^v(?:[1-9]|10)-.*json$/.test(f))) {
      const old = JSON.parse(readFileSync(dir + file, 'utf8')),
        next = parseSave(old);
      expect(next.version).toBe(11);
      expect(next.state.harbor).toEqual(newHarbor());
      for (const key of [
        'episode',
        'campaign',
        'life',
        'road',
        'galilee',
        'lake',
        'connection',
      ] as const)
        if (old.state[key]) expect(next.state[key], file + ':' + key).toEqual(old.state[key]);
      expect(next.state.journal).toEqual(old.state.journal);
    }
  });
  it('rejects forged arrangements, memories, observations, missing data and journal mismatches', () => {
    const s = clearHarbor();
    for (const change of [
      { turn: 1 },
      { notes: ['water', 'water'] },
      { stage: 'complete' },
      { stage: 'working' },
      { cargo: { nets: false, jars: false } },
      { ending: 'invented' },
      { hint: 4 },
    ])
      expect(() => parseHarbor({ ...s.harbor, ...change })).toThrow();
    const save = makeSave(s);
    save.state.journal.push('harbor-room');
    expect(() => parseSave(save)).toThrow();
    const missing = structuredClone(makeSave(s)) as unknown as { state: Record<string, unknown> };
    delete missing.state.harbor;
    expect(() => parseSave(missing)).toThrow();
    expect(() => parseSave({ ...makeSave(s), version: 12 })).toThrow(/newer/);
  });
});
describe('ordinary village activity and budgets', () => {
  it('does not imply work or a gathering was completed before progress is earned', () => {
    for (const station of VILLAGE_STATIONS) {
      const s = newGame();
      s.region = station.region as ExplorationRegion;
      expect(stationActive(station, s)).toBe(station.gate === 'always');
      const still = stationPose(station, 0, true);
      expect(stationPose(station, 123, true)).toEqual(still);
    }
  });
  it('keeps the small water route navigable and returns to the authored station', () => {
    const station = VILLAGE_STATIONS.find((s) => s.id === 'water-tender')!;
    for (let t = 0; t < station.period; t += 0.1) {
      const p = stationPose(station, t, false).position;
      expect(p.x).toBe(station.origin.x);
      expect(p.z).toBeGreaterThanOrEqual(-5.4);
      expect(p.z).toBeLessThanOrEqual(-3);
    }
    expect(stationPose(station, station.period, false).position).toEqual(station.origin);
  });
  it('keeps RFC-009 scenery inventories limited to Capernaum; RFC-010 budgets cover shared re-exports', () => {
    const baseline = JSON.parse(
      readFileSync('docs/verification/rfc009/asset-baseline.json', 'utf8'),
    ) as Record<ExplorationRegion, { assets: string[] }>;
    for (const [id, old] of Object.entries(baseline)) {
      if (!['capernaum', 'capernaum-lanes', 'gathering-house', 'bakehouse'].includes(id))
        expect(explorationAssets(id as ExplorationRegion), id).toEqual(old.assets);
      else
        expect(explorationAssets(id as ExplorationRegion)).toEqual(
          expect.arrayContaining(old.assets),
        );
    }
  });
});
