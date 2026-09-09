import { localNeighborhoodPlaces, allNeighborhoodPlaces } from './campaign/places';
import type { Obstacle } from '../game/pathfinding';
import type { GameState, Point } from '../game/types';
import { hasReturned } from '../game/episode/progress';
import { BENCH_FOOTPRINT } from './life/places';

export interface Placement extends Point {
  asset: string;
  rotation?: number;
  scale?: number;
}
export interface Interactable extends Point {
  id: string;
  name: string;
  role: string;
  kind: 'person' | 'object' | 'place';
  asset?: string;
}
export const REGION_ID = 'capernaum';
export const shoreline = (z: number): number => 9.3 + Math.sin(z * 0.16) * 1.5;
export const isLand = (p: Point): boolean =>
  p.x < shoreline(p.z) - 0.8 && p.z > -20 && p.z < 21 && p.x > -22;

export const buildings: Placement[] = [
  { asset: 'house', x: -8, z: 5, rotation: 0 },
  { asset: 'house_large', x: -13, z: -4, rotation: -Math.PI / 2 },
  { asset: 'house', x: -5, z: -11, rotation: Math.PI },
  { asset: 'house_large', x: -3, z: 13, rotation: 0.08 },
  { asset: 'house', x: -15, z: 12, rotation: -0.15 },
  { asset: 'house', x: 3, z: 17, rotation: 0.1 },
  { asset: 'house', x: -16, z: -13, rotation: Math.PI },
];
export const trees: Placement[] = [
  { asset: 'olive', x: -7, z: -5, scale: 1.2 },
  { asset: 'olive', x: -13, z: 5, scale: 1.15 },
  { asset: 'olive', x: -17, z: 2, scale: 1.3 },
  { asset: 'olive', x: -19, z: 7 },
  { asset: 'olive', x: -19, z: 17, scale: 1.3 },
  { asset: 'olive', x: -9, z: 15, scale: 0.9 },
  { asset: 'olive', x: 1, z: -16 },
  { asset: 'olive', x: -11, z: -17, scale: 1.1 },
  { asset: 'cypress', x: -11, z: 10 },
  { asset: 'cypress', x: -5, z: 17, scale: 1.25 },
  { asset: 'cypress', x: -12, z: -9 },
  { asset: 'palm', x: 6, z: 12 },
  { asset: 'palm', x: 7, z: -11, scale: 0.95 },
];
export const interactables: Interactable[] = [
  { id: 'simon', name: 'Simon', role: 'Fisherman', kind: 'person', asset: 'simon', x: 5, z: 1 },
  {
    id: 'miriam',
    name: 'Miriam',
    role: 'Village baker',
    kind: 'person',
    asset: 'miriam',
    x: -6,
    z: 0,
  },
  { id: 'jesus', name: 'Jesus', role: 'By the water', kind: 'person', asset: 'jesus', x: 6, z: 7 },
  {
    id: 'ezra',
    name: 'Ezra',
    role: 'Village elder',
    kind: 'person',
    asset: 'villager',
    x: -11,
    z: 7,
  },
  {
    id: 'nets',
    name: 'Fishing net',
    role: 'Drying by the shore',
    kind: 'object',
    asset: 'nets',
    x: 4,
    z: -7,
  },
  {
    id: 'well',
    name: 'Village well',
    role: 'A place to gather',
    kind: 'place',
    asset: 'well',
    x: -1,
    z: 5,
  },
  {
    id: 'shore',
    name: 'Sea of Galilee',
    role: 'Look out over the water',
    kind: 'place',
    x: 8,
    z: -3,
  },
  { id: 'olive', name: 'Olive grove', role: 'Rest in the shade', kind: 'place', x: -17, z: 6 },
];
export const episodePlaces: Interactable[] = [
  {
    id: 'supply-basket',
    name: 'Empty basket',
    role: 'Carry to the landing',
    kind: 'object',
    x: -4.5,
    z: 0.5,
  },
  {
    id: 'landing',
    name: 'The landing',
    role: 'A place beside the boats',
    kind: 'object',
    x: 6,
    z: -1,
  },
  { id: 'mooring', name: 'Mooring rope', role: 'Make the path clear', kind: 'object', x: 7, z: 3 },
  {
    id: 'gathering',
    name: 'The gathering',
    role: 'Make room for a neighbor',
    kind: 'place',
    x: 3,
    z: 9,
  },
  {
    id: 'viewpoint',
    name: 'Shoreline viewpoint',
    role: 'Follow the account on the lake',
    kind: 'place',
    x: 6,
    z: 5,
  },
  {
    id: 'boat-study',
    name: 'A boat at rest',
    role: 'An observation along the way',
    kind: 'place',
    x: 6,
    z: -5,
  },
  {
    id: 'net-study',
    name: 'Cord and patient hands',
    role: 'Look closely at the nets',
    kind: 'place',
    x: 3,
    z: -9,
  },
  {
    id: 'james',
    name: 'James',
    role: 'One of Simon’s partners',
    kind: 'person',
    asset: 'james',
    x: 5,
    z: 11,
  },
  {
    id: 'john',
    name: 'John',
    role: 'One of Simon’s partners',
    kind: 'person',
    asset: 'john',
    x: 6,
    z: -9,
  },
];
export const allInteractables = [...interactables, ...episodePlaces, ...allNeighborhoodPlaces];
export function activeInteractables(state: GameState): Interactable[] {
  if (state.region !== 'capernaum') return localNeighborhoodPlaces(state);
  const returned = hasReturned(state.episode);
  const base = interactables.filter((p) => !returned || !['simon', 'jesus'].includes(p.id));
  if (state.episode.stage === 'not-started') return base;
  return [
    ...base,
    ...localNeighborhoodPlaces(state),
    ...episodePlaces.filter((p) => {
      if (returned && ['supply-basket', 'mooring', 'gathering', 'james', 'john'].includes(p.id))
        return false;
      if (p.id === 'supply-basket' && state.episode.preparations.includes('basket')) return false;
      return true;
    }),
  ];
}

export const obstacles: Obstacle[] = [
  BENCH_FOOTPRINT,
  ...buildings.map((p) => ({
    x: p.x,
    z: p.z,
    width: p.asset === 'house_large' ? 4.9 : 3.9,
    depth: p.asset === 'house_large' ? 4.9 : 3.5,
  })),
  ...trees.map((p) => ({ x: p.x, z: p.z, width: 0.9, depth: 0.9 })),
  { x: -7, z: 2, width: 3.5, depth: 2.4 },
  { x: -1, z: 5, width: 1.9, depth: 1.9 },
  { x: 4, z: -7, width: 2.5, depth: 0.7 },
];

export const props: Placement[] = [
  { asset: 'market', x: -7, z: 2 },
  { asset: 'boat', x: 10.7, z: 1.4, rotation: 0.25 },
  { asset: 'boat', x: 11.7, z: 6, rotation: -0.35 },
  { asset: 'boat', x: 6.8, z: -5, rotation: -1.2 },
  { asset: 'amphora', x: -5.6, z: 2.5 },
  { asset: 'amphora', x: -10.2, z: 2.9, scale: 0.8 },
  { asset: 'amphora', x: -10.4, z: 3.7 },
  { asset: 'crate', x: 6.5, z: 0.2 },
  { asset: 'crate', x: 7.2, z: 0.5, scale: 0.8 },
  { asset: 'crate', x: -8.9, z: 1 },
  { asset: 'nets', x: 5.8, z: -8.7, rotation: 0.5 },
];
