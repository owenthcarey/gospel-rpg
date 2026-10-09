import { buildings, obstacles, trees, type Placement } from '../content/region';
import { VILLAGE_PATHS } from '../content/terrain';
import { mapPoint } from './minimap';

const bounds = { min: -24, max: 24 };
const scale = 192 / (bounds.max - bounds.min);

/** Static Capernaum geometry shares the positions and collision bounds used by the world. */
export function capernaumMapScenery(): string {
  const paths = VILLAGE_PATHS.map(([from, to, width]) => {
    const a = mapPoint(from, bounds);
    const b = mapPoint(to, bounds);
    const line = `M${a.x},${a.y}L${b.x},${b.y}`;
    // wornPaths paints a broad edge at 0.63 half-width and an inner band at
    // 0.44 half-width. Preserve those nominal widths on the overhead map.
    return `<g class="map-street" fill="none"><path d="${line}" stroke="#ae976c" stroke-width="${width * scale * 1.26}"/><path d="${line}" stroke="#dace9f" stroke-width="${width * scale * 0.88}"/></g>`;
  }).join('');
  return paths + trees.map(treeGlyph).join('') + buildings.map(houseGlyph).join('');
}

function houseGlyph(house: Placement): string {
  const point = mapPoint(house, bounds);
  const collision = obstacles.find((o) => o.x === house.x && o.z === house.z)!;
  const width = collision.width * scale;
  const depth = collision.depth * scale;
  // Wall dimensions come from the shipped Blender house recipe. Collision keeps
  // its wider axis-aligned margin; only the visible house rotates with placement.
  const wallWidth = (house.asset === 'house_large' ? 4.7 : 3.7) * scale;
  const wallDepth = (house.asset === 'house_large' ? 4 : 3.2) * scale;
  const rotation = ((house.rotation ?? 0) * 180) / Math.PI;
  return `<g class="map-house" transform="translate(${point.x},${point.y})"><rect class="map-house-footprint" x="${-width / 2}" y="${-depth / 2}" width="${width}" height="${depth}" fill="#4c4234"/><g transform="rotate(${rotation})"><rect x="${-wallWidth / 2}" y="${-wallDepth / 2}" width="${wallWidth}" height="${wallDepth}" fill="#6f6250" stroke="#f5f2ea" stroke-width="0.9"/><path d="M${-wallWidth / 2 + 1.8},${-wallDepth / 2 + 1.8}H${wallWidth / 2 - 1.8}V${wallDepth / 2 - 1.8}H${-wallWidth / 2 + 1.8}Z" fill="#5f5444"/></g></g>`;
}

function treeGlyph(tree: Placement): string {
  const point = mapPoint(tree, bounds);
  const size = tree.scale ?? 1;
  // Crowns are scenery; the dark center marks the narrow, blocked trunk.
  const crown =
    tree.asset === 'palm'
      ? '<path d="M0-7 1-2 5-5 2-1 7 0 2 1 5 5 1 2 0 7-1 2-5 5-2 1-7 0-2-1-5-5-1-2Z"/>'
      : tree.asset === 'cypress'
        ? '<path d="M0-3 2-2 3 0 2 2 0 3-2 2-3 0-2-2Z"/>'
        : '<path d="M-4-5 1-6 5-3 6 1 3 5-2 6-6 2-6-2Z"/>';
  return `<g class="map-tree" transform="translate(${point.x},${point.y})"><g transform="scale(${size})" fill="#3d6629" stroke="#2c4c1d" stroke-width="0.6">${crown}</g><rect x="-1.8" y="-1.8" width="3.6" height="3.6" fill="#514733"/></g>`;
}
