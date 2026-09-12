import type { GameState } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { NAIN_SCENES } from '../../src/game/road/types';
import { STORM_SCENES, type Berth, isLakeRegion } from '../../src/game/lake/types';
import { roadStart, roadAction, roadAt } from './road';
import { gateway } from './campaign';
import { lakeGateways, localLakePlaces } from '../../src/content/lake/places';
import { WalkGrid } from '../../src/game/pathfinding';
import { campaignLayout } from '../../src/content/campaign/layouts';

/** Reach the unlock through the actual Gospel reducers, without optional errands. */
export function completedNain(s = gateway(roadStart(), 'to-nain')): GameState {
  s = roadAction(s, 'nain-enter');
  for (const checkpoint of NAIN_SCENES) s = transition(s, { type: 'nain-next', checkpoint });
  for (const id of ['nain-after-gate', 'nain-after-courtyard', 'nain-after-neighbor'] as const)
    s = roadAction(s, id);
  return transition(roadAt(s, 'nain-viewpoint'), { type: 'nain-reflect', id: 'restoration' });
}
export function lakeStart(s = completedNain()): GameState {
  for (const id of ['nain-exit', 'road-to-lanes', 'to-shore']) s = gateway(s, id);
  return s;
}
export function lakeAt(s: GameState, id: string): GameState {
  const next = structuredClone(s);
  const p =
    localLakePlaces(next).find((p) => p.id === id) ??
    lakeGateways.find((g) => g.id === id && g.from === s.region);
  if (!p) throw new Error('No local lake destination: ' + id);
  const layout = campaignLayout(s.region);
  next.position = layout
    ? new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max).nearest(
        p,
      )!
    : { x: p.x, z: p.z };
  if (s.region === 'galilee-water') next.lake.boat.position = { ...next.position };
  if (isLakeRegion(s.region)) next.lake.visited[s.region] = { ...next.position };
  return next;
}
export function lakeAction(s: GameState, id: string, target: string): GameState {
  return transition(lakeAt(s, target), { type: 'lake-action', id });
}
export function sail(s = lakeStart()): GameState {
  return transition(lakeAt(s, 'board-' + s.region), {
    type: 'journey',
    gateway: 'board-' + s.region,
  });
}
export function dock(s: GameState, berth: Berth): GameState {
  return transition(lakeAt(s, 'dock-' + berth), { type: 'journey', gateway: 'dock-' + berth });
}
export function coveStart(s = lakeStart()): GameState {
  return dock(sail(s), 'sheltered-cove');
}
export function stormStart(s = coveStart()): GameState {
  return lakeAction(s, 'enter', 'storm-viewpoint');
}
export function stormAftermath(s = stormStart()): GameState {
  for (const checkpoint of STORM_SCENES) s = transition(s, { type: 'storm-next', checkpoint });
  return s;
}
export function crossingInterpreted(s = lakeStart()): GameState {
  s = sail(lakeAction(s, 'accept', 'joel'));
  for (const id of ['reeds', 'split-rock']) s = lakeAction(s, 'evidence-' + id, 'lake-' + id);
  return transition(s, { type: 'lake-interpret', id: 'sheltered' });
}
