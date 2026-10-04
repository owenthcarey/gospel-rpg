import { expect, it } from 'vitest';
import { arrangeLabels, overlaps, type LabelBox, type SizedLabel } from '../../src/ui/labels';

// Native 320x568 Reset parent rectangles; compass/open rectangles use the measured
// borderless minimap parent and the unchanged coarse-pointer CSS offsets.
const reservations: LabelBox[] = [
  { left: 0, top: 0, right: 320, bottom: 60 },
  { left: 12, top: 74, right: 308, bottom: 231 },
  { left: 12, top: 440, right: 152, bottom: 550 },
  { left: 162, top: 334, right: 306, bottom: 550 },
  { left: 190, top: 324, right: 234, bottom: 368 },
  { left: 216, top: 407, right: 288, bottom: 451 },
];
const neri: SizedLabel = {
  id: 'neri',
  x: 197.438,
  y: 263.805,
  width: 56,
  height: 58,
  priority: 2,
  visible: true,
};
const courtyard: SizedLabel = {
  id: 'nain-courtyard',
  x: 205.136,
  y: 300.237,
  width: 141,
  height: 45,
  priority: 1.5,
  visible: true,
};
const boxAt = (label: SizedLabel, point: { x: number; y: number }): LabelBox => ({
  left: point.x - label.width / 2,
  right: point.x + label.width / 2,
  top: point.y - label.height,
  bottom: point.y,
});

it('fits the full measured phone name in the captured unused HUD gap', () => {
  const input = [neri, courtyard];
  const original = structuredClone(input);
  const result = arrangeLabels(input, reservations, 320, 568);
  const person = result.find((label) => label.id === neri.id)!;
  expect(person.visible).toBe(true);
  expect(person.x).toBe(neri.x);
  expect(Math.abs(person.y - neri.y)).toBeLessThanOrEqual(56);
  const personBox = boxAt(neri, person);
  expect(personBox.top - reservations[1]!.bottom).toBeGreaterThanOrEqual(5);
  expect(reservations[4]!.top - personBox.bottom).toBeGreaterThanOrEqual(5);
  expect(reservations.some((reserved) => overlaps(personBox, reserved))).toBe(false);
  for (const placed of result.filter((label) => label.visible)) {
    const source = input.find((label) => label.id === placed.id)!;
    expect(reservations.some((reserved) => overlaps(boxAt(source, placed), reserved))).toBe(false);
    expect(placed.y - source.height).toBeGreaterThanOrEqual(8);
    expect(placed.y).toBeLessThanOrEqual(560);
  }
  const place = result.find((label) => label.id === courtyard.id)!;
  if (place.visible) expect(overlaps(personBox, boxAt(courtyard, place))).toBe(false);
  expect(input).toEqual(original);
});

it('keeps the complete name hidden when the same gap is too short', () => {
  const crowded = reservations.map((box, index) => (index === 4 ? { ...box, top: 298 } : box));
  expect(arrangeLabels([neri], crowded, 320, 568)[0]!.visible).toBe(false);
});

it('does not reach a valid measured gap beyond the original projection drift', () => {
  const distant = { ...neri, y: 220.5 };
  expect(arrangeLabels([distant], reservations, 320, 568)[0]!.visible).toBe(false);
});

it('preserves an explicit place winner and the existing successful placements', () => {
  const explicit = { ...courtyard, priority: 5 };
  const result = arrangeLabels([neri, explicit], reservations, 320, 568);
  expect(result.find((label) => label.id === explicit.id)).toEqual({
    id: explicit.id,
    x: explicit.x,
    y: explicit.y,
    visible: true,
  });
  expect(result.find((label) => label.id === neri.id)!.visible).toBe(false);
  const clear = { ...neri, y: 311 };
  expect(arrangeLabels([clear], reservations, 320, 568)[0]).toEqual({
    id: clear.id,
    x: clear.x,
    y: clear.y,
    visible: true,
  });
});
