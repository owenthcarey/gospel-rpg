import { newCampaign, type CampaignState, type CampaignEvent } from './campaign/types';
import {
  newEpisode,
  type EpisodeEvent,
  type EpisodeProgress,
  type RegionId,
  type StoryTrack,
} from './episode/types';

export interface Point {
  x: number;
  z: number;
}
export type QuestStage = 'not-started' | 'gathering' | 'delivered' | 'complete';
export type ItemId = 'net' | 'bread';
export type DiscoveryId = 'shore' | 'well' | 'olive';
export type VillageStoryStage = 'not-started' | 'exploring' | 'complete';
export interface GameState {
  region: RegionId;
  campaign: CampaignState;
  episode: EpisodeProgress;
  tracking: StoryTrack;
  villageMemory: DiscoveryId | null;
  position: Point;
  quest: QuestStage;
  inventory: ItemId[];
  discoveries: DiscoveryId[];
  villageStory: VillageStoryStage;
  journal: string[];
  playTime: number;
}
export type GameEvent =
  | CampaignEvent
  | EpisodeEvent
  | { type: 'remember-village'; id: DiscoveryId }
  | { type: 'accept-quest' }
  | { type: 'collect'; item: ItemId }
  | { type: 'deliver' }
  | { type: 'listen' }
  | { type: 'accept-village-story' }
  | { type: 'finish-village-story' }
  | { type: 'discover'; id: DiscoveryId };
export interface Settings {
  textSize: 'standard' | 'large';
  sound: boolean;
  volume: number;
  quality: 'low' | 'high';
  reducedMotion: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  textSize: 'standard',
  sound: false,
  volume: 0.35,
  quality: 'high',
  reducedMotion: false,
};
export function newGame(): GameState {
  return {
    region: 'capernaum',
    campaign: newCampaign(),
    episode: newEpisode(),
    tracking: 'main',
    villageMemory: null,
    position: { x: -1, z: -3 },
    quest: 'not-started',
    inventory: [],
    discoveries: [],
    villageStory: 'not-started',
    journal: ['arrival'],
    playTime: 0,
  };
}
