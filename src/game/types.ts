export interface Point {
  x: number;
  z: number;
}
export type QuestStage = 'not-started' | 'gathering' | 'delivered' | 'complete';
export type ItemId = 'net' | 'bread';
export type DiscoveryId = 'shore' | 'well' | 'olive';
export type VillageStoryStage = 'not-started' | 'exploring' | 'complete';
export interface GameState {
  position: Point;
  quest: QuestStage;
  inventory: ItemId[];
  discoveries: DiscoveryId[];
  villageStory: VillageStoryStage;
  journal: string[];
  playTime: number;
}
export type GameEvent =
  | { type: 'accept-quest' }
  | { type: 'collect'; item: ItemId }
  | { type: 'deliver' }
  | { type: 'listen' }
  | { type: 'accept-village-story' }
  | { type: 'finish-village-story' }
  | { type: 'discover'; id: DiscoveryId };
export interface Settings {
  sound: boolean;
  volume: number;
  quality: 'low' | 'high';
  reducedMotion: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  volume: 0.35,
  quality: 'high',
  reducedMotion: false,
};
export function newGame(): GameState {
  return {
    position: { x: -1, z: -3 },
    quest: 'not-started',
    inventory: [],
    discoveries: [],
    villageStory: 'not-started',
    journal: ['arrival'],
    playTime: 0,
  };
}
