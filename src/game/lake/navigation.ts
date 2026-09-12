import type { Point } from '../types';
import { WalkGrid, type Obstacle } from '../pathfinding';
import type { Berth } from './types';

export const LANDINGS: Record<Berth, { water: Point; land: Point; title: string }> = {
  capernaum: { water: { x: -17, z: -13 }, land: { x: 6, z: -4 }, title: 'Capernaum landing' },
  'reed-landing': { water: { x: 17, z: -12 }, land: { x: 0, z: -6 }, title: 'The reed landing' },
  'sheltered-cove': { water: { x: 17, z: 17 }, land: { x: 0, z: -6 }, title: 'The sheltered cove' },
};
/** Clearance includes the half-width of the hull. Both clicks and keyboard use this grid. */
export const WATER_OBSTACLES: readonly Obstacle[] = [
  { x: -5, z: 3, width: 10, depth: 9 },
  { x: 11, z: 7, width: 10, depth: 16 },
];
export const isWater = (p: Point): boolean => Math.abs(p.x) < 19 && Math.abs(p.z) < 22;
const navigationGrid = new WalkGrid(WATER_OBSTACLES, isWater, -25, 25);
export function waterGrid(): WalkGrid {
  return navigationGrid;
}
export const waterPosition = (p: Point): boolean => waterGrid().walkable(p);
export function normalizeHeading(heading: number): number {
  return ((heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}
