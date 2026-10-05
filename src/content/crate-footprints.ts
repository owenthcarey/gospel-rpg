import type { Obstacle } from '../game/pathfinding';
import type { Placement } from './region';

// Centered bounds enclose the shipped crate's asymmetric boards. WalkGrid adds
// the same traveler clearance used for the other solid scenery.
const dimensions = Object.freeze({ width: 0.82, depth: 0.74 });

export function crateFootprints(placements: readonly Placement[]): Obstacle[] {
  return placements
    .filter((p) => p.asset === 'crate')
    .map((p) =>
      Object.freeze({
        x: p.x,
        z: p.z,
        width: dimensions.width * (p.scale ?? 1),
        depth: dimensions.depth * (p.scale ?? 1),
      }),
    );
}
