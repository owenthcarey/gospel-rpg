import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointerInfo, PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { IPointerEvent } from '@babylonjs/core/Events/deviceInputEvents';
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
  const pointer = (
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
    scene.onPointerObservable.notifyObservers(new PointerInfo(type, event, null), type);
  };
  return { scene, camera, input, pointer, wheel, keyboard };
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
});
