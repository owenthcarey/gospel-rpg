import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo';
import { InteractionFeedback } from '../../src/scene/interaction';

// A small EventTarget-backed DOM boundary lets the actual feedback constructor, native
// event handlers, timers, camera observers and disposal run without adding a DOM package.
class BrowserEventBoundary extends EventTarget {
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    // Node 22 ignores boolean capture during removal; browsers match it to the registration.
    super.removeEventListener(
      type,
      callback,
      typeof options === 'boolean' ? { capture: options } : options,
    );
  }
}

class ElementBoundary extends BrowserEventBoundary {
  hidden = false;
  isConnected = true;
  className = '';
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  children: ElementBoundary[] = [];
  attributes = new Map<string, string>();
  offsetWidth = 150;
  offsetHeight = 160;
  bounds = { left: 0, top: 0, width: 390, height: 844 };
  textContent = '';
  type = '';
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  closest() {
    return null;
  }
  contains(target: unknown): boolean {
    return target === this || this.children.some((child) => child.contains(target));
  }
  append(...children: ElementBoundary[]) {
    this.children.push(...children);
  }
  replaceChildren(...children: ElementBoundary[]) {
    this.children = children;
  }
  querySelector() {
    return this.children.find((child) => child.type === 'button');
  }
  getBoundingClientRect() {
    return this.bounds;
  }
  focus() {}
  remove() {
    this.isConnected = false;
  }
}

let engine: NullEngine;
let feedback: InteractionFeedback | undefined;
afterEach(() => {
  try {
    feedback?.dispose();
    engine?.dispose();
  } finally {
    feedback = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

function studio() {
  vi.useFakeTimers();
  const body = new ElementBoundary();
  const canvas = new ElementBoundary();
  const document = Object.assign(new BrowserEventBoundary(), {
    hidden: false,
    body,
    activeElement: canvas,
    createElement: () => new ElementBoundary(),
    createTextNode: () => new ElementBoundary(),
  });
  const window = new BrowserEventBoundary();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('Element', ElementBoundary);
  vi.stubGlobal('HTMLElement', ElementBoundary);
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 844);
  engine = new NullEngine({
    renderWidth: 390,
    renderHeight: 844,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera(
    'hold',
    -1.5712812559759244,
    0.78,
    24,
    new Vector3(6.999999999473115, 0, -2.000000000358132),
    scene,
  );
  camera.minZ = 0.2;
  camera.maxZ = 220;
  camera.fov = 0.7;
  const cancelTap = vi.fn();
  let paused = false;
  vi.spyOn(scene, 'pick').mockReturnValue({
    pickedMesh: { metadata: { interactionId: 'boat' } },
  } as unknown as PickingInfo);
  feedback = new InteractionFeedback({
    scene,
    canvas: canvas as unknown as HTMLCanvasElement,
    paused: () => paused,
    place: (id) =>
      id === 'boat'
        ? { id, name: 'Board the lake boat', kind: 'place', role: 'Landing', x: 10, z: -4 }
        : undefined,
    navigate: vi.fn(),
    walk: vi.fn(),
    notice: vi.fn(),
    cancelTap,
  });
  const menu = body.children[1]!;
  const pointer = (type: string, id = 1, x = 200, y = 400) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      target: { value: canvas },
      pointerId: { value: id },
      pointerType: { value: 'touch' },
      button: { value: 0 },
      buttons: { value: type === 'pointerup' ? 0 : 1 },
      clientX: { value: x },
      clientY: { value: y },
    });
    document.dispatchEvent(event);
  };
  return {
    camera,
    document,
    window,
    canvas,
    menu,
    cancelTap,
    pointer,
    pause: () => {
      paused = true;
      feedback!.setPaused(true);
    },
  };
}

describe('feedback hold camera guard and lifetime', () => {
  it('opens the menu after the proven High follow notification without reentering getViewMatrix', () => {
    const { camera, pointer, menu } = studio();
    pointer('pointerdown');
    const getView = vi.spyOn(camera, 'getViewMatrix');
    camera.target.copyFromFloats(6.999999999498711, 0, -2.000000000340734);
    camera.getViewMatrix();
    expect(getView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(menu.hidden).toBe(false);
    pointer('pointerup');
    expect(menu.hidden).toBe(false);
  });

  it('rejects cumulative view movement, suppresses its release, and accepts a fresh hold', () => {
    const { camera, pointer, menu, document } = studio();
    pointer('pointerdown');
    for (let step = 0; step < 40; step++) {
      camera.target.x += 0.002;
      camera.getViewMatrix();
    }
    vi.advanceTimersByTime(500);
    expect(menu.hidden).toBe(true);
    pointer('pointerup');
    const click = new Event('click', { cancelable: true });
    Object.defineProperty(click, 'detail', { value: 1 });
    document.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    pointer('pointerdown', 2);
    vi.advanceTimersByTime(500);
    expect(menu.hidden).toBe(false);
  });

  it('rejects zoom driven entirely by the projection observable', () => {
    const { camera, pointer, menu } = studio();
    pointer('pointerdown');
    const getView = vi.spyOn(camera, 'getViewMatrix');
    camera.fov *= 0.9;
    camera.getProjectionMatrix();
    expect(getView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(menu.hidden).toBe(true);
  });

  for (const reason of [
    'move',
    'multitouch',
    'pointercancel',
    'blur',
    'hidden',
    'resize',
    'pause',
    'release',
    'disabled',
  ] as const)
    it('preserves rejection on ' + reason, () => {
      const { pointer, menu, canvas, document, window, pause } = studio();
      pointer('pointerdown');
      if (reason === 'move') {
        pointer('pointermove', 1, 210, 400);
        pointer('pointermove', 1, 200, 400); // Returning to down cannot resurrect the hold.
      }
      if (reason === 'multitouch') {
        pointer('pointerdown', 2);
        pointer('pointerup', 2);
      }
      if (reason === 'pointercancel') pointer('pointercancel');
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'hidden') {
        document.hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (reason === 'resize') window.dispatchEvent(new Event('resize'));
      if (reason === 'pause') pause();
      if (reason === 'release') pointer('pointerup');
      if (reason === 'disabled') canvas.setAttribute('disabled', '');
      vi.advanceTimersByTime(500);
      expect(menu.hidden).toBe(true);
    });

  it('removes both camera observers, all event listeners and the timer when disposed during a hold', () => {
    const { camera, pointer, menu, document, window, cancelTap } = studio();
    expect(camera.onViewMatrixChangedObservable.observers).toHaveLength(1);
    expect(camera.onProjectionMatrixChangedObservable.observers).toHaveLength(1);
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    pointer('pointerdown');
    feedback!.dispose();
    // Drain engine housekeeping: zero-delay observer removal and the 1 ms camera-added task.
    vi.advanceTimersByTime(1);
    expect(camera.onViewMatrixChangedObservable.observers).toHaveLength(0);
    expect(camera.onProjectionMatrixChangedObservable.observers).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeDocument.mock.calls.map(([name]) => name).sort()).toEqual(
      [
        'click',
        'contextmenu',
        'keydown',
        'pointercancel',
        'pointerdown',
        'pointermove',
        'pointerup',
        'visibilitychange',
      ].sort(),
    );
    expect(removeWindow.mock.calls.map(([name]) => name).sort()).toEqual(['blur', 'resize'].sort());
    const calls = cancelTap.mock.calls.length;
    camera.target.x += 1;
    camera.getViewMatrix();
    pointer('pointerdown', 2);
    vi.advanceTimersByTime(500);
    expect(cancelTap).toHaveBeenCalledTimes(calls);
    expect(menu.hidden).toBe(true);
    expect(menu.isConnected).toBe(false);
  });
});
