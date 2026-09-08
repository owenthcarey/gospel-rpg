import type { GameState } from '../types';
import { hasReturned } from './progress';
export interface VillagePresentation {
  delivered: boolean;
  tookNet: boolean;
  gathering: boolean;
  episodeStarted: boolean;
  returned: boolean;
  carrying: boolean;
  basketPlaced: boolean;
  basketReceived: boolean;
  ropeCoiled: boolean;
}
export function villagePresentation(state: GameState): VillagePresentation {
  return {
    delivered: state.quest === 'delivered' || state.quest === 'complete',
    tookNet:
      state.inventory.includes('net') || state.quest === 'delivered' || state.quest === 'complete',
    gathering: state.episode.preparations.includes('gathering'),
    episodeStarted: state.episode.stage !== 'not-started',
    returned: hasReturned(state.episode),
    carrying: state.episode.carrying !== null,
    basketPlaced: state.episode.preparations.includes('basket'),
    basketReceived: state.episode.aftermath.includes('landing'),
    ropeCoiled: state.episode.preparations.includes('mooring'),
  };
}
