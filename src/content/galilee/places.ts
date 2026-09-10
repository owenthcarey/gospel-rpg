import type { Interactable } from '../region';
import type { GameState } from '../../game/types';
import { CHANNEL_IDS, REST_SITES } from '../../game/galilee/types';
import { channelPosition } from '../../game/galilee/channel';
import { REST_LAYOUTS } from '../../game/galilee/arrangement';
export const galileePlaces = {
  'galilean-road': [
    {
      id: 'spring-source',
      name: 'The spring channel',
      role: 'A spring for travelers · Inspect and test',
      kind: 'object',
      x: 2,
      z: -7,
    },
    {
      id: 'spring-basins',
      name: 'The receiving basins',
      role: 'Notice where the water can go',
      kind: 'object',
      x: 9,
      z: -7,
    },
    {
      id: 'spring-tools',
      name: 'The scoop rack',
      role: 'Borrow or return the wooden scoop',
      kind: 'object',
      x: 4,
      z: -11,
    },
    ...CHANNEL_IDS.map((id) => ({
      id: 'channel-' + id,
      name: id[0]!.toUpperCase() + id.slice(1) + ' channel',
      role: 'Turn a section · Follow its open ends',
      kind: 'object' as const,
      ...channelPosition(id),
    })),
  ],
  'roadside-farm': [
    {
      id: 'leah',
      name: 'Leah',
      role: 'Room under the olives · A fictional farm host',
      kind: 'person',
      asset: 'leah',
      x: -5,
      z: -2,
    },
    {
      id: 'rest-supplies',
      name: 'The resting supplies',
      role: 'Mats, water and a folding screen',
      kind: 'object',
      x: -3,
      z: 0,
    },
    ...REST_SITES.map((site) => ({
      id: 'rest-' + site,
      name: REST_LAYOUTS[site].title,
      role: 'Inspect · Arrange a place to rest',
      kind: 'place' as const,
      x: REST_LAYOUTS[site].x,
      z: REST_LAYOUTS[site].z,
    })),
  ],
} satisfies Record<string, Interactable[]>;
export const allGalileePlaces: Interactable[] = Object.values(galileePlaces).flat();
export function galileePlaceRegion(id: string): 'galilean-road' | 'roadside-farm' | undefined {
  return (Object.keys(galileePlaces) as (keyof typeof galileePlaces)[]).find((region) =>
    galileePlaces[region].some((p) => p.id === id),
  );
}
export function localGalileePlaces(s: GameState): Interactable[] {
  return s.campaign.roof.stage === 'complete'
    ? (galileePlaces[s.region as keyof typeof galileePlaces] ?? [])
    : [];
}
