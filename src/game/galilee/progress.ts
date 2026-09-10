import type { GameState } from '../types';
import { CHANNEL_IDS, type GalileeEvent, type GalileeState } from './types';
import {
  canTurnChannel,
  galileeActions,
  galileeBlocker,
  galileeInReach,
} from '../../content/galilee/actions';
export function galileeJournalIds(g: GalileeState): string[] {
  const ids: string[] = [];
  if (g.spring.stage !== 'not-started') ids.push('galilee-spring-start');
  ids.push(...g.spring.notes.map((id) => 'galilee-spring-note-' + id));
  ids.push(...g.spring.cleared.map((id) => 'galilee-spring-clear-' + id));
  if (g.spring.ending) ids.push('galilee-spring-' + g.spring.ending);
  if (g.shelter.stage !== 'not-started') ids.push('galilee-shelter-start');
  ids.push(...g.shelter.inspected.map((id) => 'galilee-shelter-site-' + id));
  if (g.shelter.ending)
    ids.push('galilee-shelter-' + g.shelter.ending, 'galilee-shelter-at-' + g.shelter.site);
  return ids;
}
export function transitionGalilee(state: GameState, event: GalileeEvent): GameState {
  if (state.campaign.roof.stage !== 'complete') return state;
  const next = structuredClone(state),
    g = next.galilee;
  switch (event.type) {
    case 'galilee-action': {
      const action = galileeActions.find((a) => a.id === event.id);
      if (!action || galileeBlocker(state, action)) return state;
      action.apply(next);
      break;
    }
    case 'galilee-turn':
      if (
        !CHANNEL_IDS.includes(event.id) ||
        g.spring.turns[event.id] !== event.expected ||
        !canTurnChannel(state, 'channel-' + event.id)
      )
        return state;
      g.spring.turns[event.id] = ((event.expected + 1) % 4) as typeof event.expected;
      g.spring.tested = false;
      g.spring.stage = 'working';
      break;
    case 'galilee-screen':
      if (
        g.shelter.stage !== 'arranging' ||
        !g.shelter.placed.includes('screen') ||
        g.shelter.screen !== event.expected ||
        state.campaign.carrying ||
        !galileeInReach(state, 'rest-' + g.shelter.site)
      )
        return state;
      g.shelter.screen = ((event.expected + 1) % 4) as typeof event.expected;
      g.shelter.checked = false;
      break;
    case 'galilee-hint':
      if (g.spring.stage === 'not-started' || g.spring.stage === 'complete' || g.spring.hint === 3)
        return state;
      g.spring.hint++;
      break;
  }
  for (const id of galileeJournalIds(g)) if (!next.journal.includes(id)) next.journal.push(id);
  return next;
}
