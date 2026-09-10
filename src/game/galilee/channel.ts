import { CHANNEL_IDS, type ChannelId, type Direction, type GalileeState } from './types';

export const DIRECTIONS = ['north', 'east', 'south', 'west'] as const;
export const CHANNEL_CELLS: Record<
  ChannelId,
  { x: number; z: number; shape: 'straight' | 'bend' }
> = {
  entry: { x: 0, z: 0, shape: 'straight' },
  turn: { x: 1, z: 0, shape: 'bend' },
  north: { x: 1, z: 1, shape: 'bend' },
  south: { x: 1, z: -1, shape: 'bend' },
};
export const CHANNEL_ORIGIN = { x: 4, z: -7 };
export function channelPosition(id: ChannelId) {
  const cell = CHANNEL_CELLS[id];
  return { x: CHANNEL_ORIGIN.x + cell.x * 2, z: CHANNEL_ORIGIN.z + cell.z * 2 };
}
export function ports(id: ChannelId, rotation: Direction): Direction[] {
  return (CHANNEL_CELLS[id].shape === 'straight' ? [0, 2] : [0, 1]).map(
    (d) => ((d + rotation) % 4) as Direction,
  );
}
export interface FlowResult {
  path: ChannelId[];
  outlet: 'north' | 'south' | null;
  message: string;
}
/** Follow real adjacent openings from the west source. Bounded even for forged cyclic data. */
export function traceWater(turns: GalileeState['spring']['turns']): FlowResult {
  const path: ChannelId[] = [];
  let id: ChannelId = 'entry',
    incoming: Direction = 3;
  const delta = [
    { x: 0, z: 1 },
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
  ];
  while (!path.includes(id)) {
    const openings = ports(id, turns[id]);
    if (!openings.includes(incoming))
      return {
        path,
        outlet: null,
        message: `Water stops before the ${id} section: its ${DIRECTIONS[incoming]} end is closed.`,
      };
    path.push(id);
    const outgoing = openings.find((d) => d !== incoming)!;
    const cell: { x: number; z: number } = CHANNEL_CELLS[id],
      step = delta[outgoing]!;
    const next: { x: number; z: number } = { x: cell.x + step.x, z: cell.z + step.z };
    if (next.x === 2 && Math.abs(next.z) === 1) {
      const outlet = next.z === 1 ? 'north' : 'south';
      return {
        path,
        outlet,
        message: `Water reaches the ${outlet} basin. Both basins offer travelers a useful place to fill a jar.`,
      };
    }
    const neighbor: ChannelId | undefined = CHANNEL_IDS.find(
      (key) => CHANNEL_CELLS[key].x === next.x && CHANNEL_CELLS[key].z === next.z,
    );
    if (!neighbor)
      return {
        path,
        outlet: null,
        message: `Water leaves the ${id} section toward the ${DIRECTIONS[outgoing]}, where no channel receives it.`,
      };
    incoming = ((outgoing + 2) % 4) as Direction;
    id = neighbor;
  }
  return {
    path,
    outlet: null,
    message: 'The water returns to an earlier section. Connect a route to a basin.',
  };
}
export const SPRING_HINTS = [
  'Follow the open ends from the source on the west. Either receiving basin is useful.',
  'The entry must carry water east. The turn then sends it north or south into a bend.',
  'For the north basin: entry east–west, turn north–west, north bend east–south.',
  'Set Entry to east / west, Turn to west / north, and North to east / south. Test at the source. The South section may stay as it is.',
] as const;
