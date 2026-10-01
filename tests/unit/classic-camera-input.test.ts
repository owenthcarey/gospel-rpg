import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  PointerInfo,
  PointerInfoPre,
  PointerEventTypes,
} from '@babylonjs/core/Events/pointerEvents';
import type { IPointerEvent, IWheelEvent } from '@babylonjs/core/Events/deviceInputEvents';
import { PointerInput } from '@babylonjs/core/DeviceInput/InputDevices/deviceEnums';
import {
  installClassicCameraInput,
  type ClassicCameraInputOptions,
} from '../../src/scene/classic-camera-input';

let engine: NullEngine;
afterEach(() => engine?.dispose());

function studio(options: ClassicCameraInputOptions = {}) {
  engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('controls', -1.5, 0.8, 24, Vector3.Zero(), scene);
  camera.inertia = 0.72;
  camera.wheelDeltaPercentage = 0.015;
  const wheel = camera.inputs.attached.mousewheel;
  const keyboard = camera.inputs.attached.keyboard;
  const input = installClassicCameraInput(camera, options);
  camera.attachControl(true);
  const pointerEvent = (
    type: number,
    id: number,
    x: number,
    y: number,
    button: number,
    pointerType = 'mouse',
    ctrlKey = false,
  ) => {
    const event: IPointerEvent = {
      type: 'pointer',
      inputIndex: PointerInput.Move,
      pointerId: id,
      pointerType,
      button,
      buttons: type === PointerEventTypes.POINTERUP ? 0 : button === 2 ? 2 : button === 1 ? 4 : 1,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
      offsetX: x,
      offsetY: y,
      x,
      y,
      movementX: 0,
      movementY: 0,
      altKey: false,
      ctrlKey,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault() {},
    };
    return event;
  };
  const pointer = (...args: Parameters<typeof pointerEvent>) => {
    const event = pointerEvent(...args);
    scene.onPointerObservable.notifyObservers(new PointerInfo(args[0], event, null), args[0]);
  };
  const scroll = (deltaY: number, deltaX = 0) => {
    const type = PointerEventTypes.POINTERWHEEL;
    const event: IWheelEvent = {
      ...pointerEvent(type, 1, 100, 100, 0),
      inputIndex: PointerInput.MouseWheelY,
      deltaMode: 0,
      deltaX,
      deltaY,
      deltaZ: 0,
    };
    const pre = new PointerInfoPre(type, event, 100, 100);
    scene.onPrePointerObservable.notifyObservers(pre, type);
    if (!pre.skipOnPointerObservable)
      scene.onPointerObservable.notifyObservers(new PointerInfo(type, event, null), type);
    return pre;
  };
  return { scene, camera, input, pointer, scroll, wheel, keyboard };
}

describe('classic camera pointers', () => {
  for (const button of [1, 2])
    it('orbits with mouse button ' + button + ' and keeps the target fixed', () => {
      const manual = vi.fn();
      const { scene, camera, pointer, wheel, keyboard } = studio({ manual });
      pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, button, 'mouse', true);
      pointer(PointerEventTypes.POINTERMOVE, 1, 220, 160, button, 'mouse', true);
      expect(camera.movement.rotationAccumulatedPixels.x).toBeCloseTo(-0.12);
      expect(camera.movement.rotationAccumulatedPixels.y).toBeCloseTo(-0.06);
      expect(camera.movement.panAccumulatedPixels).toEqual(Vector3.Zero());
      expect(manual).toHaveBeenCalledTimes(1);
      const before = { alpha: camera.alpha, beta: camera.beta, target: camera.target.clone() };
      scene.render();
      expect(camera.alpha).not.toBe(before.alpha);
      expect(camera.beta).not.toBe(before.beta);
      expect(camera.target).toEqual(before.target);
      pointer(PointerEventTypes.POINTERUP, 1, 220, 160, button);
      expect(camera.inputs.attached.mousewheel).toBe(wheel);
      expect(camera.inputs.attached.keyboard).toBe(keyboard);
      expect(camera.wheelDeltaPercentage).toBe(0.015);
      expect(camera.inertia).toBe(0.72);
      camera.detachControl();
      camera.attachControl(true);
      manual.mockClear();
      pointer(PointerEventTypes.POINTERDOWN, 2, 100, 100, button, 'mouse', true);
      pointer(PointerEventTypes.POINTERMOVE, 2, 120, 100, button, 'mouse', true);
      expect(camera.movement.rotationAccumulatedPixels.x).toBeCloseTo(-0.02);
      expect(camera.movement.panAccumulatedPixels).toEqual(Vector3.Zero());
      expect(manual).toHaveBeenCalledTimes(1);
      pointer(PointerEventTypes.POINTERUP, 2, 120, 100, button);
    });

  for (const pointerType of ['mouse', 'touch'])
    it('keeps a primary ' + pointerType + ' drag quiet', () => {
      const manual = vi.fn();
      const { camera, pointer } = studio({ manual });
      pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 0, pointerType);
      pointer(PointerEventTypes.POINTERMOVE, 1, 260, 180, 0, pointerType);
      pointer(PointerEventTypes.POINTERUP, 1, 260, 180, 0, pointerType);
      expect(camera.movement.rotationAccumulatedPixels).toEqual(Vector3.Zero());
      expect(camera.movement.zoomAccumulatedPixels).toBe(0);
      expect(camera.movement.panAccumulatedPixels).toEqual(Vector3.Zero());
      expect(manual).not.toHaveBeenCalled();
    });

  it('rotates with two-finger center movement and pinches without panning or end-sample jumps', () => {
    const manual = vi.fn();
    const { scene, camera, pointer } = studio({ manual });
    pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERDOWN, 2, 200, 100, 0, 'touch');
    // Babylon uses the first multi-touch move as a baseline, even when stationary.
    pointer(PointerEventTypes.POINTERMOVE, 1, 100, 100, 0, 'touch');
    expect(manual).not.toHaveBeenCalled();
    pointer(PointerEventTypes.POINTERMOVE, 1, 140, 130, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 2, 240, 130, 0, 'touch');
    expect(camera.movement.rotationAccumulatedPixels.x).toBeCloseTo(-0.04);
    expect(camera.movement.rotationAccumulatedPixels.y).toBeCloseTo(-0.03);
    expect(camera.movement.zoomAccumulatedPixels).toBeCloseTo(0);
    expect(camera.movement.panAccumulatedPixels).toEqual(Vector3.Zero());
    pointer(PointerEventTypes.POINTERMOVE, 1, 120, 130, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 2, 260, 130, 0, 'touch');
    expect(camera.movement.zoomAccumulatedPixels).toBeGreaterThan(0);
    const before = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
    };
    scene.render();
    expect(camera.alpha).not.toBe(before.alpha);
    expect(camera.beta).not.toBe(before.beta);
    expect(camera.radius).toBeLessThan(before.radius);
    expect(camera.target).toEqual(before.target);
    manual.mockClear();
    pointer(PointerEventTypes.POINTERUP, 1, 120, 130, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 2, 290, 150, 0, 'touch');
    pointer(PointerEventTypes.POINTERUP, 2, 290, 150, 0, 'touch');
    expect(camera.movement.rotationAccumulatedPixels).toEqual(Vector3.Zero());
    expect(camera.movement.zoomAccumulatedPixels).toBe(0);
    expect(manual).not.toHaveBeenCalled();
  });

  it('keeps paused pointers quiet while tracking releases and recovers for fresh gestures', () => {
    let enabled = false;
    const manual = vi.fn();
    const { camera, pointer } = studio({ enabled: () => enabled, manual });
    pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 2);
    pointer(PointerEventTypes.POINTERMOVE, 1, 200, 160, 2);
    pointer(PointerEventTypes.POINTERUP, 1, 200, 160, 2);
    pointer(PointerEventTypes.POINTERDOWN, 2, 100, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERDOWN, 3, 200, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 2, 100, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 3, 260, 160, 0, 'touch');
    pointer(PointerEventTypes.POINTERUP, 2, 100, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERUP, 3, 260, 160, 0, 'touch');
    expect(camera.movement.rotationAccumulatedPixels).toEqual(Vector3.Zero());
    expect(camera.movement.zoomAccumulatedPixels).toBe(0);
    expect(camera.movement.panAccumulatedPixels).toEqual(Vector3.Zero());
    expect(manual).not.toHaveBeenCalled();
    enabled = true;
    pointer(PointerEventTypes.POINTERDOWN, 4, 100, 100, 2);
    pointer(PointerEventTypes.POINTERMOVE, 4, 130, 100, 2);
    pointer(PointerEventTypes.POINTERUP, 4, 130, 100, 2);
    expect(camera.movement.rotationAccumulatedPixels.x).toBeCloseTo(-0.03);
    expect(manual).toHaveBeenCalledTimes(1);
    camera.movement.resetRotationVelocity();
    pointer(PointerEventTypes.POINTERDOWN, 5, 100, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERDOWN, 6, 200, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 5, 100, 100, 0, 'touch');
    pointer(PointerEventTypes.POINTERMOVE, 6, 240, 130, 0, 'touch');
    expect(camera.movement.rotationAccumulatedPixels.x).toBeLessThan(0);
    expect(camera.movement.zoomAccumulatedPixels).toBeGreaterThan(0);
    expect(camera.movement.panAccumulatedPixels).toEqual(Vector3.Zero());
    expect(manual).toHaveBeenCalledTimes(3);
  });
  for (const delta of [-120, 120])
    it(
      'restores the gameplay radius before the original wheel delta ' + delta + ' is calculated',
      () => {
        const manual = vi.fn(() => {
          camera.radius = 24;
        });
        const { scene, camera, scroll, wheel } = studio({ manual });
        const baseline = new ArcRotateCamera('baseline', -1.5, 0.8, 24, Vector3.Zero(), scene);
        baseline.inertia = camera.inertia;
        baseline.wheelDeltaPercentage = camera.wheelDeltaPercentage;
        baseline.inputs.attached.mousewheel!.attachControl(true);
        camera.radius = 72;
        const pre = scroll(delta);
        expect(pre.skipOnPointerObservable).toBe(false);
        expect(manual).toHaveBeenCalledTimes(1);
        expect(camera.radius).toBe(24);
        expect(camera.movement.zoomAccumulatedPixels).not.toBe(0);
        expect(camera.movement.zoomAccumulatedPixels).toBeCloseTo(
          baseline.movement.zoomAccumulatedPixels,
          10,
        );
        expect(camera.inputs.attached.mousewheel).toBe(wheel);
        expect(camera.wheelDeltaPercentage).toBe(0.015);
        expect(camera.inertia).toBe(0.72);
      },
    );
  it('rejects paused wheel output and leaves zero or horizontal scroll quiet', () => {
    let enabled = false;
    const manual = vi.fn();
    const { camera, scroll } = studio({ enabled: () => enabled, manual });
    expect(scroll(-120).skipOnPointerObservable).toBe(true);
    expect(camera.movement.zoomAccumulatedPixels).toBe(0);
    expect(manual).not.toHaveBeenCalled();
    enabled = true;
    expect(scroll(0).skipOnPointerObservable).toBe(false);
    expect(scroll(0, 120).skipOnPointerObservable).toBe(false);
    expect(camera.movement.zoomAccumulatedPixels).toBe(0);
    expect(manual).not.toHaveBeenCalled();
    expect(scroll(-120).skipOnPointerObservable).toBe(false);
    expect(camera.movement.zoomAccumulatedPixels).toBeGreaterThan(0);
    expect(manual).toHaveBeenCalledTimes(1);
  });
  it('attaches one wheel handoff and removes it on detach or input disposal', () => {
    const manual = vi.fn();
    const { camera, input, scroll } = studio({ manual });
    input.attachControl(true);
    scroll(-120);
    expect(manual).toHaveBeenCalledTimes(1);
    input.detachControl();
    input.detachControl();
    manual.mockClear();
    scroll(-120);
    expect(manual).not.toHaveBeenCalled();
    input.attachControl(true);
    scroll(-120);
    expect(manual).toHaveBeenCalledTimes(1);
    camera.inputs.remove(input);
    manual.mockClear();
    scroll(-120);
    expect(manual).not.toHaveBeenCalled();
  });
});
