import { expect, it } from 'vitest';
import { allInteractables } from '../../src/content/region';
import { wellLabelError, type WellLabelObservation } from '../helpers/well-label-placement';

// Both failed native DIJ cases retained these fresh GLB anchor/HUD/target sizes.
// Their 61 polls each had all other selected/quest/hover/focus flags false.
// Authority: well-diagnostic-draft/native-dij-01-bounded-review.json + its raw refs.
const projected = { x: 164.07083954313, y: 360.9572946080905 };
const canvas = { x: 0, y: 0, width: 320, height: 568 };
const captured = (): WellLabelObservation => ({
  x: 164.071,
  y: 319,
  hidden: false,
  width: 122,
  height: 58,
  basis: {
    labels: allInteractables.map((point) => ({
      id: point.id,
      person: point.kind === 'person',
      place: point.kind === 'place',
      object: point.kind === 'object',
      selected: false,
      target: false,
      hovered: false,
      focused: false,
    })),
    nearest: { text: 'Explore The water point', action: 'nearest', hidden: false },
    ui: { ...canvas },
    canvas: { ...canvas },
    reserved: [
      { left: 0, top: 0, right: 320, bottom: 60 },
      { left: 12, top: 74, right: 308, bottom: 252 },
      { left: 12, top: 440, right: 152, bottom: 550 },
      { left: 162, top: 334, right: 306, bottom: 550 },
      { left: 190, top: 324, right: 234, bottom: 368 },
      { left: 216, top: 407, right: 288, bottom: 451 },
    ],
  },
});

it('accepts the exact measured compass edge from the independent native anchor', () => {
  const result = wellLabelError(captured(), projected, canvas);
  expect(result.expected).toEqual({ id: 'water-point', x: projected.x, y: 319, visible: true });
  expect(result.error).toBeCloseTo(0.00016045686999177633, 12);
});

it('preserves the first legal legacy placement on unobstructed ground', () => {
  const observed = captured();
  observed.basis.reserved = [];
  observed.y = projected.y;
  expect(wellLabelError(observed, projected, canvas).error).toBeLessThan(0.2);
});

it('rejects a wrong independent anchor even when the measured edge still fits', () => {
  expect(
    wellLabelError(captured(), { ...projected, x: projected.x + 1 }, canvas).error,
  ).toBeGreaterThan(0.2);
});

it('rejects an arbitrary nearby y that no shipped placement selected', () => {
  const observed = captured();
  observed.y = 318;
  expect(wellLabelError(observed, projected, canvas).error).toBe(1);
});

it('rejects an earlier focused label without consulting final hidden status or size', () => {
  const observed = captured();
  observed.basis.labels.find((label) => label.id !== 'water-point')!.focused = true;
  expect(wellLabelError(observed, projected, canvas)).toEqual({
    basis: 'an earlier label may reserve space',
    error: Infinity,
  });
});

it('rejects an unknown nearest identity and an incomplete priority snapshot', () => {
  const observed = captured();
  observed.basis.nearest!.text = 'Explore Something else';
  expect(wellLabelError(observed, projected, canvas).error).toBe(Infinity);
  const incomplete = captured();
  incomplete.basis.labels.pop();
  expect(wellLabelError(incomplete, projected, canvas).error).toBe(Infinity);
  const unknown = captured();
  Object.assign(
    unknown.basis.labels.find((label) => label.id !== 'water-point')!,
    { focused: undefined },
  );
  expect(wellLabelError(unknown, projected, canvas).error).toBe(Infinity);
});

it('preserves the hidden raw legacy predicate without claiming hidden measurements', () => {
  const observed = captured();
  observed.hidden = true;
  observed.width = observed.height = 0;
  observed.x = projected.x;
  observed.y = projected.y - 28;
  observed.basis.reserved = null;
  observed.basis.labels = [];
  expect(wellLabelError(observed, projected, canvas)).toEqual({ basis: 'hidden-legacy', error: 0 });
  observed.y += 1;
  expect(wellLabelError(observed, projected, canvas).error).toBe(1);
});
