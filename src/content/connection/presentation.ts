import type { GameState } from '../../game/types';
import { gateways } from '../campaign/places';
import { activeInteractables } from '../region';

/** A small original wayfinding prop beside, never in the middle of, each land passage. */
export function passageMarkers(s: GameState) {
  if (s.region === 'galilee-water') return [];
  const available = new Set(activeInteractables(s).map((p) => p.id));
  return gateways
    .filter((g) => g.from === s.region)
    .map((g) => ({
      id: g.id,
      x: g.x - 1.3,
      z: g.z,
      available: available.has(g.id),
    }));
}
export function passageObstacles(s: GameState) {
  return passageMarkers(s)
    .filter((p) => p.available)
    .map((p) => ({ x: p.x, z: p.z, width: 0.6, depth: 0.56 }));
}
export const HOME_COMPANY = [
  { x: -7.4, z: -1.3, rotation: 1.1 },
  { x: -6.7, z: -2.5, rotation: 0.35 },
] as const;
