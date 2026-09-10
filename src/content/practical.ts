import type { GameEvent, GameState } from '../game/types';
import type { ActionMotion } from './campaign/actions';
import { actionBlocker, actionMotion, worldActions } from './campaign/actions';
import { actionAvailable, episodeActions, episodeActionInReach } from './episode/interactions';
import { galileeActions, galileeBlocker } from './galilee/actions';
export interface PracticalAction {
  id: string;
  target: string;
  label: string;
  blocker?: string;
  motion?: ActionMotion;
  event: GameEvent;
}
/** A shared UI contract; each authoritative reducer still validates the event. */
export function practicalActions(s: GameState): PracticalAction[] {
  return [
    ...worldActions
      .filter((a) => actionMotion(a) && (a.visible?.(s) ?? a.available(s)))
      .map((a) => ({
        id: a.id,
        target: a.target,
        label: a.label,
        blocker: actionBlocker(a, s),
        motion: actionMotion(a),
        event: { type: 'campaign-action' as const, id: a.id },
      })),
    ...episodeActions
      .filter((a) => a.motion && actionAvailable(s, a.id))
      .map((a) => ({
        id: 'episode:' + a.id,
        target: a.destination,
        label: a.label,
        motion: a.motion,
        blocker: episodeActionInReach(s, a.id) ? undefined : 'Approach this object to act.',
        event: { type: 'episode-action' as const, id: a.id },
      })),
    ...galileeActions
      .filter((a) => a.motion && (a.visible?.(s) ?? a.available(s)))
      .map((a) => ({
        id: 'galilee:' + a.id,
        target: a.target,
        label: a.label,
        motion: a.motion,
        blocker: galileeBlocker(s, a),
        event: { type: 'galilee-action' as const, id: a.id },
      })),
  ];
}
