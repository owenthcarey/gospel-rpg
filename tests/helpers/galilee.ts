import type { GameState } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { galileeActions } from '../../src/content/galilee/actions';
import { CHANNEL_IDS, type Direction, type RestSite } from '../../src/game/galilee/types';
import { at } from './campaign';
import { roadStart } from './road';
import { campaignLayout, layoutObstacles } from '../../src/content/campaign/layouts';
import { WalkGrid } from '../../src/game/pathfinding';
import { approachPath } from '../../src/game/navigation';
import { rememberPosition } from '../../src/game/road/progress';
import { isRoadRegion } from '../../src/game/road/types';
import { makeSave } from '../../src/persistence/schema';
export function galileeAction(s: GameState, id: string): GameState {
  const action = galileeActions.find((a) => a.id === id);
  if (!action) throw new Error('Unknown action ' + id);
  const current = at(s, action.target),
    layout = campaignLayout(current.region)!;
  const grid = new WalkGrid(
    layoutObstacles(current),
    layout.terrain,
    layout.bounds.min,
    layout.bounds.max,
  );
  current.position = approachPath(grid, { x: 0, z: -9 }, current.position).at(-1)!;
  if (isRoadRegion(current.region)) rememberPosition(current, current.region);
  const next = transition(current, { type: 'galilee-action', id });
  if (next === current) throw new Error('Action rejected ' + id);
  return makeSave(next).state;
}
export function preparedSpring(s = roadStart()): GameState {
  for (const id of [
    'spring-start',
    'spring-note-source',
    'spring-note-basins',
    'spring-borrow',
    'spring-clear-inlet',
    'spring-clear-silt',
    'spring-return',
  ])
    s = galileeAction(s, id);
  return s;
}
export function connectSpring(
  s = preparedSpring(),
  outlet: 'north' | 'south' = 'north',
): GameState {
  const desired = { entry: 1, turn: outlet === 'north' ? 3 : 2, north: 1, south: 0 };
  for (const id of CHANNEL_IDS)
    while (s.galilee.spring.turns[id] !== desired[id]) {
      s = transition(at(s, 'channel-' + id), {
        type: 'galilee-turn',
        id,
        expected: s.galilee.spring.turns[id],
      });
      s = makeSave(s).state;
    }
  return galileeAction(s, 'spring-test');
}
export function chosenShelter(s = roadStart(), site: RestSite = 'shade'): GameState {
  for (const id of [
    'shelter-start',
    'shelter-inspect-shade',
    'shelter-inspect-breeze',
    'shelter-choose-' + site,
  ])
    s = galileeAction(s, id);
  return s;
}
export function arrangedShelter(s = chosenShelter(), screen: Direction = 0): GameState {
  for (const id of ['mat', 'water', 'screen']) {
    s = galileeAction(s, 'shelter-take-' + id);
    s = galileeAction(s, 'shelter-place-' + s.galilee.shelter.site + '-' + id);
  }
  while (s.galilee.shelter.screen !== screen)
    s = makeSave(
      transition(at(s, 'rest-' + s.galilee.shelter.site), {
        type: 'galilee-screen',
        expected: s.galilee.shelter.screen,
      }),
    ).state;
  return galileeAction(s, 'shelter-check-' + s.galilee.shelter.site);
}
