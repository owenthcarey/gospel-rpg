import type { Point } from '../../game/types';
import { NERI_DESTINATION, type RoadRegion } from '../../game/road/types';
import type { Decor, ExplorationLayout } from '../campaign/layouts';
const ramp = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
const heights: Record<RoadRegion, (p: Point) => number> = {
  'galilean-road': (p) => {
    const natural =
      0.9 * ramp((p.z + 10) / 20) +
      0.6 * ramp((p.x + 8) / 16) -
      2 * ramp((p.x - 14) / 10) * (1 - ramp((p.z + 3) / 10));
    const terrace =
      ramp((p.x + 6) / 8) * ramp((18 - p.x) / 8) * ramp((p.z + 19) / 8) * ramp((5 - p.z) / 8);
    return natural * (1 - terrace) + (0.52 - p.x * 0.012) * terrace;
  },
  'roadside-farm': (p) => 0.25 * ramp((p.z + 8) / 16),
  'nain-gate': (p) => 0.8 * ramp((p.z + 12) / 12),
};
const bounds = { min: -16, max: 16 };
const terrain = (p: Point) => Math.abs(p.x) < 14 && Math.abs(p.z) < 14;
const camera = { radius: 31, min: 22, max: 43, beta: 0.78, targetOffset: 1.5 };
const wall = (x: number, z: number, width: number, depth: number) => ({ x, z, width, depth });
const trees: Decor[] = [-11, -8].flatMap((x) =>
  [5, 10].map((z) => ({ asset: 'olive', x, z, scale: 1.15 })),
);
export const roadLayouts: Record<RoadRegion, ExplorationLayout> = {
  'galilean-road': {
    bounds,
    terrain,
    camera,
    inside: false,
    height: heights['galilean-road'],
    obstacles: [
      wall(-5, 1, 1.4, 1.4),
      wall(-7, -10, 1, 1),
      wall(7, 4, 1.4, 1.4),
      ...trees.map((t) => wall(t.x, t.z, 0.8, 0.8)),
      wall(8, 9, 6, 0.6),
      wall(10, -2, 4, 0.6),
      wall(11, 11, 1.8, 1.4),
      wall(12, 5, 0.8, 0.8),
      wall(-13, -8, 1.4, 1.2),
    ],
    decor: [
      ...trees,
      { asset: 'spring_marker', x: -5, z: 1 },
      { asset: 'terrace_marker', x: 7, z: 4 },
      { asset: 'terrace_wall', x: 8, z: 9 },
      { asset: 'terrace_wall', x: 10, z: -2, scaleX: 0.65 },
      { asset: 'rock', x: 11, z: 11, scale: 1.2 },
      { asset: 'olive', x: -7, z: -10, scale: 1.25 },
      { asset: 'cypress', x: 12, z: 5 },
      { asset: 'rock', x: -13, z: -8 },
      ...[-18, 18].flatMap((x) =>
        [-15, -5, 6, 18].map((z) => ({ asset: 'olive' as const, x, z, scale: 1.4 })),
      ),
    ],
    paths: [
      [{ x: 0, z: -15 }, { x: 0, z: 14 }, 2.5],
      [{ x: 0, z: -7 }, { x: 9, z: -7 }, 1.5],
      [{ x: 4, z: -11 }, { x: 4, z: -7 }, 1.2],
      [{ x: -14, z: 0 }, { x: 0, z: 0 }, 2.1],
      [{ x: -11, z: 0 }, { x: -8, z: 3 }, 1.2],
      [{ x: -8, z: 3 }, { x: -5, z: 9 }, 1.2],
      [{ x: -5, z: 9 }, { x: 0, z: 12 }, 1.2],
      [{ x: -11, z: 0 }, { x: -6, z: -3 }, 1.2],
      [{ x: -6, z: -3 }, { x: 4, z: 1 }, 1.2],
      [{ x: 4, z: 1 }, { x: 5, z: 8 }, 1.2],
      [{ x: 5, z: 8 }, { x: 0, z: 12 }, 1.2],
    ],
  },
  'roadside-farm': {
    bounds,
    terrain,
    camera,
    inside: false,
    height: heights['roadside-farm'],
    obstacles: [
      wall(-7, 8, 5, 4),
      wall(5, 8, 4.8, 0.5),
      wall(2.6, 6.4, 0.5, 3.2),
      wall(7.4, 6.4, 0.5, 3.2),
      wall(8.5, 6, 1.2, 1.2),
      wall(6, 0, 2.2, 1.2),
      wall(-9, 0, 1, 1),
      wall(-8, -6, 1, 1),
      wall(-4, 4, 2.3, 0.8),
      wall(-5, 5, 0.6, 0.6),
      wall(-8, 5, 0.8, 0.8),
      wall(3.7, 4.2, 0.8, 0.8),
      wall(9, -7, 3, 0.5),
      wall(-10, 12, 3, 0.5),
    ],
    decor: [
      { asset: 'house_large', x: -7, z: 8, rotation: Math.PI },
      { asset: 'farm_shelter', x: 5, z: 6.5 },
      { asset: 'split_olive', x: 8.5, z: 6 },
      { asset: 'terrace_marker', x: 3.7, z: 4.2, scale: 0.6 },
      { asset: 'worktable', x: 6, z: 0 },
      { asset: 'bench', x: -4, z: 4 },
      { asset: 'olive', x: -9, z: 0 },
      { asset: 'olive', x: -8, z: -6 },
      { asset: 'amphora', x: -5, z: 5 },
      { asset: 'flour_sack', x: -8, z: 5 },
      { asset: 'low_wall', x: 9, z: -7 },
      { asset: 'low_wall', x: -10, z: 12 },
      ...[-17, 17].flatMap((x) =>
        [-10, 0, 10].map((z) => ({ asset: 'olive' as const, x, z, scale: 1.4 })),
      ),
    ],
    paths: [
      [{ x: 0, z: -14 }, { x: 0, z: 3 }, 2.4],
      [{ x: -5, z: -6 }, { x: 0, z: -6 }, 1.4],
      [{ x: 0, z: -4 }, { x: 8, z: -4 }, 1.4],
      [{ x: -6, z: 3 }, { x: 5, z: 3 }, 2.3],
      [{ x: 5, z: 3 }, { x: 5, z: 7 }, 1.8],
    ],
  },
  'nain-gate': {
    bounds,
    terrain,
    camera,
    inside: false,
    height: heights['nain-gate'],
    obstacles: [
      wall(-3.4, -0.3, 3.8, 2),
      wall(3.4, -0.3, 3.8, 2),
      wall(-8, 8, 5, 4),
      wall(7, 9, 5, 4),
      wall(NERI_DESTINATION.x, NERI_DESTINATION.z + 1, 2.3, 0.8),
      wall(-10, -5, 1, 1),
      wall(-6, 7, 0.6, 0.6),
      ...[-12, -9, -6, 6, 9, 12].map((x) => wall(x, -0.3, 3, 0.5)),
    ],
    decor: [
      { asset: 'town_gate', x: 0, z: -0.3 },
      { asset: 'house', x: -8, z: 8, rotation: Math.PI },
      { asset: 'house', x: 7, z: 9, rotation: Math.PI },
      { asset: 'bench', x: NERI_DESTINATION.x, z: NERI_DESTINATION.z + 1 },
      { asset: 'olive', x: -10, z: -5, scale: 1.2 },
      { asset: 'amphora', x: -6, z: 7 },
      ...[-12, -9, -6, 6, 9, 12].map((x) => ({ asset: 'low_wall' as const, x, z: -0.3 })),
      ...[-13, -5, 4, 13].map((x) => ({ asset: 'house' as const, x, z: 17, rotation: Math.PI })),
    ],
    paths: [
      [{ x: 0, z: -15 }, { x: 0, z: 9 }, 2.7],
      [{ x: -6, z: 3 }, { x: 9, z: 3 }, 2.2],
      [{ x: 9, z: 3 }, { x: 9, z: 5 }, 2.2],
    ],
  },
};
