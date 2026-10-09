import { describe, expect, it } from 'vitest';
import { MUSIC_UNLOCK_KEY, MusicUnlocks } from '../../src/audio/unlocks';

function memory(initial?: string) {
  const values = new Map<string, string>(initial ? [[MUSIC_UNLOCK_KEY, initial]] : []);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('music track unlocks', () => {
  it('announces a track once and remembers it across sessions', () => {
    const storage = memory();
    const first = new MusicUnlocks(storage);
    expect(first.unlock('village')).toBe(true);
    expect(first.unlock('village')).toBe(false);
    expect(new MusicUnlocks(storage).unlock('village')).toBe(false);
    expect(new MusicUnlocks(storage).unlock('road')).toBe(true);
  });

  it('ignores corrupt storage and survives blocked writes', () => {
    expect(new MusicUnlocks(memory('{not json')).unlock('lake')).toBe(true);
    expect(new MusicUnlocks(memory('[1, "lake"]')).unlock('lake')).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const unlocks = new MusicUnlocks(blocked);
    expect(unlocks.unlock('lake')).toBe(true);
    expect(unlocks.unlock('lake')).toBe(false);
    expect(new MusicUnlocks(undefined).unlock('lake')).toBe(true);
  });
});
