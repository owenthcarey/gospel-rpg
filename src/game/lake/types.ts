import type { Point } from '../types';

export const LAKE_REGIONS = ['galilee-water', 'reed-landing', 'sheltered-cove'] as const;
export type LakeRegion = (typeof LAKE_REGIONS)[number];
export const BERTHS = ['capernaum', 'reed-landing', 'sheltered-cove'] as const;
export type Berth = (typeof BERTHS)[number];
export const WATER_START = { x: -17, z: -13 };
export const STORM_SCENES = [
  'evening',
  'boats',
  'storm',
  'waking',
  'command',
  'calm',
  'question',
] as const;
export type StormScene = (typeof STORM_SCENES)[number];
export const STORM_AFTERMATH = ['landing', 'lookout', 'neighbor'] as const;
export const STORM_REFLECTIONS = ['stillness', 'trust', 'wonder'] as const;
export const LAKE_EVIDENCE = ['reeds', 'split-rock'] as const;
export const LAKE_INTERPRETATIONS = ['exposed', 'island', 'sheltered'] as const;
export const LAKE_ENDINGS = ['attention', 'welcome'] as const;
export interface LakeState {
  boat: { mode: 'ashore' | 'afloat'; berth: Berth | null; position: Point; heading: number };
  trail: {
    stage: 'not-started' | 'exploring' | 'interpreted' | 'arrived' | 'complete';
    evidence: (typeof LAKE_EVIDENCE)[number][];
    interpretation: (typeof LAKE_INTERPRETATIONS)[number] | null;
    hint: number;
    ending: (typeof LAKE_ENDINGS)[number] | null;
  };
  chapter: {
    stage: 'not-started' | 'exploring' | 'witnessing' | 'aftermath' | 'complete';
    checkpoint: StormScene | null;
    aftermath: (typeof STORM_AFTERMATH)[number][];
    reflection: (typeof STORM_REFLECTIONS)[number] | null;
  };
  notes: ('reed-shore' | 'cove-shore')[];
  visited: Partial<Record<LakeRegion, Point>>;
}
export type LakeEvent =
  | { type: 'lake-action'; id: string }
  | { type: 'lake-interpret'; id: (typeof LAKE_INTERPRETATIONS)[number] }
  | { type: 'lake-hint' }
  | { type: 'lake-ending'; id: (typeof LAKE_ENDINGS)[number] }
  | { type: 'storm-next' | 'storm-summary'; checkpoint: StormScene }
  | { type: 'storm-leave' }
  | { type: 'storm-reflect'; id: (typeof STORM_REFLECTIONS)[number] };
export function isLakeRegion(id: string): id is LakeRegion {
  return (LAKE_REGIONS as readonly string[]).includes(id);
}
export function newLake(): LakeState {
  return {
    boat: { mode: 'ashore', berth: 'capernaum', position: { ...WATER_START }, heading: 0 },
    trail: { stage: 'not-started', evidence: [], interpretation: null, hint: 0, ending: null },
    chapter: { stage: 'not-started', checkpoint: null, aftermath: [], reflection: null },
    notes: [],
    visited: {},
  };
}
