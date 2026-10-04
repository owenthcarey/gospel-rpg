import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';
import { applyCameraPose, frameSubject } from '../../src/scene/presentation/framing';
import { ActionFeedback } from '../../src/scene/presentation/action';
import {
  floorHeight,
  groundMosaic,
  paintGround,
  wornPaths,
} from '../../src/scene/presentation/ground';
import {
  angleDelta,
  compositionArea,
  PresentationClock,
  turnToward,
  waterHeight,
} from '../../src/game/presence';
import { ACTOR_ASSETS } from '../../src/content/assets';
import { personIdentity } from '../../src/content/presence';
import { lakeCompositions } from '../../src/content/episode/composition';
import { sceneBeats } from '../../src/content/episode/scenes';
import { explorationAssets } from '../../src/content/inventories';
import type { ExplorationRegion } from '../../src/game/campaign/types';
import { posedVertices } from '../helpers/posed-geometry';
import { LakeRegion } from '../../src/scene/regions/lake';
import { onLake } from '../helpers/journey';
import { transition } from '../../src/game/quest';
import { DEFAULT_SETTINGS } from '../../src/game/types';
import { SCENE_IDS } from '../../src/game/episode/types';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (
      source: string,
      scene: Scene,
      options?: import('@babylonjs/core/Loading/sceneLoader').LoadAssetContainerOptions,
    ) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { ...options, pluginExtension: '.glb' },
      ),
  };
});
let engine: NullEngine;
afterEach(() => {
  vi.unstubAllGlobals();
  engine?.dispose();
});
function studio(width = 1440, height = 900) {
  engine = new NullEngine({
    renderWidth: width,
    renderHeight: height,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  engine.getCaps().maxVertexUniformVectors = 1024;
  const scene = new Scene(engine),
    camera = new ArcRotateCamera('review', -1.5, 0.85, 28, Vector3.Zero(), scene);
  const canvas = { clientWidth: width, clientHeight: height, dataset: {} } as HTMLCanvasElement;
  return { scene, camera, canvas };
}

describe('scene-owned presence', () => {
  it('restores every real lake composition with people facing one another and oars attached to hands', async () => {
    const { canvas } = studio();
    engine.getRenderingCanvas = () => canvas;
    vi.stubGlobal('document', { hidden: false });
    let state = onLake();
    const lake = new LakeRegion(engine, state);
    await lake.load(() => {});
    lake.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    for (const id of SCENE_IDS) {
      lake.update(state);
      lake.renderFrame();
      const simon = lake.scene.getTransformNodeByName('lake-simon')!,
        jesus = lake.scene.getTransformNodeByName('lake-jesus')!;
      for (const boatId of [0, 1]) {
        const boat = lake.scene.getTransformNodeByName('lake-boat-' + boatId)!;
        const inverse = Matrix.Invert(boat.computeWorldMatrix(true));
        const floors = boat
          .getChildMeshes()
          .filter((m) => m.metadata?.assetId === 'boat')
          .flatMap((m) => {
            const data = m.getPositionData() ?? [];
            return Array.from({ length: data.length / 3 }, (_, i) =>
              Vector3.TransformCoordinates(
                Vector3.FromArray(data, i * 3),
                m.computeWorldMatrix(true),
              ),
            );
          })
          .filter((v) => Math.abs(Vector3.TransformCoordinates(v, inverse).y - 0.1) < 0.002);
        expect(floors.length).toBeGreaterThan(4);
        const water = lake.scene.getMeshByName('open-water')!;
        // Imported interior floor clears the maximum wave, downward bob and roll together.
        expect(Math.min(...floors.map((v) => v.y)), id + ' dry hull').toBeGreaterThan(
          water.position.y + 0.018 + 0.022 + 0.014,
        );
      }
      if (['answer', 'astonishment', 'calling'].includes(id)) {
        for (const [a, b] of [
          [simon, jesus],
          [jesus, simon],
        ]) {
          const forward = Vector3.TransformNormal(
            new Vector3(0, 0, -1),
            a!.computeWorldMatrix(true),
          ).normalize();
          const toward = b!.getAbsolutePosition().subtract(a!.getAbsolutePosition()).normalize();
          expect(Vector3.Dot(forward, toward), id).toBeGreaterThan(0.85);
        }
      }
      if (id === 'invitation') {
        for (const side of ['left', 'right']) {
          const hand = posedVertices(simon, 'forearm_' + side);
          const oar = lake.scene.getTransformNodeByName('boat-0-oar-' + side)!;
          const handle = Vector3.TransformCoordinates(
            new Vector3(0, 0, -1.05),
            oar.computeWorldMatrix(true),
          );
          expect(Math.min(...hand.map((v) => Vector3.Distance(v, handle)))).toBeLessThan(0.1);
        }
      }
      if (id === 'answer') {
        const feet = posedVertices(simon, 'leg_left');
        const boat = lake.scene.getTransformNodeByName('lake-boat-0')!;
        expect(Math.abs(Math.min(...feet.map((v) => v.y)) - (boat.position.y + 0.1))).toBeLessThan(
          0.025,
        );
      }
      if (lakeCompositions[id].cargo && id !== 'return') {
        const bounds = (points: Vector3[]) => ({
          min: points.reduce((a, b) => Vector3.Minimize(a, b)),
          max: points.reduce((a, b) => Vector3.Maximize(a, b)),
        });
        const baskets = lake.scene.meshes.filter(
          (m) => m.metadata?.assetId === 'basket_fish' && m.getTotalVertices(),
        );
        for (const actorId of ['simon', 'jesus', 'james', 'john']) {
          const actor = lake.scene.getTransformNodeByName('lake-' + actorId)!;
          for (const side of ['left', 'right']) {
            const leg = posedVertices(actor, 'leg_' + side),
              low = Math.min(...leg.map((v) => v.y));
            const foot = bounds(leg.filter((v) => v.y < low + 0.06));
            for (const basket of baskets) {
              const data = basket.getPositionData()!;
              const cargo = bounds(
                Array.from({ length: data.length / 3 }, (_, i) =>
                  Vector3.TransformCoordinates(
                    Vector3.FromArray(data, i * 3),
                    basket.computeWorldMatrix(true),
                  ),
                ),
              );
              const overlaps = (['x', 'y', 'z'] as const).every(
                (axis) =>
                  foot.min[axis] < cargo.max[axis] - 0.015 &&
                  foot.max[axis] > cargo.min[axis] + 0.015,
              );
              expect(overlaps, `${id}: ${actorId}'s ${side} foot stays out of ${basket.name}`).toBe(
                false,
              );
            }
          }
        }
      }
      if (id === 'gathering' || id === 'return') {
        expect(simon.parent).toBeNull();
        const feet = posedVertices(simon, 'leg_left');
        expect(Math.abs(Math.min(...feet.map((v) => v.y)))).toBeLessThan(0.05);
      }
      const frozen = canvas.dataset.lakeTime;
      lake.renderFrame();
      expect(canvas.dataset.lakeTime).toBe(frozen);
      state = transition(state, { type: 'advance-scene', checkpoint: id });
    }
    lake.dispose();
    expect(lake.scene.isDisposed).toBe(true);
    // Loads the complete lake presentation and inspects imported skins on the CPU.
  }, 15_000);
  it('keeps the working net ropes attached to the Haul hands actually drawn', async () => {
    const { canvas } = studio();
    engine.getRenderingCanvas = () => canvas;
    const visibility = { hidden: false };
    let now = 1000;
    vi.stubGlobal('document', visibility);
    vi.stubGlobal('performance', { now: () => now });
    let state = onLake();
    const lake = new LakeRegion(engine, state);
    try {
      await lake.load(() => {});
      lake.update(state);
      lake.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: false });
      lake.setPaused(false);
      const initialized = lake.scene.getFrameId();
      lake.renderFrame();
      expect(lake.scene.getFrameId()).toBeGreaterThan(initialized);
      const actors = (lake as unknown as { actors: Map<string, Actor> }).actors,
        simon = actors.get('simon')!,
        cords = lake.scene.getMeshByName('net-working-cords')!,
        boat = lake.scene.getTransformNodeByName('lake-boat-0')!;
      const originalIndices = Array.from(cords.getIndices()!);
      const meshCount = lake.scene.meshes.length;
      const draw = (milliseconds: number, rendered = true) => {
        now += milliseconds;
        const before = lake.scene.getFrameId();
        lake.renderFrame();
        if (rendered) expect(lake.scene.getFrameId()).toBeGreaterThan(before);
        else expect(lake.scene.getFrameId()).toBe(before);
      };
      // Read the currently sampled exported tip directly, independently of handGrip.
      const grips = () =>
        (['left', 'right'] as const).map((side) =>
          Vector3.TransformCoordinates(
            new Vector3(0, 0.2, 0),
            simon.model.socket('forearm_' + side).computeWorldMatrix(true),
          ),
        );
      const localGrips = () => {
        const inverse = Matrix.Invert(boat.computeWorldMatrix(true));
        return grips().map((point) => Vector3.TransformCoordinates(point, inverse));
      };
      const attached = (id: (typeof SCENE_IDS)[number]) => {
        expect(cords.isEnabled(), id).toBe(true);
        expect(cords.parent).toBe(boat);
        expect(lake.scene.getMeshByName('net-working-cords')).toBe(cords);
        expect(lake.scene.meshes.length).toBe(meshCount);
        expect(Array.from(cords.getIndices()!)).toEqual(originalIndices);
        const data = cords.getVerticesData('position')!;
        expect(data.length).toBe(18);
        const cordWorld = cords.computeWorldMatrix(true),
          boatWorld = boat.computeWorldMatrix(true),
          hand = grips(),
          net = lake.scene.getTransformNodeByName('lake-net-' + lakeCompositions[id].net)!;
        for (const side of [0, 1]) {
          const point = (n: number) =>
            Vector3.TransformCoordinates(Vector3.FromArray(data, (side * 3 + n) * 3), cordWorld);
          // The Float32 cord buffer must meet the same current world-space forearm tip.
          expect(
            Vector3.Distance(point(0), hand[side]!),
            id + ': hand ' + side,
          ).toBeLessThanOrEqual(0.000002);
          expect(
            Vector3.Distance(
              point(1),
              Vector3.TransformCoordinates(new Vector3(0.86, 0.66, side ? 0.65 : -0.25), boatWorld),
            ),
          ).toBeLessThanOrEqual(0.000002);
          expect(
            Vector3.Distance(
              point(2),
              Vector3.TransformCoordinates(
                new Vector3(1.5, net.position.y + 0.08, side ? 0.8 : -0.1),
                boatWorld,
              ),
            ),
          ).toBeLessThanOrEqual(0.000002);
        }
      };
      const held = () => ({
        pose: simon.snapshotPose(),
        rig: [simon.root, ...simon.root.getChildTransformNodes()].map((node) => ({
          name: node.name,
          position: node.position.asArray(),
          rotation: node.rotation.asArray(),
          quaternion: node.rotationQuaternion?.asArray(),
          scaling: node.scaling.asArray(),
        })),
        cords: Array.from(cords.getVerticesData('position')!),
        boat: {
          position: boat.position.asArray(),
          rotation: boat.rotation.asArray(),
          scaling: boat.scaling.asArray(),
        },
        time: lake.scene.metadata.lake.time as number,
        label: canvas.dataset.lakeTime,
      });
      const observed: string[] = [];
      for (const id of SCENE_IDS) {
        expect(state.episode.checkpoint).toBe(id);
        const saved = structuredClone(state);
        lake.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: false });
        lake.update(state);
        lake.setPaused(false);
        draw(0);
        if (!['lowering', 'abundance', 'partners'].includes(id)) {
          expect(cords.isEnabled(), id).toBe(false);
        } else {
          observed.push(id);
          expect(simon.playback.clip).toBe('Haul');
          let previous = localGrips();
          for (const milliseconds of [50, 70, 250]) {
            const clock = simon.snapshotPose().elapsed,
              time = lake.scene.metadata.lake.time as number;
            draw(milliseconds);
            expect(simon.snapshotPose().elapsed).toBeGreaterThan(clock);
            expect(lake.scene.metadata.lake.time).toBeGreaterThan(time);
            const current = localGrips();
            expect(
              Math.max(...current.map((point, i) => Vector3.Distance(point, previous[i]!))),
              id + ': genuine changing Haul grip',
            ).toBeGreaterThan(0.000002);
            attached(id);
            previous = current;
          }

          // Paused cadence first records render cost, then reaches its natural due frame.
          const paused = held();
          lake.setPaused(true);
          draw(100, false);
          draw(300);
          attached(id);
          expect(held()).toEqual(paused);

          visibility.hidden = true;
          draw(500, false);
          expect(held()).toEqual(paused);
          visibility.hidden = false;
          // The real GameRuntime foreground path resets this clock before drawing again.
          lake.refreshFrame();
          draw(0);
          attached(id);
          expect(held()).toEqual(paused);

          lake.setPaused(false);
          draw(50);
          attached(id);
          expect(simon.snapshotPose().elapsed).toBeGreaterThan(paused.pose.elapsed);

          // Reduced Settings legitimately changes Haul to frame0; capture that actual draw.
          lake.applySettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
          draw(50);
          attached(id);
          expect(simon.playback.frame).toBe(0);
          const reduced = held();
          draw(100);
          attached(id);
          expect(held()).toEqual(reduced);
        }
        expect(state).toEqual(saved);
        expect(lake.getPosition()).toEqual(state.position);
        state = transition(state, { type: 'advance-scene', checkpoint: id });
      }
      expect(observed).toEqual(['lowering', 'abundance', 'partners']);
    } finally {
      lake.dispose();
    }
  });
  it('bounds cosmetic time and turns without crossing the long side of a heading wrap', () => {
    const clock = new PresentationClock();
    expect(clock.advance(10, true)).toBe(0.1);
    expect(clock.advance(10, false)).toBe(0.1);
    expect(clock.advance(-2, true)).toBe(0.1);
    expect(clock.advance(Number.NaN, true)).toBe(0.1);
    expect(clock.advance(10, true, true)).toBe(0);
    expect(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1))).toBeCloseTo(0.2);
    const turned = turnToward(Math.PI - 0.1, -Math.PI + 0.1, 0.016);
    expect(turned).toBeGreaterThan(Math.PI - 0.1);
    expect(turned).toBeLessThan(Math.PI + 0.1);
    for (let x = -10; x < 10; x += 0.2)
      expect(Math.abs(waterHeight({ x, z: x * 0.7 }, 3, 0.22))).toBeLessThanOrEqual(0.22);
  });
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
    [360, 640],
  ] as const) {
    it(`projects the whole subject above/beside the actual ${width}×${height} reading panel`, () => {
      const { scene, camera } = studio(width, height);
      const panel =
        width > 700
          ? { left: width * 0.54, right: width - 12, top: 80, bottom: height - 12 }
          : { left: 10, right: width - 10, top: height * 0.48, bottom: height - 10 };
      const area = compositionArea(width, height, panel),
        center = new Vector3(5, 1, 3),
        extent = 2;
      applyCameraPose(
        camera,
        frameSubject(camera, width, height, center, extent, -1.3, 1.12, panel),
      );
      scene.render();
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        for (const axis of ['xy', 'xz', 'yz']) {
          const p = center.add(
            new Vector3(
              axis === 'yz' ? 0 : Math.cos(a) * extent,
              axis === 'xz' ? 0 : Math.sin(a) * extent,
              axis === 'xy' ? 0 : (axis === 'yz' ? Math.cos(a) : Math.sin(a)) * extent,
            ),
          );
          const projected = Vector3.Project(
            p,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(width, height),
          );
          expect(projected.x).toBeGreaterThan(area.left);
          expect(projected.x).toBeLessThan(area.right);
          expect(projected.y).toBeGreaterThan(area.top);
          expect(projected.y).toBeLessThan(area.bottom);
          expect(projected.z).toBeGreaterThan(0);
          expect(projected.z).toBeLessThan(1);
        }
      }
    });
  }
  it('animates imported rigs while preserving navigation, supported carrying and an exact camera/pose bookmark', async () => {
    vi.stubGlobal('document', { hidden: false });
    const { scene, camera, canvas } = studio(),
      library = new AssetLibrary(scene);
    await library.load(['simon', 'traveler', 'basket_fish'], () => {});
    const speaker = new Actor(library.instantiate('simon', 'speaker')),
      listener = new Actor(library.instantiate('traveler', 'listener'));
    speaker.root.position.set(1, 0, 1);
    listener.root.position.set(1, 0, -1);
    speaker.sampleAt('Idle', 0.4);
    listener.sampleAt('Carry', 0);
    listener.attach(library.instantiate('basket_fish', 'carried'));
    const positions = [speaker.root.position.clone(), listener.root.position.clone()],
      headings = [speaker.root.rotation.y, listener.root.rotation.y];
    const poses = [speaker.snapshotPose(), listener.snapshotPose()],
      cameraTarget = camera.target.clone(),
      radius = camera.radius;
    camera.lowerRadiusLimit = 16;
    camera.upperRadiusLimit = 46;
    const conversation = new ConversationPresentation(camera, canvas);
    const panel = { left: 300, right: 1100, top: 550, bottom: 880 };
    conversation.select('simon', speaker, listener, panel);
    for (let i = 0; i < 30; i++) conversation.tick(0.016, false);
    expect(speaker.playback.clip).toBe('Greet');
    expect(listener.playback.clip).toBe('Carry');
    expect(listener.playback.frame).toBe(0);
    const initialHand = posedVertices(speaker.root, 'forearm_right').map((p) => p.asArray());
    conversation.tick(0.1, false);
    expect(posedVertices(speaker.root, 'forearm_right').map((p) => p.asArray())).not.toEqual(
      initialHand,
    );
    expect(speaker.root.position.equals(positions[0]!)).toBe(true);
    expect(listener.root.position.equals(positions[1]!)).toBe(true);
    const time = canvas.dataset.conversationTime,
      frame = speaker.playback.frame;
    conversation.setPaused(true);
    conversation.tick(0.1, false);
    expect(canvas.dataset.conversationTime).toBe(time);
    expect(speaker.playback.frame).toBe(frame);
    conversation.select('simon', speaker, listener, { ...panel, top: 430 });
    conversation.tick(0.1, false);
    expect(canvas.dataset.conversationTime).toBe(time);
    conversation.setPaused(false);
    vi.stubGlobal('document', { hidden: true });
    conversation.tick(9, false);
    expect(canvas.dataset.conversationTime).toBe(time);
    vi.stubGlobal('document', { hidden: false });
    conversation.tick(0.1, true);
    expect(canvas.dataset.conversationTime).toBe('0.00');
    expect(speaker.playback.clip).toBe('Listen');
    conversation.clear();
    expect(speaker.snapshotPose()).toEqual(poses[0]);
    expect(listener.snapshotPose()).toEqual(poses[1]);
    expect([speaker.root.rotation.y, listener.root.rotation.y]).toEqual(headings);
    expect(camera.target.equals(cameraTarget)).toBe(true);
    expect(camera.radius).toBe(radius);
    expect(camera.lowerRadiusLimit).toBe(16);
    expect(camera.upperRadiusLimit).toBe(46);
    expect(canvas.dataset.conversation).toBeUndefined();
    conversation.clear();
    library.dispose();
  });
  it('keeps painted path faces crisp and above their original sloping ground', () => {
    const { scene } = studio();
    const slope = (p: { x: number; z: number }) => p.x * 0.04 + p.z * 0.12;
    const path = wornPaths(scene, 'painted-slope', [[{ x: 0, z: 0 }, { x: 0, z: 5 }, 2]], slope);
    const positions = path.getVerticesData('position')!,
      colors = path.getVerticesData('color')!,
      indices = path.getIndices()!;
    expect(indices.length).toBeGreaterThan(0);
    for (let i = 0; i < positions.length; i += 3) {
      const lift = positions[i + 1]! - slope({ x: positions[i]!, z: positions[i + 2]! });
      expect(lift).toBeGreaterThan(0);
      expect(lift).toBeLessThan(0.05);
      expect(positions[i + 2]!).toBeGreaterThanOrEqual(0);
      expect(positions[i + 2]!).toBeLessThanOrEqual(5);
    }
    for (let i = 0; i < indices.length; i += 3) {
      const swatches = [0, 1, 2].map((n) =>
        colors.slice(indices[i + n]! * 4, indices[i + n]! * 4 + 4),
      );
      expect(swatches[1]).toEqual(swatches[0]);
      expect(swatches[2]).toEqual(swatches[0]);
    }
  });
  it('fits broad flat paint to the existing curved floor without changing its sampling grid', () => {
    const { scene } = studio();
    const floor = MeshBuilder.CreateGround(
      'painted-floor',
      { width: 24, height: 24, subdivisions: 24 },
      scene,
    );
    const source = floor.getVerticesData('position')!;
    for (let i = 0; i < source.length; i += 3)
      source[i + 1] = source[i]! * 0.08 + Math.sin(source[i + 2]! * 0.5) * 0.4;
    floor.setVerticesData('position', source);
    const indices = [...floor.getIndices()!];
    const samples = [
      { x: 3, z: 7 },
      { x: -4, z: -8 },
    ].map((p) => floorHeight(floor, p));
    const count = scene.meshes.length;
    paintGround(floor, 'dry', undefined, { mosaic: true });
    expect(scene.meshes.length).toBe(count + 1);
    paintGround(floor, 'dry', undefined, { mosaic: true });
    expect(scene.meshes.length).toBe(count + 1);
    expect(floor.getVerticesData('position')).toEqual(source);
    expect([...floor.getIndices()!]).toEqual(indices);
    expect(
      [
        { x: 3, z: 7 },
        { x: -4, z: -8 },
      ].map((p) => floorHeight(floor, p)),
    ).toEqual(samples);
    const paint = scene.getMeshByName('painted-floor-paint')!;
    expect(paint.isPickable).toBe(false);
    const positions = paint.getVerticesData('position')!,
      colors = paint.getVerticesData('color')!,
      paintedFaces = paint.getIndices()!;
    expect(paintedFaces.length).toBeGreaterThan(0);
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(
      paint
        .getVerticesData('normal')!
        .filter((_, i) => i % 3 === 1)
        .every((y) => y > 0),
    ).toBe(true);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!,
        y = positions[i + 1]!,
        z = positions[i + 2]!;
      expect(Math.abs(x)).toBeLessThanOrEqual(12);
      expect(Math.abs(z)).toBeLessThanOrEqual(12);
      // Babylon's height query excludes the right and bottom boundary; sample just inside them.
      const height = floor.getHeightAtCoordinates(Math.min(x, 12 - 1e-7), Math.max(z, -12 + 1e-7));
      expect(y - height).toBeCloseTo(0.004, 5);
    }
    for (let i = 0; i < paintedFaces.length; i += 3) {
      const swatches = [0, 1, 2].map((n) =>
        colors.slice(paintedFaces[i + n]! * 4, paintedFaces[i + n]! * 4 + 4),
      );
      expect(swatches[1]).toEqual(swatches[0]);
      expect(swatches[2]).toEqual(swatches[0]);
    }
    paintGround(floor, 'dry');
    expect(scene.meshes.length).toBe(count);
  });
  it('returns flat paint to the shared backdrop palette before the reserve boundary', () => {
    const { scene } = studio();
    const floor = MeshBuilder.CreateGround(
      'reserved-floor',
      { width: 60, height: 60, subdivisions: 60 },
      scene,
    );
    paintGround(floor, 'dry');
    const natural = [...floor.getVerticesData('color')!];
    const source = [...floor.getVerticesData('position')!];
    const indices = [...floor.getIndices()!];
    const count = scene.meshes.length;
    paintGround(floor, 'dry', undefined, {
      mosaic: true,
      reserve: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 },
    });
    const colors = floor.getVerticesData('color')!;
    const swatch = (x: number, z: number, values = colors) => {
      const index = source.findIndex((p, i) => i % 3 === 0 && p === x && source[i + 2] === z);
      return values.slice((index / 3) * 4, (index / 3) * 4 + 4);
    };
    const flat = swatch(0, 0);
    expect(swatch(18, 0)).toEqual(flat);
    expect(swatch(-18, 18)).toEqual(flat);
    for (const [x, z] of [
      [24, 0],
      [-24, 0],
      [0, 24],
      [0, -24],
      [30, 30],
    ])
      expect(swatch(x!, z!)).toEqual(swatch(x!, z!, natural));
    const mid = swatch(21, 0),
      outer = swatch(21, 0, natural);
    for (let channel = 0; channel < 4; channel++)
      expect(mid[channel]).toBeCloseTo((flat[channel]! + outer[channel]!) / 2, 6);
    const paint = scene.getMeshByName('reserved-floor-paint')!;
    const positions = paint.getVerticesData('position')!;
    expect(paint.getIndices()!.length).toBeGreaterThan(0);
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.abs(positions[i]!)).toBeLessThanOrEqual(18);
      expect(Math.abs(positions[i + 2]!)).toBeLessThanOrEqual(18);
    }
    expect(scene.meshes.length).toBe(count + 1);
    expect(floor.getVerticesData('position')).toEqual(source);
    expect([...floor.getIndices()!]).toEqual(indices);
  });
  it('gives ground patches and path ribbons upward normals without making accents interactive', () => {
    const { scene } = studio();
    const mosaic = groundMosaic(
      scene,
      'test-earth',
      { min: -5, max: 5 },
      () => true,
      () => 0,
    );
    const interior = groundMosaic(
      scene,
      'test-interior-earth',
      { min: -5, max: 5 },
      () => true,
      () => 0,
      true,
    );
    const interiorPositions = interior.getVerticesData('position')!;
    for (let i = 0; i < interiorPositions.length; i += 3) {
      expect(Math.abs(interiorPositions[i]!)).toBeLessThanOrEqual(5);
      expect(Math.abs(interiorPositions[i + 2]!)).toBeLessThanOrEqual(5);
    }
    const path = wornPaths(scene, 'test-path', [
      [{ x: 0, z: 0 }, { x: 0, z: 5 }, 2],
      [{ x: 0, z: 0 }, { x: 0, z: 0 }, 2],
    ]);
    for (const mesh of [mosaic, interior, path]) {
      const p = mesh.getVerticesData('position')!,
        normals = mesh.getVerticesData('normal')!;
      expect(p.every(Number.isFinite)).toBe(true);
      expect(normals.filter((_, i) => i % 3 === 1).every((y) => y > 0.99)).toBe(true);
    }
    expect(mosaic.isPickable).toBe(false);
    const feedback = new ActionFeedback(scene);
    feedback.play('Repair', { x: 1, z: 2 }, 0, false);
    const ring = scene.getMeshByName('accepted-work-accent')!;
    expect(ring.isEnabled()).toBe(true);
    expect(ring.isPickable).toBe(false);
    for (let i = 0; i < 30; i++) feedback.tick(0.1, false, false);
    expect(ring.isEnabled()).toBe(true);
    for (let i = 0; i < 15; i++) feedback.tick(0.1, true, false);
    expect(ring.isEnabled()).toBe(false);
    feedback.play('Use', { x: 0, z: 0 }, 0, true);
    expect(ring.isEnabled()).toBe(false);
    feedback.dispose();
    expect(scene.getMeshByName('accepted-work-accent')).toBeNull();
  });
  it('keeps ten complete tableaux, with an answer separate from the rowing invitation', () => {
    expect(Object.keys(lakeCompositions)).toEqual(sceneBeats.map((b) => b.id));
    expect(lakeCompositions.answer.simon).toBe('Respond');
    expect(lakeCompositions.invitation.simon).toBe('Row');
    expect(lakeCompositions.answer.target).not.toEqual(lakeCompositions.invitation.target);
    expect(personIdentity('Original narration')).toBeUndefined();
    expect(personIdentity('Miriam')?.asset).toBe('miriam');
    expect(personIdentity('home-farm')?.asset).toBe('leah');
  });
  it('delivers every identity portrait within 384 KiB and every region within the RFC-010 allowance', () => {
    const directory = 'public/assets/portraits/';
    expect(
      readdirSync(directory)
        .map((n) => n.replace('.webp', ''))
        .sort(),
    ).toEqual([...ACTOR_ASSETS].sort());
    let portraitBytes = 0;
    for (const id of ACTOR_ASSETS) {
      const bytes = readFileSync(directory + id + '.webp');
      portraitBytes += bytes.length;
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
    }
    expect(portraitBytes).toBeLessThanOrEqual(384 * 1024);
    const baseline = JSON.parse(
      readFileSync('docs/verification/rfc010/baseline-inventories.json', 'utf8'),
    ) as Record<ExplorationRegion, { bytes: number }>;
    const regions = Object.fromEntries(
      Object.entries(baseline).map(([region, old]) => {
        const assets = explorationAssets(region as ExplorationRegion);
        const bytes = assets.reduce(
          (sum, n) => sum + readFileSync('public/assets/models/' + n + '.glb').length,
          0,
        );
        expect(bytes - old.bytes, region).toBeLessThanOrEqual(768 * 1024);
        return [region, { assets, bytes, baselineBytes: old.bytes, addedBytes: bytes - old.bytes }];
      }),
    );
    if (process.env.PRESENCE_REVIEW_OUTPUT) {
      const inspect = (directory: string, extension: string) =>
        Object.fromEntries(
          readdirSync(directory)
            .filter((n) => n.endsWith(extension))
            .sort()
            .map((name) => {
              const buffer = readFileSync(directory + name);
              return [
                name.replace(extension, ''),
                { bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') },
              ];
            }),
        );
      writeFileSync(
        process.env.PRESENCE_REVIEW_OUTPUT,
        JSON.stringify(
          {
            baselineCommit: 'd388fec',
            models: inspect('public/assets/models/', '.glb'),
            portraits: inspect(directory, '.webp'),
            portraitBytes,
            regions,
          },
          null,
          2,
        ) + '\n',
      );
    }
  });
});
