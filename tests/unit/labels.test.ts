import { expect, it } from 'vitest';
import { arrangeLabels, overlaps, type SizedLabel } from '../../src/ui/labels';
const label = (id: string, x: number, y: number, priority = 0): SizedLabel => ({
  id,
  x,
  y,
  priority,
  width: 140,
  height: 26,
  visible: true,
});
it('keeps nearby labels readable without overlapping one another or the HUD', () => {
  const reserved = [{ left: 0, right: 390, top: 0, bottom: 180 }];
  const input = [
    label('nearby', 190, 260, 3),
    label('other', 190, 260),
    label('behind-hud', 190, 100),
    label('edge', 370, 480),
  ];
  const result = arrangeLabels(input, reserved, 390, 844);
  expect(result.find((p) => p.id === 'nearby')).toMatchObject({ visible: true, y: 260 });
  expect(result.find((p) => p.id === 'behind-hud')!.visible).toBe(false);
  const occupied = [...reserved];
  for (const p of result.filter((p) => p.visible)) {
    const box = { left: p.x - 70, right: p.x + 70, top: p.y - 26, bottom: p.y };
    expect(box.left).toBeGreaterThanOrEqual(8);
    expect(box.right).toBeLessThanOrEqual(382);
    expect(occupied.some((r) => overlaps(box, r))).toBe(false);
    occupied.push(box);
  }
  expect(input[0]!.y).toBe(260);
});
