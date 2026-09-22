import type { AssetId } from '../assets';
import type { Decor } from '../campaign/layouts';
import type { Obstacle } from '../../game/pathfinding';

// All tall additions stay against architecture; their small floor footprints are explicit.
const course = (xs: number[], z: number): Decor[] =>
  xs.map((x) => ({ asset: 'wall_footing', x, z }));
export const capernaumScenery: Record<string, readonly Decor[]> = {
  capernaum: [
    { asset: 'net_workbench', x: 0.1, z: -9.05 },
    { asset: 'door_awning', x: -8, z: 2.95, rotation: Math.PI },
    { asset: 'stone_threshold', x: -8, z: 2.75 },
    { asset: 'door_awning', x: -5, z: -8.95 },
    { asset: 'stone_threshold', x: -5, z: -8.75 },
    ...course([-9.5, -6.5], 2.92),
    ...course([-6.5, -3.5], -8.92),
    { asset: 'harbor_bollard', x: 6.3, z: -11.8 },
    { asset: 'harbor_bollard', x: 6.3, z: -14.5 },
  ],
  'capernaum-lanes': [
    { asset: 'door_awning', x: -9, z: 6.1, rotation: Math.PI },
    { asset: 'door_awning', x: 5, z: 10.4, rotation: Math.PI },
    { asset: 'stone_threshold', x: -9, z: 5.95 },
    { asset: 'stone_threshold', x: 5, z: 10.2 },
    { asset: 'courtyard_planter', x: -11.5, z: 6.25 },
    { asset: 'courtyard_planter', x: 7.5, z: 10.65 },
    ...course([-11, -7], 6.45),
    ...course([2, 3.5, 6.5, 8], 10.9),
  ],
  'gathering-house': [
    { asset: 'stone_threshold', x: 0, z: -5.9 },
    { asset: 'stone_threshold', x: -4, z: 2, rotation: Math.PI / 2, scale: 1.3 },
    { asset: 'stone_threshold', x: 4, z: 2, rotation: Math.PI / 2, scale: 1.3 },
  ],
  bakehouse: [
    { asset: 'stone_threshold', x: 0, z: -5.9 },
    { asset: 'worktable', x: 2.8, z: 4.5 },
    { asset: 'bread_board', x: 2.8, z: 4.25, y: 0.94 },
    { asset: 'courtyard_planter', x: 4.9, z: 4.8 },
    ...course([-4.2, -2.6, -1], 5.7),
  ],
};
export function villageAssets(region: string): AssetId[] {
  return [
    ...new Set([
      ...(capernaumScenery[region] ?? []).map((p) => p.asset),
      ...(region === 'capernaum' ? (['quay_stones', 'crossing_plank'] as const) : []),
      ...(region === 'gathering-house' ? (['villager'] as const) : []),
    ]),
  ];
}
export const villageObstacles: Record<string, readonly Obstacle[]> = {
  capernaum: [{ x: 0.1, z: -9.05, width: 1.5, depth: 0.8 }],
  'capernaum-lanes': [
    { x: -11.5, z: 6.25, width: 1, depth: 0.8 },
    { x: 7.5, z: 10.65, width: 1, depth: 0.8 },
  ],
  bakehouse: [
    { x: 4.9, z: 4.8, width: 1, depth: 0.8 },
    { x: 2.8, z: 4.5, width: 2.2, depth: 1.2 },
  ],
};
/** Small dry patches break up broad surfaces without covering paths or introducing collision. */
export const villagePatches: Record<string, readonly [number, number, number, number][]> = {
  capernaum: [
    [-8, 1.9, 4, 1.6],
    [-5, -8.1, 4, 1.2],
    [0, -9, 3, 2],
    [4, -13.1, 6, 5],
    [-2, 5, 4, 3],
  ],
  'capernaum-lanes': [
    [-9, 5, 4, 2],
    [5, 9.6, 5, 1.5],
    [-11, -3, 4, 3],
    [6, 3, 5, 4],
  ],
  'gathering-house': [[0, 0, 7, 8]],
  bakehouse: [
    [-3, 4, 4, 2],
    [0, 2, 4, 3],
  ],
};
