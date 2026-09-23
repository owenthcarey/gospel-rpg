import type { GameState } from '../types';
import { distance } from '../pathfinding';
import { harborPlace } from '../../content/harbor/places';
import { traceHarbor } from './arrangement';
import {
  harborRevision,
  HARBOR_NOTES,
  HARBOR_ENDINGS,
  type HarborEvent,
  type HarborState,
} from './types';

export function harborJournalIds(h: HarborState): string[] {
  return [
    ...(h.stage !== 'not-started' ? ['harbor-start'] : []),
    ...h.notes.map((n) => 'harbor-note-' + n),
    ...(h.cleared ? ['harbor-cleared'] : []),
    ...(h.ending ? ['harbor-' + h.ending, 'harbor-route-' + h.plank] : []),
  ];
}
export function harborActionTarget(id: string): string | undefined {
  if (id === 'accept' || id.startsWith('remember-')) return 'eliab';
  if (id === 'observe-water') return 'harbor-water';
  if (['observe-passage', 'clear', 'test'].includes(id)) return 'harbor-entrance';
  if (['plank-north', 'plank-south', 'plank-rack', 'turn'].includes(id)) return 'harbor-plank';
  if (['cargo-nets', 'cargo-jars'].includes(id)) return 'harbor-' + id.slice(6);
}
export function harborBlocker(s: GameState, id: string): string | undefined {
  const h = s.harbor;
  if (s.connection.replay || s.region !== 'capernaum')
    return 'Return to the ordinary shore to work here.';
  if (id === 'hint')
    return h.stage === 'not-started' || h.stage === 'complete' || h.hint === 3
      ? 'No further hint is needed.'
      : undefined;
  const target = harborPlace(harborActionTarget(id) ?? '');
  if (!target) return 'This action is not available.';
  if (distance(s.position, target) >= 2.8) return 'Approach this part of the landing to act.';
  if (id === 'accept')
    return h.stage === 'not-started' ? undefined : 'Eliab’s invitation is already remembered.';
  if (h.stage === 'not-started') return 'Speak with Eliab to begin this optional story.';
  if (h.stage === 'complete') return 'This arrangement is remembered and remains in use.';
  if (id.startsWith('observe-')) {
    const note = id.slice(8);
    return HARBOR_NOTES.some((n) => n === note) && !h.notes.some((n) => n === note)
      ? undefined
      : 'This detail is already recorded.';
  }
  if (id.startsWith('remember-'))
    return HARBOR_ENDINGS.some((n) => id === 'remember-' + n) && h.stage === 'ready'
      ? undefined
      : 'Test a clear passage before choosing a memory.';
  if (h.notes.length !== 2) return 'Inspect the water marks and the western passage first.';
  if (s.campaign.carrying || s.episode.carrying)
    return 'Put down what you carry before working with both hands.';
  if (id === 'clear' && h.cleared) return 'The rope is already coiled.';
  if (id.startsWith('plank-') && h.plank === id.slice(6)) return 'The plank is already here.';
  if (id === 'test' && h.tested)
    return 'This arrangement has already been tested. Move something to try again.';
}
export function transitionHarbor(s: GameState, event: HarborEvent): GameState {
  if (harborBlocker(s, event.id)) return s;
  const h = s.harbor;
  const changing = [
    'clear',
    'turn',
    'plank-north',
    'plank-south',
    'plank-rack',
    'cargo-nets',
    'cargo-jars',
  ].includes(event.id);
  if (changing && event.expected !== harborRevision(h)) return s;
  const next = structuredClone(s),
    n = next.harbor;
  if (changing) {
    n.stage = 'working';
    n.tested = false;
  }
  switch (event.id) {
    case 'accept':
      n.stage = 'working';
      next.tracking = 'harbor';
      break;
    case 'observe-water':
      n.notes.push('water');
      break;
    case 'observe-passage':
      n.notes.push('passage');
      break;
    case 'clear':
      n.cleared = true;
      break;
    case 'plank-north':
      n.plank = 'north';
      break;
    case 'plank-south':
      n.plank = 'south';
      break;
    case 'plank-rack':
      n.plank = 'rack';
      break;
    case 'turn':
      n.turn = n.turn === 0 ? 1 : 0;
      break;
    case 'cargo-nets':
      n.cargo.nets = !n.cargo.nets;
      break;
    case 'cargo-jars':
      n.cargo.jars = !n.cargo.jars;
      break;
    case 'test':
      n.tested = true;
      n.stage = traceHarbor(n).route ? 'ready' : 'working';
      break;
    case 'hint':
      n.hint++;
      break;
    case 'remember-patience':
      n.ending = 'patience';
      n.stage = 'complete';
      break;
    case 'remember-room':
      n.ending = 'room';
      n.stage = 'complete';
      break;
    default:
      return s;
  }
  for (const id of harborJournalIds(n)) if (!next.journal.includes(id)) next.journal.push(id);
  return next;
}
