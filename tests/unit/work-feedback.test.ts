import { afterEach, describe, expect, it, vi } from 'vitest';
import { Interface } from '../../src/ui/interface';
import { preparedSpring } from '../helpers/galilee';

afterEach(() => vi.unstubAllGlobals());

/** Exercise the actual work refresh, including focus restoration and its deferred layout read. */
function studio(
  previousFeedback = '',
  messageTop = 240,
  messageHeight = 60,
  scroll = 0,
  emptyLimit?: number,
) {
  const pageBody = { isConnected: true };
  const document = { activeElement: pageBody as object, body: pageBody };
  class Control {
    isConnected = true;
    tabIndex = 0;
    dataset: Record<string, string>;
    focus = vi.fn((options?: FocusOptions) => {
      document.activeElement = this;
      return options;
    });
    closest: (selector?: string) => object | null = () => null;
    scrollIntoView = vi.fn();
    getClientRects = () => [{}];
    constructor(value: string) {
      this.dataset = { action: 'galilee-turn', value, workId: 'turn:entry' };
    }
  }
  const oldAction = new Control('entry:1');
  const action = new Control('entry:2');
  const other = new Control('another-control');
  other.dataset = { action: 'work-inspect', value: 'channel-entry' };
  document.activeElement = oldAction;
  const writes: number[] = [];
  let readingTop = scroll;
  const body = {
    clientTop: 0,
    clientHeight: 100,
    get scrollTop() {
      return readingTop;
    },
    set scrollTop(value: number) {
      readingTop =
        !result.textContent && emptyLimit !== undefined ? Math.min(value, emptyLimit) : value;
      writes.push(readingTop);
    },
    getBoundingClientRect: () => ({ top: 100, bottom: 200, height: 100 }),
  };
  const result = {
    textContent: '',
    getBoundingClientRect: () => ({
      top: messageTop - readingTop,
      bottom: messageTop + messageHeight - readingTop,
      height: messageHeight,
    }),
  };
  const previous = {
    dataset: { workTarget: 'channel-entry' },
    querySelector: () => ({ textContent: previousFeedback }),
  };
  const surface = {};
  let currentSurface = surface;
  const crossingNodes = new Map<string, Control>();
  let crossingOwner: Control | undefined;
  let mounted = false;
  const overlay = {
    get firstElementChild() {
      return mounted ? currentSurface : previous;
    },
    contains: (node: object) =>
      (!!crossingOwner && node === crossingOwner) ||
      [...crossingNodes.values()].includes(node as Control) ||
      (mounted ? node === action || node === other : node === oldAction),
    querySelector: (selector: string) =>
      selector === '.work-panel'
        ? previous
        : selector === '.work-body'
          ? body
          : selector === '.work-result'
            ? result
            : (crossingNodes.get(selector) ?? null),
    querySelectorAll: (selector: string) => (selector.startsWith('details') ? [] : [action, other]),
  };
  const fixture = Object.assign(Object.create(Interface.prototype), {
    panel: 'work',
    overlay,
    show: vi.fn(() => {
      mounted = true;
      oldAction.isConnected = false;
      document.activeElement = pageBody;
    }),
    measureWork: vi.fn(),
  });
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('HTMLElement', Control);
  vi.stubGlobal('document', document);
  vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }));
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.push(frame);
    return frames.length;
  });
  const ui = fixture as Interface;
  const refresh = (feedback = 'The inlet now opens east and west.') => {
    expect(ui.work(preparedSpring(), 'channel-entry', feedback)).toBe(true);
    writes.length = 0;
  };
  const layout = () => frames.shift()!(0);
  const paint = () => frames.splice(0).forEach((frame) => frame(0));
  const mountCrossing = (panel: Interface['panel'] = 'journal') => {
    for (const node of crossingNodes.values()) node.isConnected = false;
    if (crossingOwner) crossingOwner.isConnected = false;
    crossingNodes.clear();
    mounted = true;
    currentSurface = {};
    ui.panel = panel;
    document.activeElement = pageBody;
    const targets = {
      review: new Control('review'),
      feedback: new Control('feedback'),
      hint: new Control('hint'),
    };
    const selectors = {
      review: '.crossing-evidence h3',
      feedback: '.crossing-feedback',
      hint: '.crossing-hints summary',
    };
    const reading = { scrollIntoView: vi.fn() };
    targets.hint.closest = (selector) => (selector === '.crossing-hints' ? reading : null);
    for (const mode of ['review', 'feedback', 'hint'] as const) {
      targets[mode].dataset = {};
      crossingNodes.set(selectors[mode], targets[mode]);
    }
    const owner = new Control('people');
    owner.dataset = { action: 'journal-category', value: 'people' };
    crossingOwner = owner;
    return {
      targets,
      reading,
      owner,
      surface: currentSurface,
      remove: (mode: keyof typeof targets) => {
        targets[mode].isConnected = false;
        return crossingNodes.delete(selectors[mode]);
      },
    };
  };
  return {
    refresh,
    layout,
    document,
    action,
    other,
    body,
    result,
    writes,
    ui,
    paint,
    mountCrossing,
  };
}

describe('compact work feedback', () => {
  it('reveals a new result below the body by the smallest scroll and retains action focus', () => {
    const { refresh, layout, document, action, body, result, writes } = studio();
    refresh();
    expect(result.textContent).toBe('');
    layout();
    expect(writes).toEqual([100]);
    expect(body.scrollTop).toBe(100);
    expect(result.getBoundingClientRect()).toMatchObject({ top: 140, bottom: 200 });
    expect(document.activeElement).toBe(action);
    expect(action.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('reveals a new result above the body without scrolling any farther', () => {
    const { refresh, layout, body, result, writes } = studio('', 240, 60, 180);
    refresh();
    layout();
    expect(writes).toEqual([140]);
    expect(body.scrollTop).toBe(140);
    expect(result.getBoundingClientRect()).toMatchObject({ top: 100, bottom: 160 });
  });

  it('keeps an already readable new result in place', () => {
    const { refresh, layout, body, writes } = studio('', 120, 60);
    refresh();
    layout();
    expect(body.scrollTop).toBe(0);
    expect(writes).toEqual([]);
  });

  it('does not jump for unchanged or empty feedback during an unrelated refresh', () => {
    for (const feedback of ['The inlet now opens east and west.', '']) {
      const { refresh, layout, body, writes } = studio(feedback);
      refresh(feedback);
      layout();
      expect(body.scrollTop).toBe(0);
      expect(writes).toEqual([]);
    }
  });

  it('restores an unchanged reading position clamped while its live region was temporarily empty', () => {
    const feedback = 'The inlet now opens east and west.';
    const { refresh, layout, body, writes } = studio(feedback, 240, 60, 80, 40);
    refresh(feedback);
    expect(body.scrollTop).toBe(40);
    layout();
    expect(body.scrollTop).toBe(80);
    expect(writes).toEqual([80]);
  });

  it('leaves a later focused control in charge of its reading position', () => {
    const { refresh, layout, document, action, other, body, writes } = studio();
    refresh();
    other.focus();
    layout();
    expect(document.activeElement).toBe(other);
    expect(action.focus).not.toHaveBeenCalled();
    expect(body.scrollTop).toBe(0);
    expect(writes).toEqual([]);
  });

  it('does not override a reading scroll made before its queued feedback layout', () => {
    const { refresh, layout, body, writes } = studio();
    refresh();
    body.scrollTop = 30;
    writes.length = 0;
    layout();
    expect(body.scrollTop).toBe(30);
    expect(writes).toEqual([]);
  });

  it('starts an oversized result at the body edge so its remaining lines can be read normally', () => {
    const { refresh, layout, body, result, writes } = studio('', 240, 160);
    refresh();
    layout();
    expect(body.scrollTop).toBe(140);
    expect(result.getBoundingClientRect().top).toBe(100);
    expect(writes).toEqual([140]);
  });
});

describe('crossing reading focus ownership', () => {
  const modes = ['review', 'feedback', 'hint'] as const;

  it.each(modes)(
    'crossing reading preserves a later owned control before its queued paint (%s)',
    (mode) => {
      const { ui, paint, document, mountCrossing } = studio();
      const { targets, reading, owner } = mountCrossing();
      ui.focusCrossing(mode);
      const focused = targets[mode].focus.mock.calls.length;
      const revealed = (mode === 'hint' ? reading : targets[mode]).scrollIntoView.mock.calls.length;
      owner.focus();
      paint();
      expect(document.activeElement === owner).toBe(true);
      expect(targets[mode].focus).toHaveBeenCalledTimes(focused);
      expect(
        mode === 'hint' ? reading.scrollIntoView : targets[mode].scrollIntoView,
      ).toHaveBeenCalledTimes(revealed);
    },
  );

  it.each(modes)(
    'crossing reading leaves a replacement surface and its owner untouched (%s)',
    (mode) => {
      const { ui, paint, document, mountCrossing } = studio();
      const previous = mountCrossing('context');
      ui.focusCrossing(mode);
      const focused = previous.targets[mode].focus.mock.calls.length;
      const current = mountCrossing('context');
      expect(current.surface !== previous.surface).toBe(true);
      expect(previous.targets[mode].isConnected).toBe(false);
      current.owner.focus();
      paint();
      expect(document.activeElement === current.owner).toBe(true);
      expect(previous.targets[mode].focus).toHaveBeenCalledTimes(focused);
      expect(current.targets[mode].focus).not.toHaveBeenCalled();
      expect(current.targets[mode].scrollIntoView).not.toHaveBeenCalled();
      expect(current.reading.scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it.each(modes)(
    'reveals the actual %s target in both admitted crossing reading panels',
    (mode) => {
      for (const panel of ['journal', 'context'] as const) {
        const { ui, paint, document, mountCrossing } = studio();
        const { targets, reading } = mountCrossing(panel);
        ui.focusCrossing(mode);
        paint();
        expect(document.activeElement === targets[mode]).toBe(true);
        expect(targets[mode].focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
        expect(targets[mode].tabIndex).toBe(mode === 'hint' ? 0 : -1);
        expect(
          mode === 'hint' ? reading.scrollIntoView : targets[mode].scrollIntoView,
        ).toHaveBeenCalledExactlyOnceWith({ block: mode === 'review' ? 'start' : 'nearest' });
        for (const otherMode of modes.filter((other) => other !== mode)) {
          expect(targets[otherMode].focus).not.toHaveBeenCalled();
          expect(targets[otherMode].scrollIntoView).not.toHaveBeenCalled();
          expect(targets[otherMode].tabIndex).toBe(0);
        }
      }
    },
  );

  it.each(modes)(
    'keeps its current owner when the requested %s reading target is missing',
    (mode) => {
      const { ui, paint, document, mountCrossing } = studio();
      const { targets, reading, owner, remove } = mountCrossing();
      remove(mode);
      owner.focus();
      ui.focusCrossing(mode);
      paint();
      expect(document.activeElement === owner).toBe(true);
      expect(reading.scrollIntoView).not.toHaveBeenCalled();
      for (const target of Object.values(targets)) {
        expect(target.focus).not.toHaveBeenCalled();
        expect(target.scrollIntoView).not.toHaveBeenCalled();
        expect(target.tabIndex).toBe(0);
      }
    },
  );

  it.each(['work', 'map', 'dialogue', null] as const)(
    'does not claim crossing focus in the ineligible %s panel',
    (panel) => {
      const { ui, paint, document, mountCrossing } = studio();
      const { targets, reading, owner } = mountCrossing(panel);
      owner.focus();
      for (const mode of modes) ui.focusCrossing(mode);
      paint();
      expect(document.activeElement === owner).toBe(true);
      expect(reading.scrollIntoView).not.toHaveBeenCalled();
      for (const target of Object.values(targets)) {
        expect(target.focus).not.toHaveBeenCalled();
        expect(target.scrollIntoView).not.toHaveBeenCalled();
        expect(target.tabIndex).toBe(0);
      }
    },
  );
});
