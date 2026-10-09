import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EMOTES, emote } from '../../src/content/emotes';
import { assets, EMOTE_CLIPS } from '../../src/content/assets';
import { pixelIconNames } from '../../src/ui/pixel-icons';

const traveler = assets.find((asset) => asset.id === 'traveler')!;

describe('emotes', () => {
  it('play clips the traveler actually ships, each with its own pixel icon', () => {
    const json = readFileSync('public/assets/models/traveler.glb');
    const length = json.readUInt32LE(12);
    const gltf = JSON.parse(json.subarray(20, 20 + length).toString()) as {
      animations: { name: string }[];
    };
    const shipped = new Set(gltf.animations.map((clip) => clip.name));
    for (const e of EMOTES) {
      expect(traveler.clips, e.id).toContain(e.clip);
      expect(shipped.has(e.clip), e.id).toBe(true);
      expect(pixelIconNames, e.id).toContain(e.id);
    }
    expect(new Set(EMOTES.map((e) => e.id)).size).toBe(EMOTES.length);
  });

  it('keeps traveler-only gestures off every other person', () => {
    for (const asset of assets)
      if (asset.kind === 'actor' && asset.id !== 'traveler')
        for (const clip of EMOTE_CLIPS) expect(asset.clips, asset.id).not.toContain(clip);
  });

  it('looks up emotes by id and rejects unknown values', () => {
    expect(emote('wave')?.clip).toBe('Wave');
    expect(emote('dance')).toBeUndefined();
    expect(emote(undefined)).toBeUndefined();
  });
});
