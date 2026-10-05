import { describe, expect, it } from 'vitest';
import { arrivalTop, type ArrivalRect } from '../../src/ui/arrival-placement';

const rect = (left: number, top: number, right: number, bottom: number): ArrivalRect => ({
  left,
  top,
  right,
  bottom,
});

describe('arrival plaque clearance', () => {
  it('keeps the usual composition when the desktop quest sits beside it', () => {
    expect(arrivalTop(1440, 900, 230, 100, [rect(0, 0, 1440, 60), rect(16, 82, 292, 350)])).toBe(
      169,
    );
  });
  it('moves below the narrow-screen quest and above the radar', () => {
    const top = arrivalTop(390, 548, 230, 70, [
      rect(0, 0, 390, 60),
      rect(12, 74, 378, 211),
      rect(230, 350, 376, 530),
    ]);
    expect(top).toBe(223);
  });
  it('yields when expanded reading and a notice fill the available strip', () => {
    expect(
      arrivalTop(320, 548, 230, 70, [
        rect(0, 0, 320, 60),
        rect(12, 74, 308, 276),
        rect(14, 287, 306, 345),
        rect(160, 350, 308, 530),
      ]),
    ).toBeUndefined();
  });
  it('merges overlapping reservations before finding the next clear strip', () => {
    expect(
      arrivalTop(390, 700, 230, 70, [
        rect(0, 0, 390, 60),
        rect(0, 70, 390, 200),
        rect(0, 150, 390, 240),
      ]),
    ).toBe(252);
  });
  it('keeps a plaque inside a short landscape viewport', () => {
    const top = arrivalTop(844, 390, 210, 70, [
      rect(0, 0, 844, 60),
      rect(0, 74, 276, 370),
      rect(600, 180, 830, 370),
    ]);
    expect(top).toBeCloseTo(82.3);
  });
  it('yields when the plaque cannot fit inside the viewport margin', () => {
    expect(arrivalTop(240, 320, 230, 70, [])).toBeUndefined();
    expect(arrivalTop(390, 100, 230, 80, [])).toBeUndefined();
  });
});
