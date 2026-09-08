import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { GameState, Point, Settings } from '../game/types';
import { regions } from '../content/regions';
import type { RegionId } from '../game/episode/types';
import { World, type WorldCallbacks } from './world';
import { LakeRegion } from './regions/lake';
import type { RegionView } from './regions/types';

export interface Diagnostics {
  region: RegionId | null;
  meshes: number;
  materials: number;
  textures: number;
  activeMeshes: number;
  fps: number;
  drawCalls: number;
  scenes: number;
}
/** One engine, one render loop, transactional replacement of disposable region scenes. */
export class GameRuntime {
  readonly engine: Engine;
  private view?: RegionView;
  private instrumentation?: SceneInstrumentation;
  private region?: RegionId;
  private settings?: Settings;
  private paused = true;
  private disposed = false;
  private switching = false;
  private diagnosticTimer = 0;
  private resize: () => void;
  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: WorldCallbacks,
  ) {
    this.engine = new Engine(
      canvas,
      true,
      { stencil: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' },
      false,
    );
    if (this.engine.webGLVersion < 2) {
      this.engine.dispose();
      throw new Error(
        'The Way needs WebGL 2. Please use a current browser with hardware acceleration enabled.',
      );
    }
    this.engine.renderEvenInBackground = false;
    this.resize = () => this.engine.resize();
    window.addEventListener('resize', this.resize);
    this.engine.runRenderLoop(() => {
      this.view?.renderFrame();
      if (import.meta.env.DEV && performance.now() - this.diagnosticTimer > 1000) {
        this.diagnosticTimer = performance.now();
        this.canvas.dataset.diagnostics = JSON.stringify(this.diagnostics());
      }
    });
  }
  async load(state: GameState, progress: (message: string) => void): Promise<void> {
    if (this.disposed) throw new Error('The game has been closed.');
    if (this.switching) throw new Error('A region is already being opened.');
    if (this.region === state.region && this.view) {
      this.update(state);
      if (this.view instanceof World) this.view.setPosition(state.position, true);
      return;
    }
    this.switching = true;
    const prior = this.view;
    prior?.deactivate();
    let candidate: RegionView | undefined;
    try {
      const definition = regions[state.region];
      progress('Opening ' + definition.title + '…');
      candidate =
        definition.mode === 'exploration'
          ? new World(this.canvas, this.callbacks, this.engine)
          : new LakeRegion(this.engine, state);
      await candidate.load(progress);
      if (this.disposed) throw new Error('Region loading was cancelled.');
      candidate.update(state);
      if (candidate instanceof World) candidate.setPosition(state.position, true);
      if (this.settings) candidate.applySettings(this.settings);
      this.instrumentation?.dispose();
      this.instrumentation = new SceneInstrumentation(candidate.scene);
      this.view = candidate;
      this.region = state.region;
      prior?.dispose();
      candidate.activate();
      candidate.setPaused(this.paused);
      this.canvas.dataset.region = state.region;
      this.canvas.dataset.worldStage = state.episode.stage;
      this.canvas.setAttribute(
        'aria-label',
        definition.mode === 'exploration'
          ? 'Capernaum game world. Click to walk; use WASD or arrow keys to move.'
          : 'A narrated view of the lake. Use the scene controls to read and continue.',
      );
    } catch (error) {
      candidate?.dispose();
      this.view = prior;
      prior?.activate();
      prior?.setPaused(this.paused);
      throw error;
    } finally {
      this.switching = false;
    }
  }
  update(state: GameState): void {
    this.view?.update(state);
    this.canvas.dataset.worldStage = state.episode.stage;
    this.canvas.dataset.checkpoint = state.episode.checkpoint ?? '';
    this.canvas.dataset.carrying = state.episode.carrying ?? '';
  }
  setPaused(value: boolean): void {
    this.paused = value;
    this.view?.setPaused(value);
  }
  getPosition(): Point {
    return this.view?.getPosition() ?? { x: -1, z: -3 };
  }
  applySettings(settings: Settings): void {
    this.settings = { ...settings };
    // Low quality still resolves at least one pixel per CSS pixel on a phone.
    this.engine.setHardwareScalingLevel(
      settings.quality === 'low'
        ? window.innerWidth < 700
          ? 1
          : 1.5
        : 1 / Math.min(window.devicePixelRatio, 1.5),
    );
    this.view?.applySettings(settings);
    this.engine.resize();
  }
  navigate(id: string): void {
    if (this.view instanceof World) this.view.navigate(id);
  }
  nearest(): ReturnType<World['nearest']> {
    return this.view instanceof World ? this.view.nearest() : undefined;
  }
  rotate(direction: number): void {
    if (this.view instanceof World) this.view.rotate(direction);
  }
  zoom(direction: number): void {
    if (this.view instanceof World) this.view.zoom(direction);
  }
  resetCamera(): void {
    if (this.view instanceof World) this.view.resetCamera();
  }
  performInteraction(): void {
    if (this.view instanceof World) this.view.performInteraction();
  }
  diagnostics(): Diagnostics {
    const scene = this.view?.scene;
    return {
      region: this.region ?? null,
      meshes: scene?.meshes.length ?? 0,
      materials: scene?.materials.length ?? 0,
      textures: scene?.textures.length ?? 0,
      activeMeshes: scene?.getActiveMeshes().length ?? 0,
      fps: Math.round(this.engine.getFps()),
      drawCalls: this.instrumentation?.drawCallsCounter.current ?? 0,
      scenes: this.engine.scenes.length,
    };
  }
  dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    this.engine.stopRenderLoop();
    this.instrumentation?.dispose();
    this.view?.dispose();
    this.engine.dispose();
  }
}
