import { describe, expect, it } from 'vitest';
import { balanceBrowserTests, SHARD_TARGET_SECONDS } from '../../tools/ci/browser-shards';
import timings from '../../tools/ci/browser-durations.json';

describe('browser CI scheduling', () => {
  it('spreads the five journeys that exhausted the release deadline across separate groups', () => {
    const tests = Object.keys(timings.seconds);
    const shards = balanceBrowserTests(tests, timings.seconds);
    const formerlyTogether = tests.filter(
      (test) =>
        test.startsWith('[chromium]') &&
        (test.includes(' › life.spec.ts › ') ||
          test.includes(' › the road opens after Chapter II;') ||
          test.includes(' › Neri walks the shade route')),
    );
    expect(formerlyTogether).toHaveLength(5);
    expect(
      new Set(
        formerlyTogether.map((test) => shards.findIndex((shard) => shard.tests.includes(test))),
      ).size,
    ).toBe(5);
    expect(shards).toHaveLength(32);
    expect(Math.max(...shards.map((shard) => shard.estimatedSeconds))).toBeLessThanOrEqual(
      SHARD_TARGET_SECONDS,
    );
    expect(shards.flatMap((shard) => shard.tests).sort()).toEqual(tests.sort());
  });

  it('automatically schedules new and renamed tests and adds groups when the budget is full', () => {
    const tests = Array.from({ length: 70 }, (_, i) => `new test ${i}`);
    const shards = balanceBrowserTests(tests, { 'removed test': 999 });
    expect(shards).toHaveLength(70);
    expect(shards.every((shard) => shard.estimatedSeconds === 180)).toBe(true);
    expect(shards.flatMap((shard) => shard.tests).sort()).toEqual(tests.sort());
  });

  it('keeps a case above the target alone without losing it or emitting empty groups', () => {
    const tests = ['long journey', ...Array.from({ length: 40 }, (_, i) => `short ${i}`)];
    const durations = Object.fromEntries(
      tests.map((test) => [test, test === 'long journey' ? 600 : 10]),
    );
    const shards = balanceBrowserTests(tests, durations);
    expect(shards.find((shard) => shard.tests.includes('long journey'))?.tests).toEqual([
      'long journey',
    ]);
    expect(shards.every((shard) => shard.tests.length)).toBe(true);
    expect(shards.flatMap((shard) => shard.tests).sort()).toEqual(tests.sort());
  });

  it('keeps assignments stable when discovery order changes', () => {
    const tests = Object.keys(timings.seconds);
    expect(balanceBrowserTests(tests, timings.seconds)).toEqual(
      balanceBrowserTests(tests.reverse(), timings.seconds),
    );
  });

  it('fails closed for missing tests, ambiguous selectors, corrupt timings or matrix overflow', () => {
    expect(() => balanceBrowserTests([], {})).toThrow('No browser tests');
    expect(() => balanceBrowserTests(['duplicate', 'duplicate'], {})).toThrow('Duplicate');
    for (const duration of [0, -1, NaN, Infinity]) {
      expect(() => balanceBrowserTests(['test'], { test: duration })).toThrow('Invalid duration');
    }
    expect(() =>
      balanceBrowserTests(
        Array.from({ length: 257 }, (_, i) => `test ${i}`),
        {},
      ),
    ).toThrow('exceeds 256');
  });
});
