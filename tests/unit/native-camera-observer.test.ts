import { afterEach, describe, expect, it, vi } from 'vitest';
import { armNativeCameraControls } from '../helpers/moored-boat-browser';

afterEach(() => vi.unstubAllGlobals());

/** DOM-shaped controls with live geometry; the unit harness never drives the game browser. */
function studio() {
  class Surface {
    isConnected = true;
    disabled = false;
    inert = false;
    display = 'block';
    visibility = 'visible';
    parent: Surface | null = null;
    box = { left: 20, top: 40, width: 44, height: 44 };
    constructor(public name: string | null) {}
    getBoundingClientRect() {
      return this.box;
    }
    getAttribute() {
      return this.name;
    }
    closest(selector: string): Surface | null {
      if (selector === '[inert]') return this.inert ? this : null;
      return this.name ? this : this.parent;
    }
    contains(node: Surface | null) {
      return node === this || node?.parent === this;
    }
  }
  const reset = new Surface('Reset camera');
  const north = new Surface('Face north');
  north.box.left = 90;
  const zoom = new Surface('Zoom in');
  zoom.box.left = 160;
  const icon = new Surface(null);
  icon.parent = reset;
  const blocker = new Surface(null);
  const nodes = [reset, north, zoom];
  const listeners = new Map<string, (event: PointerEvent) => void>();
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  let occluded = false;
  const observationWindow = {
    addEventListener: (type: string, listener: (event: PointerEvent) => void) =>
      listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    mooredCameraObservation: undefined as Window['mooredCameraObservation'],
  };
  vi.stubGlobal('Element', Surface);
  vi.stubGlobal('window', observationWindow);
  vi.stubGlobal('document', {
    querySelectorAll: () => nodes,
    elementFromPoint: (x: number, y: number) => {
      if (occluded) return blocker;
      const target = nodes.find(
        (node) =>
          x >= node.box.left &&
          x <= node.box.left + node.box.width &&
          y >= node.box.top &&
          y <= node.box.top + node.box.height,
      );
      return target === reset ? icon : (target ?? null);
    },
  });
  vi.stubGlobal('getComputedStyle', (node: Surface) => ({
    display: node.display,
    visibility: node.visibility,
  }));
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 844);
  vi.stubGlobal('PerformanceObserver', undefined);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const contact = (
    target: Surface,
    point: { x: number; y: number },
    trusted = true,
    type = 'pointerdown',
  ) => {
    listeners.get(type)!({
      target,
      clientX: point.x,
      clientY: point.y,
      isTrusted: trusted,
      pointerType: 'mouse',
      type,
      timeStamp: performance.now(),
    } as unknown as PointerEvent);
  };
  return {
    reset,
    north,
    zoom,
    icon,
    nodes,
    listeners,
    frames,
    observationWindow,
    contact,
    block: () => {
      occluded = true;
    },
    finish: () => observationWindow.mooredCameraObservation!.finish(),
  };
}

describe('native camera contact ownership', () => {
  it('measures each unique rendered control and accepts a genuine descendant target', () => {
    const fixture = studio();
    const initial = armNativeCameraControls(['Reset camera', 'Face north', 'Zoom in']);
    expect(initial.map((control) => control.point)).toEqual([
      { x: 42, y: 62 },
      { x: 112, y: 62 },
      { x: 182, y: 62 },
    ]);
    for (const control of initial)
      expect(control).toMatchObject({
        count: 1,
        enabled: true,
        rendered: true,
        exposed: true,
        inViewport: true,
      });
    fixture.contact(fixture.icon, initial[0]!.point);
    expect(fixture.finish().events[0]).toMatchObject({
      trusted: true,
      name: 'Reset camera',
      control: initial[0],
    });
  });

  it('rejects missing and duplicate named controls without inventing a fallback target', () => {
    for (const duplicate of [false, true]) {
      const fixture = studio();
      if (duplicate) fixture.nodes.push(fixture.reset);
      else fixture.nodes.shift();
      const [control] = armNativeCameraControls(['Reset camera']);
      expect(control).toMatchObject({
        count: duplicate ? 2 : 0,
        enabled: false,
        rendered: false,
        exposed: false,
        inViewport: false,
      });
      fixture.finish();
    }
  });

  it('rejects both disabled controls and controls in an inert surface', () => {
    for (const key of ['disabled', 'inert'] as const) {
      const fixture = studio();
      fixture.reset[key] = true;
      expect(armNativeCameraControls(['Reset camera'])[0]!.enabled).toBe(false);
      fixture.finish();
    }
  });

  it('rejects collapsed, non-finite, hidden and disconnected geometry', () => {
    for (const invalidate of [
      (f: ReturnType<typeof studio>) => {
        f.reset.box.height = 0;
      },
      (f: ReturnType<typeof studio>) => {
        f.reset.box.left = NaN;
      },
      (f: ReturnType<typeof studio>) => {
        f.reset.display = 'none';
      },
      (f: ReturnType<typeof studio>) => {
        f.reset.visibility = 'hidden';
      },
      (f: ReturnType<typeof studio>) => {
        f.reset.isConnected = false;
      },
    ]) {
      const fixture = studio();
      invalidate(fixture);
      expect(armNativeCameraControls(['Reset camera'])[0]!.rendered).toBe(false);
      fixture.finish();
    }
  });

  it('distinguishes an occluded control from one outside the viewport', () => {
    const blocked = studio();
    blocked.block();
    expect(armNativeCameraControls(['Reset camera'])[0]).toMatchObject({
      rendered: true,
      exposed: false,
      inViewport: true,
    });
    blocked.finish();
    const outside = studio();
    outside.reset.box.left = 400;
    expect(armNativeCameraControls(['Reset camera'])[0]).toMatchObject({
      rendered: true,
      inViewport: false,
    });
    outside.finish();
  });

  it('records live disabled and obscured predicates after a previously valid preflight', () => {
    const fixture = studio();
    const [initial] = armNativeCameraControls(['Reset camera']);
    expect(initial).toMatchObject({ enabled: true, exposed: true });
    fixture.reset.disabled = true;
    fixture.block();
    fixture.contact(fixture.reset, initial!.point);
    expect(fixture.finish().events[0]!.control).toMatchObject({ enabled: false, exposed: false });
  });

  it('records live name ambiguity even when the original control still receives the event', () => {
    const fixture = studio();
    const [initial] = armNativeCameraControls(['Reset camera']);
    fixture.nodes.push(fixture.reset);
    fixture.contact(fixture.reset, initial!.point);
    expect(fixture.finish().events[0]!.control).toMatchObject({
      count: 2,
      enabled: false,
      rendered: false,
      exposed: false,
    });
  });

  it('records the actual different command when reflow replaces the cached target', () => {
    const fixture = studio();
    const [initial] = armNativeCameraControls(['Reset camera']);
    fixture.reset.box.left = 300;
    fixture.zoom.box.left = 20;
    fixture.contact(fixture.zoom, initial!.point);
    expect(fixture.finish().events[0]).toMatchObject({
      name: 'Zoom in',
      control: { name: 'Zoom in', exposed: true },
    });
  });

  it('preserves untrusted input as a failing predicate instead of treating it as native evidence', () => {
    const fixture = studio();
    const [initial] = armNativeCameraControls(['Reset camera']);
    fixture.contact(fixture.reset, initial!.point, false);
    expect(fixture.finish().events[0]!.trusted).toBe(false);
  });

  it('cleans every passive listener and frame and can then start an independent phase', () => {
    const fixture = studio();
    armNativeCameraControls(['Reset camera']);
    const paint = [...fixture.frames.values()][0]!;
    fixture.frames.clear();
    paint(performance.now());
    const result = fixture.finish();
    expect(result.frames).toHaveLength(1);
    expect(result.longTasksSupported).toBe(false);
    expect(fixture.listeners.size).toBe(0);
    expect(fixture.frames.size).toBe(0);
    expect(fixture.observationWindow.mooredCameraObservation).toBeUndefined();
    armNativeCameraControls(['Zoom in']);
    expect(fixture.finish().initial[0]!.name).toBe('Zoom in');
  });
});
