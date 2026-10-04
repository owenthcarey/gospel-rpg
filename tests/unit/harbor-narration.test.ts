import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSave } from '../../src/persistence/schema';
import { harborText } from '../../src/content/harbor/conversations';
import { harborContext } from '../../src/ui/views/harbor';
import { dialogueFor } from '../../src/content/story';
import { workSurface } from '../../src/ui/views/exploration';

it.each([
  [
    'v11-landing-observed',
    'loose rope',
    'Loose rope across the entrance',
    'on the rack',
    'north–south',
    'occupy the northern approach',
    'stand at the southern approach',
  ],
  [
    'v11-landing-interrupted',
    'rope is coiled',
    'Entrance rope coiled',
    'south crossing',
    'north–south',
    'occupy the northern approach',
    'stand at the southern approach',
  ],
  [
    'v11-landing-north',
    'rope is coiled',
    'Entrance rope coiled',
    'north crossing',
    'east–west',
    'rest in their marked storage bay',
    'stand at the southern approach',
  ],
  [
    'v11-landing-south',
    'rope is coiled',
    'Entrance rope coiled',
    'south crossing',
    'east–west',
    'occupy the northern approach',
    'rest in their storage bay',
  ],
] as const)(
  '%s keeps current rope, cargo and plank facts consistent across work and inspection',
  (name, rope, ropePlan, plank, direction, nets, jars) => {
    const raw = JSON.parse(readFileSync(`tests/fixtures/saves/${name}.json`, 'utf8'));
    const state = parseSave(raw).state;
    expect(state).toEqual(raw.state);
    const before = structuredClone(state);
    for (const [id, fact] of [
      ['harbor-entrance', rope],
      ['harbor-nets', nets],
      ['harbor-jars', jars],
    ] as const) {
      const text = harborText(id, state);
      expect(text).toContain(fact);
      const context = harborContext(id, state)!;
      expect(context.body).toContain(text);
      expect(context.body).toContain('ORIGINAL NARRATION');
      expect(dialogueFor(id, state)).toMatchObject({ text, provenance: 'Original narration' });
      for (const view of [context.body, workSurface(state, id)]) {
        expect(view).toContain(ropePlan);
        expect(view).toContain(`Plank: ${plank} · ${direction}.`);
        expect(view).toContain(
          `Net cargo: ${state.harbor.cargo.nets ? 'stored' : 'north approach'}.`,
        );
        expect(view).toContain(
          `Jar cargo: ${state.harbor.cargo.jars ? 'stored' : 'south approach'}.`,
        );
        if (state.harbor.stage === 'complete')
          expect(view).not.toContain('data-action="harbor-action"');
      }
      if (state.harbor.cleared && id === 'harbor-entrance')
        expect(text).not.toContain('A loose rope');
      if (state.harbor.cargo.nets && id === 'harbor-nets')
        expect(text).not.toContain('occupy the northern approach');
      if (state.harbor.cargo.jars && id === 'harbor-jars')
        expect(text).not.toContain('stand at the southern approach');
    }
    expect(state).toEqual(before);
  },
);
