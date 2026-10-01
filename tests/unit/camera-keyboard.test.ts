import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { World } from '../../src/scene/world';
import { bindExplorationInput } from '../../src/scene/input';
import { PausedCadence } from '../../src/scene/presentation/cadence';
import { newGame } from '../../src/game/types';

const engines: NullEngine[] = [];
const bindings: (() => void)[] = [];
afterEach(() => {
  bindings.splice(0).forEach((dispose) => dispose());
  vi.unstubAllGlobals();
  engines.splice(0).forEach((engine) => engine.dispose());
});

class ElementStub extends EventTarget {
  closest() {
    return null;
  }
}
class InputStub extends ElementStub {}
class SelectStub extends ElementStub {}
class TextareaStub extends ElementStub {}

function studio() {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera(
    'Q handoff',
    -Math.PI / 2 - 0.45,
    0.8,
    24,
    new Vector3(0, 0, 2),
    scene,
  );
  camera.inertia = 0.72;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = 1.3;
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 54;
  const events = new EventTarget();
  const canvas = Object.assign(new ElementStub(), { dataset: {} });
  let now = 1000;
  vi.stubGlobal('window', events);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('HTMLElement', ElementStub);
  vi.stubGlobal('HTMLInputElement', InputStub);
  vi.stubGlobal('HTMLSelectElement', SelectStub);
  vi.stubGlobal('HTMLTextAreaElement', TextareaStub);
  const keys = new Set<string>();
  const fixture = Object.assign(Object.create(World.prototype), {
    engine,
    scene,
    camera,
    canvas,
    state: newGame(),
    position: { x: 0, z: 0 },
    player: new TransformNode('traveler', scene),
    actors: new Map(),
    actorPlayer: { setStrideSpeed() {}, playback: { clip: 'Idle', frame: 0, action: '' } },
    keys,
    path: [],
    routeDots: [],
    marker: { setEnabled() {} },
    boats: [],
    waterLines: [],
    cutaways: [],
    occluders: [],
    destinations: [],
    dataCache: new Map(),
    stage: { setView() {}, tick() {} },
    cadence: new PausedCadence(),
    callbacks: { frame() {} },
    active: true,
    paused: false,
    reducedMotion: false,
    pendingRotation: 0,
    time: 0,
    lastRender: now,
    lastFrame: Infinity,
  });
  const world = fixture as World;
  const binding = bindExplorationInput({
    scene,
    canvas: canvas as unknown as HTMLCanvasElement,
    keys,
    paused: () => fixture.paused,
    navigate() {},
    walk() {},
    nearest: () => undefined,
    resetCamera: () => world.resetCamera(),
    notice() {},
  });
  fixture.explorationInput = binding;
  bindings.push(() => {
    vi.stubGlobal('window', events);
    binding.dispose();
  });
  const key = (type: 'keydown' | 'keyup') =>
    events.dispatchEvent(
      Object.assign(new Event(type), {
        key: 'q',
        repeat: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    );
  const render = (milliseconds = 100) => {
    now += milliseconds;
    world.renderFrame();
  };
  const returning = () => {
    const to = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
    };
    const from = { ...to, alpha: -0.2, target: new Vector3(-2, 2, 4) };
    camera.alpha = from.alpha;
    camera.target.copyFrom(from.target);
    fixture.cameraReturn = { from, to, t: 0 };
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
  return { camera, fixture, world, keys, key, render, returning, pose, context };
}

describe('keyboard camera ownership', () => {
  it('keeps the Q rotation rate and stops rotating after keyup', () => {
    const { camera, key, render, context } = studio();
    const initial = camera.alpha;
    const originalContext = context();
    key('keydown');
    for (let frame = 0; frame < 10; frame++) {
      render();
      expect(context()).toEqual(originalContext);
    }
    expect(camera.alpha).toBeCloseTo(initial + 0.8, 12);
    key('keyup');
    const released = camera.alpha;
    for (let frame = 0; frame < 4; frame++) {
      render();
      expect(camera.alpha).toBe(released);
      expect(context()).toEqual(originalContext);
    }
  });

  it('rejects paused Q and accepts a fresh press after resume', () => {
    const { camera, world, keys, key, render, context } = studio();
    const originalContext = context();
    world.setPaused(true);
    const paused = camera.alpha;
    key('keydown');
    render(250);
    expect(keys.has('q')).toBe(false);
    expect(camera.alpha).toBe(paused);
    expect(context()).toEqual(originalContext);
    key('keyup');
    world.setPaused(false);
    key('keydown');
    render();
    expect(camera.alpha).toBeGreaterThan(paused);
    expect(context()).toEqual(originalContext);
  });

  it('takes over a returning camera like the existing public camera controls', () => {
    const actual = studio();
    const originalContext = actual.context();
    actual.returning();
    actual.key('keydown');
    actual.render();
    const actualFirst = actual.pose();
    expect(actual.fixture.cameraReturn).toBeUndefined();
    expect(actual.context()).toEqual(originalContext);
    actual.render();
    const actualSecond = actual.pose();
    actual.key('keyup');
    actual.render();
    expect(actual.pose()).toEqual(actualSecond);
    expect(actual.context()).toEqual(originalContext);

    // The shipped rotate button already invokes the actual transition finisher.
    // Compare identical Q events/render frames, without duplicating the easing formula.
    const control = studio();
    control.returning();
    control.world.rotate(0);
    control.key('keydown');
    control.render();
    const controlFirst = control.pose();
    control.render();
    expect(actualFirst).toEqual(controlFirst);
    expect(actualSecond).toEqual(control.pose());
    expect(control.context()).toEqual(originalContext);
  });

  it('cancels an unfinished button rotation before the first Q frame', () => {
    const actual = studio();
    const originalContext = actual.context();
    actual.world.rotate(1);
    actual.key('keydown');
    actual.render();
    const actualFirst = actual.pose();
    expect(actual.fixture.pendingRotation).toBe(0);
    expect(actual.context()).toEqual(originalContext);
    actual.key('keyup');
    actual.render();
    expect(actual.pose()).toEqual(actualFirst);

    const control = studio();
    control.key('keydown');
    control.render();
    expect(actualFirst).toEqual(control.pose());
    expect(control.context()).toEqual(originalContext);
  });

  it('waits for an elapsed simulation frame before Q claims a return', () => {
    const { fixture, key, render, returning } = studio();
    returning();
    const bookmark = fixture.cameraReturn;
    key('keydown');
    render(0);
    expect(fixture.cameraReturn).toBe(bookmark);
    render();
    expect(fixture.cameraReturn).toBeUndefined();
  });

  it('lets a return and button rotation continue without held Q', () => {
    const { fixture, world, render, returning, camera } = studio();
    returning();
    const bookmark = fixture.cameraReturn;
    const initial = camera.alpha;
    world.rotate(1);
    // Start a fresh return while the existing button step remains queued.
    returning();
    render();
    expect(fixture.cameraReturn).not.toBeUndefined();
    expect(fixture.cameraReturn).not.toBe(bookmark);
    expect(fixture.cameraReturn.t).toBeGreaterThan(0);
    expect(fixture.pendingRotation).toBeGreaterThan(0);
    expect(fixture.pendingRotation).toBeLessThan(0.3);
    expect(camera.alpha).not.toBe(initial);
  });
});
