import { expect, it } from 'vitest';
import { allInteractables } from '../../src/content/region';
import { examinations, examineText } from '../../src/content/examine';

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
