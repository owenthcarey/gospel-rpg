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
