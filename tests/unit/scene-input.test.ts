import { afterEach, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo';
import { PointerInfo, PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { bindExplorationInput } from '../../src/scene/input';

afterEach(() => vi.unstubAllGlobals());

it('cancels canonical taps without clearing movement keys and accepts a fresh gesture', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const floor = new Mesh('ground', scene);
  floor.metadata = { ground: true };
  const pick = new PickingInfo();
  pick.hit = true;
  pick.pickedMesh = floor;
  pick.pickedPoint = new Vector3(4, 0, 7);
  const surface = new EventTarget();
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  const keys = new Set(['w']);
  const walk = vi.fn();
  const binding = bindExplorationInput({
    scene,
    canvas: surface as HTMLCanvasElement,
    keys,
    paused: () => false,
    navigate: vi.fn(),
    walk,
    nearest: () => undefined,
    resetCamera: vi.fn(),
    notice: vi.fn(),
  });
  const pointer = (type: string, pointerId: number) =>
    Object.assign(new Event(type), { pointerId, clientX: 10, clientY: 10, button: 0 });
  const down = (id: number) => surface.dispatchEvent(pointer('pointerdown', id));
  const up = (id: number) => {
    const event = pointer('pointerup', id);
    events.dispatchEvent(event);
    scene.onPointerObservable.notifyObservers(
      new PointerInfo(PointerEventTypes.POINTERTAP, event as unknown as PointerInfo['event'], pick),
    );
  };
  try {
    down(1);
    binding.cancelTap();
    down(2);
    up(1);
    up(2);
    expect(walk).not.toHaveBeenCalled();
    expect(keys).toEqual(new Set(['w']));
    down(3);
    up(3);
    expect(walk).toHaveBeenCalledExactlyOnceWith({ x: 4, z: 7 }, { x: 10, y: 10 });
    down(4);
    binding.clear();
    up(4);
    expect(walk).toHaveBeenCalledTimes(1);
    expect(keys.size).toBe(0);
    keys.add('w');
    down(5);
    binding.dispose();
    up(5);
    down(6);
    up(6);
    expect(walk).toHaveBeenCalledTimes(1);
    expect(keys.size).toBe(0);
  } finally {
    binding.dispose();
    engine.dispose();
  }
});

class ControlBoundary extends EventTarget {
  constructor(
    private interactive = false,
    private world = false,
  ) {
    super();
  }
  closest(selector: string) {
    if (selector === 'button,a,summary') return this.interactive ? this : null;
    if (selector === '.camera-controls,.minimap-wrap') return this.world ? this : null;
    return null;
  }
}
class InputBoundary extends ControlBoundary {}
class SelectBoundary extends ControlBoundary {}
class TextareaBoundary extends ControlBoundary {}

function keyboardStudio() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  vi.stubGlobal('HTMLElement', ControlBoundary);
  vi.stubGlobal('HTMLInputElement', InputBoundary);
  vi.stubGlobal('HTMLSelectElement', SelectBoundary);
  vi.stubGlobal('HTMLTextAreaElement', TextareaBoundary);
  const keys = new Set<string>();
  const manualMove = vi.fn();
  const navigate = vi.fn();
  const resetCamera = vi.fn();
  const binding = bindExplorationInput({
    scene,
    canvas: new ControlBoundary() as unknown as HTMLCanvasElement,
    keys,
    paused: () => false,
    navigate,
    manualMove,
    walk: vi.fn(),
    nearest: () => 'simon',
    resetCamera,
    notice: vi.fn(),
  });
  const send = (
    key: string,
    target: ControlBoundary,
    options: { type?: string; prevented?: boolean; ctrlKey?: boolean; isComposing?: boolean } = {},
  ) => {
    const { type = 'keydown', prevented, ...modifiers } = options;
    const event = Object.assign(new Event(type, { cancelable: true }), {
      key,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...modifiers,
    });
    Object.defineProperty(event, 'target', { value: target });
    if (prevented) event.preventDefault();
    events.dispatchEvent(event);
    return event;
  };
  const dispose = () => {
    binding.dispose();
    engine.dispose();
  };
  return { keys, manualMove, navigate, resetCamera, send, dispose };
}

it('keeps world letter controls available after using a focused camera or compass button', () => {
  const { keys, manualMove, navigate, resetCamera, send, dispose } = keyboardStudio();
  const control = new ControlBoundary(true, true);
  try {
    expect(send('w', control).defaultPrevented).toBe(true);
    expect(keys).toEqual(new Set(['w']));
    expect(manualMove).toHaveBeenCalledTimes(1);
    send('w', control, { type: 'keyup' });
    expect(keys.size).toBe(0);
    send('q', control);
    expect(keys).toEqual(new Set(['q']));
    send('r', control);
    expect(resetCamera).toHaveBeenCalledTimes(1);
    send('e', control);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('simon');
    expect(send('ArrowDown', control).defaultPrevented).toBe(false);
    expect(keys.has('arrowdown')).toBe(false);
    expect(send('Enter', control).defaultPrevented).toBe(false);
    expect(send(' ', control).defaultPrevented).toBe(false);
  } finally {
    dispose();
  }
});

it('leaves reading controls, context options, typing and reserved key events to their owners', () => {
  const { keys, manualMove, navigate, resetCamera, send, dispose } = keyboardStudio();
  try {
    for (const control of [
      new ControlBoundary(true),
      new InputBoundary(),
      new SelectBoundary(),
      new TextareaBoundary(),
    ]) {
      for (const key of ['w', 'q', 'r', 'e', 'ArrowUp'])
        expect(send(key, control).defaultPrevented).toBe(false);
    }
    const world = new ControlBoundary(true, true);
    send('w', world, { prevented: true });
    send('q', world, { ctrlKey: true });
    send('e', world, { isComposing: true });
    expect(send('j', world).defaultPrevented).toBe(false);
    expect(keys.size).toBe(0);
    expect(manualMove).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(resetCamera).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});
