export type { AccountId } from './connection/types';
import type { AccountId } from './connection/types';
import type { GameEvent, GameState } from './types';
export function accountFor(s: GameState): AccountId {
  if (s.connection.replay) return s.connection.replay.account;
  if (s.region === 'storm-account') return 'storm';
  if (s.region === 'nain-account') return 'nain';
  if (s.region === 'roof-account') return 'roof';
  if (s.region === 'lake-gennesaret') return 'lake';
  if (
    ['storm', 'crossing'].includes(s.tracking) ||
    ['galilee-water', 'reed-landing', 'sheltered-cove'].includes(s.region)
  )
    return 'storm';
  if (s.tracking === 'nain' || s.tracking === 'trail' || s.tracking === 'company') return 'nain';
  if (s.tracking === 'roof' || s.campaign.roof.stage !== 'not-started') return 'roof';
  return 'lake';
}
export function leavePresentationEvent(s: GameState): GameEvent {
  if (s.connection.replay) return { type: 'replay-close' };
  return {
    type:
      s.region === 'storm-account'
        ? 'storm-leave'
        : s.region === 'nain-account'
          ? 'nain-leave'
          : s.region === 'roof-account'
            ? 'roof-leave'
            : 'leave-scene',
  };
}
