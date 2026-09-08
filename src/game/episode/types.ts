/** Stable persisted IDs. Renaming any of these requires a save migration. */
export const SCENE_IDS = [
  'gathering',
  'teaching',
  'invitation',
  'answer',
  'lowering',
  'abundance',
  'partners',
  'astonishment',
  'calling',
  'return',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];
export type RegionId = 'capernaum' | 'lake-gennesaret';
export type StoryTrack = 'main' | 'village';
export const PREPARATIONS = ['basket', 'mooring', 'gathering'] as const;
export type PreparationId = (typeof PREPARATIONS)[number];
export const AFTERMATH = ['landing', 'miriam', 'ezra'] as const;
export type AftermathId = (typeof AFTERMATH)[number];
export const REFLECTIONS = ['wonder', 'trust', 'community'] as const;
export type ReflectionId = (typeof REFLECTIONS)[number];
export const NOTES = ['landing', 'boat', 'net'] as const;
export type NoteId = (typeof NOTES)[number];
export const ACTION_IDS = [
  'take-basket',
  'place-basket',
  'secure-mooring',
  'join-gathering',
  'receive-catch',
  'talk-miriam',
  'talk-ezra',
] as const;
export type EpisodeActionId = (typeof ACTION_IDS)[number];
export interface EpisodeProgress {
  stage: 'not-started' | 'preparing' | 'witnessing' | 'aftermath' | 'complete';
  preparations: PreparationId[];
  carrying: 'empty-basket' | null;
  checkpoint: SceneId | null;
  aftermath: AftermathId[];
  reflection: ReflectionId | null;
  notes: NoteId[];
}
export type EpisodeEvent =
  | { type: 'start-episode' }
  | { type: 'episode-action'; id: EpisodeActionId }
  | { type: 'episode-note'; id: NoteId }
  | { type: 'enter-scene' }
  | { type: 'advance-scene'; checkpoint: SceneId }
  | { type: 'leave-scene' }
  | { type: 'skip-scene'; checkpoint: SceneId }
  | { type: 'reflect'; id: ReflectionId }
  | { type: 'track-story'; story: StoryTrack };

export function newEpisode(): EpisodeProgress {
  return {
    stage: 'not-started',
    preparations: [],
    carrying: null,
    checkpoint: null,
    aftermath: [],
    reflection: null,
    notes: [],
  };
}
