import type { GameState } from '../../src/game/types';
import type { RoadActionId } from '../../src/game/road/types';
import { transition } from '../../src/game/quest';
import { at, action, gateway, witnessed } from './campaign';
import { localRoadPlaces } from '../../src/content/road/places';
import { roadActions } from '../../src/content/road/actions';
import { placeRegion } from '../../src/content/campaign/places';
import { campaignLayout } from '../../src/content/campaign/layouts';
import { WalkGrid } from '../../src/game/pathfinding';
export function completedRoof(): GameState {
  let s = witnessed();
  for (const id of ['after-ruth', 'after-hannah', 'after-house']) s = action(s, id);
  return transition(at(s, 'house-viewpoint'), { type: 'roof-reflect', id: 'welcome' });
}
export function roadStart(): GameState {
  return gateway(completedRoof(), 'to-road');
}
export function roadAt(s: GameState, id: string): GameState {
  const state = structuredClone(s);
  state.region = placeRegion(id, state)!;
  const p = localRoadPlaces(state).find((p) => p.id === id)!;
  const layout = campaignLayout(state.region)!;
  state.position = new WalkGrid(
    layout.obstacles,
    layout.terrain,
    layout.bounds.min,
    layout.bounds.max,
  ).nearest(p)!;
  return state;
}
export function roadAction(s: GameState, id: RoadActionId): GameState {
  return transition(roadAt(s, roadActions.find((a) => a.id === id)!.target), {
    type: 'road-action',
    id,
  });
}
