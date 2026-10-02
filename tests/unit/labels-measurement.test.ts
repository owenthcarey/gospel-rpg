import { expect, it } from 'vitest';
import {
  arrangeLabels,
  measureLabels,
  type LabelCandidate,
  type LabelMeasureNode,
} from '../../src/ui/labels';

/** Native offsets are zero under display:none; layout changes remain independent of visibility. */
function sizeNode(id: string, width: number, height: number, events: string[] = []) {
  let hidden = true;
  const layout = { width, height };
  const node: LabelMeasureNode = {
    get hidden() {
      return hidden;
    },
    set hidden(value: boolean) {
      events.push(`${id}:hidden=${value}`);
      hidden = value;
    },
    get offsetWidth() {
      events.push(`${id}:width`);
      return hidden ? 0 : layout.width;
    },
    get offsetHeight() {
      events.push(`${id}:height`);
      return hidden ? 0 : layout.height;
    },
  };
  return { node, layout, events };
}
const candidate = (id = 'miriam', visible = true): LabelCandidate => ({
  id,
  x: 190,
  y: 211,
  priority: 5,
  visible,
});
const reserved = [
  { left: 0, right: 390, top: 0, bottom: 180 },
  { left: 0, right: 390, top: 221, bottom: 844 },
];

it('keeps an expanded name hidden consistently when only the old 26px estimate fits a HUD gap', () => {
  const source = candidate();
  const { node } = sizeNode(source.id, 80, 54);
  const nodes = new Map([[source.id, node]]);
  // The regression geometry admits the former hidden-label estimate, but not the actual name.
  expect(
    arrangeLabels([{ ...source, width: 80, height: 26 }], reserved, 390, 844)[0]!.visible,
  ).toBe(true);
  for (let frame = 0; frame < 10; frame++) {
    expect(node.offsetHeight).toBe(0);
    const [measured] = measureLabels([source], nodes);
    expect(measured).toMatchObject({ width: 80, height: 54, priority: 5, visible: true });
    expect(node.hidden).toBe(true);
    const [placed] = arrangeLabels([measured!], reserved, 390, 844);
    expect(placed!.visible).toBe(false);
    node.hidden = !placed!.visible;
  }
  expect(source).toEqual(candidate());
});

it('remeasures expanded, collapsed, font and viewport sizes instead of retaining a hidden size', () => {
  const source = candidate();
  const { node, layout } = sizeNode(source.id, 80, 54);
  const nodes = new Map([[source.id, node]]);
  for (const size of [
    { width: 80, height: 54, visible: false }, // Expanded person name.
    { width: 30, height: 26, visible: true }, // Name collapses to its marker.
    { width: 80, height: 54, visible: false }, // Expands again after being visible.
    { width: 98, height: 62, visible: false }, // Font metrics or reading size changes.
    { width: 68, height: 48, visible: false }, // Responsive viewport dimensions change.
  ]) {
    layout.width = size.width;
    layout.height = size.height;
    const before = node.hidden;
    const [measured] = measureLabels([source], nodes);
    expect(measured).toMatchObject({ width: size.width, height: size.height });
    expect(node.hidden).toBe(before);
    const [placed] = arrangeLabels([measured!], reserved, 390, 844);
    expect(placed!.visible).toBe(size.visible);
    node.hidden = !placed!.visible;
  }
});

it('unhides every projected candidate before reading sizes and leaves offscreen nodes untouched', () => {
  const events: string[] = [];
  const first = sizeNode('first', 60, 54, events);
  const second = sizeNode('second', 90, 62, events);
  const offscreen = sizeNode('offscreen', 120, 80, events);
  const labels = [candidate('first'), candidate('second'), candidate('offscreen', false)];
  const nodes = new Map([
    ['first', first.node],
    ['second', second.node],
    ['offscreen', offscreen.node],
  ]);
  const measured = measureLabels(labels, nodes);
  expect(events).toEqual([
    'first:hidden=false',
    'second:hidden=false',
    'first:width',
    'first:height',
    'second:width',
    'second:height',
    'first:hidden=true',
    'second:hidden=true',
  ]);
  expect(measured[2]).toMatchObject({ visible: false, width: 0, height: 0, priority: 5 });
  expect([...nodes.values()].every((node) => node.hidden)).toBe(true);
});

it('leaves an already visible focused label visible throughout measurement', () => {
  const events: string[] = [];
  const { node } = sizeNode('focused', 98, 62, events);
  node.hidden = false;
  events.length = 0;
  const [measured] = measureLabels([candidate('focused')], new Map([['focused', node]]));
  expect(measured).toMatchObject({ width: 98, height: 62, priority: 5, visible: true });
  expect(node.hidden).toBe(false);
  // Hiding a focused button would discard native focus; measurement never toggles it.
  expect(events).toEqual(['focused:width', 'focused:height']);
});

it('keeps missing or ancestor-hidden labels unavailable and restores hidden state if reading fails', () => {
  const { node } = sizeNode('ancestor-hidden', 0, 0);
  const measured = measureLabels(
    [candidate('ancestor-hidden'), candidate('missing')],
    new Map([['ancestor-hidden', node]]),
  );
  expect(measured.every((label) => !label.visible)).toBe(true);
  expect(node.hidden).toBe(true);
  const unreadable: LabelMeasureNode = {
    hidden: true,
    get offsetWidth(): number {
      throw new Error('layout unavailable');
    },
    offsetHeight: 54,
  };
  expect(() => measureLabels([candidate()], new Map([['miriam', unreadable]]))).toThrow(
    'layout unavailable',
  );
  expect(unreadable.hidden).toBe(true);
});
