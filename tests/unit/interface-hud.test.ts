import { describe, expect, it } from 'vitest';
import {
  HintFade,
  LABEL_NEAR,
  labelExpanded,
  labelPriority,
  toastKind,
  TOAST_ICONS,
  TOAST_KINDS,
  type LabelState,
} from '../../src/ui/hud';
import { coldOpenStep, type ColdOpenState } from '../../src/ui/cinematic';
import { icon, iconNames } from '../../src/ui/icons';
import { logoMark } from '../../src/ui/logo';

const label = (over: Partial<LabelState> = {}): LabelState => ({
  kind: 'person',
  distance: 20,
  nearest: false,
  target: false,
  selected: false,
  hovered: false,
  focused: false,
  ...over,
});

describe('world label hierarchy', () => {
  it('shows distant people and places as markers only', () => {
    expect(labelExpanded(label())).toBe(false);
    expect(labelExpanded(label({ kind: 'place', distance: LABEL_NEAR.person }))).toBe(false);
  });
  it('opens a name when near, nearest, tracked, selected, hovered or focused', () => {
    expect(labelExpanded(label({ distance: LABEL_NEAR.person }))).toBe(true);
    expect(labelExpanded(label({ kind: 'place', distance: LABEL_NEAR.place - 0.1 }))).toBe(true);
    for (const key of ['nearest', 'target', 'selected', 'hovered', 'focused'] as const)
      expect(labelExpanded(label({ [key]: true }))).toBe(true);
  });
  it('places interaction first, then guidance, then proximity', () => {
    const order = [
      label({ focused: true }),
      label({ nearest: true }),
      label({ selected: true }),
      label({ target: true }),
      label({ distance: 2 }),
      label(),
      label({ kind: 'place' }),
    ].map(labelPriority);
    expect([...order].sort((a, b) => b - a)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
  });
  it('treats unknown positions as distant', () => {
    expect(labelExpanded(label({ distance: Infinity }))).toBe(false);
  });
});

describe('control hints', () => {
  it('fade only after both walking and acting, and return on reset', () => {
    const hints = new HintFade(10, 3);
    for (let i = 0; i < 20; i++) hints.move(1);
    expect(hints.faded).toBe(false);
    hints.interact();
    hints.interact();
    expect(hints.faded).toBe(false);
    expect(hints.interact()).toBe(true);
    hints.reset();
    expect(hints.faded).toBe(false);
    expect(hints.moved).toBe(0);
  });
  it('ignores teleports and invalid distances', () => {
    const hints = new HintFade(10, 0);
    hints.move(50);
    hints.move(Number.NaN);
    hints.move(-2);
    expect(hints.moved).toBe(0);
    expect(hints.faded).toBe(false);
  });
});

describe('journal ribbons', () => {
  it('infers a notice kind for existing callers', () => {
    expect(toastKind('Progress could not be saved. Export your journey from Settings.')).toBe(
      'warning',
    );
    expect(toastKind('The journey could not load. Try again.')).toBe('warning');
    expect(toastKind('Your imported journey is ready.')).toBe('save');
    expect(toastKind('A new memory has been added to your journal.')).toBe('memory');
    expect(toastKind('Supplies delivered · Jesus is waiting by the water.')).toBe('item');
    expect(toastKind('You have arrived together. Speak with Amos.')).toBe('place');
    expect(toastKind('Chapter begun · A place by the water')).toBe('story');
  });
  it('maps every kind to an icon in the set', () => {
    for (const kind of TOAST_KINDS) expect(iconNames).toContain(TOAST_ICONS[kind]);
  });
});

describe('cold open progression', () => {
  const start: ColdOpenState = { index: 0, total: 3, result: null };
  it('advances card by card and finishes after the last', () => {
    let s = coldOpenStep(start, 'advance');
    expect(s).toEqual({ index: 1, total: 3, result: null });
    s = coldOpenStep(coldOpenStep(s, 'advance'), 'advance');
    expect(s.result).toBe('finished');
    expect(coldOpenStep(s, 'skip').result).toBe('finished');
  });
  it('skips at any point and ignores later input', () => {
    const s = coldOpenStep(coldOpenStep(start, 'advance'), 'skip');
    expect(s).toMatchObject({ index: 1, result: 'skipped' });
    expect(coldOpenStep(s, 'advance')).toBe(s);
  });
});

describe('icons and mark', () => {
  it('draw every icon on one 24 px, 1.6 stroke grid, hidden from assistive technology', () => {
    for (const name of iconNames) {
      const svg = icon(name);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke-width="1.6"');
      expect(svg).toContain('aria-hidden="true"');
    }
    expect(icon('not-an-icon')).toBe(icon('leaf'));
  });
  it('keeps the logo mark decorative', () => {
    expect(logoMark()).toContain('aria-hidden="true"');
  });
});
