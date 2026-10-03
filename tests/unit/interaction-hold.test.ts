import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo';
import { InteractionFeedback } from '../../src/scene/interaction';
import { examineText } from '../../src/content/examine';
import { allInteractables, type Interactable } from '../../src/content/region';
import { action, district } from '../helpers/campaign';

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

function studio(
  pointerType: 'touch' | 'mouse' = 'touch',
  priorCursorHandling = false,
  observation?: { place: Interactable; examine: (place: Interactable) => string },
) {
  vi.useFakeTimers();
  const body = new ElementBoundary();
  const canvas = new ElementBoundary();
  const width = pointerType === 'mouse' ? 1440 : 390;
  const height = pointerType === 'mouse' ? 900 : 844;
  canvas.bounds = { left: 0, top: 0, width, height };
  const document = Object.assign(new BrowserEventBoundary(), {
    hidden: false,
    body,
    activeElement: canvas,
    createElement: () => new ElementBoundary(),
    createTextNode: (text: string) => {
      const node = new ElementBoundary();
      node.textContent = text;
      return node;
    },
  });
  const window = new BrowserEventBoundary();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('Element', ElementBoundary);
  vi.stubGlobal('HTMLElement', ElementBoundary);
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
  engine = new NullEngine({
    renderWidth: width,
    renderHeight: height,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const scene = new Scene(engine);
  scene.doNotHandleCursors = priorCursorHandling;
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
  const pick = vi.spyOn(scene, 'pick').mockReturnValue({
    pickedMesh: { metadata: { interactionId: observation?.place.id ?? 'boat' } },
  } as unknown as PickingInfo);
  const notice = vi.fn();
  const navigate = vi.fn();
  const walk = vi.fn();
  feedback = new InteractionFeedback({
    scene,
    canvas: canvas as unknown as HTMLCanvasElement,
    paused: () => paused,
    place: (id) =>
      id === observation?.place.id
        ? observation.place
        : id === 'boat'
          ? { id, name: 'Board the lake boat', kind: 'place', role: 'Landing', x: 10, z: -4 }
          : undefined,
    navigate,
    walk,
    examine: observation?.examine,
    notice,
    cancelTap,
  });
  const hint = body.children[0]!;
  const menu = body.children[1]!;
  let now = 100;
  if (pointerType === 'mouse') vi.spyOn(performance, 'now').mockImplementation(() => now);
  const pointer = (
    type: string,
    id = 1,
    x = 200,
    y = 400,
    options: { target?: ElementBoundary; buttons?: number; pointerType?: string } = {},
  ) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      target: { value: options.target ?? canvas },
      pointerId: { value: id },
      pointerType: { value: options.pointerType ?? pointerType },
      button: { value: 0 },
      buttons: { value: options.buttons ?? (type === 'pointerup' ? 0 : 1) },
      clientX: { value: x },
      clientY: { value: y },
    });
    document.dispatchEvent(event);
  };
  const hover = (options: Parameters<typeof pointer>[4] = {}) => {
    // A real eligible mousemove passes the existing 80 ms pick throttle.
    now += 81;
    pointer('pointermove', 1, 884, 521, { ...options, buttons: options.buttons ?? 0 });
  };
  return {
    scene,
    camera,
    hint,
    pick,
    hover,
    document,
    window,
    canvas,
    menu,
    cancelTap,
    notice,
    navigate,
    walk,
    pointer,
    pause: () => {
      paused = true;
      feedback!.setPaused(true);
    },
  };
}

it('resolves the earned observation when Examine is activated, after opening the menu', () => {
  let state = district();
  for (const id of ['life-thread-accept', 'life-clue-water', 'life-clue-cloth', 'life-identify'])
    state = action(state, id);
  const place = allInteractables.find((p) => p.id === 'sewing-rest')!;
  const examine = vi.fn((point: Interactable) => examineText(point, state));
  const { document, canvas, menu, notice } = studio('mouse', false, { place, examine });
  const key = new Event('keydown', { cancelable: true });
  Object.defineProperties(key, {
    target: { value: canvas },
    key: { value: 'ContextMenu' },
  });
  document.dispatchEvent(key);
  expect(menu.hidden).toBe(false);
  expect(examine).not.toHaveBeenCalled();
  state = action(state, 'life-take-pouch');
  const before = structuredClone(state);
  const choice = menu.children.find((node) => node.children[0]?.textContent === 'Examine ');
  expect(choice).toBeDefined();
  choice!.dispatchEvent(new Event('click'));
  expect(menu.hidden).toBe(true);
  expect(examine).toHaveBeenCalledExactlyOnceWith(place);
  expect(notice).toHaveBeenCalledExactlyOnceWith(
    'A pouch by the shore: The dry resting place is empty. Ruth’s pouch is in your hands.',
  );
  expect(state).toEqual(before);
});

it('retains the default observation when no state-aware callback is provided', () => {
  const { document, canvas, menu, notice } = studio('mouse');
  const key = new Event('keydown', { cancelable: true });
  Object.defineProperties(key, {
    target: { value: canvas },
    key: { value: 'ContextMenu' },
  });
  document.dispatchEvent(key);
  const choice = menu.children.find((node) => node.children[0]?.textContent === 'Examine ');
  choice!.dispatchEvent(new Event('click'));
  expect(notice).toHaveBeenCalledExactlyOnceWith('Board the lake boat: Landing.');
});

it.each(['Inspect', 'Walk here'])('keeps %s separate from observational feedback', (option) => {
  const place = allInteractables.find((p) => p.id === 'sewing-rest')!;
  const examine = vi.fn(() => 'Observation');
  const { document, canvas, menu, notice, navigate, walk } = studio('mouse', false, {
    place,
    examine,
  });
  const key = new Event('keydown', { cancelable: true });
  Object.defineProperties(key, {
    target: { value: canvas },
    key: { value: 'ContextMenu' },
  });
  document.dispatchEvent(key);
  const choice = menu.children.find((node) =>
    option === 'Inspect'
      ? node.children[0]?.textContent === 'Inspect '
      : node.textContent === option,
  );
  choice!.dispatchEvent(new Event('click'));
  expect(examine).not.toHaveBeenCalled();
  expect(notice).not.toHaveBeenCalled();
  if (option === 'Inspect') {
    expect(navigate).toHaveBeenCalledExactlyOnceWith(place.id, undefined);
    expect(walk).not.toHaveBeenCalled();
  } else {
    expect(walk).toHaveBeenCalledExactlyOnceWith(place, undefined);
    expect(navigate).not.toHaveBeenCalled();
  }
});

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

// Exercise the real downstream Babylon cursor pass that follows document feedback.
// Only the browser DOM/event boundary is supplied; the input manager is unchanged.
function engineMousemove(scene: Scene, canvas: ElementBoundary) {
  vi.spyOn(engine, 'getInputElement').mockReturnValue(canvas as unknown as HTMLElement);
  vi.stubGlobal(
    'PointerEvent',
    class extends Event {
      constructor(type: string, init: PointerEventInit = {}) {
        super(type);
        Object.assign(this, init);
      }
    },
  );
  scene.simulatePointerMove({ hit: false, pickedMesh: null } as PickingInfo, { pointerId: 1 });
}

describe('feedback hover camera guard and lifetime', () => {
  it('retains the named hint and pointer cursor through tiny actual follow notifications', () => {
    const { scene, camera, hover, hint, menu, canvas, pick } = studio('mouse');
    hover();
    engineMousemove(scene, canvas);
    expect(hint.hidden).toBe(false);
    expect(hint.children.map((child) => child.textContent).join('')).toBe(
      'Visit Board the lake boat',
    );
    expect(canvas.style.cursor).toBe('pointer');
    const notified = vi.fn();
    camera.onViewMatrixChangedObservable.add(notified);
    const getView = vi.spyOn(camera, 'getViewMatrix');
    camera.target.x += 3e-11;
    camera.target.z += 2e-11;
    camera.getViewMatrix();
    engineMousemove(scene, canvas);
    expect(getView).toHaveBeenCalledTimes(1);
    expect(notified).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(700);
    expect(hint.hidden).toBe(false);
    expect(canvas.style.cursor).toBe('pointer');
    expect(menu.hidden).toBe(true);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('clears cumulative small pan, stays clear on return, and picks again only on a fresh mousemove', () => {
    const { camera, hover, hint, canvas, pick } = studio('mouse');
    const original = camera.target.clone();
    hover();
    camera.target.x += 0.002;
    camera.getViewMatrix();
    expect(hint.hidden).toBe(false);
    for (let step = 1; step < 40; step++) {
      camera.target.x += 0.002;
      camera.getViewMatrix();
    }
    expect(hint.hidden).toBe(true);
    expect(canvas.style.cursor).toBe('');
    expect(pick).toHaveBeenCalledTimes(1);
    camera.target.copyFrom(original);
    camera.getViewMatrix();
    expect(hint.hidden).toBe(true);
    hover();
    expect(hint.hidden).toBe(false);
    expect(canvas.style.cursor).toBe('pointer');
    expect(pick).toHaveBeenCalledTimes(2);
  });

  for (const motion of ['orbit', 'tilt', 'zoom', 'projection'] as const)
    it('clears on meaningful ' + motion + ' without repicking the stale target', () => {
      const { camera, hover, hint, canvas, pick } = studio('mouse');
      hover();
      const getView = vi.spyOn(camera, 'getViewMatrix');
      if (motion === 'orbit') camera.alpha += 0.08;
      if (motion === 'tilt') camera.beta += 0.08;
      if (motion === 'zoom') camera.radius *= 0.8;
      if (motion === 'projection') {
        camera.fov *= 0.9;
        camera.getProjectionMatrix();
        expect(getView).not.toHaveBeenCalled();
      } else camera.getViewMatrix();
      expect(hint.hidden).toBe(true);
      expect(canvas.style.cursor).toBe('');
      expect(pick).toHaveBeenCalledTimes(1);
    });

  it('clears an actual bounds change even when the accompanying camera notification is tiny', () => {
    const { camera, hover, hint, canvas, pick } = studio('mouse');
    hover();
    canvas.bounds.left += 1;
    camera.target.x += 3e-11;
    camera.getViewMatrix();
    expect(hint.hidden).toBe(true);
    expect(canvas.style.cursor).toBe('');
    expect(pick).toHaveBeenCalledTimes(1);
  });

  for (const reason of [
    'outside',
    'buttons',
    'touch',
    'down',
    'pointercancel',
    'blur',
    'hidden',
    'resize',
    'pause',
    'menu',
  ] as const)
    it(
      'clears the hover baseline on ' + reason + ' and never revives it from camera settling',
      () => {
        const { camera, hover, hint, canvas, document, window, pause, pointer, pick, menu } =
          studio('mouse');
        hover();
        expect(hint.hidden).toBe(false);
        if (reason === 'outside') hover({ target: new ElementBoundary() });
        if (reason === 'buttons') hover({ buttons: 1 });
        if (reason === 'touch') hover({ pointerType: 'touch' });
        if (reason === 'down') pointer('pointerdown');
        if (reason === 'pointercancel') pointer('pointercancel');
        if (reason === 'blur') window.dispatchEvent(new Event('blur'));
        if (reason === 'hidden') {
          document.hidden = true;
          document.dispatchEvent(new Event('visibilitychange'));
        }
        if (reason === 'resize') window.dispatchEvent(new Event('resize'));
        if (reason === 'pause') pause();
        if (reason === 'menu') {
          const key = new Event('keydown', { cancelable: true });
          Object.defineProperties(key, {
            target: { value: canvas },
            key: { value: 'ContextMenu' },
          });
          document.dispatchEvent(key);
          expect(menu.hidden).toBe(false);
        }
        expect(hint.hidden).toBe(true);
        expect(canvas.style.cursor).toBe('');
        const picks = pick.mock.calls.length;
        camera.target.x += 3e-11;
        camera.getViewMatrix();
        expect(hint.hidden).toBe(true);
        expect(canvas.style.cursor).toBe('');
        expect(pick).toHaveBeenCalledTimes(picks);
      },
    );

  it.each([false, true])('returns cursor ownership to the previous scene policy (%s)', (prior) => {
    const { scene, hover, canvas, hint } = studio('mouse', prior);
    scene.defaultCursor = 'crosshair';
    hover();
    engineMousemove(scene, canvas);
    expect(hint.hidden).toBe(false);
    expect(canvas.style.cursor).toBe('pointer');
    feedback!.dispose();
    canvas.style.cursor = 'next-owner';
    engineMousemove(scene, canvas);
    expect(canvas.style.cursor).toBe(prior ? 'next-owner' : 'crosshair');
    // A repeated cleanup must not overwrite a later owner's explicit policy.
    scene.doNotHandleCursors = true;
    feedback!.dispose();
    expect(scene.doNotHandleCursors).toBe(true);
  });

  it('clears an active hover and removes its camera and native input lifetime on disposal', () => {
    const { camera, hover, hint, canvas, pick } = studio('mouse');
    hover();
    expect(hint.hidden).toBe(false);
    feedback!.dispose();
    vi.advanceTimersByTime(1); // Babylon deferred observer removal and camera-added task.
    expect(hint.hidden).toBe(true);
    expect(hint.isConnected).toBe(false);
    expect(canvas.style.cursor).toBe('');
    expect(camera.onViewMatrixChangedObservable.observers).toHaveLength(0);
    expect(camera.onProjectionMatrixChangedObservable.observers).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    camera.target.x += 1;
    camera.getViewMatrix();
    hover();
    expect(pick).toHaveBeenCalledTimes(1);
    expect(hint.hidden).toBe(true);
    expect(canvas.style.cursor).toBe('');
  });
});
