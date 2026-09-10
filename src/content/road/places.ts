import type { GameState } from '../../game/types';
import { isRoadRegion, NERI_START, NERI_DESTINATION, type RoadRegion } from '../../game/road/types';
import type { Interactable } from '../region';
import type { Gateway } from '../campaign/places';
import { companyMeeting } from './routes';
export const roadGateways: readonly Gateway[] = [
  {
    id: 'to-road',
    name: 'The road beyond Capernaum',
    role: 'Later in the journey · Chapter III',
    kind: 'place',
    x: 13,
    z: 6,
    from: 'capernaum-lanes',
    to: 'galilean-road',
    arrival: { x: 0, z: -12 },
  },
  {
    id: 'road-to-lanes',
    name: 'Return to Capernaum',
    role: 'The lanes, house and shore',
    kind: 'place',
    x: 0,
    z: -13,
    from: 'galilean-road',
    to: 'capernaum-lanes',
    arrival: { x: 12, z: 6 },
  },
  {
    id: 'to-farm',
    name: 'The roadside farm',
    role: 'Tamar’s resting place · Company for the road',
    kind: 'place',
    x: -12,
    z: 0,
    from: 'galilean-road',
    to: 'roadside-farm',
    arrival: { x: 0, z: -9 },
  },
  {
    id: 'farm-exit',
    name: 'Continue to the road',
    role: 'The fork toward Nain',
    kind: 'place',
    x: 0,
    z: -10,
    from: 'roadside-farm',
    to: 'galilean-road',
    arrival: { x: -11, z: 0 },
  },
  {
    id: 'to-nain',
    name: 'Continue to Nain',
    role: 'The town gate · Luke 7:11–17',
    kind: 'place',
    x: 0,
    z: 12,
    from: 'galilean-road',
    to: 'nain-gate',
    arrival: { x: 0, z: -11 },
  },
  {
    id: 'nain-exit',
    name: 'Return to the Galilean road',
    role: 'The farm and Capernaum',
    kind: 'place',
    x: 0,
    z: -12,
    from: 'nain-gate',
    to: 'galilean-road',
    arrival: { x: 0, z: 11 },
  },
];
export const roadPlaces: Record<RoadRegion, readonly Interactable[]> = {
  'galilean-road': [
    {
      id: 'tamar',
      name: 'Tamar',
      role: 'A way remembered · An original traveler story',
      kind: 'person',
      asset: 'ruth',
      x: -3,
      z: -7,
    },
    {
      id: 'road-spring',
      name: 'The spring marker',
      role: 'Inspect · Water and a carved branch',
      kind: 'object',
      x: -5,
      z: 1,
    },
    {
      id: 'road-terrace',
      name: 'The terrace marker',
      role: 'Inspect · Two stones and a turning path',
      kind: 'object',
      x: 7,
      z: 4,
    },
    {
      id: 'lake-view',
      name: 'The distant lake',
      role: 'An imagined view back toward Galilee',
      kind: 'place',
      x: 7,
      z: -8,
    },
  ],
  'roadside-farm': [
    {
      id: 'farm-landmark',
      name: 'The resting shelter',
      role: 'Inspect · A split olive beside two pale stones',
      kind: 'place',
      x: 4,
      z: 6,
    },
    {
      id: 'neri',
      name: 'Neri',
      role: 'Company on the road · An original traveler story',
      kind: 'person',
      asset: 'amos',
      ...NERI_START,
    },
  ],
  'nain-gate': [
    {
      id: 'nain-viewpoint',
      name: 'A place at the gate',
      role: 'Witness Luke 7:11–17',
      kind: 'place',
      x: 0,
      z: -3,
    },
    {
      id: 'nain-courtyard',
      name: 'The quiet courtyard',
      role: 'A place to return and remember',
      kind: 'place',
      ...NERI_DESTINATION,
    },
    {
      id: 'adina',
      name: 'Adina',
      role: 'A fictional neighbor by the gate',
      kind: 'person',
      asset: 'hannah',
      x: -5,
      z: 3,
    },
  ],
};
export const roadDynamicPlaces: readonly Interactable[] = [
  {
    id: 'neri-meeting',
    name: 'Walk with Neri',
    role: 'The next meeting place',
    kind: 'place',
    x: 0,
    z: 0,
  },
];
export function localRoadPlaces(s: GameState): Interactable[] {
  if (!isRoadRegion(s.region) || s.campaign.roof.stage !== 'complete') return [];
  const c = s.road.company,
    meeting = companyMeeting(c);
  return [
    ...roadPlaces[s.region].filter((p) => p.id !== 'neri'),
    ...(c.region === s.region
      ? [
          {
            ...roadPlaces['roadside-farm'][1]!,
            ...c.position,
            role:
              c.stage === 'complete'
                ? 'Your walk is remembered · Resting in the courtyard'
                : 'Company on the road · He waits when you stop',
          },
        ]
      : []),
    ...(meeting?.region === s.region
      ? [{ ...roadDynamicPlaces[0]!, ...meeting, role: meeting.description }]
      : []),
  ];
}
export function roadPlaceRegion(id: string, s?: GameState): RoadRegion | undefined {
  if (id === 'neri') return s?.road.company.region ?? 'roadside-farm';
  if (id === 'neri-meeting') return s ? companyMeeting(s.road.company)?.region : 'roadside-farm';
  return Object.entries(roadPlaces).find(([, places]) => places.some((p) => p.id === id))?.[0] as
    RoadRegion | undefined;
}
