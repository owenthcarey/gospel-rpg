import type { DiscoveryId, GameEvent, GameState } from './types';

export const discoveryOrder: readonly DiscoveryId[] = ['well', 'olive', 'shore'];

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
    case 'accept-village-story':
      if (state.villageStory !== 'not-started') return state;
      next.villageStory = 'exploring';
      next.journal.push('ezra-invitation');
      break;
    case 'finish-village-story':
      if (state.villageStory !== 'exploring' || !hasMemories(state)) return state;
      next.villageStory = 'complete';
      next.journal.push('ezra-memory');
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
      return villageObjective(state);
  }
}

export function objectiveTarget(state: GameState): string {
  if (state.quest === 'not-started' || (state.quest === 'gathering' && hasSupplies(state)))
    return 'simon';
  if (state.quest === 'gathering') return state.inventory.includes('net') ? 'miriam' : 'nets';
  if (state.quest === 'delivered') return 'jesus';
  return villageTarget(state);
}

export function hasMemories(state: GameState): boolean {
  return discoveryOrder.every((id) => state.discoveries.includes(id));
}

export function villageObjective(state: GameState): string {
  if (state.villageStory === 'complete') return 'A morning remembered. Stay as long as you like.';
  if (state.villageStory === 'not-started') return 'Speak with Ezra near the olive trees';
  if (hasMemories(state)) return 'Share your morning with Ezra';
  return `Remember the well, the grove, and the shore · ${state.discoveries.length} / 3`;
}

export function villageTarget(state: GameState): string {
  if (state.villageStory !== 'exploring' || hasMemories(state)) return 'ezra';
  return discoveryOrder.find((id) => !state.discoveries.includes(id))!;
}
