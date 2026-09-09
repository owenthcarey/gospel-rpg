import { describe, it, expect } from 'vitest';
import { transition, objectiveTarget } from '../../src/game/quest';
import { newGame, type GameState } from '../../src/game/types';
import { actionAllowed, worldActions } from '../../src/content/campaign/actions';
import { ROOF_SCENES, ROOF_REFLECTIONS, NEIGHBOR_NOTES } from '../../src/game/campaign/types';
import {
  WALK_ROUTES,
  allNeighborhoodPlaces,
  gateways,
  nextGateway,
  localNeighborhoodPlaces,
} from '../../src/content/campaign/places';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { approachPath } from '../../src/game/navigation';
import { WalkGrid, distance, findPath } from '../../src/game/pathfinding';
import { contextView, roofTranscript } from '../../src/ui/views/campaign';
import { roofBeats } from '../../src/content/campaign/scenes';
import { roofVerses } from '../../src/content/campaign/scripture';
import { noteTargets } from '../../src/content/campaign/actions';
import { makeSave } from '../../src/persistence/schema';
import { action, at, completedEpisode, district, gateway, witnessed } from '../helpers/campaign';
const roundtrip = (s: GameState) => expect(makeSave(s).state).toEqual(s);

describe('Through the Roof progression', () => {
  it('unlocks after Chapter I without replaying prior work', () => {
    const blocked = { ...newGame(), position: { x: -3, z: 19 } };
    expect(transition(blocked, { type: 'journey', gateway: 'to-lanes' })).toBe(blocked);
    const prior = completedEpisode(),
      next = gateway(prior, 'to-lanes');
    expect(next.episode).toEqual(prior.episode);
    expect(next.journal).toEqual([...prior.journal, 'roof-invitation']);
    expect(next.campaign.roof.stage).toBe('exploring');
    roundtrip(next);
  });
  it('requires nearby local actions and ignores forged/duplicate actions', () => {
    const s = district();
    expect(transition(s, { type: 'campaign-action', id: 'roof-enter' })).toBe(s);
    expect(transition(s, { type: 'journey', gateway: 'house-exit' })).toBe(s);
    expect(transition(s, { type: 'campaign-action', id: 'unknown' })).toBe(s);
    const accepted = action(s, 'walk-accept');
    expect(transition(accepted, { type: 'campaign-action', id: 'walk-accept' })).toBe(accepted);
  });
  it('saves every scene, ignores stale commands, leaves/resumes, and matches summary', () => {
    const initial = action(district(), 'roof-enter');
    let s = initial;
    for (const checkpoint of ROOF_SCENES) {
      expect(s.campaign.roof.checkpoint).toBe(checkpoint);
      roundtrip(s);
      const left = transition(s, { type: 'roof-leave' });
      roundtrip(left);
      expect(left.region).toBe('gathering-house');
      s = action(left, 'roof-enter');
      expect(s.campaign.roof.checkpoint).toBe(checkpoint);
      const next = transition(s, { type: 'roof-next', checkpoint });
      expect(transition(next, { type: 'roof-next', checkpoint })).toBe(next);
      s = next;
    }
    const summary = transition(initial, { type: 'roof-summary', checkpoint: 'house' });
    expect(s.campaign.roof).toEqual(summary.campaign.roof);
    expect(s.journal).toEqual(summary.journal);
    roundtrip(s);
    expect(s.campaign.walk.stage).toBe('not-started');
    expect(s.campaign.table.stage).toBe('not-started');
  });
  it.each(ROOF_REFLECTIONS)('completes only after the aftermath, choosing %s', (id) => {
    let s = witnessed();
    const early = at(s, 'house-viewpoint');
    expect(transition(early, { type: 'roof-reflect', id })).toBe(early);
    for (const actionId of ['after-house', 'after-hannah', 'after-ruth']) {
      s = action(s, actionId);
      roundtrip(s);
    }
    s = transition(at(s, 'house-viewpoint'), { type: 'roof-reflect', id });
    expect(s.campaign.roof.stage).toBe('complete');
    expect(s.campaign.roof.reflection).toBe(id);
    roundtrip(s);
    expect(transition(s, { type: 'roof-reflect', id })).toBe(s);
  });
  it('provides separately attributed scripture and a description for every scene', () => {
    expect(roofBeats.map((b) => b.id)).toEqual(ROOF_SCENES);
    expect(new Set(roofBeats.flatMap((b) => b.verses))).toEqual(new Set(Object.keys(roofVerses)));
    expect(roofTranscript()).toContain('Luke 5:17–26');
    for (const beat of roofBeats) {
      expect(beat.description.length).toBeGreaterThan(80);
      expect(beat.narration.length).toBeGreaterThan(80);
    }
  });
});

describe('independent neighborhood stories', () => {
  for (const timing of ['before', 'after'] as const)
    for (const location of ['courtyard', 'bakehouse'] as const)
      for (const first of ['bread', 'water'] as const) {
        it(`${timing} the account: ${location} table, ${first} first, restores every held state`, () => {
          let s = action(timing === 'before' ? district() : witnessed(), 'table-accept');
          s = action(s, 'table-' + location);
          roundtrip(s);
          for (const item of [first, first === 'bread' ? 'water' : 'bread']) {
            s = action(s, item === 'bread' ? 'take-bread' : 'take-jug');
            roundtrip(s);
            expect(
              actionAllowed(
                at(s, item === 'bread' ? 'jug-shelf' : 'bread-shelf'),
                item === 'bread' ? 'take-jug' : 'take-bread',
              ),
            ).toBe(false);
            if (item === 'water') {
              s = action(s, 'fill-jug');
              roundtrip(s);
            }
            const wrong = action(
              s,
              'place-' + item + '-' + (location === 'courtyard' ? 'bakehouse' : 'courtyard'),
            );
            expect(wrong.campaign.table.delivered).toEqual(s.campaign.table.delivered);
            s = action(s, 'place-' + item + '-' + location);
            roundtrip(s);
          }
          s = action(s, 'table-finish');
          expect(s.campaign.table.stage).toBe('complete');
          roundtrip(s);
          expect(s.campaign.roof.stage).toBe(timing === 'before' ? 'exploring' : 'aftermath');
        });
      }
  it.each(['passage', 'outer'] as const)(
    'requires both travelers at every step on the %s route',
    (route) => {
      let s = action(district(), 'walk-accept');
      s = action(s, 'walk-' + route);
      if (route === 'passage') {
        expect(actionAllowed(at(s, 'amos'), 'walk-start')).toBe(false);
        s = action(s, 'borrow-handle');
        roundtrip(s);
        s = action(s, 'open-passage');
        expect(s.campaign.carrying).toBeNull();
        roundtrip(s);
      }
      s = action(s, 'walk-start');
      for (const point of WALK_ROUTES[route]) {
        s = { ...s, region: 'capernaum-lanes', position: { ...point } };
        expect(transition(s, { type: 'walk-step' })).toBe(s);
        s.campaign.walk.position = { ...point };
        s = transition(s, { type: 'walk-step' });
        roundtrip(s);
      }
      expect(s.campaign.walk.stage).toBe('arrived');
      s = action(s, 'walk-finish');
      expect(s.campaign.walk.stage).toBe('complete');
      roundtrip(s);
    },
  );
  it('returns held objects without losing the option to help', () => {
    let s = action(action(district(), 'table-accept'), 'table-bakehouse');
    for (const [take, put] of [
      ['take-bread', 'return-bread'],
      ['take-jug', 'return-jug'],
    ]) {
      s = action(s, take!);
      s = action(s, put!);
      expect(s.campaign.carrying).toBeNull();
      roundtrip(s);
    }
    s = action(action(s, 'walk-accept'), 'walk-passage');
    s = action(s, 'borrow-handle');
    s = action(s, 'return-handle');
    expect(s.campaign.carrying).toBeNull();
    roundtrip(s);
  });
  it('records each neighborhood observation once', () => {
    let s = district();
    for (const id of NEIGHBOR_NOTES) {
      const target = Object.entries(noteTargets).find(([, note]) => note === id)![0];
      s = transition(at(s, target), { type: 'neighbor-note', id });
      expect(transition(s, { type: 'neighbor-note', id })).toBe(s);
      roundtrip(s);
    }
    expect(s.campaign.notes).toHaveLength(6);
  });
});

describe('region contracts and reachable actions', () => {
  it('routes objectives through doorways across regions', () => {
    expect(nextGateway('bakehouse', 'gathering-house')).toBe('bakehouse-exit');
    expect(nextGateway('gathering-house', 'capernaum')).toBe('house-exit');
    const s = { ...district(), tracking: 'roof' as const };
    expect(objectiveTarget(s)).toBe('to-house');
    expect(objectiveTarget({ ...s, region: 'bakehouse' })).toBe('bakehouse-exit');
    expect(objectiveTarget({ ...s, tracking: 'village' })).toBe('to-shore');
  });
  it('uses unique IDs, known action targets and contextual content', () => {
    expect(new Set(allNeighborhoodPlaces.map((p) => p.id)).size).toBe(allNeighborhoodPlaces.length);
    expect(new Set(worldActions.map((a) => a.id)).size).toBe(worldActions.length);
    for (const a of worldActions)
      expect(allNeighborhoodPlaces.some((p) => p.id === a.target)).toBe(true);
    for (const p of allNeighborhoodPlaces)
      expect(contextView(p.id, at(district(), p.id))?.body.length).toBeGreaterThan(80);
  });
  it('every local destination is reachable with the passage closed or open', () => {
    for (const region of ['capernaum-lanes', 'gathering-house', 'bakehouse'] as const)
      for (const open of [false, true]) {
        const s = { ...district(), region };
        s.campaign.walk.gateOpen = open;
        const layout = campaignLayout(region)!;
        const grid = new WalkGrid(
          layoutObstacles(s),
          layout.terrain,
          layout.bounds.min,
          layout.bounds.max,
        );
        const start = gateways.find((g) => g.to === region)!.arrival;
        expect(grid.walkable(start)).toBe(true);
        for (const target of localNeighborhoodPlaces(s)) {
          const path = approachPath(grid, start, target);
          expect(
            path.length > 0 || distance(start, target) < 2.4,
            `${region}/${target.id}/${open}`,
          ).toBe(true);
        }
      }
  });
  it('the passage gate changes walkability and both companion routes are traversable', () => {
    for (const route of ['passage', 'outer'] as const) {
      const s = district();
      s.campaign.walk.gateOpen = route === 'passage';
      const l = campaignLayout(s.region)!;
      const grid = new WalkGrid(layoutObstacles(s), l.terrain, l.bounds.min, l.bounds.max);
      expect(grid.walkable({ x: 0, z: 0 })).toBe(route === 'passage');
      let from = s.campaign.walk.position;
      for (const to of WALK_ROUTES[route]) {
        expect(findPath(grid, from, to).length, route + JSON.stringify(to)).toBeGreaterThan(0);
        from = to;
      }
    }
  });
});
