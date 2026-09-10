export const GALILEE_ITEMS = ['channel-scoop', 'rest-mat', 'rest-water', 'rest-screen'] as const;
export const CHANNEL_IDS = ['entry', 'turn', 'north', 'south'] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];
export type Direction = 0 | 1 | 2 | 3;
export const SPRING_NOTES = ['source', 'basins'] as const;
export const SPRING_CLEARING = ['inlet', 'silt'] as const;
export const SPRING_ENDINGS = ['patience', 'sharing'] as const;
export const REST_SITES = ['shade', 'breeze'] as const;
export type RestSite = (typeof REST_SITES)[number];
export const REST_SUPPLIES = ['mat', 'water', 'screen'] as const;
export type RestSupply = (typeof REST_SUPPLIES)[number];
export const REST_ENDINGS = ['welcome', 'care'] as const;
export interface GalileeState {
  spring: {
    stage: 'not-started' | 'working' | 'flowing' | 'complete';
    notes: (typeof SPRING_NOTES)[number][];
    cleared: (typeof SPRING_CLEARING)[number][];
    turns: Record<ChannelId, Direction>;
    tested: boolean;
    hint: 0 | 1 | 2 | 3;
    ending: (typeof SPRING_ENDINGS)[number] | null;
  };
  shelter: {
    stage: 'not-started' | 'planning' | 'arranging' | 'ready' | 'complete';
    inspected: RestSite[];
    site: RestSite | null;
    placed: RestSupply[];
    screen: Direction;
    checked: boolean;
    ending: (typeof REST_ENDINGS)[number] | null;
  };
}
/** expected guards rotations against rapid clicks and stale restored panels. */
export type GalileeEvent =
  | { type: 'galilee-action'; id: string }
  | { type: 'galilee-turn'; id: ChannelId; expected: Direction }
  | { type: 'galilee-screen'; expected: Direction }
  | { type: 'galilee-hint' };
export function newGalilee(): GalileeState {
  return {
    spring: {
      stage: 'not-started',
      notes: [],
      cleared: [],
      turns: { entry: 0, turn: 0, north: 0, south: 2 },
      tested: false,
      hint: 0,
      ending: null,
    },
    shelter: {
      stage: 'not-started',
      inspected: [],
      site: null,
      placed: [],
      screen: 2,
      checked: false,
      ending: null,
    },
  };
}
