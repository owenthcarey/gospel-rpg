import type { Point } from '../game/types';

/** Capernaum's painted paths, shared by the scene, ground cover and local maps. */
export const VILLAGE_PATHS = [
  [{ x: -4, z: -26 }, { x: -3, z: 1 }, 2.6],
  [{ x: -3, z: 1 }, { x: 0, z: 22 }, 2.8],
  [{ x: -20, z: -1 }, { x: 8, z: -1 }, 2.5],
  [{ x: -3, z: 8 }, { x: -16, z: 8 }, 1.8],
  [{ x: 4, z: -10 }, { x: 6, z: 10 }, 1.5],
] as const satisfies readonly (readonly [Point, Point, number])[];
