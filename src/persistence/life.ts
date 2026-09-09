import { idList, isRecord } from './episode';
import {
  BENCH_METHODS,
  LIFE_ITEMS,
  THREAD_CLUES,
  THREAD_ENDINGS,
  type LifeState,
} from '../game/life/types';
import type { CampaignState } from '../game/campaign/types';
function fail(): never {
  throw new Error('This save contains inconsistent investigation or bench progress.');
}
const member = (v: unknown, ids: readonly string[]) => typeof v === 'string' && ids.includes(v);
export function parseLife(raw: unknown, campaign: CampaignState, episodeStage: string): LifeState {
  if (!isRecord(raw) || !isRecord(raw.thread) || !isRecord(raw.bench)) fail();
  const t = raw.thread,
    b = raw.bench;
  if (
    !member(t.stage, ['not-started', 'searching', 'identified', 'returned', 'complete']) ||
    !idList(t.clues, THREAD_CLUES) ||
    (t.ending !== null && !member(t.ending, THREAD_ENDINGS)) ||
    !member(b.stage, ['not-started', 'planning', 'working', 'fitted', 'complete']) ||
    (b.method !== null && !member(b.method, BENCH_METHODS)) ||
    typeof b.cleared !== 'boolean'
  )
    fail();
  const life = raw as unknown as LifeState,
    { thread, bench } = life,
    held = campaign.carrying;
  if (
    episodeStage !== 'complete' &&
    (thread.stage !== 'not-started' ||
      bench.stage !== 'not-started' ||
      LIFE_ITEMS.some((id) => id === held))
  )
    fail();
  if (thread.stage === 'not-started' && thread.clues.length) fail();
  if (['identified', 'returned', 'complete'].includes(thread.stage) && thread.clues.length !== 2)
    fail();
  if ((thread.stage === 'complete') !== (thread.ending !== null)) fail();
  if (held === 'sewing-pouch' && thread.stage !== 'identified') fail();
  if (
    ['not-started', 'planning'].includes(bench.stage)
      ? bench.method !== null || bench.cleared
      : bench.method === null
  )
    fail();
  if (['fitted', 'complete'].includes(bench.stage) && !bench.cleared) fail();
  if (held === 'lashing-cord' || held === 'wood-brace') {
    if (
      bench.stage !== 'working' ||
      bench.method !== (held === 'lashing-cord' ? 'lashing' : 'brace')
    )
      fail();
  }
  return {
    thread: { stage: thread.stage, clues: [...thread.clues], ending: thread.ending },
    bench: { stage: bench.stage, method: bench.method, cleared: bench.cleared },
  };
}
