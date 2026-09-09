import type { GameState } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { readyReflection } from './journey';
import { gateways, allNeighborhoodPlaces, placeRegion } from '../../src/content/campaign/places';
import { worldAction } from '../../src/content/campaign/actions';
import { ROOF_SCENES } from '../../src/game/campaign/types';
export function completedEpisode(): GameState {
  return transition(readyReflection(), { type: 'reflect', id: 'community' });
}
export function district(): GameState {
  return gateway(completedEpisode(), 'to-lanes');
}
export function at(state: GameState, id: string): GameState {
  const place = allNeighborhoodPlaces.find((p) => p.id === id)!;
  return {
    ...structuredClone(state),
    region: placeRegion(id)!,
    position: id === 'amos' ? { ...state.campaign.walk.position } : { x: place.x, z: place.z },
  };
}
export function action(state: GameState, id: string): GameState {
  const target = worldAction(id)!.target;
  return transition(at(state, target), { type: 'campaign-action', id });
}
export function gateway(state: GameState, id: string): GameState {
  const gate = gateways.find((g) => g.id === id)!;
  return transition(
    { ...state, region: gate.from, position: { x: gate.x, z: gate.z } },
    { type: 'journey', gateway: id },
  );
}
export function witnessed(state = district()): GameState {
  let s = action(state, 'roof-enter');
  for (const checkpoint of ROOF_SCENES) s = transition(s, { type: 'roof-next', checkpoint });
  return s;
}
