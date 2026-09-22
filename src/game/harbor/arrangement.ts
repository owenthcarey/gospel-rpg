import type { Point } from '../types';
import type { HarborRoute, HarborState } from './types';

export const HARBOR_CENTER: Point = { x: 3.8, z: -13.1 };
export const HARBOR_SPACING = 1.15;
export const HARBOR_FOOTPRINT = { ...HARBOR_CENTER, width: 3.65, depth: 3.65 };
export const HARBOR_ENTRY = { x: 0, z: 1 };
export const HARBOR_EXIT = { x: 2, z: 1 };
export const HARBOR_CELLS = Array.from({ length: 9 }, (_, i) => ({
  x: i % 3,
  z: Math.floor(i / 3),
}));
export function harborPosition(cell: Point): Point {
  return {
    x: HARBOR_CENTER.x + (cell.x - 1) * HARBOR_SPACING,
    z: HARBOR_CENTER.z + (cell.z - 1) * HARBOR_SPACING,
  };
}
export function cargoPosition(h: HarborState, cargo: 'nets' | 'jars'): Point {
  return harborPosition(
    cargo === 'nets' ? { x: 0, z: h.cargo.nets ? 3.1 : 2 } : { x: 2, z: h.cargo.jars ? -1.1 : 0 },
  );
}
export function plankPosition(h: HarborState): Point {
  return harborPosition({
    x: h.plank === 'rack' ? -1.1 : 1,
    z: h.plank === 'north' ? 2 : h.plank === 'south' ? 0 : 1,
  });
}
export function harborCellBlocked(h: HarborState, c: Point): boolean {
  if (c.x === 1) return h.turn !== 0 || h.plank === 'rack' || c.z !== (h.plank === 'north' ? 2 : 0);
  return (!h.cargo.nets && c.x === 0 && c.z === 2) || (!h.cargo.jars && c.x === 2 && c.z === 0);
}
export interface HarborTrace {
  route: HarborRoute | null;
  path: Point[];
  message: string;
}
/** Search the actual dry cells; neither choice is recognized by a magic success command. */
export function traceHarbor(h: HarborState): HarborTrace {
  const queue = [{ cell: HARBOR_ENTRY, path: [HARBOR_ENTRY] }];
  const seen = new Set<string>();
  const reached: Point[] = [];
  if (!h.cleared)
    return {
      route: null,
      path: [],
      message: 'A loose rope crosses the western entrance. Coil it before checking the passage.',
    };
  while (queue.length) {
    const { cell, path } = queue.shift()!;
    const key = `${cell.x},${cell.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reached.push(cell);
    if (cell.x === HARBOR_EXIT.x && cell.z === HARBOR_EXIT.z)
      return {
        route: h.plank as HarborRoute,
        path,
        message: `The ${h.plank} passage is clear. The plank spans the wet strip and both approaches are open.`,
      };
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ]) {
      const next = { x: cell.x + dx!, z: cell.z + dz! };
      if (next.x >= 0 && next.x < 3 && next.z >= 0 && next.z < 3 && !harborCellBlocked(h, next))
        queue.push({ cell: next, path: [...path, next] });
    }
  }
  const message =
    h.plank === 'rack'
      ? 'The plank is still on its rack. Choose a crossing on the north or south side.'
      : h.turn !== 0
        ? 'The plank runs along the water. Turn it east–west so both ends rest on dry stone.'
        : h.plank === 'north'
          ? 'The net cargo blocks the northern approach. Move it into its storage bay.'
          : 'The jar cargo blocks the southern approach. Move it into its storage bay.';
  return { route: null, path: reached, message };
}
export const HARBOR_HINTS = [
  'Follow the water marks. A useful passage needs dry footing at both ends.',
  'The middle strip is wet. The north and south crossings are equally useful; clear the approach on the side you choose.',
  'Place the plank at either crossing and turn it east–west. Move that side’s cargo into its marked storage bay.',
  'One solution: coil the rope, store the net cargo, place the plank north, turn it east–west, then test. The south route works with the jar cargo stored instead.',
] as const;
