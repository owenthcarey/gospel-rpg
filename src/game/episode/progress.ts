import { chapters } from '../../content/campaign/chapters';
import { episodeActionInReach, actionFor } from '../../content/episode/interactions';
import type { GameState } from '../types';
import {
  AFTERMATH,
  PREPARATIONS,
  SCENE_IDS,
  type EpisodeEvent,
  type EpisodeProgress,
} from './types';

export function preparationsReady(episode: EpisodeProgress): boolean {
  return PREPARATIONS.every((id) => episode.preparations.includes(id)) && episode.carrying === null;
}
export function aftermathReady(episode: EpisodeProgress): boolean {
  return AFTERMATH.every((id) => episode.aftermath.includes(id));
}
export function hasReturned(episode: EpisodeProgress): boolean {
  return episode.stage === 'aftermath' || episode.stage === 'complete';
}
export function completedScenes(episode: EpisodeProgress): readonly string[] {
  if (hasReturned(episode)) return SCENE_IDS;
  if (episode.stage !== 'witnessing' || !episode.checkpoint) return [];
  return SCENE_IDS.slice(0, SCENE_IDS.indexOf(episode.checkpoint));
}
/** Exact set expected in saves; order in the journal stays the player's own. */
export function episodeJournalIds(episode: EpisodeProgress): string[] {
  const ids: string[] = [];
  if (episode.stage !== 'not-started') ids.push('episode-invitation');
  if (episode.carrying || episode.preparations.includes('basket')) ids.push('action-take-basket');
  for (const preparation of episode.preparations) {
    const id = { basket: 'place-basket', mooring: 'secure-mooring', gathering: 'join-gathering' }[
      preparation
    ];
    ids.push('action-' + id);
  }
  ids.push(...completedScenes(episode).map((id) => 'scene-' + id));
  for (const task of episode.aftermath) {
    ids.push(
      'action-' + { landing: 'receive-catch', miriam: 'talk-miriam', ezra: 'talk-ezra' }[task],
    );
  }
  ids.push(...episode.notes.map((id) => 'note-' + id));
  if (episode.reflection) ids.push('reflection-' + episode.reflection);
  if (episode.stage === 'complete') ids.push('episode-complete');
  return ids;
}
function addJournal(state: GameState, id: string): void {
  if (!state.journal.includes(id)) state.journal.push(id);
}
function returnToShore(state: GameState): void {
  state.episode.stage = 'aftermath';
  state.episode.checkpoint = null;
  state.region = 'capernaum';
  state.position = { x: 5, z: 6 };
  for (const id of SCENE_IDS) addJournal(state, 'scene-' + id);
}

/** Returns the original object for stale, repeated or out-of-order commands. */
export function transitionEpisode(state: GameState, event: EpisodeEvent): GameState {
  const next = structuredClone(state);
  const e = next.episode;
  switch (event.type) {
    case 'track-story':
      if (!chapters[event.story].available(state)) return state;
      if (state.tracking === event.story) return state;
      next.tracking = event.story;
      return next;
    case 'start-episode':
      if (state.quest !== 'complete' || e.stage !== 'not-started' || state.region !== 'capernaum')
        return state;
      e.stage = 'preparing';
      next.tracking = 'main';
      addJournal(next, 'episode-invitation');
      return next;
    case 'episode-action': {
      if (!episodeActionInReach(state, event.id)) return state;
      const definition = actionFor(event.id);
      const effect = definition.effect;
      switch (effect.kind) {
        case 'carry':
          e.carrying = 'empty-basket';
          break;
        case 'place':
          e.carrying = null;
          e.preparations.push(effect.preparation);
          break;
        case 'prepare':
          e.preparations.push(effect.preparation);
          break;
        case 'aftermath':
          e.aftermath.push(effect.task);
          break;
      }
      addJournal(next, 'action-' + event.id);
      return next;
    }
    case 'episode-note':
      if (e.stage === 'not-started' || e.notes.includes(event.id) || state.region !== 'capernaum')
        return state;
      e.notes.push(event.id);
      addJournal(next, 'note-' + event.id);
      return next;
    case 'enter-scene':
      if (state.region !== 'capernaum') return state;
      if (e.stage === 'preparing' && preparationsReady(e)) {
        e.stage = 'witnessing';
        e.checkpoint = SCENE_IDS[0];
      } else if (e.stage !== 'witnessing') return state;
      next.region = 'lake-gennesaret';
      next.tracking = 'main';
      return next;
    case 'leave-scene':
      if (state.region !== 'lake-gennesaret' || e.stage !== 'witnessing') return state;
      next.region = 'capernaum';
      return next;
    case 'advance-scene': {
      if (
        state.region !== 'lake-gennesaret' ||
        e.stage !== 'witnessing' ||
        e.checkpoint !== event.checkpoint
      )
        return state;
      addJournal(next, 'scene-' + e.checkpoint);
      const nextId = SCENE_IDS[SCENE_IDS.indexOf(event.checkpoint) + 1];
      if (nextId) e.checkpoint = nextId;
      else returnToShore(next);
      return next;
    }
    case 'skip-scene':
      if (
        state.region !== 'lake-gennesaret' ||
        e.stage !== 'witnessing' ||
        e.checkpoint !== event.checkpoint
      )
        return state;
      returnToShore(next);
      return next;
    case 'reflect':
      if (e.stage !== 'aftermath' || !aftermathReady(e) || state.region !== 'capernaum')
        return state;
      e.reflection = event.id;
      e.stage = 'complete';
      addJournal(next, 'reflection-' + event.id);
      addJournal(next, 'episode-complete');
      return next;
  }
}
