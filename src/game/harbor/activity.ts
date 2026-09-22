import type { GameState, Point } from '../types';
import type { ActorClip } from '../../content/assets';
export interface VillageStation {
  id: string;
  region: string;
  origin: Point;
  facing: Point;
  clip: ActorClip;
  period: number;
  route?: readonly Point[];
  gate: 'always' | 'harbor' | 'roof' | 'table';
  low: boolean;
  actorId?: string;
}
export const VILLAGE_STATIONS: readonly VillageStation[] = [
  {
    id: 'net-worker',
    region: 'capernaum',
    origin: { x: 0.1, z: -9.7 },
    facing: { x: 0.1, z: -9.05 },
    clip: 'Use',
    period: 12,
    gate: 'harbor',
    low: true,
    actorId: 'eliab',
  },
  {
    id: 'water-tender',
    region: 'capernaum-lanes',
    origin: { x: -12.35, z: -3 },
    facing: { x: -11, z: -3 },
    clip: 'Use',
    period: 17,
    gate: 'always',
    low: true,
    route: [
      { x: -12.35, z: -3 },
      { x: -12.35, z: -5.4 },
    ],
  },
  {
    id: 'bread-worker',
    region: 'bakehouse',
    origin: { x: 2.8, z: 3.55 },
    facing: { x: 2.8, z: 4.5 },
    clip: 'Use',
    period: 14,
    gate: 'always',
    low: true,
  },
  {
    id: 'house-company',
    region: 'gathering-house',
    origin: { x: -4, z: 2 },
    facing: { x: 0, z: 2 },
    clip: 'Sit',
    period: 20,
    gate: 'roof',
    low: true,
  },
  {
    id: 'courtyard-company',
    region: 'capernaum-lanes',
    origin: { x: 7, z: 4.3 },
    facing: { x: 7, z: 3 },
    clip: 'Sit',
    period: 21,
    gate: 'table',
    low: false,
  },
];
export function stationActive(station: VillageStation, s: GameState): boolean {
  return (
    station.region === s.region &&
    (station.gate === 'always' ||
      (station.gate === 'harbor' && s.harbor.stage === 'complete') ||
      (station.gate === 'roof' && s.campaign.roof.stage === 'complete') ||
      (station.gate === 'table' &&
        s.campaign.table.stage === 'complete' &&
        s.campaign.table.location === 'courtyard'))
  );
}
/** Each route is authored inside a small station; no cosmetic time becomes save state. */
export function stationPose(
  station: VillageStation,
  time: number,
  still: boolean,
): { position: Point; facing: Point; clip: ActorClip } {
  const phase = (time % station.period) / station.period;
  if (!still && station.route && phase > 0.55) {
    const a = station.route[0]!,
      b = station.route[1]!,
      t = (phase - 0.55) / 0.45;
    const progress = t < 0.5 ? t * 2 : 2 - t * 2;
    return {
      position: { x: a.x + (b.x - a.x) * progress, z: a.z + (b.z - a.z) * progress },
      facing: t < 0.5 ? b : a,
      clip: 'Walk',
    };
  }
  return {
    position: station.origin,
    facing: station.facing,
    clip: station.clip === 'Sit' || still || phase < 0.4 ? station.clip : 'Idle',
  };
}
