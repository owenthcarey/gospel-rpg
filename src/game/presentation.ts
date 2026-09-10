import type { GameEvent, GameState } from './types';
export type AccountId = 'lake' | 'roof' | 'nain';
export function accountFor(s: GameState): AccountId {
  if (s.region === 'nain-account') return 'nain';
  if (s.region === 'roof-account') return 'roof';
  if (s.region === 'lake-gennesaret') return 'lake';
  if (s.tracking === 'nain' || s.tracking === 'trail' || s.tracking === 'company') return 'nain';
  if (s.tracking === 'roof' || s.campaign.roof.stage !== 'not-started') return 'roof';
  return 'lake';
}
export function leavePresentationEvent(s: GameState): GameEvent {
  return {
    type:
      s.region === 'nain-account'
        ? 'nain-leave'
        : s.region === 'roof-account'
          ? 'roof-leave'
          : 'leave-scene',
  };
}
