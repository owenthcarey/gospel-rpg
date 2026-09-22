import { newGame, type GameState } from '../../src/game/types';
import { harborActionTarget } from '../../src/game/harbor/progress';
import { harborPlace } from '../../src/content/harbor/places';
import { harborRevision, type HarborRoute } from '../../src/game/harbor/types';
import { transition } from '../../src/game/quest';
import { WalkGrid } from '../../src/game/pathfinding';
import { obstacles, isLand } from '../../src/content/region';
import { approachPath } from '../../src/game/navigation';
import { makeSave } from '../../src/persistence/schema';
export function harborAction(s: GameState, id: string): GameState {
  const current = structuredClone(s),
    target = harborPlace(harborActionTarget(id) ?? '');
  current.region = 'capernaum';
  if (target)
    current.position = approachPath(new WalkGrid(obstacles, isLand), { x: 0, z: -3 }, target).at(
      -1,
    )!;
  if (!current.position) throw new Error('Unreachable harbor target ' + id);
  const next = transition(current, {
    type: 'harbor-action',
    id,
    expected: harborRevision(current.harbor),
  });
  if (next === current) throw new Error('Rejected harbor action ' + id);
  return makeSave(next).state;
}
export function preparedHarbor(s = newGame()): GameState {
  for (const id of ['accept', 'observe-water', 'observe-passage']) s = harborAction(s, id);
  return s;
}
export function clearHarbor(route: HarborRoute = 'north', s = preparedHarbor()): GameState {
  for (const id of [
    'clear',
    'plank-' + route,
    'turn',
    'cargo-' + (route === 'north' ? 'nets' : 'jars'),
    'test',
  ])
    s = harborAction(s, id);
  return s;
}
