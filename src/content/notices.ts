import type { GameEvent, GameState } from '../game/types';
import type { ActionMotion } from './campaign/actions';
import { worldAction, actionMotion } from './campaign/actions';
import { harborActions, harborNotice } from './harbor/actions';
import { galileeActions } from './galilee/actions';
import { roadActions } from './road/actions';
import { actionFor } from './episode/interactions';
import { traceWater } from '../game/galilee/channel';
import { checkArrangement } from '../game/galilee/arrangement';

/** The visible physical motion an accepted event plays, if any. Cosmetic only. */
export function motionFor(
  event: GameEvent,
  previous: GameState,
  state: GameState,
): { motion: ActionMotion; target?: string } | undefined {
  switch (event.type) {
    case 'harbor-action': {
      const action = harborActions(previous).find((a) => a.id === event.id);
      return action?.motion ? { motion: action.motion, target: action.target } : undefined;
    }
    case 'galilee-action': {
      const action = galileeActions.find((a) => a.id === event.id);
      return action?.motion ? { motion: action.motion, target: action.target } : undefined;
    }
    case 'galilee-turn':
      return { motion: 'Repair', target: 'channel-' + event.id };
    case 'galilee-screen':
      return { motion: 'Repair', target: 'rest-' + state.galilee.shelter.site };
    case 'campaign-action': {
      const action = worldAction(event.id);
      const motion = action && actionMotion(action);
      return motion ? { motion, target: action.target } : undefined;
    }
    case 'episode-action': {
      const action = actionFor(event.id);
      return action.motion ? { motion: action.motion, target: action.destination } : undefined;
    }
  }
  return undefined;
}

/** The journal ribbon for an accepted event: authored text only, derived from saved state. */
export function noticeFor(
  event: GameEvent,
  previous: GameState,
  state: GameState,
): string | undefined {
  switch (event.type) {
    case 'harbor-action':
      return harborNotice(state, event);
    case 'galilee-action':
      return event.id === 'spring-test'
        ? traceWater(state.galilee.spring.turns).message
        : event.id.startsWith('shelter-check-')
          ? checkArrangement(state.galilee.shelter).message
          : galileeActions.find((a) => a.id === event.id)?.notice;
    case 'journey':
      return event.gateway.startsWith('board-')
        ? 'Steer with arrows or WASD, or choose a map destination. Approach a landing to dock.'
        : undefined;
    case 'lake-action':
      if (event.id === 'enter') return undefined;
      return event.id.startsWith('evidence-')
        ? 'Observation recorded. Compare your clues in A sheltered way in the journal.'
        : event.id === 'accept'
          ? 'Joel’s recollection is in your journal. Both shores are open to explore.'
          : event.id === 'arrive'
            ? 'The sheltered landing fits both clues. Return to Joel when you are ready.'
            : 'Your lake memory is recorded.';
    case 'storm-reflect':
      return 'Peace, be still complete · The way home is now available in your journal.';
    case 'lake-ending':
      return 'A sheltered way complete · Your memory is in the journal.';
    case 'road-action':
      return roadActions.find((a) => a.id === event.id)?.notice ?? 'Remembered.';
    case 'road-evidence':
      return 'Observation recorded. The other marker may be inspected in either order.';
    case 'road-step':
      return state.road.company.stage === 'arrived'
        ? 'You have arrived together. Speak with Neri beside the bench.'
        : undefined;
    case 'nain-reflect':
      return 'At the gate complete · Your reflection is remembered.';
    case 'road-ending':
      return 'A way remembered complete · Your shared memory is in the journal.';
    case 'campaign-action':
      return worldAction(event.id)?.notice ?? 'Remembered.';
    case 'roof-reflect':
      return 'Through the Roof complete · Your reflection is remembered.';
    case 'walk-step':
      return state.campaign.walk.stage === 'arrived'
        ? 'You have arrived together. Speak with Amos.'
        : undefined;
    case 'neighbor-note':
      return 'A neighborhood memory has been added to your journal.';
    case 'episode-action':
      return actionFor(event.id).notice;
    case 'start-episode':
      return 'Into the Deep · Make room on the shore.';
    case 'episode-note':
      return 'An observation has been added to your journal.';
    case 'reflect':
      return 'Into the Deep complete · Your reflection is in the journal.';
    case 'leave-scene':
      return 'Your place on the lake is kept. Resume at the shoreline viewpoint.';
    case 'advance-scene':
    case 'skip-scene':
      return state.region === 'capernaum'
        ? 'Back on shore · Help at the landing, then visit Miriam and Ezra.'
        : undefined;
    case 'track-story':
      return 'Your selected story is now tracked.';
    case 'collect':
      return previous.inventory.includes(event.item)
        ? undefined
        : `${event.item === 'net' ? 'Mended fishing net' : 'Barley loaves'} added to your satchel.`;
    case 'accept-quest':
      return previous.quest === 'not-started' ? 'Chapter begun · A place by the water' : undefined;
    case 'deliver':
      return state.quest === 'delivered'
        ? 'Supplies delivered · Jesus is waiting by the water.'
        : undefined;
    case 'discover':
      return previous.discoveries.includes(event.id)
        ? undefined
        : 'A new memory has been added to your journal.';
    case 'listen':
      return previous.quest === 'delivered'
        ? 'Prelude complete · Speak with Simon to continue Into the Deep.'
        : undefined;
    case 'accept-village-story':
      return 'Village story begun · An ordinary morning. Find your next stop in the journal.';
    case 'finish-village-story':
      return 'Village story complete · A place among neighbors. A new memory is in your journal.';
  }
  return undefined;
}
