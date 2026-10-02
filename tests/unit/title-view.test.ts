import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TitleView } from '../../src/scene/regions/title';
import { StageEnvironment } from '../../src/scene/environment/stage';
import { WaterPresentation } from '../../src/scene/presentation/water';
import { DEFAULT_SETTINGS, newGame } from '../../src/game/types';
import { GameRuntime } from '../../src/scene/runtime';
import * as worlds from '../../src/scene/world';

let engine: NullEngine;
afterEach(() => {
  try {
    engine?.dispose();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

function studio() {
  engine = new NullEngine();
  const document = { hidden: false, removeEventListener: vi.fn() };
  vi.stubGlobal('document', document);
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  // Advance the actual title's frame logic without rendering thousands of GPU frames
  // or recalculating unrelated procedural waves and particles.
  vi.spyOn(Scene.prototype, 'render').mockImplementation(() => {});
  vi.spyOn(StageEnvironment.prototype, 'tick').mockImplementation(() => {});
  vi.spyOn(WaterPresentation.prototype, 'tick').mockImplementation(() => {});
  const view = new TitleView(engine);
  view.applySettings({ ...DEFAULT_SETTINGS, quality: 'low' });
  const boats = view.scene.transformNodes.filter((node) => node.name === 'title-boat');
  expect(boats).toHaveLength(2);
  const frame = (elapsed = 100) => {
    now += elapsed;
    view.renderFrame();
  };
  view.renderFrame();
  return { view, boats, frame, document };
}

function runtimeStudio() {
  engine = new NullEngine();
  const canvas = { dataset: {} as Record<string, string>, setAttribute: vi.fn() };
  vi.stubGlobal('window', { removeEventListener: vi.fn() });
  vi.stubGlobal('document', { hidden: false, removeEventListener: vi.fn() });
  vi.spyOn(engine, 'getRenderingCanvas').mockReturnValue({
    removeAttribute(name: string) {
      if (name === 'data-title') delete canvas.dataset.title;
    },
  } as HTMLCanvasElement);
  // Exercise the actual scene-ownership methods with Babylon's nonrendering engine;
  // constructing a second WebGL engine is unrelated to the title-loading races.
  const runtime = Object.assign(Object.create(GameRuntime.prototype), {
    engine,
    canvas,
    settings: { ...DEFAULT_SETTINGS, quality: 'low' },
    paused: true,
    resize: () => {},
  }) as GameRuntime;
  return { runtime, canvas };
}

function pendingReady() {
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => (finish = resolve));
  const loading = vi.spyOn(TitleView.prototype, 'load').mockReturnValue(ready);
  return { finish, loading };
}

describe('welcome scene', () => {
  it.each([
    { renderer: 'Metal', quality: 'low' as const },
    { renderer: 'SwiftShader', quality: 'high' as const },
  ])(
    'starts a $quality welcome on $renderer without a full-size shadow allocation',
    ({ renderer, quality }) => {
      engine = new NullEngine();
      Object.assign(engine, { getGlInfo: () => ({ renderer }) });
      const targets = vi.spyOn(engine, 'createRenderTargetTexture');
      const view = new TitleView(engine, quality);
      try {
        expect(targets.mock.calls.length).toBeGreaterThan(0);
        for (const [size] of targets.mock.calls)
          expect(
            typeof size === 'number' ? size : Math.max(size.width, size.height),
          ).toBeLessThanOrEqual(16);
        expect(view.scene.shadowsEnabled).toBe(false);
        expect(view.scene.transformNodes.filter((node) => node.name === 'title-boat')).toHaveLength(
          2,
        );
      } finally {
        view.dispose();
      }
    },
  );

  it('retains both boats in the original composition throughout a half-hour idle session', () => {
    const { view, boats, frame } = studio();
    const homes = boats.map((boat) => boat.position.clone());
    let traveled = 0;
    let previous = homes[0]!.x;
    for (let tick = 0; tick < 18_000; tick++) {
      frame();
      const distance = Math.abs(boats[0]!.position.x - previous);
      expect(distance).toBeLessThanOrEqual(0.012 + 1e-8);
      traveled += distance;
      previous = boats[0]!.position.x;
      if (tick % 600 === 0) {
        boats.forEach((boat, index) => {
          expect(Math.abs(boat.position.x - homes[index]!.x)).toBeLessThanOrEqual(1.5);
          expect(boat.position.z).toBe(homes[index]!.z);
          expect(Math.abs(boat.position.y)).toBeLessThanOrEqual(0.06);
        });
      }
    }
    expect(traveled).toBeGreaterThan(100);
    expect(view.scene.isDisposed).toBe(false);
    expect(engine.scenes).toHaveLength(1);
  });

  it('holds the live pose while paused, hidden or reduced and resumes without catching up', () => {
    const { view, boats, frame, document } = studio();
    for (let tick = 0; tick < 30; tick++) frame();
    const pose = () =>
      boats.map((boat) => ({
        position: boat.position.asArray(),
        rotation: boat.rotation.asArray(),
      }));
    const before = pose();
    view.setPaused(true);
    frame(60_000);
    expect(pose()).toEqual(before);
    view.setPaused(false);
    document.hidden = true;
    frame(60_000);
    document.hidden = false;
    frame(60_000);
    expect(pose()).toEqual(before);
    view.applySettings({ ...DEFAULT_SETTINGS, quality: 'low', reducedMotion: true });
    frame(60_000);
    expect(pose()).toEqual(before);
    view.applySettings({ ...DEFAULT_SETTINGS, quality: 'low' });
    frame();
    expect(Math.abs(boats[0]!.position.x - before[0]!.position[0]!)).toBeLessThanOrEqual(
      0.012 + 1e-8,
    );
    expect(pose()).not.toEqual(before);
  });

  it('repaints a still welcome view at the existing paused cadence and resumes animated drawing', () => {
    const { view, frame } = studio();
    const render = vi.mocked(view.scene.render);
    for (const mode of ['reduced', 'paused'] as const) {
      view.applySettings({
        ...DEFAULT_SETTINGS,
        quality: 'low',
        reducedMotion: mode === 'reduced',
      });
      view.setPaused(mode === 'paused');
      render.mockClear();
      for (let tick = 0; tick < 60; tick++) frame(1000 / 60);
      expect(render.mock.calls.length).toBeGreaterThan(3);
      expect(render.mock.calls.length).toBeLessThanOrEqual(10);
    }
    view.applySettings({ ...DEFAULT_SETTINGS, quality: 'low' });
    view.setPaused(false);
    render.mockClear();
    for (let tick = 0; tick < 60; tick++) frame(1000 / 60);
    expect(render).toHaveBeenCalledTimes(60);
  });

  it('redraws a still backdrop immediately after foreground return without treating idle time as GPU work', () => {
    const { view, frame, boats } = studio();
    view.applySettings({ ...DEFAULT_SETTINGS, quality: 'low', reducedMotion: true });
    const pose = boats.map((boat) => boat.position.asArray());
    const render = vi.mocked(view.scene.render);
    render.mockClear();
    // No engine callbacks arrive during a background minute. Runtime invalidates on return.
    view.refreshFrame();
    frame(60_000);
    expect(render).toHaveBeenCalledOnce();
    expect(boats.map((boat) => boat.position.asArray())).toEqual(pose);
    render.mockClear();
    for (let tick = 0; tick < 60; tick++) frame(1000 / 60);
    expect(render.mock.calls.length).toBeGreaterThan(3);
    expect(render.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('releases a title that fails to become ready and allows the next attempt', async () => {
    const { runtime, canvas } = runtimeStudio();
    vi.spyOn(TitleView.prototype, 'load')
      .mockRejectedValueOnce(new Error('Title readiness failed'))
      .mockResolvedValue(undefined);
    await expect(runtime.showTitle()).rejects.toThrow('Title readiness failed');
    expect(engine.scenes).toHaveLength(0);
    expect(canvas.dataset.title).toBeUndefined();
    await runtime.showTitle();
    expect(engine.scenes).toHaveLength(1);
    expect(canvas.dataset.title).toBe('true');
    runtime.dispose();
    expect(engine.scenes).toHaveLength(0);
    expect(canvas.dataset.title).toBeUndefined();
  });

  it('shares an unfinished title load instead of allocating overlapping scenes', async () => {
    const { runtime } = runtimeStudio();
    const { finish, loading } = pendingReady();
    const first = runtime.showTitle();
    const second = runtime.showTitle();
    try {
      expect(engine.scenes).toHaveLength(1);
      expect(loading).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await Promise.allSettled([first, second]);
    }
    expect(engine.scenes).toHaveLength(1);
    await runtime.showTitle();
    expect(engine.scenes).toHaveLength(1);
    runtime.dispose();
    expect(engine.scenes).toHaveLength(0);
  });

  it('uses the preferences chosen while its scene is still loading', async () => {
    const { runtime } = runtimeStudio();
    const { finish } = pendingReady();
    const preferences = vi.spyOn(TitleView.prototype, 'applySettings');
    const task = runtime.showTitle();
    const latest = { ...DEFAULT_SETTINGS, quality: 'low' as const, reducedMotion: true };
    runtime.applySettings(latest);
    finish();
    await task;
    expect(preferences).toHaveBeenLastCalledWith(latest);
    runtime.dispose();
    expect(engine.scenes).toHaveLength(0);
  });

  it('settles real scene readiness when an unfinished title is disposed', async () => {
    const { view } = studio();
    vi.spyOn(view.scene, 'whenReadyAsync').mockReturnValue(new Promise(() => {}));
    const task = view.load();
    const cancelled = expect(task).rejects.toThrow('Title loading was cancelled');
    expect(view.scene.onDisposeObservable.observers).toHaveLength(1);
    view.dispose();
    await cancelled;
    view.dispose();
    expect(engine.scenes).toHaveLength(0);
    expect(view.scene.onDisposeObservable.observers).toHaveLength(0);
  });

  it('retires an unfinished backdrop when the runtime closes without publishing it later', async () => {
    const { runtime, canvas } = runtimeStudio();
    const { finish } = pendingReady();
    const task = runtime.showTitle();
    expect(engine.scenes).toHaveLength(1);
    runtime.dispose();
    expect(engine.scenes).toHaveLength(0);
    finish();
    await task;
    expect(engine.scenes).toHaveLength(0);
    expect(canvas.dataset.title).toBeUndefined();
    await runtime.showTitle();
    expect(engine.scenes).toHaveLength(0);
  });

  it('lets the first region retire an unfinished backdrop without waiting for title readiness', async () => {
    const { runtime, canvas } = runtimeStudio();
    vi.spyOn(Scene.prototype, 'whenReadyAsync').mockReturnValue(new Promise(() => {}));
    const title = runtime.showTitle();
    const titleScene = engine.scenes[0]!;
    const scene = new Scene(engine);
    const region = {
      scene,
      load: vi.fn().mockResolvedValue(undefined),
      update: vi.fn(),
      applySettings: vi.fn(),
      activate: vi.fn(),
      setPaused: vi.fn(),
      dispose: () => scene.dispose(),
    };
    // Keep region construction out of this ownership check; load commits a real Babylon scene.
    vi.spyOn(worlds, 'World').mockImplementation(function () {
      return region as unknown as worlds.World;
    });
    await runtime.load(newGame(), () => {});
    await title;
    expect(titleScene.isDisposed).toBe(true);
    expect(scene.isDisposed).toBe(false);
    expect(engine.scenes).toEqual([scene]);
    expect(region.activate).toHaveBeenCalledOnce();
    expect(canvas.dataset.region).toBe('capernaum');
    expect(canvas.dataset.title).toBeUndefined();
    await runtime.showTitle();
    expect(engine.scenes).toEqual([scene]);
    runtime.dispose();
    expect(engine.scenes).toHaveLength(0);
  });
});
