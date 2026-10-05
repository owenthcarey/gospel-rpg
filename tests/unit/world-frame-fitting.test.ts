import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { World } from '../../src/scene/world';
import { PausedCadence } from '../../src/scene/presentation/cadence';

afterEach(() => vi.unstubAllGlobals());

function pausedFrame() {
  let now = 0;
  const documentState = { hidden: false };
  vi.stubGlobal('document', documentState);
  vi.stubGlobal('performance', { now: () => now });
  const size = { width: 400, height: 800, reads: 0 };
  const canvas = {
    dataset: {},
    get clientWidth() {
      size.reads++;
      return size.width;
    },
    get clientHeight() {
      size.reads++;
      return size.height;
    },
  };
  const camera = {
    radius: 20,
    lowerRadiusLimit: 3,
    upperRadiusLimit: 40,
    position: Vector3.Zero(),
    target: Vector3.Zero(),
    getViewMatrix: vi.fn(),
  };
  const render = vi.fn();
  // Exercise actual World.renderFrame and fitCamera without unrelated asset loading or GPU work.
  const world: World = Object.assign(Object.create(World.prototype), {
    canvas,
    camera,
    cameraAspectScale: 1,
    layout: { camera: { min: 3, max: 40 } },
    active: false,
    paused: true,
    reducedMotion: true,
    lastRender: 0,
    lastFrame: Infinity,
    cadence: new PausedCadence(),
    time: 0,
    pendingRotation: 0,
    keys: new Set(),
    boats: [],
    cutaways: [],
    occluders: [],
    destinations: [],
    player: { position: Vector3.Zero() },
    dataCache: new Map(),
    state: { region: 'capernaum-lanes' },
    stage: { setView: vi.fn(), tick: vi.fn() },
    scene: { render },
    actorPlayer: { playback: { clip: 'Idle', frame: 0, action: 'Idle' } },
  });
  return {
    world,
    camera,
    size,
    render,
    documentState,
    at: (value: number) => {
      now = value;
    },
  };
}

describe('world camera fitting across skipped paused frames', () => {
  it('leaves skipped-frame geometry untouched and fits the next invalidated resize before drawing', () => {
    const { world, camera, size, render, at } = pausedFrame();
    world.renderFrame();
    expect(camera.radius).toBe(36);
    expect(render).toHaveBeenCalledTimes(1);
    size.reads = 0;
    size.width = 1000;
    size.height = 700;
    at(10);
    world.renderFrame();
    expect(size.reads).toBe(0);
    expect(camera.radius).toBe(36);
    expect(render).toHaveBeenCalledTimes(1);
    world.refreshFrame(false);
    world.renderFrame();
    expect(size.reads).toBe(2);
    expect(camera.radius).toBe(20);
    expect(camera.lowerRadiusLimit).toBe(3);
    expect(camera.upperRadiusLimit).toBe(40);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('defers hidden-tab sizing until the foreground frame is invalidated', () => {
    const { world, camera, size, render, documentState } = pausedFrame();
    documentState.hidden = true;
    // Interface's resize layout publication also clears an absent conversation.
    // The synchronous close path must keep the existing hidden-frame deferral.
    world.setConversation();
    expect(size.reads).toBe(0);
    expect(camera.radius).toBe(20);
    world.renderFrame();
    expect(size.reads).toBe(0);
    expect(camera.radius).toBe(20);
    expect(render).not.toHaveBeenCalled();
    documentState.hidden = false;
    world.refreshFrame();
    world.renderFrame();
    expect(size.reads).toBe(2);
    expect(camera.radius).toBe(36);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it.each(['workView', 'conversationView'] as const)(
    'retains %s focus without fitting the layout camera',
    (view) => {
      const { world, camera, size, render } = pausedFrame();
      Object.assign(world, { [view]: { active: true, animated: false, tick: vi.fn() } });
      world.renderFrame();
      expect(size.reads).toBe(0);
      expect(camera.radius).toBe(20);
      expect(camera.lowerRadiusLimit).toBe(3);
      expect(camera.upperRadiusLimit).toBe(40);
      expect(render).toHaveBeenCalledTimes(1);
    },
  );
});

function fitSnapshot(view: ReturnType<typeof pausedFrame>) {
  const state = view.world as unknown as {
    readonly cameraAspectScale: number;
    readonly cameraReturn?: {
      from: { alpha: number; beta: number; radius: number; target: Vector3 };
      to: { alpha: number; beta: number; radius: number; target: Vector3 };
      t: number;
    };
  };
  const returned = state.cameraReturn;
  const pose = (value: NonNullable<typeof returned>['from']) => ({
    alpha: value.alpha,
    beta: value.beta,
    radius: value.radius,
    target: value.target.asArray(),
  });
  return {
    radius: view.camera.radius,
    limits: [view.camera.lowerRadiusLimit, view.camera.upperRadiusLimit],
    target: view.camera.target.asArray(),
    scale: state.cameraAspectScale,
    returned: returned ? { from: pose(returned.from), to: pose(returned.to), t: returned.t } : null,
  };
}

function beginConversationReturn(view: ReturnType<typeof pausedFrame>) {
  const camera = Object.assign(view.camera, { alpha: -1.5, beta: 0.8 });
  const bookmark = {
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    target: camera.target.clone(),
  };
  const conversation = {
    active: true,
    animated: false,
    clear: vi.fn(() => {
      conversation.active = false;
      camera.alpha = bookmark.alpha;
      camera.beta = bookmark.beta;
      camera.radius = bookmark.radius;
      camera.target.copyFrom(bookmark.target);
    }),
  };
  // Use the existing presentation mock boundary; World creates/advances the return itself.
  Object.assign(view.world, { reducedMotion: false, conversationView: conversation });
  camera.alpha = -1.2;
  camera.beta = 1.12;
  camera.radius = 10;
  camera.target.set(2, 1, -3);
  view.world.setConversation();
  expect(conversation.clear).toHaveBeenCalledOnce();
  expect(conversation.active).toBe(false);
}

describe('world camera fitting with an undisplayed canvas', () => {
  it.each([
    [0, 0],
    [0, 740],
    [512, 0],
  ])('defers initial %i × %i extents and recovers on the next displayed frame', (width, height) => {
    // Complete the direct positive-size reference before constructing another clock fixture.
    const reference = pausedFrame();
    reference.size.width = 512;
    reference.size.height = 740;
    reference.world.renderFrame();
    const expected = fitSnapshot(reference);

    const actual = pausedFrame();
    const initial = fitSnapshot(actual);
    actual.size.width = width;
    actual.size.height = height;
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(initial);
    expect(actual.size.reads).toBe(2);
    expect(actual.render).toHaveBeenCalledOnce();

    actual.size.width = 512;
    actual.size.height = 740;
    actual.at(10);
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(expected);
    expect(Number.isFinite(actual.camera.radius)).toBe(true);
    expect(actual.render).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 800],
    [512, 740],
  ])('retains selected zoom through zero extents before %i × %i recovery', (width, height) => {
    const reference = pausedFrame();
    reference.world.renderFrame();
    reference.world.zoom(-1);
    reference.size.width = width;
    reference.size.height = height;
    reference.at(20);
    reference.world.refreshFrame(false);
    reference.world.renderFrame();
    const expected = fitSnapshot(reference);

    const actual = pausedFrame();
    actual.world.renderFrame();
    actual.world.zoom(-1);
    expect(actual.camera.radius).toBe(33);
    const selected = fitSnapshot(actual);
    actual.size.width = 0;
    actual.size.height = 0;
    actual.at(10);
    // An absent conversation layout publication also invokes the genuine fitting path.
    actual.world.setConversation();
    expect(fitSnapshot(actual)).toEqual(selected);
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(selected);

    actual.size.width = width;
    actual.size.height = height;
    actual.at(20);
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(expected);
    expect(actual.camera.radius / fitSnapshot(actual).scale).toBeCloseTo(
      selected.radius / selected.scale,
      12,
    );
    expect(actual.render).toHaveBeenCalledTimes(3);
  });

  it('preserves pending conversation return endpoints until the displayed size resumes', () => {
    const reference = pausedFrame();
    reference.at(1000);
    reference.world.renderFrame();
    reference.world.zoom(-1);
    beginConversationReturn(reference);
    reference.size.width = 512;
    reference.size.height = 740;
    reference.world.refreshFrame(false);
    reference.world.renderFrame();
    const resumed = fitSnapshot(reference);
    reference.at(1350);
    reference.world.refreshFrame(false);
    reference.world.renderFrame();
    const continued = fitSnapshot(reference);
    reference.at(1700);
    reference.world.refreshFrame(false);
    reference.world.renderFrame();
    const finished = fitSnapshot(reference);
    expect(finished.returned).toBeNull();

    const actual = pausedFrame();
    actual.at(1000);
    actual.world.renderFrame();
    actual.world.zoom(-1);
    beginConversationReturn(actual);
    const original = fitSnapshot(actual);
    expect(original.returned?.from.radius).toBe(10);
    expect(original.returned?.to.radius).toBe(33);
    expect(original.returned?.t).toBe(0);
    actual.size.width = 0;
    actual.size.height = 0;
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(original);

    actual.size.width = 512;
    actual.size.height = 740;
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(resumed);
    actual.at(1350);
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(continued);
    actual.at(1700);
    actual.world.refreshFrame(false);
    actual.world.renderFrame();
    expect(fitSnapshot(actual)).toEqual(finished);
    expect(Number.isFinite(actual.camera.radius)).toBe(true);
  });
});
