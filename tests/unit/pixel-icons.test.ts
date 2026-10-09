import { describe, expect, it } from 'vitest';
import { pixelGlyphRows, pixelIcon, pixelIconNames, pixelPalette } from '../../src/ui/pixel-icons';

describe('pixel tab icons', () => {
  it('draws every glyph on a 16-cell grid from the shared palette', () => {
    for (const name of pixelIconNames) {
      const rows = pixelGlyphRows(name);
      expect(rows, name).toHaveLength(16);
      for (const row of rows) {
        expect(row, name).toHaveLength(16);
        for (const cell of row)
          expect(cell === '.' || cell in pixelPalette, name + cell).toBe(true);
      }
    }
  });

  it('renders crisp decorative SVG with an outline', () => {
    const svg = pixelIcon('satchel');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('fill="#000"');
    expect(pixelIcon('satchel')).toBe(svg);
  });
});
