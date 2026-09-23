import type { ScreenRect } from '../../game/presence';
import { applyCameraPose, frameSubject } from '../presentation/framing';
import { WaterPresentation } from '../presentation/water';
import { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GameState, Point, Settings } from '../../game/types';
import type { ActorClip, AssetId } from '../../content/assets';
import { AssetLibrary, type Model } from '../assets';
import { Actor } from '../actors/actor';
import { boatSupport } from '../actors/boat';
import type { RegionView } from './types';

export const STORM_ASSETS: readonly AssetId[] = [
  'boat',
  'oar',
  'boat_cushion',
  'jesus',
  'simon',
  'john',
  'rock',
  'cove_headland',
];
/** Seven independently restorable, user-paced tableaux. No steering or progress callbacks. */
export class StormRegion implements RegionView {
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private library: AssetLibrary;
  private state: GameState;
  private boat!: Model;
  private others: Model[] = [];
  private actors: Actor[] = [];
  private oars: TransformNode[] = [];
  private water: WaterPresentation;
  private flood: Mesh;
  private sea: StandardMaterial;
  private time = 0;
  private readingBounds?: ScreenRect;
  private last = 0;
  private paused = true;
  private reduced = false;
  private low = false;
  constructor(
    private engine: Engine,
    state: GameState,
  ) {
    this.state = structuredClone(state);
    this.scene = new Scene(engine);
    this.scene.skipPointerMovePicking = true;
    this.camera = new ArcRotateCamera(
      'storm-camera',
      -1.05,
      0.9,
      16,
      new Vector3(0, 0.8, 0),
      this.scene,
    );
    this.camera.minZ = 0.1;
    this.camera.maxZ = 150;
    const sky = new HemisphericLight('evening-sky', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.8;
    const sun = new DirectionalLight('evening-light', new Vector3(0.4, -1, 0.6), this.scene);
    sun.position.set(-12, 20, -12);
    sun.intensity = 0.55;
    const shadows = new ShadowGenerator(1024, sun);
    shadows.usePercentageCloserFiltering = true;
    shadows.normalBias = 0.04;
    this.library = new AssetLibrary(this.scene, shadows);
    this.sea = this.material('storm-sea', '#6098a5');
    this.water = new WaterPresentation(this.scene, {
      name: 'storm-water',
      width: 150,
      depth: 150,
      y: -0.2,
      storm: true,
    });
    this.flood = MeshBuilder.CreateGround(
      'water-inside-hull',
      { width: 0.85, height: 2.2 },
      this.scene,
    );
    this.flood.material = this.sea;
    this.flood.isPickable = false;
  }
  private material(name: string, hex: string): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
    m.specularColor = Color3.Black();
    return m;
  }
  async load(progress: (message: string) => void): Promise<void> {
    await this.library.load(STORM_ASSETS, (n, total) =>
      progress(`Preparing Peace, be still · ${n} of ${total}`),
    );
    this.boat = this.library.instantiate('boat', 'gospel-storm-boat');
    this.boat.root.scaling.set(1.45, 1, 1.7);
    boatSupport(this.boat.root, 'stern-platform', 0.65, 1.35, 0.53, 0.6);
    boatSupport(this.boat.root, 'storm-forward-seat', 1.15, 0.25, 0.58, -1.05);
    boatSupport(this.boat.root, 'storm-middle-seat', 1.15, 0.25, 0.58, -0.2);
    this.flood.parent = this.boat.root;
    this.flood.position.y = 0.39;
    const cushion = this.library.instantiate('boat_cushion', 'stern-cushion').root;
    cushion.parent = this.boat.root;
    cushion.position.set(0, 0.57, 1.05);
    cushion.scaling.y = 0.4;
    for (const [i, asset] of (['jesus', 'simon', 'john'] as const).entries()) {
      const actor = new Actor(this.library.instantiate(asset, 'storm-' + asset));
      actor.root.parent = this.boat.root;
      actor.root.scaling.set(1 / 1.45, 1, 1 / 1.7);
      actor.root.position.set(0, 0.2, i === 0 ? 1.1 : i === 1 ? -0.8 : 0.25);
      this.actors.push(actor);
    }
    for (const side of [-1, 1]) {
      const oar = this.library.instantiate('oar', 'storm-oar-' + side).root;
      oar.parent = this.boat.root;
      oar.position.set(side * 0.7, 0.65, -0.5);
      oar.rotation.y = (side * Math.PI) / 2;
      this.oars.push(oar);
    }
    for (let i = 0; i < 2; i++) {
      const boat = this.library.instantiate('boat', 'other-small-boat-' + i);
      boat.root.position.set(i ? 7 : -8, -0.12, 8 + i * 2);
      boat.root.rotation.y = -0.2;
      this.others.push(boat);
    }
    for (let i = 0; i < 4; i++) {
      const rock = this.library.instantiate(
        i === 2 ? 'cove_headland' : 'rock',
        'distant-storm-shore-' + i,
      ).root;
      rock.position.set(-25 + i * 15, -0.1, 28);
      rock.scaling.setAll(2);
    }
    this.stage();
    await this.scene.whenReadyAsync();
  }
  private stage(): void {
    if (!this.boat) return;
    const id = this.state.lake.chapter.checkpoint ?? 'evening';
    const rough = ['storm', 'waking'].includes(id)
      ? 1
      : id === 'command'
        ? this.reduced
          ? 0
          : 1 - Math.min(this.time / 3, 1)
        : 0;
    this.scene.clearColor = Color4.Lerp(
      new Color4(0.65, 0.74, 0.75, 1),
      new Color4(0.28, 0.36, 0.43, 1),
      rough,
    );
    this.sea.diffuseColor = Color3.Lerp(
      Color3.FromHexString('#6098a5').toLinearSpace(),
      Color3.FromHexString('#3c586b').toLinearSpace(),
      rough,
    );
    this.boat.root.position.set(
      0,
      -0.12 + (this.reduced ? 0 : Math.sin(this.time * 1.5) * 0.045 * rough),
      0,
    );
    this.boat.root.rotation.z = this.reduced ? 0 : Math.sin(this.time * 1.5) * 0.045 * rough;
    this.flood.setEnabled(rough > 0.05);
    const sleeping = ['evening', 'boats', 'storm', 'waking'].includes(id);
    this.actors.forEach((a, i) => {
      const clip: ActorClip =
        i === 0
          ? sleeping
            ? 'Recline'
            : id === 'command'
              ? 'Gesture'
              : 'Idle'
          : id === 'waking' && i === 2
            ? 'Kneel'
            : 'Sit';
      a.root.position.set(
        0,
        i === 0 ? (sleeping ? 0.7 : 0.57) : 0.2,
        i === 0 ? (sleeping ? 0.05 : 0.7) : i === 1 ? -1.05 : -0.2,
      );
      a.root.rotation.y = i === 0 && !sleeping ? Math.PI : 0;
      a.sampleAt(clip, this.reduced || sleeping || clip === 'Sit' ? 0 : (this.time % 2) / 2);
    });
    this.water.setStorm(rough);
    this.water.quality(this.low);
    this.water.tick(this.time, this.reduced);
    this.others.forEach((b) => b.root.setEnabled(id !== 'waking'));
    const alpha = id === 'waking' ? -1.5 : -1.05,
      beta = 0.9;
    const canvas = this.engine.getRenderingCanvas()!;
    const extent = id === 'waking' ? 2.45 : id === 'command' ? 3 : id === 'question' ? 5 : 4.2;
    applyCameraPose(
      this.camera,
      frameSubject(
        this.camera,
        canvas.clientWidth,
        canvas.clientHeight,
        new Vector3(0, 0.7, 0),
        extent,
        alpha,
        beta,
        this.readingBounds,
      ),
    );
    this.scene.metadata = {
      ...this.scene.metadata,
      storm: { checkpoint: id, rough, time: this.time },
    };
  }
  update(state: GameState): void {
    if (this.state.lake.chapter.checkpoint !== state.lake.chapter.checkpoint) this.time = 0;
    this.state = structuredClone(state);
    this.stage();
  }
  setReadingBounds(rect?: ScreenRect): void {
    this.readingBounds = rect;
  }
  renderFrame(): void {
    const now = performance.now();
    if (document.hidden) {
      this.last = now;
      return;
    }
    if (this.paused && now - this.last < 100) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    if (!this.paused && !this.reduced) this.time += dt;
    this.stage();
    this.engine.getRenderingCanvas()!.dataset.stormTime =
      this.state.lake.chapter.checkpoint + ':' + this.time.toFixed(2);
    this.scene.render();
  }
  getPosition(): Point {
    return { ...this.state.position };
  }
  applySettings(s: Settings): void {
    this.reduced = s.reducedMotion;
    this.low = s.quality === 'low';
    this.scene.shadowsEnabled = !this.low;
    this.stage();
  }
  setPaused(v: boolean): void {
    this.paused = v;
    this.last = performance.now();
  }
  activate(): void {
    this.last = performance.now();
  }
  deactivate(): void {
    this.paused = true;
  }
  dispose(): void {
    this.water.dispose();
    this.library.dispose();
    this.scene.dispose();
  }
}
