import type { Point } from '../../game/types';
import {
  NERI_DESTINATION,
  type CompanyRoute,
  type RoadRegion,
  type RoadState,
} from '../../game/road/types';
export interface MeetingPoint extends Point {
  region: RoadRegion;
  name: string;
  description: string;
  exit?: string;
}
const farm: readonly MeetingPoint[] = [
  {
    region: 'roadside-farm',
    x: -2,
    z: 0,
    name: 'The courtyard edge',
    description: 'Neri joins you beside the farm courtyard.',
  },
  {
    region: 'roadside-farm',
    x: 0,
    z: -10,
    name: 'The farm entrance',
    description: 'Meet here together, then choose Continue to the road.',
    exit: 'farm-exit',
  },
];
const destination: readonly MeetingPoint[] = [
  {
    region: 'galilean-road',
    x: 0,
    z: 12,
    name: 'The way toward Nain',
    description: 'Meet here together, then choose Continue to Nain.',
    exit: 'to-nain',
  },
  {
    region: 'nain-gate',
    x: -1,
    z: -8,
    name: 'Below the town gate',
    description: 'Wait together where the path enters the town.',
  },
  {
    region: 'nain-gate',
    ...NERI_DESTINATION,
    name: 'The courtyard bench',
    description: 'There is a quiet seat here at the end of the walk.',
  },
];
export const COMPANY_PATHS: Record<CompanyRoute, readonly MeetingPoint[]> = {
  shade: [
    ...farm,
    {
      region: 'galilean-road',
      x: -8,
      z: 3,
      name: 'Olive shade',
      description: 'The shaded route follows the olive trees west of the spring.',
    },
    {
      region: 'galilean-road',
      x: -5,
      z: 9,
      name: 'The sheltered bend',
      description: 'A low terrace wall shelters this bend from the open road.',
    },
    ...destination,
  ],
  terrace: [
    ...farm,
    {
      region: 'galilean-road',
      x: -6,
      z: -3,
      name: 'The open crossing',
      description: 'Cross below the spring toward the open terraces.',
    },
    {
      region: 'galilean-road',
      x: 4,
      z: 1,
      name: 'The terrace view',
      description: 'The path climbs gently into the light above the spring.',
    },
    {
      region: 'galilean-road',
      x: 5,
      z: 8,
      name: 'The upper bend',
      description: 'Turn toward Nain with the terraced ground behind you.',
    },
    ...destination,
  ],
};
export function companyMeeting(company: RoadState['company']): MeetingPoint | undefined {
  return company.route && company.stage === 'walking'
    ? COMPANY_PATHS[company.route][company.step]
    : undefined;
}
