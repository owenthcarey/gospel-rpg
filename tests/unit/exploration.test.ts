import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { newGame } from '../../src/game/types';
import { journeySuggestions, suggestStory } from '../../src/content/exploration/suggestions';
import { workTarget, validPreview, previewDescription } from '../../src/content/exploration/work';
import { TapGesture } from '../../src/game/gestures';
import { transition } from '../../src/game/quest';
import { makeSave, parseSave } from '../../src/persistence/schema';
import { STORY_TRACKS } from '../../src/game/campaign/types';
import { chapters, storyStatus } from '../../src/content/campaign/chapters';
import { routeDestination } from '../../src/game/connection/routes';
import { activeInteractables } from '../../src/content/region';
import { arrangedShelter, preparedSpring, galileeAction } from '../helpers/galilee';
import { at } from '../helpers/campaign';
import { accounts } from '../../src/game/connection/accounts';
import { roadStart } from '../helpers/road';
import { completedJourney } from '../helpers/connection';
import type { Direction } from '../../src/game/galilee/types';

function borrowedScoop() {
  let s = roadStart();
  for (const id of ['spring-start', 'spring-note-source', 'spring-note-basins', 'spring-borrow'])
    s = galileeAction(s, id);
  return s;
}

describe('journey suggestions', () => {
  it('opens with the actual first invitation and nearby optional story', () => {
    const state = newGame(),
      before = structuredClone(state);
    const result = journeySuggestions(state);
    expect(result.current).toMatchObject({ id: 'main', target: 'simon', available: true });
    expect(result.nearby.map((s) => s.id)).toEqual(['village', 'harbor']);
    expect(result.elsewhere).toEqual([]);
    expect(result.completed).toBe(0);
    expect(state).toEqual(before);
  });
  for (const file of readdirSync('tests/fixtures/saves')) {
    it('keeps suggestions truthful for migrated ' + file, () => {
      const s = parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + file, 'utf8'))).state;
      const before = JSON.stringify(makeSave(s).state);
      for (const id of STORY_TRACKS) {
        const suggestion = suggestStory(s, id);
        if (['complete', 'unavailable'].includes(storyStatus(s, id)))
          expect(suggestion).toBeUndefined();
        else {
          expect(suggestion?.title).toBe(chapters[id].title);
          const destination = routeDestination(s, suggestion!.target);
          if (destination) expect(suggestion?.region).toBe(destination.region);
        }
      }
      journeySuggestions(s);
      for (const p of activeInteractables(s)) workTarget(s, p.id);
      expect(JSON.stringify(makeSave(s).state)).toBe(before);
    });
  }
  it('offers earned homecoming and preserves the traveler during replay', () => {
    const s = completedJourney();
    expect(suggestStory(s, 'home')).toBeDefined();
    expect(suggestStory(s, 'storm')).toBeUndefined();
    const replay = transition(s, {
      type: 'replay-open',
      account: 'lake',
      checkpoint: accounts.lake.scenes[0]!.id,
    });
    expect(replay).not.toBe(s);
    expect(journeySuggestions(replay).replay).toBe('Into the Deep');
  });
  it('keeps carrying guidance available independently of the selected story', () => {
    const s = borrowedScoop();
    expect(journeySuggestions(s).held?.target).toBe('spring-tools');
  });
});

describe('physical work commands and temporary proposals', () => {
  it('exposes guards for distant, carried and completed work', () => {
    const s = preparedSpring();
    const local = at(s, 'channel-entry');
    expect(workTarget(local, 'channel-entry')?.actions[0]?.blocker).toBeUndefined();
    const remote = { ...local, position: { x: -20, z: -20 } };
    expect(workTarget(remote, 'channel-entry')?.near).toBe(false);
    expect(workTarget(remote, 'channel-entry')?.actions[0]?.blocker).toBeTruthy();
    const carrying = borrowedScoop();
    expect(
      workTarget(at(carrying, 'channel-entry'), 'channel-entry')?.actions[0]?.blocker,
    ).toBeTruthy();
    expect(workTarget(newGame(), 'invented')).toBeUndefined();
    expect(workTarget(newGame(), 'simon')).toBeUndefined();
  });
  for (const direction of [0, 1, 2, 3] as Direction[]) {
    it(
      'previews direction ' + direction + ' without progress, then applies one guarded command',
      () => {
        const s = at(arrangedShelter(undefined, 2), 'rest-shade'),
          before = JSON.stringify(makeSave(s).state);
        const preview = { site: 'shade' as const, expected: s.galilee.shelter.screen, direction };
        expect(validPreview(s, 'rest-shade', preview)).toBe(true);
        expect(previewDescription(s, preview)).toContain(direction === 2 ? 'southern' : 'Preview');
        expect(JSON.stringify(makeSave(s).state)).toBe(before);
        const event = {
          type: 'galilee-screen' as const,
          expected: s.galilee.shelter.screen,
          direction,
        };
        const next = transition(s, event);
        expect(next.galilee.shelter.screen).toBe(direction);
        expect(transition(next, event)).toBe(next);
        expect(makeSave(next).state.galilee.shelter.screen).toBe(direction);
        expect(next.campaign).toEqual(s.campaign);
      },
    );
  }
  it('rejects stale, invalid, distant, carrying and other-site proposals', () => {
    const s = at(arrangedShelter(undefined, 2), 'rest-shade');
    for (const direction of [-1, 4, 0.5, NaN]) {
      expect(
        transition(s, { type: 'galilee-screen', expected: 2, direction: direction as Direction }),
      ).toBe(s);
    }
    const proposal = { site: 'shade' as const, expected: 2 as const, direction: 3 as const };
    expect(validPreview(s, 'rest-breeze', proposal)).toBe(false);
    expect(validPreview(s, 'rest-shade', { ...proposal, expected: 1 })).toBe(false);
    const remote = { ...s, position: { x: 20, z: 20 } };
    expect(validPreview(remote, 'rest-shade', proposal)).toBe(false);
    expect(transition(remote, { type: 'galilee-screen', expected: 2, direction: 3 })).toBe(remote);
    const carrying = galileeAction(s, 'shelter-recover-shade-water');
    expect(validPreview(carrying, 'rest-shade', proposal)).toBe(false);
    expect(transition(carrying, { type: 'galilee-screen', expected: 2, direction: 3 })).toBe(
      carrying,
    );
  });
});

describe('tap ownership', () => {
  it('accepts one short primary tap exactly once', () => {
    const g = new TapGesture();
    g.down(1, 10, 10, 0);
    g.up(1, 13, 12);
    expect(g.consume(1)).toBe(true);
    expect(g.consume(1)).toBe(false);
  });
  it('rejects a drag even after returning to its start, then accepts a fresh tap', () => {
    const g = new TapGesture();
    g.down(1, 10, 10, 0);
    g.move(1, 30, 30);
    g.up(1, 10, 10);
    expect(g.consume(1)).toBe(false);
    g.down(2, 10, 10, 0);
    g.up(2, 10, 10);
    expect(g.consume(2)).toBe(true);
  });
  it('rejects both fingers of a pinch and a canceled gesture', () => {
    const g = new TapGesture();
    g.down(1, 10, 10, 0);
    g.down(2, 20, 20, 0);
    g.up(1, 10, 10);
    g.up(2, 20, 20);
    expect(g.consume(1)).toBe(false);
    expect(g.consume(2)).toBe(false);
    g.down(1, 10, 10, 0);
    g.clear();
    g.up(1, 10, 10);
    expect(g.consume(1)).toBe(false);
  });
  it('rejects secondary-button orbit and unrelated pointer releases', () => {
    const g = new TapGesture();
    g.down(1, 0, 0, 2);
    g.up(1, 0, 0);
    expect(g.consume(1)).toBe(false);
    g.up(99, 0, 0);
    expect(g.consume(99)).toBe(false);
  });
});
