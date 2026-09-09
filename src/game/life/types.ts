export const THREAD_CLUES = ['water', 'cloth'] as const;
export type ThreadClue = (typeof THREAD_CLUES)[number];
export const THREAD_ENDINGS = ['route', 'welcome'] as const;
export type ThreadEnding = (typeof THREAD_ENDINGS)[number];
export const BENCH_METHODS = ['lashing', 'brace'] as const;
export type BenchMethod = (typeof BENCH_METHODS)[number];
export const LIFE_ITEMS = ['sewing-pouch', 'lashing-cord', 'wood-brace'] as const;
export interface LifeState {
  thread: {
    stage: 'not-started' | 'searching' | 'identified' | 'returned' | 'complete';
    clues: ThreadClue[];
    ending: ThreadEnding | null;
  };
  bench: {
    stage: 'not-started' | 'planning' | 'working' | 'fitted' | 'complete';
    method: BenchMethod | null;
    cleared: boolean;
  };
}
export function newLife(): LifeState {
  return {
    thread: { stage: 'not-started', clues: [], ending: null },
    bench: { stage: 'not-started', method: null, cleared: false },
  };
}
