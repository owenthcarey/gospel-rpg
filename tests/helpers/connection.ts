import { transition } from '../../src/game/quest';
import type { GameState } from '../../src/game/types';
import { homePlaces } from '../../src/content/connection/home';
import { routePlan } from '../../src/game/connection/routes';
import { gateways } from '../../src/content/campaign/places';
import { campaignLayout } from '../../src/content/campaign/layouts';
import { WalkGrid } from '../../src/game/pathfinding';
import { isLand, obstacles } from '../../src/content/region';
import { stormAftermath, lakeAction, lakeAt } from './lake';

export function completedJourney(): GameState {
  let state = stormAftermath();
  for (const [id, target] of [
    ['landing', 'cove-shore'],
    ['lookout', 'cove-lookout'],
    ['neighbor', 'dalia'],
  ])
    state = lakeAction(state, 'after-' + id, target!);
  return transition(lakeAt(state, 'storm-viewpoint'), { type: 'storm-reflect', id: 'wonder' });
}
/** Walk to each explicit passage through the real reducers, retaining the whole save. */
export function homeAt(state: GameState, visit: 'farm' | 'table' | 'shore'): GameState {
  let s = structuredClone(state);
  const place = homePlaces.find((p) => p.visit === visit)!;
  for (let i = 0; s.region !== place.region && i < 12; i++) {
    const plan = routePlan(s, place.id)!;
    const gate = gateways.find((g) => g.id === plan.leg)!;
    s.position = { x: gate.x, z: gate.z };
    if (s.region === 'galilee-water') s.lake.boat.position = { ...s.position };
    const next = transition(s, { type: 'journey', gateway: gate.id });
    if (next === s) throw new Error('Blocked helper passage: ' + gate.id);
    s = next;
  }
  const layout = campaignLayout(s.region);
  const grid = layout
    ? new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max)
    : new WalkGrid(obstacles, isLand);
  s.position = grid.nearest(place)!;
  return s;
}
