import { describe, expect, it } from 'vitest';
import { ChatterSchedule } from '../../src/ui/chatter';
import { CHATTER } from '../../src/content/chatter';
import { allInteractables } from '../../src/content/region';

const lines = { a: ['A one', 'A two'], b: ['B one'], c: ['C one'] };

describe('overhead chatter', () => {
  it('waits before the first remark, then speaks in turn', () => {
    const chatter = new ChatterSchedule(lines, 10_000, 3_000, 2);
    expect(chatter.tick(0, ['a'])).toEqual([]);
    const spoken = [];
    for (let t = 0; t <= 40_000; t += 250)
      spoken.push(...chatter.tick(t, ['a']).map((l) => l.text));
    expect(new Set(spoken)).toEqual(new Set(['A one', 'A two']));
  });

  it('keeps each remark up for its duration and no more', () => {
    const chatter = new ChatterSchedule(lines, 10_000, 3_000, 2);
    let start = -1;
    for (let t = 0; t <= 20_000 && start < 0; t += 50) if (chatter.tick(t, ['b']).length) start = t;
    expect(start).toBeGreaterThan(0);
    expect(chatter.tick(start + 2_900, ['b'])).toHaveLength(1);
    expect(chatter.tick(start + 3_100, ['b'])).toHaveLength(0);
  });

  it('limits how many people speak at once', () => {
    const chatter = new ChatterSchedule(lines, 1_000, 60_000, 2);
    for (let t = 0; t <= 20_000; t += 100)
      expect(chatter.tick(t, ['a', 'b', 'c']).length).toBeLessThanOrEqual(2);
  });

  it('silences people who leave range and ignores people without lines', () => {
    const chatter = new ChatterSchedule(lines, 1_000, 60_000, 3);
    let t = 0;
    while (!chatter.tick(t, ['a', 'z']).length && t < 20_000) t += 100;
    expect(chatter.tick(t, ['a', 'z']).map((l) => l.id)).toEqual(['a']);
    expect(chatter.tick(t + 100, [])).toEqual([]);
    chatter.quiet();
    expect(chatter.tick(t + 200, ['a'])).toEqual([]);
  });

  it('gives remarks only to ordinary neighbors in the world', () => {
    const people = new Set(allInteractables.filter((p) => p.kind === 'person').map((p) => p.id));
    for (const id of Object.keys(CHATTER)) expect(people.has(id), id).toBe(true);
    for (const id of ['jesus', 'simon', 'james', 'john']) expect(CHATTER[id]).toBeUndefined();
    for (const text of Object.values(CHATTER).flat()) expect(text.length).toBeLessThanOrEqual(40);
  });
});
