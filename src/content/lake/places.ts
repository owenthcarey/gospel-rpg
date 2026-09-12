import type { GameState } from '../../game/types';
import type { Interactable } from '../region';
import type { Gateway } from '../campaign/places';
import { LANDINGS } from '../../game/lake/navigation';
import { BERTHS, isLakeRegion, type LakeRegion } from '../../game/lake/types';

export const lakeGateways: readonly Gateway[] = BERTHS.flatMap((berth) => [
  {
    id: 'board-' + berth,
    name: 'Board for the lake',
    role: 'Board · Steer or choose a map destination',
    kind: 'place' as const,
    ...LANDINGS[berth].land,
    from: berth,
    to: 'galilee-water' as const,
    arrival: LANDINGS[berth].water,
  },
  {
    id: 'dock-' + berth,
    name: LANDINGS[berth].title,
    role: 'Approach, then dock and step ashore',
    kind: 'place' as const,
    ...LANDINGS[berth].water,
    from: 'galilee-water' as const,
    to: berth,
    arrival: LANDINGS[berth].land,
  },
]);
export const boatkeeper: Interactable = {
  id: 'joel',
  name: 'Joel',
  role: 'Boatkeeper · A sheltered way',
  kind: 'person',
  asset: 'villager',
  x: 3,
  z: -4,
};
export const lakePlaces: Record<LakeRegion, readonly Interactable[]> = {
  'galilee-water': [
    {
      id: 'lake-reeds',
      name: 'The reed bank',
      role: 'Study the exposed shore',
      kind: 'place',
      x: 16,
      z: -5,
    },
    {
      id: 'lake-split-rock',
      name: 'The split rock',
      role: 'Study the turning landmark',
      kind: 'place',
      x: -5,
      z: -1,
    },
  ],
  'reed-landing': [
    {
      id: 'reed-shore',
      name: 'The open shore',
      role: 'Notice the reeds and open water',
      kind: 'place',
      x: 5,
      z: 1,
    },
  ],
  'sheltered-cove': [
    {
      id: 'cove-shore',
      name: 'The inward landing',
      role: 'Confirm the shelter behind the headland',
      kind: 'place',
      x: 4,
      z: -3,
    },
    {
      id: 'storm-viewpoint',
      name: 'A view over the lake',
      role: 'Peace, be still · Mark 4:35–41',
      kind: 'place',
      x: -2,
      z: 0,
    },
    {
      id: 'cove-lookout',
      name: 'The quiet lookout',
      role: 'Pause above the water',
      kind: 'place',
      x: 7,
      z: 5,
    },
    {
      id: 'dalia',
      name: 'Dalia',
      role: 'An original neighbor at the cove',
      kind: 'person',
      asset: 'miriam',
      x: -5,
      z: 4,
    },
  ],
};
export function localLakePlaces(s: GameState): Interactable[] {
  if (s.road.chapter.stage !== 'complete') return [];
  return s.region === 'capernaum'
    ? [boatkeeper]
    : isLakeRegion(s.region)
      ? [...lakePlaces[s.region]]
      : [];
}
export function lakePlaceRegion(id: string): 'capernaum' | LakeRegion | undefined {
  if (id === 'joel') return 'capernaum';
  return Object.entries(lakePlaces).find(([, places]) => places.some((p) => p.id === id))?.[0] as
    LakeRegion | undefined;
}
