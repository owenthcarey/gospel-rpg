import { describe, expect, it } from 'vitest';
import {
  capernaumMapIcons,
  MAP_ICON_LABELS,
  mapIconGlyph,
  mapIconNames,
  mapIconPalette,
  mapIconRows,
} from '../../src/ui/map-icons';
import { isLand } from '../../src/content/region';

describe('minimap place icons', () => {
  it('are 9 × 9 glyphs drawn only from their palette, each with a legend label', () => {
    for (const name of mapIconNames) {
      const rows = mapIconRows(name);
      expect(rows, name).toHaveLength(9);
      for (const row of rows) {
        expect(row, name).toHaveLength(9);
        for (const cell of row) expect(cell === '.' || cell in mapIconPalette, name).toBe(true);
      }
      expect(MAP_ICON_LABELS[name].length).toBeGreaterThan(0);
      expect(mapIconGlyph(name)).toContain('<circle r="7"');
    }
  });

  it('mark Capernaum places inside the map, with fish on the water and the rest on land', () => {
    const icons = capernaumMapIcons();
    expect(icons.map((icon) => icon.name).sort()).toEqual([...mapIconNames].sort());
    for (const { name, at } of icons) {
      expect(Math.abs(at.x), name).toBeLessThan(24);
      expect(Math.abs(at.z), name).toBeLessThan(24);
      expect(isLand(at), name).toBe(name !== 'fishing');
    }
  });
});
