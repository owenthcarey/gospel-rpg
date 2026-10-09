import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { highestViewHeight, SkyDome } from '../../src/scene/environment/sky';
import { environmentFor } from '../../src/content/environment';

function studio(beta: number) {
  const engine = new NullEngine({
    renderWidth: 1440,
    renderHeight: 900,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('sky-test', -Math.PI / 2, beta, 30, Vector3.Zero(), scene);
  camera.fov = 0.7;
  scene.activeCamera = camera;
  camera.getViewMatrix(true);
  camera.getProjectionMatrix(true);
  return { engine, scene, camera, sky: new SkyDome(scene, 400) };
}

describe('sky dome culling', () => {
  it('steps aside when the whole view looks down past the horizon haze', () => {
    const { engine, camera, sky } = studio(0.78);
    expect(highestViewHeight(camera)).toBeLessThan(-0.1);
    sky.cull(camera);
    expect(sky.mesh.isVisible).toBe(false);
    engine.dispose();
  });

  it('draws whenever any part of the view reaches the haze or the open sky', () => {
    const { engine, camera, sky } = studio(1.45);
    expect(highestViewHeight(camera)).toBeGreaterThan(0);
    sky.mesh.isVisible = false;
    sky.cull(camera);
    expect(sky.mesh.isVisible).toBe(true);
    engine.dispose();
  });

  it('paints its haze in the same output space as the shader', () => {
    const { engine, sky } = studio(0.78);
    const profile = environmentFor('capernaum');
    const fog = Color3.FromHexString(profile.fog.color);
    sky.apply(profile, new Vector3(0, -1, 0), false);
    expect(sky.haze.r).toBeCloseTo(fog.r, 6);
    sky.apply(profile, new Vector3(0, -1, 0), true);
    expect(sky.haze.g).toBeCloseTo(fog.g ** 2.2, 6);
    expect(sky.haze.a).toBe(1);
    engine.dispose();
  });
});
