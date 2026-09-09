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
  'capernaum-lanes': {
    id: 'capernaum-lanes',
    title: 'Capernaum lanes',
    subtitle: 'Some days later · Through the Roof',
    mode: 'exploration',
    arrival: { x: 0, z: -12 },
    returnRegion: 'capernaum',
  },
  'gathering-house': {
    id: 'gathering-house',
    title: 'The gathering house',
    subtitle: 'An open room · Mark 2:1–12',
    mode: 'exploration',
    arrival: { x: 0, z: -5 },
    returnRegion: 'capernaum-lanes',
  },
  bakehouse: {
    id: 'bakehouse',
    title: 'Hannah’s bakehouse',
    subtitle: 'Bread and company · Original neighborhood story',
    mode: 'exploration',
    arrival: { x: 0, z: -5 },
    returnRegion: 'capernaum-lanes',
  },
  'roof-account': {
    id: 'roof-account',
    title: 'Through the Roof',
    subtitle: 'The Gospel according to Mark · 2:1–12',
    mode: 'presentation',
    arrival: { x: 0, z: -2 },
    returnRegion: 'gathering-house',
  },
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
