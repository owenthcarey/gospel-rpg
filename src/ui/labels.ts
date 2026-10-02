import type { ScreenLabel } from '../scene/world';
export interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface LabelCandidate extends ScreenLabel {
  priority: number;
}
export interface SizedLabel extends LabelCandidate {
  width: number;
  height: number;
}
export type LabelMeasureNode = Pick<HTMLElement, 'hidden' | 'offsetWidth' | 'offsetHeight'>;
export const overlaps = (a: LabelBox, b: LabelBox) =>
  a.left < b.right + 5 && a.right > b.left - 5 && a.top < b.bottom + 5 && a.bottom > b.top - 5;

/** Read current layout sizes even when the previous placement hid an expanded name. */
export function measureLabels(
  labels: readonly LabelCandidate[],
  nodes: ReadonlyMap<string, LabelMeasureNode>,
): SizedLabel[] {
  const hidden = new Set<LabelMeasureNode>();
  try {
    // Batch writes before reads; the caller applies final placement before the next paint.
    for (const label of labels) {
      const node = nodes.get(label.id);
      if (label.visible && node?.hidden) {
        hidden.add(node);
        node.hidden = false;
      }
    }
    return labels.map((label) => {
      const node = nodes.get(label.id);
      const width = label.visible ? (node?.offsetWidth ?? 0) : 0;
      const height = label.visible ? (node?.offsetHeight ?? 0) : 0;
      return { ...label, width, height, visible: label.visible && width > 0 && height > 0 };
    });
  } finally {
    for (const node of hidden) node.hidden = true;
  }
}

/** Preserve projected locations; crowded or HUD-covered labels remain available on the map. */
export function arrangeLabels(
  labels: readonly SizedLabel[],
  reserved: readonly LabelBox[],
  width: number,
  height: number,
): ScreenLabel[] {
  const occupied = [...reserved],
    result = new Map<string, ScreenLabel>();
  for (const label of [...labels].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  )) {
    let placement: ScreenLabel = { ...label, visible: false };
    if (label.visible)
      for (const offset of [0, -28, 28, -56, 56]) {
        const x = Math.max(label.width / 2 + 8, Math.min(width - label.width / 2 - 8, label.x)),
          y = label.y + offset;
        const box = {
          left: x - label.width / 2,
          right: x + label.width / 2,
          top: y - label.height,
          bottom: y,
        };
        if (box.top < 8 || box.bottom > height - 8 || occupied.some((r) => overlaps(r, box)))
          continue;
        placement = { id: label.id, x, y, visible: true };
        occupied.push(box);
        break;
      }
    result.set(label.id, placement);
  }
  return labels.map((label) => result.get(label.id)!);
}
