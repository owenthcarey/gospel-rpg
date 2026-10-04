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
