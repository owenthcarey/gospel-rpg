import type { Point } from '../game/types';
import type { RegionId } from '../game/episode/types';

export interface RegionDefinition {
  id: RegionId;
  title: string;
  subtitle: string;
  mode: 'exploration' | 'presentation';
  arrival: Point;
  returnRegion: RegionId | null;
}
export const regions: Record<RegionId, RegionDefinition> = {
  capernaum: {
    id: 'capernaum',
    title: 'Capernaum',
    subtitle: 'Northern shore · Galilee',
    mode: 'exploration',
    arrival: { x: -1, z: -3 },
    returnRegion: null,
  },
  'lake-gennesaret': {
    id: 'lake-gennesaret',
    title: 'Lake of Gennesaret',
    subtitle: 'Into the Deep · Luke 5:1–11',
    mode: 'presentation',
    arrival: { x: 5, z: 6 },
    returnRegion: 'capernaum',
  },
};
