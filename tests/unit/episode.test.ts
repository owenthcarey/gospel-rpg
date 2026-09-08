import { describe, expect, it } from 'vitest';
import { transition } from '../../src/game/quest';
import { newGame, type GameEvent } from '../../src/game/types';
import { AFTERMATH, SCENE_IDS, REFLECTIONS } from '../../src/game/episode/types';
import { episodeJournalIds, preparationsReady } from '../../src/game/episode/progress';
import { mainObjective, mainTarget } from '../../src/game/episode/objectives';
import { villagePresentation } from '../../src/game/episode/presentation';
import { activeInteractables, obstacles, isLand, allInteractables } from '../../src/content/region';
import { actionAvailable, episodeActions } from '../../src/content/episode/interactions';
import { sceneBeats } from '../../src/content/episode/scenes';
import { verses } from '../../src/content/episode/scripture';
import { dialogueFor, journalEntries } from '../../src/content/story';
import { WalkGrid, findPath, distance } from '../../src/game/pathfinding';
import { makeSave, parseSave } from '../../src/persistence/schema';
import {
  completedPrelude,
  onLake,
  play,
  readyReflection,
  readyShore,
  returnedShore,
} from '../helpers/journey';

describe('Into the Deep progression', () => {
  it('unlocks only after the prelude and never changes it', () => {
    expect(transition(newGame(), { type: 'start-episode' })).toEqual(newGame());
    const initial = completedPrelude();
    const begun = transition(initial, { type: 'start-episode' });
    expect(begun.episode.stage).toBe('preparing');
    expect(begun.quest).toBe('complete');
    expect(initial.episode.stage).toBe('not-started');
    expect(transition(begun, { type: 'start-episode' })).toBe(begun);
    expect(mainTarget(initial)).toBe('simon');
  });
  it('requires carrying the basket before placing it and prevents duplicate items', () => {
    const begun = transition(completedPrelude(), { type: 'start-episode' });
    expect(transition(begun, { type: 'episode-action', id: 'place-basket' })).toBe(begun);
    const carrying = transition(begun, { type: 'episode-action', id: 'take-basket' });
    expect(carrying.episode.carrying).toBe('empty-basket');
    expect(mainTarget(carrying)).toBe('landing');
    expect(transition(carrying, { type: 'episode-action', id: 'take-basket' })).toBe(carrying);
    const placed = transition(carrying, { type: 'episode-action', id: 'place-basket' });
    expect(placed.episode.carrying).toBeNull();
    expect(placed.episode.preparations).toEqual(['basket']);
    expect(transition(placed, { type: 'episode-action', id: 'take-basket' })).toBe(placed);
    expect(placed.inventory).toEqual([]);
  });
  it.each([
    ['take-basket', 'place-basket', 'secure-mooring', 'join-gathering'],
    ['secure-mooring', 'take-basket', 'join-gathering', 'place-basket'],
    ['join-gathering', 'secure-mooring', 'take-basket', 'place-basket'],
  ] as const)('allows independent preparation order %j', (...ids) => {
    let state = transition(completedPrelude(), { type: 'start-episode' });
    for (const id of ids) {
      expect(transition(state, { type: 'enter-scene' })).toBe(state);
      state = transition(state, { type: 'episode-action', id });
      expect(parseSave(makeSave(state)).state).toEqual(state);
    }
    expect(preparationsReady(state.episode)).toBe(true);
    expect(mainTarget(state)).toBe('viewpoint');
    expect(transition(state, { type: 'enter-scene' }).region).toBe('lake-gennesaret');
  });
  it('advances every checkpoint once, preserves scripture memories and returns to shore', () => {
    let state = onLake();
    for (const checkpoint of SCENE_IDS) {
      expect(state.episode.checkpoint).toBe(checkpoint);
      const previous = state;
      state = transition(state, { type: 'advance-scene', checkpoint });
      expect(transition(state, { type: 'advance-scene', checkpoint })).toBe(state);
      expect(previous.episode.checkpoint).toBe(checkpoint);
      expect(state.journal).toContain('scene-' + checkpoint);
      expect(parseSave(makeSave(state)).state).toEqual(state);
    }
    expect(state.region).toBe('capernaum');
    expect(state.episode.stage).toBe('aftermath');
    expect(state.episode.reflection).toBeNull();
    expect(state.episode.checkpoint).toBeNull();
    expect(mainTarget(state)).toBe('landing');
  });
  it.each(SCENE_IDS)('leaves and resumes checkpoint %s without advancing it', (checkpoint) => {
    let state = onLake();
    for (const id of SCENE_IDS.slice(0, SCENE_IDS.indexOf(checkpoint))) {
      state = transition(state, { type: 'advance-scene', checkpoint: id });
    }
    const left = transition(state, { type: 'leave-scene' });
    expect(left.region).toBe('capernaum');
    expect(left.episode.checkpoint).toBe(checkpoint);
    expect(transition(left, { type: 'advance-scene', checkpoint })).toBe(left);
    const restored = parseSave(makeSave(left)).state;
    const resumed = transition(restored, { type: 'enter-scene' });
    expect(resumed).toEqual(state);
  });
  it.each(SCENE_IDS)('summary from %s yields the same canonical aftermath', (checkpoint) => {
    let state = onLake();
    for (const id of SCENE_IDS.slice(0, SCENE_IDS.indexOf(checkpoint))) {
      state = transition(state, { type: 'advance-scene', checkpoint: id });
    }
    const skipped = transition(state, { type: 'skip-scene', checkpoint });
    expect(skipped).toEqual(returnedShore());
    expect(transition(skipped, { type: 'skip-scene', checkpoint })).toBe(skipped);
  });
  it('rejects stale scene tokens and progression from outside the lake', () => {
    const lake = onLake();
    expect(transition(lake, { type: 'advance-scene', checkpoint: 'calling' })).toBe(lake);
    expect(transition(lake, { type: 'skip-scene', checkpoint: 'return' })).toBe(lake);
    const ready = readyShore();
    expect(transition(ready, { type: 'advance-scene', checkpoint: 'gathering' })).toBe(ready);
    for (const action of episodeActions) expect(actionAvailable(lake, action.id)).toBe(false);
  });
  it.each(REFLECTIONS)('completes with %s after all aftermath conversations and help', (id) => {
    const returned = returnedShore();
    expect(transition(returned, { type: 'reflect', id })).toBe(returned);
    const ready = readyReflection();
    expect(ready.episode.aftermath).toEqual([...AFTERMATH]);
    const complete = transition(ready, { type: 'reflect', id });
    expect(complete.episode.stage).toBe('complete');
    expect(complete.episode.reflection).toBe(id);
    expect(complete.journal).toContain('reflection-' + id);
    expect(complete.journal).toContain('episode-complete');
    expect(transition(complete, { type: 'reflect', id })).toBe(complete);
    expect(makeSave(complete).state).toEqual(complete);
    expect(mainObjective(complete)).toContain('complete');
    expect(dialogueFor('miriam', complete).text).not.toEqual(dialogueFor('miriam', returned).text);
  });
  it('records optional observations once and independently from preparation', () => {
    let state = transition(completedPrelude(), { type: 'start-episode' });
    for (const id of ['boat', 'net', 'landing'] as const) {
      state = transition(state, { type: 'episode-note', id });
      expect(transition(state, { type: 'episode-note', id })).toBe(state);
      expect(makeSave(state).state).toEqual(state);
    }
    expect(state.episode.preparations).toEqual([]);
    expect(episodeJournalIds(state.episode)).toHaveLength(4);
  });
  it('preserves independent village progress and the player’s chosen memory', () => {
    const events: GameEvent[] = [
      { type: 'accept-village-story' },
      { type: 'discover', id: 'shore' },
      { type: 'discover', id: 'well' },
      { type: 'discover', id: 'olive' },
      { type: 'remember-village', id: 'well' },
      { type: 'finish-village-story' },
      { type: 'track-story', story: 'village' },
    ];
    const state = play(events, readyReflection());
    const completed = transition(state, { type: 'reflect', id: 'community' });
    expect(completed.villageMemory).toBe('well');
    expect(completed.villageStory).toBe('complete');
    expect(completed.tracking).toBe('village');
    expect(makeSave(completed).state).toEqual(completed);
    expect(dialogueFor('ezra-village', completed).choices[0]?.next).toBe('ezra-well');
  });
});

describe('authored destinations and scene content', () => {
  it('makes every available destination reachable in each exploration phase', () => {
    const grid = new WalkGrid(obstacles, isLand);
    for (const state of [newGame(), readyShore(), returnedShore(), readyReflection()]) {
      for (const destination of activeInteractables(state)) {
        const approaches = [];
        for (let x = -2; x <= 2; x++)
          for (let z = -2; z <= 2; z++) {
            const p = { x: Math.round(destination.x) + x, z: Math.round(destination.z) + z };
            if (grid.walkable(p) && distance(p, destination) < 2.25) approaches.push(p);
          }
        expect(
          approaches.some((p) => findPath(grid, state.position, p).length > 0),
          destination.id,
        ).toBe(true);
      }
    }
  });
  it('has valid dialogue destinations and effects for every reachable episode phase', () => {
    for (const state of [
      newGame(),
      completedPrelude(),
      readyShore(),
      returnedShore(),
      readyReflection(),
    ]) {
      const seen = new Set<string>();
      const queue = allInteractables.map((p) => p.id);
      while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const node = dialogueFor(id, state);
        expect(node.text.length, id).toBeGreaterThan(20);
        expect(node.choices.length, id).toBeGreaterThan(0);
        if (node.speaker === 'Jesus') expect(node.provenance).toBe('Scripture · WEB');
        for (const choice of node.choices) {
          expect(Boolean(choice.next || choice.close), id).toBe(true);
          if (choice.next) queue.push(choice.next);
          if (choice.event?.type === 'episode-action')
            expect(actionAvailable(state, choice.event.id), id).toBe(true);
        }
      }
    }
  });
  it('includes every source verse in the transcript and labels every caption', () => {
    expect(sceneBeats.map((beat) => beat.id)).toEqual([...SCENE_IDS]);
    const scriptureText = sceneBeats
      .flatMap((beat) => beat.captions)
      .filter((caption) => caption.provenance === 'Scripture · WEB')
      .map((caption) => caption.text)
      .join(' ');
    // Verses 9–10 may span separate captions; normalized source text remains exact.
    for (const [id, text] of Object.entries(verses)) {
      expect(scriptureText, id).toContain(text);
    }
    for (const beat of sceneBeats) {
      expect(journalEntries['scene-' + beat.id]).toEqual(beat.journal);
      for (const caption of beat.captions) {
        if (caption.provenance === 'Scripture · WEB') expect(caption.reference).toMatch(/^Luke 5:/);
        else expect(caption.provenance).toBe('Original narration');
      }
    }
  });
  it('derives persistent props and departed actors from story state', () => {
    const initial = villagePresentation(newGame());
    expect(initial.delivered).toBe(false);
    expect(villagePresentation(completedPrelude()).delivered).toBe(true);
    const ready = villagePresentation(readyShore());
    expect(ready.basketPlaced).toBe(true);
    expect(ready.ropeCoiled).toBe(true);
    expect(ready.gathering).toBe(true);
    const returned = returnedShore();
    expect(villagePresentation(returned).returned).toBe(true);
    expect(activeInteractables(returned).some((p) => p.id === 'simon' || p.id === 'jesus')).toBe(
      false,
    );
    expect(activeInteractables(onLake())).toEqual([]);
    const received = transition(returned, { type: 'episode-action', id: 'receive-catch' });
    expect(villagePresentation(received).basketReceived).toBe(true);
  });
});

it.each(REFLECTIONS)(
  'remembers %s in both villagers without requiring the optional story',
  (id) => {
    const state = transition(readyReflection(), { type: 'reflect', id });
    const miriam = dialogueFor('miriam', state);
    const ezra = dialogueFor('ezra', state);
    expect(state.villageStory).toBe('not-started');
    expect(miriam.text).not.toEqual(dialogueFor('miriam', returnedShore()).text);
    expect(ezra.subtitle).toBe('What stays with you');
    expect(ezra.choices.some((choice) => choice.next === 'ezra-village')).toBe(true);
    expect(
      dialogueFor('ezra-village', state).choices.some(
        (choice) => choice.next === 'ezra-invitation',
      ),
    ).toBe(true);
  },
);
