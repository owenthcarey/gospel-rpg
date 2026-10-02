import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { HoldView } from '../../src/scene/hold-view';

let engine: NullEngine;
afterEach(() => engine?.dispose());

function studio(width = 390, height = 844, renderScale = 1) {
  engine = new NullEngine({
    renderWidth: width * renderScale,
    renderHeight: height * renderScale,
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
  const bounds = { left: 0, top: 0, width, height };
  const matrix = () => {
    camera.getViewMatrix();
    camera.getProjectionMatrix();
    return camera.getTransformationMatrix();
  };
  const viewport = () => camera.viewport.toGlobal(width, height);
  const capture = () => HoldView.capture(matrix(), camera.getTarget(), viewport(), bounds)!;
  const changed = (hold: HoldView) => hold.changed(matrix(), viewport(), bounds);
  const screen = (point: Vector3) =>
    Vector3.Project(point, Matrix.IdentityReadOnly, matrix(), viewport());
  return { scene, camera, bounds, matrix, viewport, capture, changed, screen };
}

describe('cumulative hold view', () => {
  it('permits the actual High follow notification with only 3.095e-11 m of target movement', () => {
    const { camera, capture, changed } = studio();
    const hold = capture();
    let notifications = 0;
    camera.onViewMatrixChangedObservable.add(() => notifications++);
    camera.target.copyFromFloats(6.999999999498711, 0, -2.000000000340734);
    expect(changed(hold)).toBe(false);
    // The engine really emits the notification that rejected the native 749.5 ms hold.
    expect(notifications).toBe(1);
  });

  for (const action of ['orbit', 'tilt', 'zoom'] as const)
    it(
      'rejects a centered ' + action + ' even though the camera focus stays at the same pixel',
      () => {
        const { camera, capture, changed, screen } = studio();
        const focus = camera.target.clone();
        const before = screen(focus);
        const hold = capture();
        if (action === 'orbit') camera.alpha += 0.03;
        if (action === 'tilt') camera.beta += 0.03;
        if (action === 'zoom') camera.radius -= 1;
        const after = screen(focus);
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.001);
        expect(changed(hold)).toBe(true);
      },
    );

  it('accumulates repeated individually subpixel pans against the original down view', () => {
    const { camera, capture, changed } = studio();
    const original = capture();
    let rejected = false;
    for (let step = 0; step < 40; step++) {
      const previousView = capture();
      camera.target.x += 0.002;
      expect(changed(previousView)).toBe(false);
      rejected ||= changed(original);
    }
    expect(rejected).toBe(true);
  });

  it('keeps a rejected gesture rejected after the camera returns to the original pose', () => {
    const { camera, capture, changed } = studio();
    const alpha = camera.alpha;
    const hold = capture();
    camera.alpha += 0.05;
    expect(changed(hold)).toBe(true);
    camera.alpha = alpha;
    expect(changed(hold)).toBe(true);
  });

  it('rejects projection-only zoom without requiring a new view matrix notification', () => {
    const { camera, capture, changed } = studio();
    const hold = capture();
    let notifications = 0;
    camera.onProjectionMatrixChangedObservable.add(() => notifications++);
    camera.fov *= 0.9;
    expect(changed(hold)).toBe(true);
    expect(notifications).toBe(1);
  });

  for (const width of [390, 1280])
    for (const renderScale of [1, 2])
      it(`uses CSS pixels on a ${width}px canvas with ${renderScale}x render resolution`, () => {
        const height = width === 390 ? 844 : 720;
        const { camera, capture, changed, screen } = studio(width, height, renderScale);
        const focus = camera.target.clone();
        const before = screen(focus);
        const hold = capture();
        // Pan one world-axis metre to calibrate this actual camera's CSS projection.
        camera.target.x += 1;
        const pixelPerMetre = Math.hypot(screen(focus).x - before.x, screen(focus).y - before.y);
        camera.target.copyFrom(focus);
        camera.target.x += 1 / pixelPerMetre;
        expect(changed(hold)).toBe(false);
        camera.target.copyFrom(focus);
        camera.target.x += 3 / pixelPerMetre;
        expect(changed(hold)).toBe(true);
      });

  it('captures at the actual target depth and works with an inset camera viewport', () => {
    const { camera, capture, changed } = studio();
    camera.viewport = new Viewport(0.1, 0.1, 0.8, 0.8);
    const hold = capture();
    expect(changed(hold)).toBe(false);
    camera.radius -= 1;
    expect(changed(hold)).toBe(true);
  });

  it('rejects a viewport or canvas displacement even before window resize delivers its event', () => {
    const { capture, matrix, viewport, bounds } = studio();
    const hold = capture();
    expect(hold.changed(matrix(), viewport(), { ...bounds, left: 10 })).toBe(true);
    const other = capture();
    expect(other.changed(matrix(), { ...viewport(), width: bounds.width - 10 }, bounds)).toBe(true);
  });

  it('rejects invalid projections and cannot capture an empty or singular baseline', () => {
    const { camera, capture, matrix, viewport, bounds } = studio();
    const hold = capture();
    expect(hold.changed(Matrix.Zero(), viewport(), bounds)).toBe(true);
    expect(HoldView.capture(Matrix.Zero(), camera.target, viewport(), bounds)).toBeUndefined();
    expect(
      HoldView.capture(matrix(), camera.target, viewport(), { ...bounds, width: 0 }),
    ).toBeUndefined();
  });

  it('reads current cached camera matrices while the scene transform is still the previous frame', () => {
    const { scene, camera, capture, changed, matrix } = studio();
    scene.setTransformMatrix(camera.getViewMatrix(), camera.getProjectionMatrix());
    const previousSceneTransform = scene.getTransformMatrix().clone();
    const hold = capture();
    camera.target.x += 1;
    expect(changed(hold)).toBe(true);
    expect(scene.getTransformMatrix().equals(previousSceneTransform)).toBe(true);
    expect(matrix().equals(previousSceneTransform)).toBe(false);
  });
});
