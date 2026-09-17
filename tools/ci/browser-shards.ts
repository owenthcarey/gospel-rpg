export const SHARD_TARGET_SECONDS = 300;
export const UNKNOWN_TEST_SECONDS = 180;
const MINIMUM_SHARDS = 32;
const MAXIMUM_SHARDS = 256; // GitHub Actions matrix limit.

export interface BrowserShard {
  tests: string[];
  estimatedSeconds: number;
}

/** Longest first, placing each case in the least-loaded group that has room. */
export function balanceBrowserTests(
  tests: string[],
  durations: Readonly<Record<string, number>>,
): BrowserShard[] {
  if (!tests.length) throw new Error('No browser tests discovered');
  if (new Set(tests).size !== tests.length) throw new Error('Duplicate browser test selectors');
  const estimates = tests.map((test) => {
    const recorded = durations[test] ?? UNKNOWN_TEST_SECONDS;
    if (!Number.isFinite(recorded) || recorded <= 0) {
      throw new Error(`Invalid duration for ${test}`);
    }
    // Even tiny/skipped cases need some room for worker and browser startup.
    return { test, seconds: Math.max(15, recorded) };
  });
  estimates.sort((a, b) => b.seconds - a.seconds || a.test.localeCompare(b.test, 'en'));
  const shards: BrowserShard[] = Array.from(
    { length: Math.min(MINIMUM_SHARDS, tests.length) },
    () => ({
      tests: [],
      estimatedSeconds: 0,
    }),
  );
  for (const { test, seconds } of estimates) {
    let shard = shards.reduce((least, next) =>
      next.estimatedSeconds < least.estimatedSeconds ? next : least,
    );
    // A single test above the target runs alone; don't silently drop or split it.
    if (shard.tests.length && shard.estimatedSeconds + seconds > SHARD_TARGET_SECONDS) {
      shard = { tests: [], estimatedSeconds: 0 };
      shards.push(shard);
    }
    shard.tests.push(test);
    shard.estimatedSeconds += seconds;
  }
  if (shards.length > MAXIMUM_SHARDS) {
    throw new Error('Browser plan exceeds 256 jobs; review the scheduling budget');
  }
  return shards;
}
