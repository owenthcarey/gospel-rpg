import type { GameState } from '../../game/types';
import { REST_LAYOUTS } from '../../game/galilee/arrangement';
import type { RestSite, RestSupply } from '../../game/galilee/types';

export function heldItemStatus(state: GameState): string {
  return state.region === 'galilee-water' ? 'Stowed aboard' : 'In your hands';
}

export function restSupplyStatus(state: GameState, supply: RestSupply, here: RestSite): string {
  const shelter = state.galilee.shelter;
  if (shelter.site && shelter.placed.includes(supply))
    return shelter.site === here ? 'Placed here' : `Placed at: ${REST_LAYOUTS[shelter.site].title}`;
  if (state.campaign.carrying === 'rest-' + supply) return heldItemStatus(state);
  return 'At the rack';
}
