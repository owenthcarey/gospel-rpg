import type { Point } from '../types';

export const ROAD_REGIONS = ['galilean-road', 'roadside-farm', 'nain-gate'] as const;
export type RoadRegion = (typeof ROAD_REGIONS)[number];
export const NAIN_SCENES = [
  'approach',
  'procession',
  'compassion',
  'command',
  'restored',
  'wonder',
] as const;
export type NainSceneId = (typeof NAIN_SCENES)[number];
export const NAIN_AFTERMATH = ['gate', 'courtyard', 'neighbor'] as const;
export const NAIN_REFLECTIONS = ['compassion', 'restoration', 'wonder'] as const;
export type NainReflection = (typeof NAIN_REFLECTIONS)[number];
export const TRAIL_EVIDENCE = ['spring', 'terrace'] as const;
export type TrailEvidence = (typeof TRAIL_EVIDENCE)[number];
export const TRAIL_INTERPRETATIONS = ['shelter', 'ridge', 'spring'] as const;
export type TrailInterpretation = (typeof TRAIL_INTERPRETATIONS)[number];
export const TRAIL_ENDINGS = ['observation', 'company'] as const;
export const COMPANY_ROUTES = ['shade', 'terrace'] as const;
export type CompanyRoute = (typeof COMPANY_ROUTES)[number];
export const NERI_START: Readonly<Point> = { x: -4, z: 3 };
export const NERI_DESTINATION: Readonly<Point> = { x: 9, z: 4 };
export interface RoadState {
  chapter: {
    stage: 'not-started' | 'exploring' | 'witnessing' | 'aftermath' | 'complete';
    checkpoint: NainSceneId | null;
    aftermath: (typeof NAIN_AFTERMATH)[number][];
    reflection: NainReflection | null;
  };
  trail: {
    stage: 'not-started' | 'exploring' | 'interpreted' | 'arrived' | 'complete';
    evidence: TrailEvidence[];
    interpretation: TrailInterpretation | null;
    ending: (typeof TRAIL_ENDINGS)[number] | null;
    hint: 0 | 1 | 2 | 3;
  };
  company: {
    stage: 'not-started' | 'invited' | 'walking' | 'arrived' | 'complete';
    route: CompanyRoute | null;
    step: number;
    region: RoadRegion;
    position: Point;
  };
  visited: Partial<Record<RoadRegion, Point>>;
}
export type RoadEvent =
  | { type: 'road-action'; id: RoadActionId }
  | { type: 'road-evidence'; id: TrailEvidence }
  | { type: 'road-interpret'; id: TrailInterpretation }
  | { type: 'road-ending'; id: (typeof TRAIL_ENDINGS)[number] }
  | { type: 'road-hint' }
  | { type: 'road-route'; id: CompanyRoute }
  | { type: 'road-step'; step: number }
  | { type: 'nain-next' | 'nain-summary'; checkpoint: NainSceneId }
  | { type: 'nain-leave' }
  | { type: 'nain-reflect'; id: NainReflection };
export const ROAD_ACTIONS = [
  'trail-accept',
  'trail-arrive',
  'company-accept',
  'company-start',
  'company-finish',
  'nain-enter',
  'nain-after-gate',
  'nain-after-courtyard',
  'nain-after-neighbor',
] as const;
export type RoadActionId = (typeof ROAD_ACTIONS)[number];
export function isRoadRegion(id: string): id is RoadRegion {
  return ROAD_REGIONS.some((region) => region === id);
}
export function newRoad(): RoadState {
  return {
    chapter: { stage: 'not-started', checkpoint: null, aftermath: [], reflection: null },
    trail: { stage: 'not-started', evidence: [], interpretation: null, ending: null, hint: 0 },
    company: {
      stage: 'not-started',
      route: null,
      step: 0,
      region: 'roadside-farm',
      position: { ...NERI_START },
    },
    visited: {},
  };
}
