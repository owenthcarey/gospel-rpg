import { describe, expect, it } from 'vitest';
import { assets } from '../../src/content/assets';
import {
  FISHING_SPOT_EXAMINE,
  sceneryExaminations,
  sceneryExamine,
} from '../../src/content/scenery-examine';
import { examinations } from '../../src/content/examine';
import { examinable } from '../../src/scene/interaction';

const mesh = (metadata: Record<string, string> | null, visible = true, enabled = true) => ({
  metadata,
  isVisible: visible,
  isEnabled: () => enabled,
});

describe('scenery examine', () => {
  it('names real assets with short, original lines that end like sentences', () => {
    const ids = new Set(assets.map((asset) => asset.id));
    for (const [id, line] of Object.entries(sceneryExaminations)) {
      expect(ids.has(id as never), id).toBe(true);
      expect(line!.name.length, id).toBeLessThanOrEqual(16);
      expect(line!.text, id).toMatch(/^[A-Z].{8,70}[.!]$/);
      expect(Object.values(examinations), id).not.toContain(line!.text);
    }
    expect(FISHING_SPOT_EXAMINE.text).toMatch(/[.]$/);
  });

  it('leaves the traveler and story people to their own options', () => {
    for (const asset of assets)
      if (asset.kind === 'actor' && asset.id !== 'villager')
        expect(sceneryExamine(asset.id), asset.id).toBeUndefined();
    expect(sceneryExamine(undefined)).toBeUndefined();
  });

  it('examines only visible, enabled, non-interactive scenery, and always the fishing spot', () => {
    expect(examinable(mesh({ assetId: 'boat' }))?.name).toBe('Fishing boat');
    expect(examinable(mesh({ assetId: 'boat', interactionId: 'board-capernaum' }))).toBeUndefined();
    expect(examinable(mesh({ assetId: 'boat' }, false))).toBeUndefined();
    expect(examinable(mesh({ assetId: 'boat' }, true, false))).toBeUndefined();
    expect(examinable(mesh({ assetId: 'grass_tuft' }))).toBeUndefined();
    expect(examinable(mesh(null))).toBeUndefined();
    // The spot's pick target is never drawn; the bubbles above it are too small to aim at.
    expect(examinable(mesh({ examine: 'fishing-spot' }, false))).toBe(FISHING_SPOT_EXAMINE);
  });
});
