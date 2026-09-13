import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { WorkPresentation } from '../../src/scene/work';
import { workTarget } from '../../src/content/exploration/work';
import { preparedSpring, chosenShelter, arrangedShelter } from '../helpers/galilee';
import { at } from '../helpers/campaign';
import { supplyPosition } from '../../src/game/galilee/arrangement';
import { channelPosition } from '../../src/game/galilee/channel';
import { CHANNEL_IDS, type Direction } from '../../src/game/galilee/types';
import { groundHeight } from '../../src/content/campaign/layouts';

let engine: NullEngine;
afterEach(() => engine?.dispose());
function workshop(width: number, height: number) {
  engine = new NullEngine({
    renderWidth: width,
    renderHeight: height,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('review-camera', -1, 0.9, 18, new Vector3(0, 0, 0), scene);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 24;
  const canvas = { clientWidth: width, clientHeight: height } as HTMLCanvasElement;
  const work = new WorkPresentation(scene, camera, canvas);
  const panel =
    width >= 700
      ? { left: width - 390, right: width, top: 80, bottom: height }
      : { left: 8, right: width - 8, top: height * 0.56, bottom: height - 8 };
  work.setBounds(panel);
  return { scene, camera, canvas, work, panel };
}

describe('temporary world focus geometry', () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
    [360, 640],
  ] as const) {
    it(`frames all four channel sections in the unobstructed ${width}×${height} viewport`, () => {
      const { scene, camera, work, panel } = workshop(width, height);
      const state = at(preparedSpring(), 'channel-entry');
      const before = structuredClone(state);
      const bookmark = {
        alpha: camera.alpha,
        beta: camera.beta,
        radius: camera.radius,
        target: camera.target.clone(),
      };
      work.select(workTarget(state, 'channel-entry'), state);
      work.tick(true, 1 / 60);
      scene.render();
      const viewport = camera.viewport.toGlobal(width, height);
      // WebGL viewport Y starts at the bottom; DOM/projected pixels start at the top.
      viewport.y = height - viewport.y - viewport.height;
      for (const id of CHANNEL_IDS) {
        const p = channelPosition(id);
        for (const dx of [-1, 1])
          for (const dz of [-1, 1]) {
            const point = new Vector3(p.x + dx, groundHeight(state.region, p) + 0.4, p.z + dz);
            const projected = Vector3.Project(
              point,
              Matrix.Identity(),
              scene.getTransformMatrix(),
              viewport,
            );
            expect(projected.z).toBeGreaterThan(0);
            expect(projected.z).toBeLessThan(1);
            expect(projected.x).toBeGreaterThan(10);
            expect(projected.x).toBeLessThan(width >= 700 ? panel.left - 10 : width - 10);
            expect(projected.y).toBeGreaterThan(60);
            expect(projected.y).toBeLessThan(width >= 700 ? height - 10 : panel.top - 10);
          }
      }
      expect(scene.getMeshByName('selected-work-target')!.isEnabled()).toBe(true);
      expect(scene.getMeshByName('selected-work-target')!.isPickable).toBe(false);
      expect(state).toEqual(before);
      work.clear();
      expect(camera.alpha).toBe(bookmark.alpha);
      expect(camera.beta).toBe(bookmark.beta);
      expect(camera.radius).toBe(bookmark.radius);
      expect(camera.target.equals(bookmark.target)).toBe(true);
      expect([
        camera.viewport.x,
        camera.viewport.y,
        camera.viewport.width,
        camera.viewport.height,
      ]).toEqual([0, 0, 1, 1]);
      expect(camera.lowerRadiusLimit).toBe(8);
      expect(camera.upperRadiusLimit).toBe(24);
      work.dispose();
      expect(scene.meshes).toHaveLength(0);
      expect(scene.materials).toHaveLength(0);
    });
  }
  for (const site of ['shade', 'breeze'] as const) {
    it(`places every ${site} proposal at its authoritative supply socket without touching real geometry`, () => {
      const { scene, work } = workshop(1440, 900);
      const state = at(arrangedShelter(chosenShelter(undefined, site), 2), 'rest-' + site);
      const real = MeshBuilder.CreateBox('placed-screen', {}, scene);
      const original = supplyPosition(site, 'screen', 2);
      real.position.set(original.x, 0, original.z);
      const actualMatrix = real.computeWorldMatrix(true).clone();
      const before = structuredClone(state);
      for (const direction of [0, 1, 2, 3] as Direction[]) {
        work.select(workTarget(state, 'rest-' + site), state, { site, expected: 2, direction });
        work.tick(true, 1 / 60);
        scene.render();
        const ghost = scene.meshes.filter((m) => m.name.startsWith('work-screen-preview-'));
        expect(ghost).toHaveLength(18);
        const socket = supplyPosition(site, 'screen', direction);
        expect(ghost.reduce((n, m) => n + m.position.x, 0) / ghost.length).toBeCloseTo(socket.x, 5);
        expect(ghost.reduce((n, m) => n + m.position.z, 0) / ghost.length).toBeCloseTo(socket.z, 5);
        expect(ghost.every((m) => m.isEnabled() && !m.isPickable)).toBe(true);
        expect(real.computeWorldMatrix(true).equals(actualMatrix)).toBe(true);
        expect(state).toEqual(before);
        expect(scene.getMeshByName('work-southern-approach')!.scaling.x).toBe(
          direction === 2 ? 0.4 : 1,
        );
      }
      work.clear();
      expect(
        scene.meshes.filter((m) => m.name.startsWith('work-')).every((m) => !m.isEnabled()),
      ).toBe(true);
      expect(scene.metadata.work).toBeNull();
      work.dispose();
      expect(scene.meshes).toEqual([real]);
    });
  }
});
