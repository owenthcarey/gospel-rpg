import { expect, it } from 'vitest';
import { activeInteractables, allInteractables } from '../../src/content/region';
import { examinations, examineText } from '../../src/content/examine';
import { lifePresentation } from '../../src/content/life/presentation';
import { action, at, district } from '../helpers/campaign';
import { importSave, makeSave } from '../../src/persistence/schema';

it('authors observations only for existing people, objects and places', () => {
  const ids = new Set(allInteractables.map((place) => place.id));
  for (const [id, description] of Object.entries(examinations)) {
    expect(ids.has(id), id).toBe(true);
    expect(description.length).toBeGreaterThan(10);
    expect(description.length).toBeLessThan(150);
  }
});

it('provides a named, short observation for every authored interaction without changing it', () => {
  for (const place of allInteractables) {
    const before = structuredClone(place);
    const text = examineText(place);
    expect(text.startsWith(place.name + ': ')).toBe(true);
    expect(text.endsWith('.')).toBe(true);
    expect(place).toEqual(before);
  }
});

it('observes the pouch at its earned location through carrying, setting back and returning', () => {
  const initial = at(district(), 'sewing-rest');
  let identified = initial;
  for (const id of ['life-thread-accept', 'life-clue-water', 'life-clue-cloth', 'life-identify'])
    identified = action(identified, id);
  const held = action(identified, 'life-take-pouch');
  const setBack = action(held, 'life-set-pouch');
  const returned = action(action(setBack, 'life-take-pouch'), 'life-return-pouch');
  const complete = action(returned, 'life-ending-welcome');

  for (const [earned, location] of [
    [initial, 'shore'],
    [identified, 'shore'],
    [held, 'hands'],
    [setBack, 'shore'],
    [returned, 'Ruth'],
    [complete, 'Ruth'],
  ] as const) {
    const state = at(earned, 'sewing-rest');
    const saved = importSave(JSON.stringify(makeSave(state))).state;
    const place = activeInteractables(saved).find((p) => p.id === 'sewing-rest')!;
    const before = structuredClone(saved);
    const text = examineText(place, saved);
    if (location === 'shore') {
      expect(lifePresentation(saved).pouchAtShore).toBe(true);
      expect(text).toBe(examineText(place));
    } else {
      expect(lifePresentation(saved).pouchAtShore).toBe(false);
      expect(text).toContain('resting place is empty');
      expect(text).toContain(
        location === 'hands' ? 'in your hands' : 'beside her in the courtyard',
      );
    }
    expect(saved).toEqual(before);
    // State awareness must leave every other original description intact.
    for (const other of allInteractables.filter((p) => p.id !== 'sewing-rest'))
      expect(examineText(other, saved)).toBe(examineText(other));
  }
});
