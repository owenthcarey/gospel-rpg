import type { ExplorationLayout, Decor } from '../campaign/layouts';
import type { LakeRegion } from '../../game/lake/types';
import { WATER_OBSTACLES, isWater } from '../../game/lake/navigation';
const camera = { radius: 33, min: 18, max: 52, beta: 0.78, targetOffset: 1.5 };
const shore = (p: { x: number; z: number }) => Math.abs(p.x) < 14 && p.z > -8 && p.z < 14;
const shoreDecor: Decor[] = [
  { asset: 'landing_pier', x: 0, z: -7 },
  { asset: 'olive', x: -9, z: 6, scale: 1.4 },
  { asset: 'bench', x: -5, z: 7 },
  { asset: 'rock', x: 9, z: 9, scale: 1.4 },
];
export const lakeLayouts: Record<LakeRegion, ExplorationLayout> = {
  'galilee-water': {
    bounds: { min: -25, max: 25 },
    inside: false,
    terrain: isWater,
    obstacles: WATER_OBSTACLES,
    paths: [],
    camera: { ...camera, radius: 44, max: 66 },
    decor: [
      { asset: 'split_rock', x: -5, z: 3, scale: 1.8 },
      { asset: 'cove_headland', x: 11, z: 7, scale: 1.3 },
      { asset: 'reed_bank', x: 21, z: -5, scale: 1.2 },
      { asset: 'landing_pier', x: -20, z: -13, rotation: Math.PI / 2 },
      { asset: 'landing_pier', x: 20, z: -12, rotation: -Math.PI / 2 },
      { asset: 'landing_pier', x: 20, z: 17, rotation: -Math.PI / 2 },
      ...[-14, -4, 8, 18].flatMap((z) => [
        { asset: 'olive' as const, x: -26, z, scale: 1.4 },
        { asset: 'rock' as const, x: 25, z, scale: 1.6 },
      ]),
      { asset: 'farm_shelter', x: 26, z: 17 },
      { asset: 'house', x: -27, z: -14 },
    ],
  },
  'reed-landing': {
    bounds: { min: -16, max: 16 },
    inside: false,
    terrain: shore,
    obstacles: [
      { x: -9, z: 6, width: 1, depth: 1 },
      { x: -5, z: 7, width: 2.4, depth: 1 },
      { x: 9, z: 9, width: 2.5, depth: 2.5 },
    ],
    paths: [
      [{ x: 0, z: -8 }, { x: 0, z: 5 }, 2],
      [{ x: 0, z: 2 }, { x: 6, z: 2 }, 1.8],
    ],
    camera,
    decor: [
      ...shoreDecor,
      ...[-8, -4, 5, 9].map((x) => ({ asset: 'reed_bank' as const, x, z: -9, scale: 1.2 })),
      { asset: 'split_rock', x: 8, z: 12 },
    ],
  },
  'sheltered-cove': {
    bounds: { min: -16, max: 16 },
    inside: false,
    terrain: shore,
    obstacles: [
      { x: -9, z: 6, width: 1, depth: 1 },
      { x: -5, z: 7, width: 2.4, depth: 1 },
      { x: -6, z: 10, width: 5, depth: 4 },
      { x: 11, z: -2, width: 4, depth: 8 },
      { x: 9, z: 9, width: 2.5, depth: 2.5 },
    ],
    paths: [
      [{ x: 0, z: -8 }, { x: 0, z: 6 }, 2.2],
      [{ x: -6, z: 4 }, { x: 7, z: 4 }, 1.8],
    ],
    camera,
    decor: [
      ...shoreDecor,
      { asset: 'farm_shelter', x: -6, z: 10 },
      { asset: 'cove_headland', x: 11, z: -2, scale: 1.2 },
      { asset: 'amphora', x: -8, z: 9 },
      { asset: 'reed_bank', x: -8, z: -9 },
    ],
  },
};
