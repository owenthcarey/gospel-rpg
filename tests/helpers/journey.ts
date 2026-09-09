import { newGame, type GameEvent, type GameState } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { actionFor } from '../../src/content/episode/interactions';
import { activeInteractables } from '../../src/content/region';
import type { EpisodeActionId } from '../../src/game/episode/types';
import { SCENE_IDS } from '../../src/game/episode/types';

export function play(events: readonly GameEvent[], initial: GameState = newGame()): GameState {
  return events.reduce(
    (state, event) =>
      event.type === 'episode-action' ? episodeAction(state, event.id) : transition(state, event),
    initial,
  );
}
export function completedPrelude(): GameState {
  return play([
    { type: 'accept-quest' },
    { type: 'collect', item: 'net' },
    { type: 'collect', item: 'bread' },
    { type: 'deliver' },
    { type: 'listen' },
  ]);
}
export function readyShore(): GameState {
  return play(
    [
      { type: 'start-episode' },
      { type: 'episode-action', id: 'take-basket' },
      { type: 'episode-action', id: 'place-basket' },
      { type: 'episode-action', id: 'secure-mooring' },
      { type: 'episode-action', id: 'join-gathering' },
    ],
    completedPrelude(),
  );
}
export function onLake(): GameState {
  return transition(readyShore(), { type: 'enter-scene' });
}
export function returnedShore(): GameState {
  return play(
    SCENE_IDS.map((checkpoint) => ({ type: 'advance-scene', checkpoint })),
    onLake(),
  );
}
export function readyReflection(): GameState {
  return play(
    [
      { type: 'episode-action', id: 'receive-catch' },
      { type: 'episode-action', id: 'talk-miriam' },
      { type: 'episode-action', id: 'talk-ezra' },
    ],
    returnedShore(),
  );
}

/** A journey walks to the authored destination before submitting its action. */
export function episodeAction(state: GameState, id: EpisodeActionId): GameState {
  const target = activeInteractables(state).find((p) => p.id === actionFor(id).destination);
  if (!target) throw new Error('Missing episode destination: ' + id);
  return transition(
    { ...state, position: { x: target.x, z: target.z } },
    { type: 'episode-action', id },
  );
}
