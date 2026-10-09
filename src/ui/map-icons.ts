import { FISHING_SPOT, interactables, props } from '../content/region';
import type { Point } from '../game/types';

/**
 * Original round minimap icons for everyday places, as the classic games mark fishing spots,
 * water sources and shops. Each is a 9 × 9 pixel glyph on a dark disc; the minimap keeps
 * them upright while the map turns with the camera.
 */
const PALETTE: Record<string, string> = {
  w: '#2f6fa8',
  W: '#7fc0ea',
  p: '#f4f1e6',
  b: '#6b3f1c',
  l: '#c8853f',
  y: '#efc75a',
};

const GLYPHS = {
  fishing: [
    '.........',
    '.........',
    '..wwww..w',
    '.wWWWWwww',
    'wpWWWWww.',
    '.wWWWWwww',
    '..wwww..w',
    '.........',
    '.........',
  ],
  water: [
    '....w....',
    '....w....',
    '...wWw...',
    '...wWw...',
    '..wWWWw..',
    '.wWpWWWw.',
    '.wWpWWWw.',
    '..wWWWw..',
    '...www...',
  ],
  bakery: [
    '.........',
    '.........',
    '..bbbbb..',
    '.blllllb.',
    'blylylylb',
    'blllllllb',
    '.bbbbbbb.',
    '.........',
    '.........',
  ],
} satisfies Record<string, readonly string[]>;

export type MapIconName = keyof typeof GLYPHS;
export const mapIconNames = Object.keys(GLYPHS) as MapIconName[];

/** Grid validation for tests. */
export function mapIconRows(name: MapIconName): readonly string[] {
  return GLYPHS[name];
}
export const mapIconPalette = PALETTE;

/** One icon centred on the origin, 15 map units across. */
export function mapIconGlyph(name: MapIconName): string {
  const rects = GLYPHS[name].flatMap((row, y) =>
    [...row].flatMap((cell, x) =>
      cell === '.'
        ? []
        : [`<rect x="${x - 4.5}" y="${y - 4.5}" width="1" height="1" fill="${PALETTE[cell]}"/>`],
    ),
  );
  return `<circle r="7" fill="#2a2016" stroke="#000" stroke-width="1"/>${rects.join('')}`;
}

/** Capernaum's everyday places, at the same positions the world uses. */
export const MAP_ICON_LABELS: Readonly<Record<MapIconName, string>> = {
  fishing: 'Fishing spot',
  water: 'Water source',
  bakery: 'Bakery',
};

/** A legend swatch for the map key. */
export function mapIconSwatch(name: MapIconName): string {
  return `<svg class="legend-icon" viewBox="-7.5 -7.5 15 15" aria-hidden="true" focusable="false">${mapIconGlyph(name)}</svg>`;
}

export function capernaumMapIcons(): readonly { name: MapIconName; at: Point }[] {
  const well = interactables.find((place) => place.id === 'well')!;
  const market = props.find((prop) => prop.asset === 'market')!;
  return [
    { name: 'fishing', at: FISHING_SPOT },
    // Beside the well, so the well's own place marker never covers the drop.
    { name: 'water', at: { x: well.x - 1.8, z: well.z + 1.2 } },
    { name: 'bakery', at: { x: market.x, z: market.z } },
  ];
}
