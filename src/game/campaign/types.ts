import type { Point } from '../types';

export const EXPLORATION_REGIONS = [
  'capernaum',
  'capernaum-lanes',
  'gathering-house',
  'bakehouse',
] as const;
export type ExplorationRegion = (typeof EXPLORATION_REGIONS)[number];
export const REGION_IDS = [...EXPLORATION_REGIONS, 'lake-gennesaret', 'roof-account'] as const;
export type RegionId = (typeof REGION_IDS)[number];
export const STORY_TRACKS = ['main', 'village', 'roof', 'neighbors', 'table'] as const;
export type StoryTrack = (typeof STORY_TRACKS)[number];
export const ROOF_SCENES = [
  'house',
  'bearers',
  'roof',
  'forgiven',
  'question',
  'authority',
  'rise',
  'amazement',
] as const;
export type RoofSceneId = (typeof ROOF_SCENES)[number];
export const ROOF_REFLECTIONS = ['welcome', 'persistence', 'amazement'] as const;
export type RoofReflection = (typeof ROOF_REFLECTIONS)[number];
export const ROOF_AFTERMATH = ['ruth', 'hannah', 'house'] as const;
export const NEIGHBOR_NOTES = [
  'threshold',
  'oven',
  'roof-beams',
  'water',
  'lane',
  'table',
] as const;
export type NeighborNote = (typeof NEIGHBOR_NOTES)[number];
export const HELD_ITEMS = ['bread-basket', 'empty-jug', 'water-jug', 'cart-handle'] as const;
export type HeldItem = (typeof HELD_ITEMS)[number];
export interface CampaignState {
  roof: {
    stage: 'not-started' | 'exploring' | 'witnessing' | 'aftermath' | 'complete';
    checkpoint: RoofSceneId | null;
    aftermath: (typeof ROOF_AFTERMATH)[number][];
    reflection: RoofReflection | null;
  };
  walk: {
    stage: 'not-started' | 'invited' | 'walking' | 'arrived' | 'complete';
    route: 'passage' | 'outer' | null;
    gateOpen: boolean;
    step: number;
    position: Point;
  };
  table: {
    stage: 'not-started' | 'preparing' | 'complete';
    location: 'courtyard' | 'bakehouse' | null;
    delivered: ('bread' | 'water')[];
  };
  carrying: HeldItem | null;
  notes: NeighborNote[];
  visited: Partial<Record<ExplorationRegion, Point>>;
}
export type CampaignEvent =
  | { type: 'journey'; gateway: string }
  | { type: 'campaign-action'; id: string }
  | { type: 'roof-next'; checkpoint: RoofSceneId }
  | { type: 'roof-summary'; checkpoint: RoofSceneId }
  | { type: 'roof-leave' }
  | { type: 'roof-reflect'; id: RoofReflection }
  | { type: 'neighbor-note'; id: NeighborNote }
  | { type: 'walk-step' };
export function newCampaign(): CampaignState {
  return {
    roof: { stage: 'not-started', checkpoint: null, aftermath: [], reflection: null },
    walk: {
      stage: 'not-started',
      route: null,
      gateOpen: false,
      step: 0,
      position: { x: -9, z: -5 },
    },
    table: { stage: 'not-started', location: null, delivered: [] },
    carrying: null,
    notes: [],
    visited: {},
  };
}
export function isExploration(region: RegionId): region is ExplorationRegion {
  return EXPLORATION_REGIONS.some((id) => id === region);
}
