import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { makeSave, parseSave, importSave, SAVE_VERSION } from '../../src/persistence/schema';
import { transition } from '../../src/game/quest';
import { newGame } from '../../src/game/types';
import { newEpisode, SCENE_IDS } from '../../src/game/episode/types';
import {
  completedPrelude,
  onLake,
  readyReflection,
  readyShore,
  returnedShore,
} from '../helpers/journey';

describe('v4 compatibility and consistency', () => {
  const fixtures = readdirSync(new URL('../fixtures/saves/', import.meta.url)).filter((file) =>
    file.endsWith('.json'),
  );
  it.each(fixtures)('migrates and round-trips %s', (filename) => {
    const raw = JSON.parse(
      readFileSync(new URL('../fixtures/saves/' + filename, import.meta.url), 'utf8'),
    );
    const save = parseSave(raw);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.state.quest).toBe(raw.state.quest);
    expect(save.state.inventory).toEqual(raw.state.inventory);
    expect(save.state.discoveries).toEqual(raw.state.discoveries ?? []);
    expect(save.state.journal).toEqual(raw.state.journal);
    if (raw.version < 4) {
      expect(save.state.episode).toEqual(newEpisode());
      expect(save.state.villageMemory).toBeNull();
      expect(save.region).toBe('capernaum');
    }
    expect(importSave(JSON.stringify(save))).toEqual(save);
  });
  it.each(SCENE_IDS)('round-trips an on-lake and suspended %s checkpoint', (checkpoint) => {
    let state = onLake();
    for (const id of SCENE_IDS.slice(0, SCENE_IDS.indexOf(checkpoint)))
      state = transition(state, { type: 'advance-scene', checkpoint: id });
    expect(importSave(JSON.stringify(makeSave(state))).state).toEqual(state);
    state = transition(state, { type: 'leave-scene' });
    expect(importSave(JSON.stringify(makeSave(state))).state).toEqual(state);
  });
  it('rejects inconsistent episode phases, inventory, checkpoints and journal records', () => {
    const save = makeSave(readyShore());
    const e = save.state.episode;
    const invalid = [
      { ...e, stage: 'unknown' },
      { ...e, stage: ['preparing'] },
      { ...e, stage: 'not-started' },
      { ...e, carrying: 'empty-basket' },
      { ...e, carrying: 'fish' },
      { ...e, checkpoint: 'calling' },
      { ...e, checkpoint: 'unknown' },
      { ...e, stage: 'witnessing', checkpoint: null },
      { ...e, stage: 'witnessing', checkpoint: 'gathering', preparations: [] },
      { ...e, stage: 'witnessing', checkpoint: 'gathering', reflection: 'trust' },
      { ...e, stage: 'aftermath', checkpoint: 'calling' },
      { ...e, stage: 'complete', reflection: 'trust' },
      { ...e, preparations: ['basket', 'basket', 'mooring'] },
      { ...e, notes: ['script'] },
      { ...e, notes: ['boat', 'boat'] },
      { ...e, aftermath: ['miriam'] },
    ];
    for (const episode of invalid)
      expect(() => parseSave({ ...save, state: { ...save.state, episode } })).toThrow();
    for (const state of [
      { ...save.state, tracking: 'sideways' },
      { ...save.state, tracking: ['main'] },
      { ...save.state, region: 'lake-gennesaret' },
      { ...save.state, villageMemory: 'well' },
      { ...save.state, journal: save.state.journal.slice(1) },
      { ...save.state, journal: [...save.state.journal, 'scene-calling'] },
    ])
      expect(() => parseSave({ ...save, state })).toThrow();
  });
  it('rejects a completed episode without all aftermath tasks or its reflection', () => {
    const completed = transition(readyReflection(), { type: 'reflect', id: 'wonder' });
    const save = makeSave(completed);
    for (const episode of [
      { ...completed.episode, reflection: null },
      { ...completed.episode, aftermath: ['miriam', 'ezra'] },
      { ...completed.episode, preparations: ['basket', 'mooring'] },
      { ...completed.episode, checkpoint: 'return' },
    ])
      expect(() => parseSave({ ...save, state: { ...completed, episode } })).toThrow();
    const returned = returnedShore();
    expect(() => makeSave({ ...returned, region: 'lake-gennesaret' })).toThrow();
    expect(() => makeSave({ ...newGame(), episode: readyShore().episode })).toThrow();
  });
  it('does not mistake a completed legacy prelude for a completed new episode', () => {
    const state = completedPrelude();
    const legacy = { version: 3, region: 'capernaum', savedAt: '2026-09-08T00:00:00Z', state };
    const migrated = parseSave(legacy);
    const begun = transition(migrated.state, { type: 'start-episode' });
    expect(begun.episode.stage).toBe('preparing');
    expect(begun.journal).toContain('complete');
    expect(begun.journal).not.toContain('episode-complete');
  });
});
