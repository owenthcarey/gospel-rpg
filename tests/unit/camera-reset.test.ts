import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointerInfo, PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { IPointerEvent } from '@babylonjs/core/Events/deviceInputEvents';
import { PointerInput } from '@babylonjs/core/DeviceInput/InputDevices/deviceEnums';
import { installClassicCameraInput } from '../../src/scene/classic-camera-input';
import { World } from '../../src/scene/world';

let engine: NullEngine;
afterEach(() => engine?.dispose());

interface CameraFixture {
  camera: ArcRotateCamera;
  cameraAspectScale: number;
  pendingRotation: number;
  reducedMotion: boolean;
  layout?: { camera: { beta: number; radius: number } };
  workView?: { active: boolean; frame: () => void };
}

function studio() {
  engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('reset', -1.5, 0.8, 24, new Vector3(2, 1, -4), scene);
  camera.inertia = 0.72;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = 1.3;
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 54;
  installClassicCameraInput(camera);
  camera.attachControl(true);
  // Use the actual World commands without constructing unrelated assets or a WebGL engine.
  const fixture: CameraFixture = Object.assign(Object.create(World.prototype), {
    camera,
    cameraAspectScale: 1.1,
    pendingRotation: 0.3,
    reducedMotion: true,
    layout: { camera: { beta: 0.91, radius: 28 } },
  });
  const world = fixture as unknown as World;
  const pointer = (
    type: number,
    pointerId: number,
    x: number,
    y: number,
    button: number,
    pointerType = 'mouse',
  ) => {
    const event: IPointerEvent = {
      type: 'pointer',
      inputIndex: PointerInput.Move,
      pointerId,
      pointerType,
      button,
      buttons: type === PointerEventTypes.POINTERUP ? 0 : button === 2 ? 2 : 1,
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
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault() {},
    };
    scene.onPointerObservable.notifyObservers(new PointerInfo(type, event, null), type);
  };
  const gestures = {
    orbit: () => {
      pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 2);
      pointer(PointerEventTypes.POINTERMOVE, 1, 160, 130, 2);
      pointer(PointerEventTypes.POINTERUP, 1, 160, 130, 2);
      expect(camera.movement.rotationAccumulatedPixels.lengthSquared()).toBeGreaterThan(0);
    },
    pinch: () => {
      pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERDOWN, 2, 200, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERMOVE, 1, 100, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERMOVE, 1, 90, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERMOVE, 2, 210, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERUP, 1, 90, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERUP, 2, 210, 100, 0, 'touch');
      expect(camera.movement.zoomAccumulatedPixels).toBeGreaterThan(0);
    },
  };
  const pose = () => ({ alpha: camera.alpha, beta: camera.beta, radius: camera.radius });
  const context = () => ({
    target: camera.target.clone(),
    limits: [
      camera.lowerBetaLimit,
      camera.upperBetaLimit,
      camera.lowerRadiusLimit,
      camera.upperRadiusLimit,
    ],
    inertia: camera.inertia,
  });
  return { scene, camera, fixture, world, gestures, pose, context };
}

describe('ordinary camera reset', () => {
  for (const gesture of ['orbit', 'pinch'] as const) {
    for (const phase of ['queued', 'coasting'] as const)
      it('stops ' + phase + ' native ' + gesture + ' input and holds the default pose', () => {
        const { scene, camera, fixture, world, gestures, pose, context } = studio();
        const originalContext = context();
        gestures[gesture]();
        if (phase === 'coasting') {
          scene.render();
          expect(
            gesture === 'orbit' ? camera.inertialAlphaOffset : camera.inertialRadiusOffset,
          ).not.toBe(0);
        }
        world.resetCamera();
        const resetPose = pose();
        expect(resetPose.alpha).toBe(-Math.PI / 2 - 0.45);
        expect(resetPose.beta).toBe(0.91);
        expect(resetPose.radius).toBeCloseTo(30.8, 12);
        expect(fixture.pendingRotation).toBe(0);
        for (let frame = 0; frame < 12; frame++) {
          scene.render();
          expect(pose()).toEqual(resetPose);
          expect(context()).toEqual(originalContext);
        }
      });

    it('allows native ' + gesture + ' release to coast until a reset is requested', () => {
      const { scene, gestures, pose, context } = studio();
      const originalContext = context();
      gestures[gesture]();
      scene.render();
      const firstFrame = pose();
      scene.render();
      const secondFrame = pose();
      if (gesture === 'orbit') {
        expect(secondFrame.alpha).not.toBe(firstFrame.alpha);
        expect(secondFrame.beta).not.toBe(firstFrame.beta);
        expect(secondFrame.radius).toBe(firstFrame.radius);
      } else expect(secondFrame.radius).toBeLessThan(firstFrame.radius);
      expect(context()).toEqual(originalContext);
    });
  }

  it('keeps Face north limited to orientation while a pinch continues to coast', () => {
    const { scene, world, gestures, pose, context } = studio();
    gestures.orbit();
    gestures.pinch();
    scene.render();
    const before = pose();
    const originalContext = context();
    world.faceNorth();
    expect(pose().alpha).toBeCloseTo(-Math.PI / 2, 12);
    expect(pose().beta).toBe(before.beta);
    expect(pose().radius).toBe(before.radius);
    for (let frame = 0; frame < 12; frame++) {
      scene.render();
      expect(pose().alpha).toBeCloseTo(-Math.PI / 2, 12);
      expect(pose().beta).toBe(before.beta);
      expect(context()).toEqual(originalContext);
    }
    expect(pose().radius).toBeLessThan(before.radius);
  });

  it('delegates active work framing at the current pose after retiring old motion', () => {
    const { world, fixture, gestures, pose, camera, context } = studio();
    const frame = vi.fn();
    fixture.workView = { active: true, frame };
    gestures.orbit();
    gestures.pinch();
    const before = pose();
    const originalContext = context();
    world.resetCamera();
    expect(frame).toHaveBeenCalledOnce();
    expect(pose()).toEqual(before);
    expect(context()).toEqual(originalContext);
    expect(camera.movement.rotationAccumulatedPixels).toEqual(Vector3.Zero());
    expect(camera.movement.zoomAccumulatedPixels).toBe(0);
    expect(fixture.pendingRotation).toBe(0);
  });
});
