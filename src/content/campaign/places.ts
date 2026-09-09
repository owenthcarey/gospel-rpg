import type { Interactable } from '../region';
import type { GameState, Point } from '../../game/types';
import type { ExplorationRegion, RegionId } from '../../game/campaign/types';
import { lifePlaces } from '../life/places';

export interface Gateway extends Interactable {
  from: ExplorationRegion;
  to: ExplorationRegion;
  arrival: Point;
}
export const gateways: readonly Gateway[] = [
  {
    id: 'to-lanes',
    name: 'The road into Capernaum',
    role: 'Chapter II · Through the Roof',
    kind: 'place',
    x: -3,
    z: 19,
    from: 'capernaum',
    to: 'capernaum-lanes',
    arrival: { x: 0, z: -12 },
  },
  {
    id: 'to-shore',
    name: 'Return to the shore',
    role: 'Into the Deep · Ezra and Miriam',
    kind: 'place',
    x: 0,
    z: -13,
    from: 'capernaum-lanes',
    to: 'capernaum',
    arrival: { x: -3, z: 18 },
  },
  {
    id: 'to-house',
    name: 'Enter the gathering house',
    role: 'Through the Roof · A place to listen',
    kind: 'place',
    x: 5,
    z: 10,
    from: 'capernaum-lanes',
    to: 'gathering-house',
    arrival: { x: 0, z: -5 },
  },
  {
    id: 'house-exit',
    name: 'Return to the lanes',
    role: 'Leave the gathering house',
    kind: 'place',
    x: 0,
    z: -6,
    from: 'gathering-house',
    to: 'capernaum-lanes',
    arrival: { x: 5, z: 8 },
  },
  {
    id: 'to-bakehouse',
    name: 'Enter Hannah’s bakehouse',
    role: 'A table for neighbors',
    kind: 'place',
    x: -9,
    z: 6,
    from: 'capernaum-lanes',
    to: 'bakehouse',
    arrival: { x: 0, z: -5 },
  },
  {
    id: 'bakehouse-exit',
    name: 'Return to the lanes',
    role: 'Leave the bakehouse',
    kind: 'place',
    x: 0,
    z: -6,
    from: 'bakehouse',
    to: 'capernaum-lanes',
    arrival: { x: -9, z: 4 },
  },
];
export const neighborhoodPlaces: Record<
  'capernaum-lanes' | 'gathering-house' | 'bakehouse',
  readonly Interactable[]
> = {
  'capernaum-lanes': [
    {
      id: 'ruth',
      name: 'Ruth',
      role: 'A neighbor in the courtyard',
      kind: 'person',
      asset: 'ruth',
      x: 6,
      z: 5,
    },
    {
      id: 'amos',
      name: 'Amos',
      role: 'A way together',
      kind: 'person',
      asset: 'amos',
      x: -9,
      z: -5,
    },
    {
      id: 'passage',
      name: 'The narrow passage',
      role: 'Open · A handcart blocks the way',
      kind: 'object',
      x: 0,
      z: 0,
    },
    {
      id: 'water-point',
      name: 'The water point',
      role: 'Fill a jug · Notice the meeting place',
      kind: 'object',
      x: -11,
      z: -3,
    },
    {
      id: 'courtyard-table',
      name: 'Courtyard table',
      role: 'A place for neighbors',
      kind: 'object',
      x: 6,
      z: 3,
    },
    {
      id: 'lane-note',
      name: 'The outer lane',
      role: 'A slower way around',
      kind: 'place',
      x: 11,
      z: -7,
    },
    {
      id: 'amos-waypoint',
      name: 'Walk with Amos',
      role: 'He will wait when you stop',
      kind: 'place',
      x: 4,
      z: 5,
    },
  ],
  'gathering-house': [
    {
      id: 'house-viewpoint',
      name: 'A place in the house',
      role: 'Witness Mark 2:1–12',
      kind: 'place',
      x: 0,
      z: 1,
    },
    {
      id: 'house-note',
      name: 'The threshold',
      role: 'Notice the house',
      kind: 'place',
      x: -3,
      z: -3,
    },
    {
      id: 'beam-note',
      name: 'The roof beams',
      role: 'Look up · Artistic interpretation',
      kind: 'place',
      x: 3,
      z: 3,
    },
  ],
  bakehouse: [
    {
      id: 'hannah',
      name: 'Hannah',
      role: 'A table for neighbors',
      kind: 'person',
      asset: 'hannah',
      x: -3,
      z: 2,
    },
    {
      id: 'bread-shelf',
      name: 'Bread for the table',
      role: 'Carry · A basket to share',
      kind: 'object',
      x: -4,
      z: 0,
    },
    {
      id: 'jug-shelf',
      name: 'An empty jug',
      role: 'Carry · Fill at the water point',
      kind: 'object',
      x: 4,
      z: 1,
    },
    {
      id: 'tool-shelf',
      name: 'The handcart handle',
      role: 'Borrow · Clear the passage',
      kind: 'object',
      x: 4,
      z: -2,
    },
    {
      id: 'bakehouse-table',
      name: 'Bakehouse table',
      role: 'A place indoors',
      kind: 'object',
      x: 0,
      z: 2,
    },
    {
      id: 'oven-note',
      name: 'The warm oven',
      role: 'Inspect · Daily work',
      kind: 'place',
      x: -3,
      z: 4,
    },
  ],
};
export const WALK_ROUTES: Record<'passage' | 'outer', readonly Point[]> = {
  passage: [
    { x: -5, z: -4 },
    { x: 0, z: -2 },
    { x: 0, z: 2 },
    { x: 4, z: 5 },
  ],
  outer: [
    { x: -5, z: -8 },
    { x: 8, z: -8 },
    { x: 11, z: 1 },
    { x: 10, z: 5 },
    { x: 4, z: 5 },
  ],
};
export const allNeighborhoodPlaces: readonly Interactable[] = [
  ...gateways,
  ...Object.values(neighborhoodPlaces).flat(),
  ...Object.values(lifePlaces).flat(),
];
export function localNeighborhoodPlaces(state: GameState): Interactable[] {
  if (state.episode.stage !== 'complete') return [];
  const exits = gateways.filter((g) => g.from === state.region);
  if (state.region === 'capernaum') return [...exits, ...lifePlaces.capernaum];
  if (!(state.region in neighborhoodPlaces)) return [];
  const walk = state.campaign.walk;
  return [
    ...neighborhoodPlaces[state.region as keyof typeof neighborhoodPlaces]
      .filter((p) => p.id !== 'amos-waypoint' || walk.stage === 'walking')
      .map((p) => {
        if (p.id === 'amos') return { ...p, ...walk.position };
        if (p.id === 'amos-waypoint') return { ...p, ...WALK_ROUTES[walk.route!][walk.step]! };
        if (p.id === 'passage' && walk.gateOpen) return { ...p, role: 'The passage is open' };
        return { ...p };
      }),
    ...exits,
    ...lifePlaces[state.region as ExplorationRegion],
  ];
}
export function placeRegion(id: string): RegionId | undefined {
  for (const [region, places] of Object.entries(lifePlaces))
    if (places.some((p) => p.id === id)) return region as RegionId;
  const gateway = gateways.find((g) => g.id === id);
  if (gateway) return gateway.from;
  for (const [region, places] of Object.entries(neighborhoodPlaces))
    if (places.some((p) => p.id === id)) return region as RegionId;
  return undefined;
}
/** Route guidance across the small authored region graph; no teleporting to objectives. */
export function nextGateway(from: RegionId, to: RegionId): string | undefined {
  if (from === to) return undefined;
  const queue: { region: RegionId; first?: string }[] = [{ region: from }];
  const visited = new Set<RegionId>();
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.region)) continue;
    visited.add(current.region);
    for (const gate of gateways.filter((g) => g.from === current.region)) {
      const first = current.first ?? gate.id;
      if (gate.to === to) return first;
      queue.push({ region: gate.to, first });
    }
  }
  return undefined;
}
