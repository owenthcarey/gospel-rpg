import type { ExplorationRegion } from '../game/campaign/types';
import type { GameState } from '../game/types';
import { regions } from './regions';
export const journeyPlaces: Record<
  ExplorationRegion,
  { destination: string; description: string; x: number; y: number }
> = {
  capernaum: {
    destination: 'shore',
    description: 'The village shore, lake memories and a place beside Miriam’s stall.',
    x: 65,
    y: 220,
  },
  'capernaum-lanes': {
    destination: 'water-point',
    description: 'The water point, courtyard and two ways to walk with Amos.',
    x: 210,
    y: 220,
  },
  'gathering-house': {
    destination: 'house-viewpoint',
    description: 'A place to witness and remember Mark 2:1–12.',
    x: 210,
    y: 70,
  },
  bakehouse: {
    destination: 'hannah',
    description: 'Hannah’s oven, mending cloth and a table for neighbors.',
    x: 210,
    y: 360,
  },
  'galilean-road': {
    destination: 'tamar',
    description: 'The spring, terraced paths and Tamar’s recollection.',
    x: 375,
    y: 220,
  },
  'roadside-farm': {
    destination: 'farm-landmark',
    description: 'A dry shelter, a split olive and company for the road.',
    x: 375,
    y: 70,
  },
  'nain-gate': {
    destination: 'nain-viewpoint',
    description: 'A gate, a quiet courtyard and Luke 7:11–17.',
    x: 540,
    y: 220,
  },
};
export function knownRegions(s: GameState): ExplorationRegion[] {
  return [
    ...new Set([
      'capernaum' as const,
      ...(Object.keys(s.campaign.visited) as ExplorationRegion[]),
      ...(Object.keys(s.road.visited) as ExplorationRegion[]),
    ]),
  ];
}
export function travelerRegion(s: GameState): ExplorationRegion {
  return (
    regions[s.region].returnRegion && regions[s.region].mode === 'presentation'
      ? regions[s.region].returnRegion
      : s.region
  ) as ExplorationRegion;
}
