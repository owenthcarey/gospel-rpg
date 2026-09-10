import type { Interactable } from '../region';
import type { ExplorationRegion } from '../../game/campaign/types';

export const lifePlaces: Record<ExplorationRegion, readonly Interactable[]> = {
  capernaum: [
    {
      id: 'sewing-rest',
      name: 'A pouch by the shore',
      role: 'Compare · A familiar thread',
      kind: 'object',
      x: 4,
      z: -10,
    },
    {
      id: 'landing-bench',
      name: 'The landing bench',
      role: 'A place to rest',
      kind: 'object',
      x: 3,
      z: 7,
    },
    {
      id: 'cord-basket',
      name: 'Spare lashing cord',
      role: 'Borrow · Mend the landing bench',
      kind: 'object',
      x: 1,
      z: 3,
    },
  ],
  'capernaum-lanes': [
    {
      id: 'thread-clue',
      name: 'A thread by the water',
      role: 'Inspect · Ruth’s missing pouch',
      kind: 'object',
      x: -9,
      z: -2,
    },
  ],
  bakehouse: [
    {
      id: 'cloth-clue',
      name: 'Ruth’s mending cloth',
      role: 'Inspect · A distinctive stitch',
      kind: 'object',
      x: -2,
      z: -2,
    },
    {
      id: 'brace-shelf',
      name: 'A spare wooden brace',
      role: 'Borrow · Mend the landing bench',
      kind: 'object',
      x: 2,
      z: -3,
    },
  ],
  'gathering-house': [],
  'galilean-road': [],
  'roadside-farm': [],
  'nain-gate': [],
};
export const BENCH_FOOTPRINT = { x: 3, z: 7, width: 2.3, depth: 1.2 };
