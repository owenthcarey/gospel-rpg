import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { newGame } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import {
  importSave,
  makeSave,
  parseSave,
  parseSettings,
  MAX_SAVE_BYTES,
  SAVE_VERSION,
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
    expect(() => parseSave({ ...save, version: SAVE_VERSION + 1 })).toThrow(/newer version/);
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
  it('migrates a completed v2 journey without losing earlier discoveries', () => {
    const oldState = {
      position: { x: 6, z: 5 },
      quest: 'complete',
      inventory: [],
      discoveries: ['well', 'shore'],
      journal: ['arrival', 'simon', 'bread', 'net', 'delivered', 'complete', 'well', 'shore'],
      playTime: 240,
    };
    const migrated = parseSave({
      version: 2,
      region: 'capernaum',
      savedAt: '2026-09-07T12:00:00Z',
      state: oldState,
    });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.state).toEqual({ ...newGame(), ...oldState, villageStory: 'not-started' });
    expect(importSave(JSON.stringify(migrated))).toEqual(migrated);
  });
  it('round-trips each village story stage and rejects inconsistent completion', () => {
    let state = newGame();
    for (const event of [
      { type: 'accept-village-story' },
      { type: 'discover', id: 'olive' },
      { type: 'discover', id: 'shore' },
      { type: 'discover', id: 'well' },
      { type: 'finish-village-story' },
    ] as const) {
      state = transition(state, event);
      expect(importSave(JSON.stringify(makeSave(state))).state).toEqual(state);
    }
    const save = makeSave(state);
    for (const damaged of [
      { ...state, villageStory: 'unknown' },
      { ...state, villageStory: 'not-started' },
      {
        ...state,
        discoveries: ['shore', 'well'],
        journal: state.journal.filter((id) => id !== 'olive'),
      },
      { ...state, journal: state.journal.filter((id) => id !== 'ezra-invitation') },
      { ...state, journal: state.journal.filter((id) => id !== 'ezra-memory') },
    ])
      expect(() => parseSave({ ...save, state: damaged })).toThrow();
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

describe('storage failures', () => {
  it('keeps session slots and portable export available when IndexedDB cannot open', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    });
    const repository = new SaveRepository();
    try {
      await repository.init('blocked-' + crypto.randomUUID());
      expect(repository.persistent).toBe(false);
      const state = transition(newGame(), { type: 'accept-quest' });
      await repository.save('slot-1', state);
      expect((await repository.load('slot-1'))?.state).toEqual(state);
      expect(importSave(JSON.stringify(makeSave(state))).state).toEqual(state);
    } finally {
      open.mockRestore();
      repository.close();
    }
  });
  it('rejects a failed write, preserves the earlier slot, and permits a later retry', async () => {
    const repository = new SaveRepository();
    await repository.init('quota-' + crypto.randomUUID());
    await repository.save('auto', newGame());
    const state = transition(newGame(), { type: 'accept-quest' });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    try {
      await expect(repository.save('auto', state)).rejects.toThrow('Storage is full');
      expect((await repository.load('auto'))?.state.quest).toBe('not-started');
      expect(importSave(JSON.stringify(makeSave(state))).state.quest).toBe('gathering');
    } finally {
      put.mockRestore();
    }
    await repository.save('auto', state);
    expect((await repository.load('auto'))?.state.quest).toBe('gathering');
    repository.close();
  });
});
