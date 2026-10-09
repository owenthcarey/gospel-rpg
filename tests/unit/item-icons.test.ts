import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HELD_ITEMS } from '../../src/game/campaign/types';
import { items } from '../../src/content/story';
import { itemArtwork } from '../../src/ui/item-art';

const folder = new URL('../../public/assets/items/', import.meta.url);
const itemIds = [...Object.keys(items), ...HELD_ITEMS, 'empty-basket'];

describe('original item sprite delivery', () => {
  it('covers every existing satchel and carried item without orphaned production sprites', () => {
    const referenced = new Set<string>();
    for (const id of itemIds) {
      const markup = itemArtwork(id);
      expect(markup, id).toContain('<img ');
      const source = markup.match(/src="([^"]+)"/)?.[1];
      expect(source, id).toMatch(/\/assets\/items\/[a-z-]+\.webp$/);
      referenced.add(source!.split('/').at(-1)!);
    }
    expect([...referenced].sort()).toEqual(readdirSync(folder).sort());
    expect(referenced.size).toBe(13);
  });

  it('distinguishes an empty jug from water carried for either table or resting place', () => {
    const empty = itemArtwork('empty-jug');
    const filled = itemArtwork('water-jug');
    expect(empty).not.toBe(filled);
    expect(itemArtwork('rest-water')).toBe(filled);
    expect(readFileSync(new URL('jug.webp', folder))).not.toEqual(
      readFileSync(new URL('water-jug.webp', folder)),
    );
  });

  it('keeps transparent 64 px WebP sprites inside a compact download budget', () => {
    let totalBytes = 0;
    for (const file of readdirSync(folder)) {
      const bytes = readFileSync(new URL(file, folder));
      expect(bytes.toString('ascii', 0, 4), file).toBe('RIFF');
      expect(bytes.readUInt32LE(4), file).toBe(bytes.length - 8);
      expect(bytes.toString('ascii', 8, 12), file).toBe('WEBP');
      const chunk = bytes.toString('ascii', 12, 16);
      if (chunk === 'VP8L') {
        // Lossless sprites keep exact one-pixel outlines; the VP8L header packs
        // 14-bit width and height and an alpha-in-use bit after its signature.
        expect(bytes[20], file).toBe(0x2f);
        const header = bytes.readUInt32LE(21);
        expect((header & 0x3fff) + 1, file).toBe(64);
        expect(((header >>> 14) & 0x3fff) + 1, file).toBe(64);
        expect((header >>> 28) & 1, file).toBe(1);
      } else {
        // Blender's lossy RGBA WebP output declares alpha and canvas size in VP8X.
        expect(chunk, file).toBe('VP8X');
        expect(bytes[20]! & 0x10, file).toBe(0x10);
        expect(bytes.readUIntLE(24, 3) + 1, file).toBe(64);
        expect(bytes.readUIntLE(27, 3) + 1, file).toBe(64);
      }
      expect(bytes.length, file).toBeGreaterThan(512);
      expect(bytes.length, file).toBeLessThan(6 * 1024);
      totalBytes += bytes.length;
    }
    expect(totalBytes).toBeLessThan(48 * 1024);
  });
});
