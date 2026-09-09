import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { returnedShore } from '../helpers/journey';
import { action, at, completedEpisode, district, gateway } from '../helpers/campaign';
import { transition } from '../../src/game/quest';
import { newGame, type GameState } from '../../src/game/types';
import { lifeActions } from '../../src/content/life/actions';
import {
  actionAllowed,
  actionBlocker,
  actionMotion,
  worldAction,
} from '../../src/content/campaign/actions';
import { lifeJournalIds } from '../../src/game/life/progress';
import { lifePlaces, BENCH_FOOTPRINT } from '../../src/content/life/places';
import { newLife } from '../../src/game/life/types';
import { makeSave, parseSave, importSave, SAVE_VERSION } from '../../src/persistence/schema';
import { campaignGoal } from '../../src/game/campaign/objectives';
import { heldItems, heldReturn } from '../../src/game/life/objectives';
import { lifePresentation } from '../../src/content/life/presentation';
import { lifeJournal } from '../../src/content/life/journal';
import { explorationAssets } from '../../src/content/inventories';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { obstacles, isLand } from '../../src/content/region';
import { WalkGrid, distance } from '../../src/game/pathfinding';
import { approachPath } from '../../src/game/navigation';
import { contextView } from '../../src/ui/views/campaign';
import {
  memoryEntries,
  journalPeople,
  journalPlaces,
  threadEvidence,
} from '../../src/ui/views/journal';
import { nearbyActions } from '../../src/ui/views/actions';

function step(s: GameState, id: string): GameState {
  const next = action(s, id);
  expect(next.life, id).not.toBe(s.life);
  expect(importSave(JSON.stringify(makeSave(next))).state, id).toEqual(next);
  return next;
}
function identify(s = district()): GameState {
  for (const id of ['life-thread-accept', 'life-clue-water', 'life-clue-cloth', 'life-identify'])
    s = step(s, id);
  return s;
}
function plan(method: 'lashing' | 'brace', s = district()): GameState {
  return step(step(s, 'life-bench-inspect'), 'life-method-' + method);
}

describe('A familiar thread', () => {
  for (const order of [
    ['water', 'cloth'],
    ['cloth', 'water'],
  ])
    for (const ending of ['route', 'welcome']) {
      it(`accepts ${order.join(' then ')} and remembers ${ending} through every interruption`, () => {
        let s = step(district(), 'life-thread-accept');
        for (const clue of order) {
          const before = at(s, 'sewing-rest');
          expect(transition(before, { type: 'campaign-action', id: 'life-identify' })).toBe(before);
          expect(action(s, 'life-take-pouch').campaign.carrying).toBeNull();
          s = step(s, 'life-clue-' + clue);
          expect(contextView('sewing-rest', s)!.body).toContain('both');
        }
        s = step(s, 'life-identify');
        s = step(s, 'life-take-pouch');
        expect(lifePresentation(s).pouchAtShore).toBe(false);
        const earlier = structuredClone(s);
        s = step(s, 'life-set-pouch');
        expect(lifePresentation(s).pouchAtShore).toBe(true);
        expect(s.life.thread.stage).toBe('identified');
        s = step(s, 'life-take-pouch');
        expect(s.life).toEqual(earlier.life);
        s = step(s, 'life-return-pouch');
        expect(s.life.thread.stage).toBe('returned');
        expect(s.campaign.carrying).toBeNull();
        s = step(s, 'life-ending-' + ending);
        expect(s.life.thread.ending).toBe(ending);
        expect(lifePresentation(s).pouchWithRuth).toBe(true);
        expect(lifePresentation(s).pouchAtShore).toBe(false);
        expect(s.campaign.roof.stage).toBe('exploring');
        expect(s.life.bench).toEqual(newLife().bench);
        for (const id of [
          'life-thread-accept',
          'life-return-pouch',
          'life-ending-route',
          'life-ending-welcome',
        ]) {
          const local = at(s, 'ruth');
          expect(transition(local, { type: 'campaign-action', id })).toBe(local);
        }
      });
    }
  it('preserves investigation tracking on the first journey and does not gate Chapter II', () => {
    const s = { ...completedEpisode(), tracking: 'belonging' as const };
    expect(gateway(s, 'to-lanes').tracking).toBe('belonging');
    const roof = action(identify(), 'roof-enter');
    expect(roof.region).toBe('roof-account');
    expect(makeSave(roof).state.life.thread.stage).toBe('identified');
  });
});

describe('A place to rest', () => {
  for (const method of ['lashing', 'brace'] as const)
    for (const first of ['clear', 'fetch']) {
      it(`supports ${method}, ${first} first, material return, fitting and testing`, () => {
        let s = plan(method);
        if (first === 'clear') s = step(s, 'life-clear-bench');
        s = step(s, 'life-take-' + method);
        const held = s.campaign.carrying;
        s = step(s, 'life-return-' + method);
        expect(s.campaign.carrying).toBeNull();
        s = step(s, 'life-take-' + method);
        expect(s.campaign.carrying).toBe(held);
        if (first === 'fetch') {
          expect(action(s, 'life-fit-' + method).life.bench.stage).toBe('working');
          s = step(s, 'life-clear-bench');
        }
        expect(action(s, 'life-test-bench').life.bench.stage).toBe('working');
        s = step(s, 'life-fit-' + method);
        expect(s.campaign.carrying).toBeNull();
        expect(lifePresentation(s).benchAsset).toBe(
          method === 'lashing' ? 'bench_lashed' : 'bench_braced',
        );
        expect(lifePresentation(s).benchOccupied).toBe(false);
        s = step(s, 'life-test-bench');
        expect(lifePresentation(s).benchOccupied).toBe(true);
        const completed = at(s, 'landing-bench');
        for (const id of [
          'life-test-bench',
          'life-bench-inspect',
          'life-clear-bench',
          'life-method-lashing',
          'life-method-brace',
        ])
          expect(transition(completed, { type: 'campaign-action', id })).toBe(completed);
        expect(s.life.thread).toEqual(newLife().thread);
      });
    }
  it('can complete entirely on the shore before any neighborhood visit', () => {
    let s = completedEpisode();
    for (const id of [
      'life-bench-inspect',
      'life-method-lashing',
      'life-clear-bench',
      'life-take-lashing',
      'life-fit-lashing',
      'life-test-bench',
    ])
      s = step(s, id);
    expect(s.campaign.roof.stage).toBe('not-started');
    expect(s.life.bench.stage).toBe('complete');
    expect(gateway(s, 'to-lanes').life).toEqual(s.life);
  });
});

describe('interleaved actions and useful guidance', () => {
  const holding = (): GameState[] => {
    const t = action(action(district(), 'table-accept'), 'table-courtyard');
    const w = action(action(district(), 'walk-accept'), 'walk-passage');
    return [
      action(t, 'take-bread'),
      action(t, 'take-jug'),
      action(action(t, 'take-jug'), 'fill-jug'),
      action(w, 'borrow-handle'),
      action(identify(), 'life-take-pouch'),
      action(plan('lashing'), 'life-take-lashing'),
      action(plan('brace'), 'life-take-brace'),
    ];
  };
  it('routes each foreign held object to its actual return point in every practical story', () => {
    for (const s of holding())
      for (const tracking of ['neighbors', 'table', 'belonging', 'rest'] as const) {
        const item = heldItems[s.campaign.carrying!];
        if (item.story === tracking) continue;
        const local = {
          ...s,
          tracking,
          region: 'gathering-house' as const,
          position: { x: 0, z: -2 },
        };
        expect(campaignGoal(local)!.text).toContain(item.place);
        expect(campaignGoal(local)!.target).toBe('house-exit');
        expect(heldReturn(s)!.target).toBe(item.target);
        expect(makeSave(local).state.campaign.carrying).toBe(s.campaign.carrying);
      }
  });
  it('cannot overwrite old held items by borrowing new ones, or new items with old ones', () => {
    for (let s of holding()) {
      const held = s.campaign.carrying;
      if (s.life.thread.stage === 'not-started') s = identify(s);
      if (s.life.bench.stage === 'not-started') s = plan('lashing', s);
      if (s.campaign.table.stage === 'not-started')
        s = action(action(s, 'table-accept'), 'table-courtyard');
      for (const id of ['take-bread', 'take-jug', 'life-take-pouch', 'life-take-lashing']) {
        const next = action(s, id);
        expect(next.campaign.carrying).toBe(held);
        expect(actionBlocker(worldAction(id)!, s)).toBeDefined();
      }
      expect(makeSave(s).state.campaign.carrying).toBe(held);
    }
  });
  it('uses the same guard and semantic motions for tray, full context, stale and far events', () => {
    const s = plan('lashing');
    const local = at(s, 'landing-bench');
    expect(nearbyActions(local)).toContain('data-value="life-clear-bench"');
    expect(contextView('landing-bench', local)!.body).toContain('life-clear-bench');
    expect(actionMotion(worldAction('life-clear-bench')!)).toBe('Repair');
    expect(actionMotion(worldAction('life-test-bench')!)).toBe('SitDown');
    for (const id of lifeActions.map((a) => a.id)) {
      const far = { ...local, position: { x: -22, z: -22 } };
      expect(actionAllowed(far, id)).toBe(false);
      expect(transition(far, { type: 'campaign-action', id })).toBe(far);
      const early = newGame();
      expect(transition(early, { type: 'campaign-action', id })).toBe(early);
    }
  });
});

describe('v6 compatibility and impossible states', () => {
  it('migrates every legacy fixture without mutating it or inventing discoveries', () => {
    for (const file of readdirSync('tests/fixtures/saves').filter((f) =>
      /^v[1-5]-.*json$/.test(f),
    )) {
      const raw = JSON.parse(readFileSync('tests/fixtures/saves/' + file, 'utf8'));
      const before = structuredClone(raw),
        save = parseSave(raw);
      expect(raw).toEqual(before);
      expect(save.version).toBe(SAVE_VERSION);
      expect(save.state.life).toEqual(newLife());
      expect(save.state.journal).toEqual(raw.state.journal);
      if (raw.version === 5) expect(save.state.campaign).toEqual(raw.state.campaign);
    }
  });
  it('rejects unknown, contradictory, premature and forged earned records', () => {
    const save = makeSave(district());
    const edits: ((s: typeof save) => void)[] = [
      (s) => {
        s.state.life.thread.stage = 'identified';
      },
      (s) => {
        s.state.life.thread.clues = ['water'];
      },
      (s) => {
        s.state.life.thread.ending = 'route';
      },
      (s) => {
        s.state.life.thread.clues = ['water', 'water'];
      },
      (s) => {
        s.state.life.bench.stage = 'complete';
      },
      (s) => {
        s.state.life.bench.method = 'brace';
      },
      (s) => {
        s.state.life.bench.cleared = true;
      },
      (s) => {
        s.state.campaign.carrying = 'sewing-pouch';
      },
      (s) => {
        s.state.campaign.carrying = 'lashing-cord';
      },
      (s) => {
        s.state.journal.push('thread-invitation');
      },
    ];
    for (const edit of edits) {
      const raw = structuredClone(save);
      edit(raw);
      expect(() => parseSave(raw)).toThrow();
    }
    const material = makeSave(action(plan('lashing'), 'life-take-lashing'));
    material.state.campaign.carrying = 'wood-brace';
    expect(() => parseSave(material)).toThrow(/bench progress/);
    const pouch = makeSave(action(identify(), 'life-take-pouch'));
    pouch.state.life.thread.stage = 'returned';
    expect(() => parseSave(pouch)).toThrow(/investigation/);
    const missing = makeSave(identify());
    missing.state.journal = missing.state.journal.filter((id) => id !== 'thread-clue-water');
    expect(() => parseSave(missing)).toThrow(/journal/);
  });
  it('round-trips every reachable combination of the two new story states', () => {
    const queue = [district()],
      visited = new Set<string>();
    while (queue.length) {
      const s = queue.shift()!;
      const key = JSON.stringify([s.life, s.campaign.carrying]);
      if (visited.has(key)) continue;
      visited.add(key);
      expect(makeSave(s).state).toEqual(s);
      expect(lifeJournalIds(s.life).every((id) => Boolean(lifeJournal[id]))).toBe(true);
      for (const a of lifeActions)
        if (actionAllowed(at(s, a.target), a.id)) queue.push(action(s, a.id));
    }
    expect(visited.size).toBeGreaterThan(100);
    expect(visited.size).toBeLessThan(2000);
  });
});

describe('world and journal continuity', () => {
  it('gives every clue, source and bench a reachable approach and keeps the bench footprint', () => {
    expect(obstacles).toContainEqual(BENCH_FOOTPRINT);
    for (const [region, places] of Object.entries(lifePlaces)) {
      const s = { ...district(), region: region as GameState['region'] },
        layout = campaignLayout(region);
      const grid = layout
        ? new WalkGrid(layoutObstacles(s), layout.terrain, layout.bounds.min, layout.bounds.max)
        : new WalkGrid(obstacles, isLand);
      const start = region === 'capernaum' ? { x: -1, z: -3 } : { x: 0, z: -5 };
      for (const p of places) {
        const path = approachPath(grid, start, p);
        expect(path.length, p.id).toBeGreaterThan(0);
        expect(distance(path.at(-1)!, p), p.id).toBeLessThan(2.8);
      }
    }
  });
  it('loads explicit regional inventories and includes every local life asset', () => {
    expect(explorationAssets('gathering-house')).not.toContain('oven');
    expect(explorationAssets('gathering-house')).not.toContain('handcart');
    expect(explorationAssets('gathering-house').length).toBeLessThan(20);
    expect(explorationAssets('bakehouse')).toContain('mending_cloth');
    expect(explorationAssets('capernaum')).toContain('bench_lashed');
  });
  it('keeps evidence, references and reachable directories separately accessible', () => {
    let s = identify();
    s = step(step(step(s, 'life-take-pouch'), 'life-return-pouch'), 'life-ending-route');
    expect(threadEvidence(s)).toContain('two short stitches');
    expect(memoryEntries(s, 'belonging')).toContain('thread-ending-route');
    expect(memoryEntries(s, 'belonging')).not.toContain('roof-invitation');
    expect(memoryEntries(s, 'main')).toContain('Luke 5');
    expect(journalPeople(s)).toContain('Her pouch is safe beside her');
    expect(journalPeople(returnedShore())).not.toContain('Find Jesus');
    expect(journalPeople(returnedShore())).not.toContain('Find Simon');
    expect(journalPlaces(s)).toContain('data-value="hannah"');
    const oldPosition = { ...s.campaign.walk.position };
    lifePresentation(s);
    expect(s.campaign.walk.position).toEqual(oldPosition);
  });
});
