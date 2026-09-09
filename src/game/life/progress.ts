import type { GameState } from '../types';
import type { LifeState } from './types';

export function lifeJournalIds(life: LifeState): string[] {
  const ids: string[] = [],
    { thread, bench } = life;
  if (thread.stage !== 'not-started') ids.push('thread-invitation');
  ids.push(...thread.clues.map((id) => 'thread-clue-' + id));
  if (['identified', 'returned', 'complete'].includes(thread.stage)) ids.push('thread-identified');
  if (['returned', 'complete'].includes(thread.stage)) ids.push('thread-returned');
  if (thread.ending) ids.push('thread-ending-' + thread.ending);
  if (bench.stage !== 'not-started') ids.push('bench-inspected');
  if (bench.method) ids.push('bench-method-' + bench.method);
  if (bench.cleared) ids.push('bench-cleared');
  if (['fitted', 'complete'].includes(bench.stage)) ids.push('bench-fitted');
  if (bench.stage === 'complete') ids.push('bench-complete');
  return ids;
}

/** Called only after the shared action/distance guard. Unknown events are no-ops. */
export function applyLifeAction(next: GameState, id: string): boolean {
  const { thread, bench } = next.life,
    c = next.campaign;
  switch (id) {
    case 'life-thread-accept':
      thread.stage = 'searching';
      next.tracking = 'belonging';
      break;
    case 'life-clue-water':
      thread.clues.push('water');
      break;
    case 'life-clue-cloth':
      thread.clues.push('cloth');
      break;
    case 'life-identify':
      thread.stage = 'identified';
      break;
    case 'life-take-pouch':
      c.carrying = 'sewing-pouch';
      break;
    case 'life-set-pouch':
      c.carrying = null;
      break;
    case 'life-return-pouch':
      c.carrying = null;
      thread.stage = 'returned';
      break;
    case 'life-ending-route':
      thread.stage = 'complete';
      thread.ending = 'route';
      break;
    case 'life-ending-welcome':
      thread.stage = 'complete';
      thread.ending = 'welcome';
      break;
    case 'life-bench-inspect':
      bench.stage = 'planning';
      next.tracking = 'rest';
      break;
    case 'life-method-lashing':
      bench.stage = 'working';
      bench.method = 'lashing';
      break;
    case 'life-method-brace':
      bench.stage = 'working';
      bench.method = 'brace';
      break;
    case 'life-clear-bench':
      bench.cleared = true;
      break;
    case 'life-take-lashing':
      c.carrying = 'lashing-cord';
      break;
    case 'life-take-brace':
      c.carrying = 'wood-brace';
      break;
    case 'life-return-lashing':
    case 'life-return-brace':
      c.carrying = null;
      break;
    case 'life-fit-lashing':
    case 'life-fit-brace':
      c.carrying = null;
      bench.stage = 'fitted';
      break;
    case 'life-test-bench':
      bench.stage = 'complete';
      break;
    default:
      return false;
  }
  for (const entry of lifeJournalIds(next.life))
    if (!next.journal.includes(entry)) next.journal.push(entry);
  return true;
}
