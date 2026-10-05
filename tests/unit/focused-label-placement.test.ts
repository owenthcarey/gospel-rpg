import { expect, it } from 'vitest';
import { arrangeLabels, overlaps, type LabelBox, type SizedLabel } from '../../src/ui/labels';

const rack: SizedLabel = {
  id: 'spring-tools',
  x: 780,
  y: 524,
  width: 110,
  height: 52,
  priority: 5,
  visible: true,
};
const reservations: LabelBox[] = [
  { left: 0, top: 0, right: 1440, bottom: 64 },
  { left: 480, top: 464, right: 964, bottom: 528 },
  { left: 498, top: 540, right: 942, bottom: 836 },
];
const boxAt = (label: SizedLabel, point: { x: number; y: number }): LabelBox => ({
  left: point.x - label.width / 2,
  right: point.x + label.width / 2,
  top: point.y - label.height,
  bottom: point.y,
});

it('preserves the focused name in the nearest measured gap without crossing the notice or HUD', () => {
  const focused = { ...rack, focused: true };
  const before = structuredClone(focused);
  const placed = arrangeLabels([focused], reservations, 1440, 900)[0]!;
  expect(placed).toEqual({ id: rack.id, x: rack.x, y: 459, visible: true });
  expect(Math.abs(placed.y - rack.y)).toBe(65);
  expect(reservations.some((reserved) => overlaps(boxAt(rack, placed), reserved))).toBe(false);
  expect(placed.y - rack.height).toBeGreaterThanOrEqual(8);
  expect(placed.y).toBeLessThanOrEqual(892);
  expect(focused).toEqual(before);
});

it('keeps an unfocused or merely high-priority name within the original 56px association', () => {
  for (const focused of [undefined, false]) {
    const ordinary = { ...rack, focused };
    expect(arrangeLabels([ordinary], reservations, 1440, 900)[0]!.visible).toBe(false);
  }
});

it('keeps the focus-owned name ahead of neighboring names while every visible box stays clear', () => {
  const neighbor = { ...rack, id: 'channel-south', y: 450, priority: 4 };
  const candidates = [neighbor, { ...rack, focused: true }];
  const placed = arrangeLabels(candidates, reservations, 1440, 900);
  expect(placed.find((label) => label.id === rack.id)!.visible).toBe(true);
  const occupied = [...reservations];
  for (const point of placed.filter((label) => label.visible)) {
    const source = candidates.find((label) => label.id === point.id)!;
    const box = boxAt(source, point);
    expect(occupied.some((reserved) => overlaps(box, reserved))).toBe(false);
    expect(point.x).toBe(source.x);
    expect(Math.abs(point.y - source.y)).toBeLessThanOrEqual(source.focused ? 84 : 56);
    occupied.push(box);
  }
});

it('does not associate even a focused name with a free gap beyond 84px', () => {
  const distant = reservations.map((box, index) => (index === 1 ? { ...box, top: 430 } : box));
  expect(arrangeLabels([{ ...rack, focused: true }], distant, 1440, 900)[0]!.visible).toBe(false);
});

it('leaves a fully blocked focus-owned name hidden for the existing map alternative', () => {
  const blocked = [{ left: 0, top: 0, right: 1440, bottom: 900 }];
  expect(arrangeLabels([{ ...rack, focused: true }], blocked, 1440, 900)[0]!.visible).toBe(false);
});

it('preserves existing successful placements when the extra focus step is unnecessary', () => {
  for (const focused of [false, true]) {
    const clear = { ...rack, y: 420, focused };
    expect(arrangeLabels([clear], reservations, 1440, 900)[0]).toEqual({
      id: clear.id,
      x: clear.x,
      y: clear.y,
      visible: true,
    });
  }
});
