import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Atmosphere } from '../../src/scene/environment/atmosphere';
import { environmentFor } from '../../src/content/environment';

function studio(width = 1280, height = 720, completeRawSprite = false) {
  const engine = new NullEngine({
    renderWidth: width,
    renderHeight: height,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  if (completeRawSprite) {
    const createRawTexture = engine.createRawTexture.bind(engine);
    engine.createRawTexture = (...args: Parameters<NullEngine['createRawTexture']>) => {
      expect(args[0]).toBeInstanceOf(Uint8Array);
      expect(args[0]?.byteLength).toBe(1024);
      expect(args.slice(1, 5)).toEqual([16, 16, 5, false]);
      const texture = createRawTexture(...args);
      expect([texture.width, texture.height, texture.format]).toEqual([16, 16, 5]);
      // NullEngine omits the raw upload completion recorded by the WebGL factory.
      texture.isReady = true;
      return texture;
    };
  }
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

async function withParticles(
  region: 'galilean-road' | 'nain-gate' | 'gathering-house' | 'bakehouse',
  smoke: boolean,
  review: (view: {
    scene: Scene;
    atmosphere: Atmosphere;
    systems: ParticleSystem[];
    draw: (frames: number, running?: boolean) => void;
  }) => void,
) {
  const { engine, scene, atmosphere } = studio(1280, 720, true);
  try {
    // This public Scene option fixes its animation ratio without changing particle state.
    scene.useConstantAnimationDeltaTime = true;
    atmosphere.setProfile(environmentFor(region));
    if (smoke) atmosphere.addSmoke(new Vector3(-3, 1.25, 4.7), 0.7);
    await scene.whenReadyAsync();
    const systems = scene.particleSystems.filter(
      (system): system is ParticleSystem =>
        system instanceof ParticleSystem &&
        (system.name.startsWith('ambient-') || system.name === 'hearth-smoke'),
    );
    expect(systems.map((system) => system.name).sort()).toEqual(
      [
        region === 'galilean-road' || region === 'nain-gate' ? 'ambient-insects' : 'ambient-motes',
        ...(smoke ? ['hearth-smoke'] : []),
      ].sort(),
    );
    const draw = (frames: number, running = true) => {
      for (let frame = 0; frame < frames; frame++) {
        atmosphere.tick(0.016, running);
        scene.render();
      }
    };
    draw(1);
    for (const system of systems) {
      expect(system.isReady()).toBe(true);
      expect(
        system.getActiveCount(),
        system.name + ': real live particles before Settings',
      ).toBeGreaterThan(0);
    }
    const owned = [...scene.particleSystems];
    review({ scene, atmosphere, systems, draw });
    expect(scene.particleSystems.length).toBe(owned.length);
    expect(scene.particleSystems.every((system, i) => system === owned[i])).toBe(true);
  } finally {
    atmosphere.dispose();
    engine.dispose();
  }
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

  it.each(['galilean-road', 'nain-gate', 'gathering-house'] as const)(
    'removes already emitted %s particles when Reduce motion is enabled',
    async (region) => {
      await withParticles(region, false, ({ atmosphere, systems, draw }) => {
        atmosphere.applySettings(false, true);
        for (const system of systems) expect(system.getActiveCount(), system.name).toBe(0);
        draw(12);
        for (const system of systems) expect(system.getActiveCount(), system.name).toBe(0);
      });
    },
  );

  it.each([0, 12])(
    'emits fresh motes and oven smoke after Reduce motion with %i intervening draws',
    async (reducedDraws) => {
      await withParticles('bakehouse', true, ({ atmosphere, systems, draw }) => {
        const previous = systems.map((system) => new Set(system.particles));
        atmosphere.applySettings(true, true);
        draw(reducedDraws);
        atmosphere.applySettings(true, false);
        draw(80);
        for (const [i, system] of systems.entries()) {
          expect(system.getActiveCount(), system.name + ': live after resume').toBeGreaterThan(0);
          expect(
            system.particles.some((particle) => !previous[i]!.has(particle) && particle.age > 0),
            system.name + ': naturally emitted and advanced fresh particle',
          ).toBe(true);
        }
      });
    },
  );

  it('preserves live particle phase on quality changes and freezes ordinary paused draws', async () => {
    await withParticles('bakehouse', true, ({ atmosphere, systems, draw }) => {
      const particles = systems.map((system) => [...system.particles]);
      const values = () =>
        systems.map((system) =>
          system.particles.map((particle) => [particle.age, ...particle.position.asArray()]),
        );
      const original = values();
      const rates = systems.map((system) => system.emitRate);
      let restarted = 0;
      for (const system of systems) system.onStartedObservable.add(() => restarted++);

      atmosphere.applySettings(true, false);
      expect(restarted).toBe(0);
      expect(values()).toEqual(original);
      for (const [i, system] of systems.entries()) {
        expect(system.particles.length).toBe(particles[i]!.length);
        expect(system.particles.every((particle, j) => particle === particles[i]![j])).toBe(true);
        expect(system.emitRate).toBeLessThan(rates[i]!);
      }
      draw(12, false);
      expect(values()).toEqual(original);
      expect(restarted).toBe(0);

      atmosphere.applySettings(false, false);
      expect(values()).toEqual(original);
      expect(restarted).toBe(0);
      for (const [i, system] of systems.entries()) expect(system.emitRate).toBe(rates[i]);
      draw(1);
      for (const [i, system] of systems.entries()) {
        expect(system.particles[0] === particles[i]![0]).toBe(true);
        expect(system.particles[0]!.age).toBeGreaterThan(original[i]![0]![0]!);
      }
      expect(restarted).toBe(0);
    });
  });

  it('holds story fireworks through a paused conversation and skips them under Reduce motion', async () => {
    await withParticles('galilean-road', false, ({ scene, atmosphere, draw }) => {
      const sparks = scene.particleSystems.find((s) => s.name === 'celebration-sparks')!;
      const live = () => sparks.getActiveCount();
      draw(1, false);
      atmosphere.fireworks(new Vector3(0, 1.9, 0));
      draw(6, false);
      expect(live(), 'no burst while the world is paused').toBe(0);
      draw(2);
      expect(live()).toBeGreaterThan(40);
      draw(220);
      expect(live(), 'the burst leaves on its own').toBe(0);

      atmosphere.applySettings(true, false);
      atmosphere.fireworks(new Vector3(0, 1.9, 0));
      draw(2);
      expect(live()).toBeGreaterThan(0);
      expect(live()).toBeLessThanOrEqual(40);
      draw(220);

      atmosphere.applySettings(false, true);
      atmosphere.fireworks(new Vector3(0, 1.9, 0));
      draw(4);
      expect(live()).toBe(0);
      atmosphere.applySettings(false, false);
    });
  });
});
