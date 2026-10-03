import { describe, expect, it } from 'vitest';
import { lifeText } from '../../src/content/life/conversations';
import { examineText } from '../../src/content/examine';
import { activeInteractables, allInteractables } from '../../src/content/region';
import { contextView } from '../../src/ui/views/campaign';
import { importSave, makeSave } from '../../src/persistence/schema';
import { action, at, district } from '../helpers/campaign';

for (const [method, source, item, otherSource] of [
  ['lashing', 'cord-basket', 'lashing-cord', 'brace-shelf'],
  ['brace', 'brace-shelf', 'wood-brace', 'cord-basket'],
] as const) {
  describe(`${method} observations follow the earned bench material`, () => {
    const initial = district();
    const planning = action(initial, 'life-bench-inspect');
    const chosen = action(planning, 'life-method-' + method);
    const held = action(chosen, 'life-take-' + method);
    const returned = action(held, 'life-return-' + method);
    const cleared = action(held, 'life-clear-bench');
    const fitted = action(cleared, 'life-fit-' + method);
    const complete = action(fitted, 'life-test-bench');

    for (const [stage, earned] of [
      ['initial', initial],
      ['planning', planning],
      ['chosen', chosen],
      ['returned', returned],
    ] as const) {
      it(`preserves the available material observation while ${stage}`, () => {
        const local = at(earned, source);
        const baseline = at(initial, source);
        expect(lifeText(source, local)).toBe(lifeText(source, baseline));
        const place = activeInteractables(local).find((p) => p.id === source)!;
        expect(examineText(place, local)).toBe(examineText(place));
        expect(local.campaign.carrying).toBeNull();
      });
    }

    for (const [stage, earned] of [
      ['held', held],
      ['fitted', fitted],
      ['complete', complete],
    ] as const) {
      it(`describes the empty source and actual material location while ${stage}`, () => {
        const saved = importSave(JSON.stringify(makeSave(at(earned, source)))).state;
        const before = structuredClone(saved);
        const place = activeInteractables(saved).find((p) => p.id === source)!;
        const narration = lifeText(source, saved)!;
        const observation = examineText(place, saved);
        expect(narration).toContain('empty');
        expect(observation).toContain('empty');
        if (stage === 'held') {
          expect(saved.campaign.carrying).toBe(item);
          expect(narration).toContain('while you carry');
          expect(observation).toContain('in your hands');
        } else {
          expect(saved.campaign.carrying).toBeNull();
          expect(saved.life.bench.stage).toBe(stage);
          expect(narration).toContain('landing bench');
          expect(observation).toContain('landing bench');
          expect(narration).not.toContain('Borrow');
          expect(narration).not.toContain('Return');
        }
        expect(contextView(source, saved)?.body).toContain(narration);
        expect(saved).toEqual(before);
        expect(lifeText(otherSource, saved)).toBe(lifeText(otherSource, initial));
        for (const other of allInteractables.filter((p) => p.id !== source))
          expect(examineText(other, saved)).toBe(examineText(other));
      });
    }

    for (const [earned, ready] of [
      [held, false],
      [cleared, true],
    ] as const) {
      it(`keeps held material instructions consistent with ${ready ? 'cleared' : 'loose'} pieces`, () => {
        const local = at(earned, 'landing-bench');
        const narration = lifeText('landing-bench', local)!;
        expect(narration).toContain('in your hands');
        expect(narration).not.toContain('waits');
        expect(narration).not.toContain('fetching');
        expect(narration).toContain(
          ready ? 'You can fit the repair now.' : 'while holding the chosen material',
        );
        expect(contextView('landing-bench', local)?.body).toContain(narration);
      });
    }
  });
}
