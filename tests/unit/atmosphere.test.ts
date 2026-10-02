import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Atmosphere } from '../../src/scene/environment/atmosphere';
import { environmentFor } from '../../src/content/environment';

function studio(width = 1280, height = 720) {
  const engine = new NullEngine({
    renderWidth: width,
    renderHeight: height,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('flock-test', 0, 0.78, 33, Vector3.Zero(), scene);
  camera.fov = 0.7;
  camera.minZ = 0.2;
  const atmosphere = new Atmosphere(scene, environmentFor('capernaum'));
  atmosphere.setFocus(Vector3.Zero());
  atmosphere.tick(0, true);
  scene.render();
  const flock = scene.getMeshByName('flock-gulls')!;
  return { engine, scene, camera, atmosphere, flock };
}

describe('ambient bird silhouettes', () => {
  it.each([
    [1280, 720],
    [607, 740],
    [390, 844],
  ])('keeps nearby birds small across camera angles and zoom at %i × %i', (width, height) => {
    const { engine, scene, camera, atmosphere, flock } = studio(width, height);
    try {
      const viewport = new Viewport(0, 0, width, height);
      const scale = Math.max(1, 0.9 / (width / height));
      let largest = 0;
      let visible = 0;
      for (const radius of [16, 33, 46]) {
        camera.radius = radius * scale;
        for (const beta of [0.42, 0.78, 1.32]) {
          camera.beta = beta;
          for (let sample = 0; sample < 120; sample++) {
            for (let angle = 0; angle < 12; angle++) {
              camera.alpha = (angle * Math.PI) / 6;
              atmosphere.tick(angle === 0 ? 0.5 : 0, true);
              scene.render();
              const view = camera.getViewMatrix(true);
              const transform = view.multiply(camera.getProjectionMatrix(true));
              const positions = flock.getVerticesData('position')!;
              for (let bird = 0; bird < 7; bird++) {
                const points = Array.from({ length: 5 }, (_, vertex) => {
                  const point = Vector3.FromArray(positions, (bird * 5 + vertex) * 3);
                  return {
                    screen: Vector3.Project(point, Matrix.IdentityReadOnly, transform, viewport),
                    depth: Vector3.TransformCoordinates(point, view).z,
                  };
                });
                const center = points[4]!;
                if (
                  center.depth <= camera.minZ ||
                  center.screen.x < 0 ||
                  center.screen.x > width ||
                  center.screen.y < 0 ||
                  center.screen.y > height
                )
                  continue;
                visible++;
                const xs = points.map((point) => point.screen.x);
                const ys = points.map((point) => point.screen.y);
                const span = Math.max(
                  Math.max(...xs) - Math.min(...xs),
                  Math.max(...ys) - Math.min(...ys),
                );
                largest = Math.max(largest, span / Math.min(width, height));
              }
            }
          }
        }
      }
      expect(visible).toBeGreaterThan(100);
      expect(largest).toBeLessThanOrEqual(0.035);
      expect(flock.getTotalVertices()).toBe(35);
      expect(flock.getTotalIndices()).toBe(84);
      expect(flock.isPickable).toBe(false);
    } finally {
      atmosphere.dispose();
      engine.dispose();
    }
  });

  it.each([
    [1280, 720],
    [607, 740],
    [390, 844],
  ])('keeps the silhouette limit after queued camera motion at %i × %i', (width, height) => {
    const { engine, scene, camera, atmosphere, flock } = studio(width, height);
    try {
      camera.inertia = 0.72;
      camera.lowerBetaLimit = 0.42;
      camera.upperBetaLimit = 1.32;
      const scale = Math.max(1, 0.9 / (width / height));
      camera.lowerRadiusLimit = 16 * scale;
      camera.upperRadiusLimit = 46 * scale;
      const viewport = new Viewport(0, 0, width, height);
      let largest = 0;
      let visible = 0;
      for (let sample = 0; sample < 90; sample++) {
        for (const radius of [16, 24, 33, 46]) {
          for (const beta of [0.42, 0.78, 1.32]) {
            for (let angle = 0; angle < 24; angle++) {
              const alpha = (angle * Math.PI) / 12;
              camera.alpha = alpha;
              camera.beta = beta;
              camera.radius = radius * scale;
              const rotation = (sample % 2 ? 1 : -1) * 0.2;
              camera.inertialAlphaOffset = rotation;
              camera.inertialBetaOffset = (sample % 3 ? 1 : -1) * 0.08;
              camera.inertialRadiusOffset = (sample % 2 ? 1 : -1) * 3 * scale;
              atmosphere.tick(angle === 0 && beta === 0.42 && radius === 16 ? 0.5 : 0, true);
              // World advances cosmetic time before Scene.render consumes the queued input.
              scene.render();
              expect(camera.alpha).toBeCloseTo(alpha + rotation, 12);
              const view = camera.getViewMatrix(true);
              const transform = view.multiply(camera.getProjectionMatrix(true));
              const positions = flock.getVerticesData('position')!;
              for (let bird = 0; bird < 7; bird++) {
                const points = Array.from({ length: 5 }, (_, vertex) => {
                  const point = Vector3.FromArray(positions, (bird * 5 + vertex) * 3);
                  return {
                    screen: Vector3.Project(point, Matrix.IdentityReadOnly, transform, viewport),
                    depth: Vector3.TransformCoordinates(point, view).z,
                  };
                });
                const center = points[4]!;
                if (
                  center.depth <= camera.minZ ||
                  center.screen.x < 0 ||
                  center.screen.x > width ||
                  center.screen.y < 0 ||
                  center.screen.y > height
                )
                  continue;
                visible++;
                const xs = points.map((point) => point.screen.x);
                const ys = points.map((point) => point.screen.y);
                largest = Math.max(
                  largest,
                  Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) /
                    Math.min(width, height),
                );
              }
            }
          }
        }
      }
      expect(visible).toBeGreaterThan(100);
      expect(largest).toBeLessThanOrEqual(0.035);
    } finally {
      atmosphere.dispose();
      engine.dispose();
    }
  });

  it('freezes flight during reading, hides reduced motion and resumes the same flock', () => {
    const { engine, scene, atmosphere, flock } = studio();
    try {
      const before = Array.from(flock.getVerticesData('position')!);
      atmosphere.tick(10, false);
      scene.render();
      expect(Array.from(flock.getVerticesData('position')!)).toEqual(before);
      atmosphere.applySettings(true, true);
      atmosphere.tick(10, true);
      scene.render();
      expect(flock.isEnabled()).toBe(false);
      expect(Array.from(flock.getVerticesData('position')!)).toEqual(before);
      atmosphere.applySettings(true, false);
      atmosphere.tick(0.5, true);
      scene.render();
      expect(flock.isEnabled()).toBe(true);
      expect(Array.from(flock.getVerticesData('position')!)).not.toEqual(before);
      expect(flock.getTotalVertices()).toBe(35);
    } finally {
      atmosphere.dispose();
      engine.dispose();
    }
  });

  it('poses once per rendered frame and releases its observer with the atmosphere', () => {
    const { engine, scene, atmosphere, flock } = studio();
    try {
      const update = vi.spyOn(flock, 'updateVerticesData');
      atmosphere.tick(0.5, true);
      expect(update).not.toHaveBeenCalled();
      scene.render();
      expect(update).toHaveBeenCalledTimes(1);
      atmosphere.tick(0.5, true);
      scene.render();
      expect(update).toHaveBeenCalledTimes(2);
      expect(scene.onBeforeRenderObservable.hasObservers()).toBe(true);
      atmosphere.dispose();
      expect(scene.onBeforeRenderObservable.hasObservers()).toBe(false);
      scene.render();
      expect(update).toHaveBeenCalledTimes(2);
    } finally {
      engine.dispose();
    }
  });

  it('disposes old flock resources on profile changes and leaves indoor views bird free', () => {
    const { engine, scene, atmosphere, flock } = studio();
    try {
      const originalMaterial = flock.material!;
      atmosphere.setProfile(environmentFor('capernaum-lanes'));
      expect(flock.isDisposed()).toBe(true);
      expect(scene.materials).not.toContain(originalMaterial);
      const sparrows = scene.getMeshByName('flock-sparrows')!;
      expect(sparrows.getTotalVertices()).toBe(45);
      expect(sparrows.isPickable).toBe(false);
      atmosphere.setProfile(environmentFor('gathering-house'));
      expect(sparrows.isDisposed()).toBe(true);
      expect(scene.meshes.filter((mesh) => mesh.name.startsWith('flock-'))).toHaveLength(0);
    } finally {
      atmosphere.dispose();
      engine.dispose();
    }
  });
});
