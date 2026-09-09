import type { Point, GameState } from '../../game/types';
import type { Obstacle } from '../../game/pathfinding';
import type { AssetId } from '../assets';
export interface Decor extends Point {
  asset: AssetId;
  y?: number;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  cutaway?: 'roof' | 'wall';
}
export interface ExplorationLayout {
  bounds: { min: number; max: number };
  inside: boolean;
  terrain: (p: Point) => boolean;
  obstacles: readonly Obstacle[];
  decor: readonly Decor[];
  paths: readonly [Point, Point, number][];
  camera: { radius: number; min: number; max: number; beta: number; targetOffset: number };
}
const wall = (x: number, z: number, width: number, depth: number): Obstacle => ({
  x,
  z,
  width,
  depth,
});
const roomDecor = (): Decor[] => [
  ...[-6, 6].flatMap((x) =>
    [-4.5, -1.5, 1.5, 4.5].map((z) => ({
      asset: 'room_wall' as const,
      x,
      z,
      rotation: Math.PI / 2,
      cutaway: 'wall' as const,
    })),
  ),
  ...[-4.5, -1.5, 1.5, 4.5].map((x) => ({
    asset: 'room_wall' as const,
    x,
    z: 6,
    cutaway: 'wall' as const,
  })),
  ...[-4.5, 4.5].map((x) => ({ asset: 'room_wall' as const, x, z: -6, cutaway: 'wall' as const })),
  ...[-2.25, 2.25].map((x) => ({
    asset: 'room_wall' as const,
    x,
    z: -6,
    scaleX: 0.5,
    cutaway: 'wall' as const,
  })),
  { asset: 'doorway', x: 0, z: -6, cutaway: 'wall' },
  { asset: 'roof_opening', x: 0, z: 0, y: 3.25, cutaway: 'roof' },
  { asset: 'roof_panel', x: 0, z: 0, y: 3.25, cutaway: 'roof' },
];
const roomObstacles = [
  wall(-6, 0, 0.3, 12),
  wall(6, 0, 0.3, 12),
  wall(0, 6, 12, 0.3),
  wall(-3.4, -6, 5.2, 0.3),
  wall(3.4, -6, 5.2, 0.3),
];
export const districtLayout: ExplorationLayout = {
  bounds: { min: -16, max: 16 },
  inside: false,
  terrain: (p) => p.x > -15 && p.x < 15 && p.z > -15 && p.z < 15,
  obstacles: [
    wall(-9, 9, 6, 5),
    wall(5, 13, 8, 4),
    wall(-7.5, 0, 12, 0.5),
    wall(5.5, 0, 6, 0.5),
    wall(-11, -3, 1.5, 1.5),
    wall(6, 3, 2.2, 1.2),
    wall(-3, 9, 1, 1),
  ],
  decor: [
    { asset: 'house_large', x: -9, z: 9, rotation: Math.PI },
    { asset: 'house_large', x: 5, z: 13, rotation: Math.PI, scale: 1.3 },
    { asset: 'doorway', x: 5, z: 10.5 },
    { asset: 'doorway', x: -9, z: 6.2 },
    { asset: 'exterior_steps', x: 10, z: 11, rotation: Math.PI / 2 },
    ...[-12, -9, -6, -3, 4, 7].map((x) => ({ asset: 'low_wall' as const, x, z: 0 })),
    { asset: 'olive', x: -3, z: 9, scale: 1.4 },
    { asset: 'cypress', x: 13, z: 11 },
    { asset: 'olive', x: -13, z: -10 },
    { asset: 'well', x: -11, z: -3, scale: 0.85 },
    { asset: 'worktable', x: 6, z: 3 },
    { asset: 'bench', x: 6, z: 1.7 },
    { asset: 'bench', x: 6, z: 4.3 },
    { asset: 'amphora', x: -6, z: 6 },
    { asset: 'crate', x: 12, z: -4 },
    { asset: 'rock', x: 13, z: -10, scale: 0.8 },
    ...[-20, 20].flatMap((x) =>
      [-15, -5, 7, 19].map((z, i) => ({
        asset: i % 2 ? ('house' as const) : ('house_large' as const),
        x,
        z,
        rotation: x < 0 ? -Math.PI / 2 : Math.PI / 2,
      })),
    ),
    ...[-15, -6, 7, 17].map((x) => ({ asset: 'house' as const, x, z: 21, rotation: Math.PI })),
    ...[-14, -8, 8, 14].map((x, i) => ({
      asset: 'olive' as const,
      x,
      z: i % 2 ? -19 : 18,
      scale: 1.3,
    })),
    ...[-4.5, -1.5, 1.5, 4.5].map((x) => ({
      asset: 'landing_mat' as const,
      x: x + 5,
      z: 9.8,
      scale: 0.5,
    })),
  ],
  paths: [
    [{ x: 0, z: -15 }, { x: 0, z: 8 }, 2.3],
    [{ x: -12, z: -6 }, { x: 11, z: -6 }, 2.4],
    [{ x: 11, z: -9 }, { x: 11, z: 9 }, 2.4],
    [{ x: -11, z: 5 }, { x: 11, z: 5 }, 2.4],
  ],
  camera: { radius: 32, min: 20, max: 44, beta: 0.79, targetOffset: 1.5 },
};
export const houseLayout: ExplorationLayout = {
  bounds: { min: -8, max: 8 },
  inside: true,
  terrain: (p) => Math.abs(p.x) < 6 && p.z > -7 && p.z < 6,
  obstacles: [...roomObstacles, wall(-4, 2, 0.7, 3), wall(4, 2, 0.7, 3)],
  decor: [
    ...roomDecor(),
    { asset: 'bench', x: -4, z: 2, rotation: Math.PI / 2 },
    { asset: 'bench', x: 4, z: 2, rotation: Math.PI / 2 },
    { asset: 'stool', x: 0, z: 4.5 },
    { asset: 'amphora', x: -4.6, z: 4.6 },
  ],
  paths: [],
  camera: { radius: 23, min: 16, max: 28, beta: 0.72, targetOffset: 0 },
};
export const bakehouseLayout: ExplorationLayout = {
  bounds: { min: -8, max: 8 },
  inside: true,
  terrain: houseLayout.terrain,
  obstacles: [
    ...roomObstacles,
    wall(-3, 4.7, 2.4, 1.5),
    wall(0, 2, 2.2, 1.2),
    wall(4.7, 1, 0.6, 2),
    wall(-4.7, 0, 0.6, 2),
  ],
  decor: [
    ...roomDecor(),
    { asset: 'oven', x: -3, z: 4.7 },
    { asset: 'worktable', x: 0, z: 2 },
    { asset: 'bench', x: 0, z: 0.6 },
    { asset: 'shelf', x: -4.7, z: 0, rotation: Math.PI / 2 },
    { asset: 'shelf', x: 4.7, z: 1, rotation: -Math.PI / 2 },
    { asset: 'flour_sack', x: -4.7, z: 3 },
  ],
  paths: [],
  camera: { radius: 23, min: 16, max: 28, beta: 0.72, targetOffset: 0 },
};
export function campaignLayout(region: string): ExplorationLayout | undefined {
  return (
    {
      'capernaum-lanes': districtLayout,
      'gathering-house': houseLayout,
      bakehouse: bakehouseLayout,
    } as Record<string, ExplorationLayout>
  )[region];
}
export function layoutObstacles(s: GameState): Obstacle[] {
  const layout = campaignLayout(s.region);
  if (!layout) return [];
  return [
    ...layout.obstacles,
    ...(s.region === 'capernaum-lanes' && !s.campaign.walk.gateOpen ? [wall(0, 0, 3.4, 1)] : []),
  ];
}
