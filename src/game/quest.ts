import type { GameEvent, GameState } from './types';

/** The sole authority for story progression. Invalid/repeated actions are harmless. */
export function transition(state: GameState, event: GameEvent): GameState {
  const next = structuredClone(state);
  switch (event.type) {
    case 'accept-quest':
      if (state.quest !== 'not-started') return state;
      next.quest = 'gathering';
      next.journal.push('simon');
      break;
    case 'collect':
      if (state.quest !== 'gathering' || state.inventory.includes(event.item)) return state;
      next.inventory.push(event.item);
      next.journal.push(event.item);
      break;
    case 'deliver':
      if (state.quest !== 'gathering' || !hasSupplies(state)) return state;
      next.quest = 'delivered';
      next.inventory = [];
      next.journal.push('delivered');
      break;
    case 'listen':
      if (state.quest !== 'delivered') return state;
      next.quest = 'complete';
      next.journal.push('complete');
      break;
    case 'discover':
      if (state.discoveries.includes(event.id)) return state;
      next.discoveries.push(event.id);
      next.journal.push(event.id);
      break;
  }
  return next;
}

export function hasSupplies(state: GameState): boolean {
  return state.inventory.includes('net') && state.inventory.includes('bread');
}

export function objective(state: GameState): string {
  switch (state.quest) {
    case 'not-started':
      return 'Speak with Simon by the boats';
    case 'gathering':
      return hasSupplies(state) ? 'Bring the supplies to Simon' : 'Help prepare the shore';
    case 'delivered':
      return 'Listen to Jesus by the water';
    case 'complete':
      return 'Take your time. There is more to discover.';
  }
}

export function objectiveTarget(state: GameState): string {
  if (state.quest === 'not-started' || (state.quest === 'gathering' && hasSupplies(state)))
    return 'simon';
  if (state.quest === 'gathering') return state.inventory.includes('net') ? 'miriam' : 'nets';
  if (state.quest === 'delivered') return 'jesus';
  return 'shore';
}
