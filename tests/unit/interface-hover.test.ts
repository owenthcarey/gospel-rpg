import { describe, expect, it } from 'vitest';
import { interfaceHover } from '../../src/ui/interface-hover';

type Fake = {
  classes: string[];
  action?: string;
  label?: string;
  title?: string;
  parent?: Fake;
};
const element = (fake: Fake): Element => {
  const matches = (selector: string) =>
    selector.split(',').some((part) => {
      const classes = [...part.trim().matchAll(/\.([\w-]+)/g)].map((m) => m[1]!);
      const last = classes.at(-1);
      return !!last && fake.classes.includes(last);
    });
  const self: Record<string, unknown> = {
    dataset: { action: fake.action },
    matches,
    getAttribute: (name: string) =>
      name === 'aria-label' ? (fake.label ?? null) : name === 'title' ? (fake.title ?? null) : null,
    closest: (selector: string) =>
      matches(selector) ? self : fake.parent ? element(fake.parent).closest(selector) : null,
  };
  return self as unknown as Element;
};

describe('interface hover text', () => {
  it('names stone tabs, orbs and the compass', () => {
    expect(interfaceHover(element({ classes: ['run-orb'], action: 'run-toggle' }))).toEqual({
      verb: 'Toggle Run',
    });
    expect(interfaceHover(element({ classes: ['minimap-compass'], action: 'face-north' }))).toEqual(
      { verb: 'Look North' },
    );
    expect(interfaceHover(element({ classes: ['minimap-open'], action: 'map' }))).toEqual({
      verb: 'World Map',
    });
    expect(interfaceHover(element({ classes: ['control-hints'], action: 'messages' }))).toEqual({
      verb: 'Messages',
    });
    expect(interfaceHover(element({ classes: ['toolbar'], action: 'emotes' }))).toEqual({
      verb: 'Emotes',
    });
    const icon = element({
      classes: ['pixel-icon'],
      parent: { classes: ['button'], action: 'inventory' },
    });
    expect(interfaceHover(icon)).toBeUndefined();
  });

  it('offers to examine satchel items by name and falls back to labels', () => {
    expect(
      interfaceHover(element({ classes: ['satchel-slot-button'], title: 'Barley loaves' })),
    ).toEqual({ verb: 'Examine', item: 'Barley loaves' });
    expect(interfaceHover(element({ classes: ['run-orb'], label: 'Unknown' }))).toEqual({
      verb: 'Unknown',
    });
    expect(interfaceHover(element({ classes: ['panel'] }))).toBeUndefined();
  });

  it('names emotes and music tracks by their own words', () => {
    const entry = (classes: string[], text: string, first = text) =>
      ({
        closest: (selector: string) =>
          classes.some((name) => selector.includes('.' + name))
            ? entry(classes, text, first)
            : null,
        textContent: text,
        childNodes: [{ textContent: first }],
      }) as unknown as Element;
    expect(interfaceHover(entry(['emote-grid'], ' Wave '))).toEqual({ verb: 'Wave' });
    expect(
      interfaceHover(
        entry(['music-track'], 'Lanterns in the Lanes · heard', 'Lanterns in the Lanes'),
      ),
    ).toEqual({ verb: 'Lanterns in the Lanes' });
  });
});
