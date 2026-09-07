import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import {
  importSave,
  makeSave,
  parseSave,
  parseSettings,
  MAX_SAVE_BYTES,
} from '../../src/persistence/schema';
import { SaveRepository } from '../../src/persistence/saves';

describe('save safety', () => {
  it('round-trips progress without sharing references', () => {
    const state = transition(newGame(), { type: 'accept-quest' });
    const result = importSave(JSON.stringify(makeSave(state)));
    expect(result.state).toEqual(state);
    result.state.position.x = 12;
    expect(state.position.x).toBe(-1);
  });
  it('migrates version 1 and rejects future versions', () => {
    const save = makeSave(newGame());
    const oldState = {
      position: save.state.position,
      quest: save.state.quest,
      inventory: save.state.inventory,
      journal: save.state.journal,
    };
    expect(parseSave({ ...save, version: 1, state: oldState }).state).toEqual(save.state);
    expect(() => parseSave({ ...save, version: 3 })).toThrow(/newer version/);
  });
  it('rejects malformed JSON, oversized files, impossible items, and non-finite positions', () => {
    expect(() => importSave('not json')).toThrow(/JSON/);
    expect(() => importSave(' '.repeat(MAX_SAVE_BYTES + 1))).toThrow(/too large/);
    const save = makeSave(newGame());
    for (const state of [
      { ...save.state, position: { x: NaN, z: 0 } },
      { ...save.state, position: { x: 999, z: 0 } },
      { ...save.state, inventory: ['bread'] },
      { ...save.state, journal: ['<script>'] },
      { ...save.state, quest: 'complete' },
      { ...save.state, quest: ['gathering'], journal: ['arrival', 'simon'] },
      { ...save.state, journal: ['arrival', 'complete'] },
      { ...save.state, discoveries: ['shore', 'shore'] },
    ])
      expect(() => parseSave({ ...save, state })).toThrow();
    expect(() => parseSave({ ...save, region: 'unknown' })).toThrow();
  });
  it('normalizes invalid settings', () => {
    expect(parseSettings({ volume: 100, quality: 'ultra', sound: 'yes' })).toEqual({
      volume: 1,
      quality: 'high',
      sound: false,
      reducedMotion: false,
    });
  });
});

describe('IndexedDB save slots', () => {
  it('persists independent slots and settings across connections', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const a = new SaveRepository();
    await a.init(name);
    expect(a.persistent).toBe(true);
    await a.save('auto', newGame());
    const progressed = transition(newGame(), { type: 'accept-quest' });
    await a.save('slot-1', progressed);
    await a.saveSettings({ sound: true, volume: 0.2, quality: 'low', reducedMotion: true });
    a.close();
    const b = new SaveRepository();
    await b.init(name);
    expect((await b.load('auto'))?.state.quest).toBe('not-started');
    expect((await b.load('slot-1'))?.state.quest).toBe('gathering');
    expect(await b.load('slot-2')).toBeNull();
    expect(b.getSettings().quality).toBe('low');
    expect(await b.list()).toHaveLength(4);
    b.close();
  });
});
