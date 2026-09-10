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
import type { GameState, Point, Settings } from '../../game/types';
import { NAIN_ASSETS, type ActorAsset, type ActorClip } from '../../content/assets';
import type { NainSceneId } from '../../game/road/types';
import { AssetLibrary, type Model } from '../assets';
import { Actor } from '../actors/actor';
import type { RegionView } from './types';

interface Composition {
  alpha: number;
  beta: number;
  radius: number;
  target: [number, number, number];
}
const compositions: Record<NainSceneId, Composition> = {
  approach: { alpha: -1.05, beta: 0.83, radius: 23, target: [0, 1, 0] },
  procession: { alpha: -1.1, beta: 0.9, radius: 16, target: [0, 1, 1] },
  compassion: { alpha: -1.5, beta: 0.92, radius: 14, target: [-1, 1, 0] },
  command: { alpha: -1.15, beta: 0.95, radius: 14, target: [0, 1, 0] },
  restored: { alpha: -1.15, beta: 0.9, radius: 15, target: [-0.5, 1, 0] },
  wonder: { alpha: -1.1, beta: 0.82, radius: 20, target: [0, 1, 0] },
};
/** Each checkpoint owns a complete tableau. Motion illustrates text and never awards progress. */
export class NainRegion implements RegionView {
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private library: AssetLibrary;
  private actors = new Map<string, Actor>();
  private frame!: Model;
  private state: GameState;
  private time = 0;
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
    this.scene.clearColor = new Color4(0.72, 0.78, 0.73, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = new ArcRotateCamera(
      'nain-camera',
      -1.1,
      0.85,
      22,
      new Vector3(0, 1, 0),
      this.scene,
    );
    this.camera.minZ = 0.1;
    this.camera.maxZ = 100;
    const sky = new HemisphericLight('gate-sky', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.72;
    sky.groundColor = new Color3(0.4, 0.35, 0.24);
    const sun = new DirectionalLight('gate-light', new Vector3(0.5, -1.4, 0.8), this.scene);
    sun.position.set(-12, 22, -12);
    sun.intensity = 0.68;
    const shadow = new ShadowGenerator(1024, sun);
    shadow.usePercentageCloserFiltering = true;
    shadow.bias = 0.003;
    shadow.normalBias = 0.04;
    this.library = new AssetLibrary(this.scene, shadow);
    const floor = MeshBuilder.CreateGround('nain-earth', { width: 70, height: 70 }, this.scene);
    const mat = new StandardMaterial('nain-earth-matte', this.scene);
    mat.diffuseColor = Color3.FromHexString('#c7bd91').toLinearSpace();
    mat.specularColor = Color3.Black();
    floor.material = mat;
    floor.receiveShadows = true;
    floor.isPickable = false;
    const road = MeshBuilder.CreateGround('gate-road', { width: 5, height: 36 }, this.scene);
    const path = new StandardMaterial('gate-road-matte', this.scene);
    path.diffuseColor = Color3.FromHexString('#dfcea4').toLinearSpace();
    path.specularColor = Color3.Black();
    road.material = path;
    road.position.y = 0.012;
    road.receiveShadows = true;
    road.isPickable = false;
  }
  async load(progress: (message: string) => void): Promise<void> {
    await this.library.load(NAIN_ASSETS, (n, total) =>
      progress(`Preparing At the gate · ${n} of ${total}`),
    );
    this.library.instantiate('town_gate', 'nain-gate').root.position.set(0, 0, 6);
    for (const x of [-12, -9, -6, 6, 9, 12])
      this.library.instantiate('low_wall', 'town-wall').root.position.set(x, 0, 6);
    for (const [x, z] of [
      [-7, 11],
      [7, 12],
      [-4, 17],
      [5, 18],
    ]) {
      const house = this.library.instantiate('house', 'town-house');
      house.root.position.set(x!, 0, z!);
      house.root.rotation.y = Math.PI;
    }
    for (const [x, z] of [
      [-9, -3],
      [10, 3],
    ])
      this.library.instantiate('olive', 'gate-olive').root.position.set(x!, 0, z!);
    this.frame = this.library.instantiate('procession_frame', 'procession-frame');
    const make = (id: string, asset: ActorAsset) => {
      const actor = new Actor(this.library.instantiate(asset, id));
      this.actors.set(id, actor);
    };
    make('jesus', 'jesus');
    make('mother', 'widow');
    make('son', 'young_man');
    for (let i = 0; i < 4; i++) make('bearer-' + i, 'bearer');
    for (let i = 0; i < 10; i++) make('neighbor-' + i, i % 3 ? 'villager' : 'hannah');
    this.stage();
    await this.scene.whenReadyAsync();
  }
  update(state: GameState): void {
    if (this.state.road.chapter.checkpoint !== state.road.chapter.checkpoint) this.time = 0;
    this.state = structuredClone(state);
    this.stage();
  }
  private face(actor: Actor, target: Point): void {
    actor.face(target);
    // The imported skins' visible front is -Z after the existing model wrapper.
    // Calibrate the tableau to the actual mesh; reclining root poses are separate.
    actor.root.rotation.y += Math.PI;
  }
  private stage(): void {
    if (!this.frame) return;
    const id = this.state.road.chapter.checkpoint ?? 'approach',
      c = compositions[id];
    this.camera.alpha = c.alpha;
    this.camera.beta = c.beta;
    this.camera.target.set(...c.target);
    const canvas = this.engine.getRenderingCanvas()!,
      below = canvas.clientWidth <= 900 && canvas.clientHeight > 540;
    const radius =
      c.radius * (below ? Math.max(1, 0.9 / (canvas.clientWidth / canvas.clientHeight)) : 1);
    if (below)
      this.camera.target.addInPlace(
        new Vector3(
          Math.cos(c.alpha) * Math.cos(c.beta),
          -Math.sin(c.beta),
          Math.sin(c.alpha) * Math.cos(c.beta),
        ).scale(radius * Math.tan(this.camera.fov / 2) * 0.48),
      );
    else
      this.camera.target.addInPlace(
        new Vector3(-Math.sin(c.alpha), 0, Math.cos(c.alpha)).scale(3.2),
      );
    this.camera.radius = radius;
    const approaching = id === 'approach',
      restored = id === 'wonder' || (id === 'restored' && (this.reduced || this.time >= 2.5));
    const z = approaching
      ? 3
      : id === 'procession' && !this.reduced
        ? 1.5 * (1 - Math.min(this.time / 3, 1))
        : 0;
    this.frame.root.position.set(restored ? 3.4 : 0, restored ? 0.08 : 0.84, restored ? 2 : z);
    for (const [name, actor] of this.actors) {
      let clip: ActorClip = 'Idle';
      actor.root.setEnabled(true);
      if (name === 'jesus') {
        actor.root.position.set(
          approaching ? -1.3 : id === 'command' ? -0.95 : -1.35,
          0,
          approaching ? -5 : -0.25,
        );
        this.face(
          actor,
          id === 'compassion'
            ? { x: -2.9, z: 1 }
            : { x: 0, z: id === 'command' ? actor.root.position.z : z },
        );
        clip = id === 'command' ? 'TouchFrame' : id === 'compassion' ? 'Gesture' : 'Idle';
      } else if (name === 'mother') {
        actor.root.position.set(-2.9, 0, approaching ? 2 : 1);
        this.face(actor, { x: restored ? -2 : -1.35, z: restored ? 0.2 : -0.25 });
      } else if (name === 'son') {
        actor.root.rotation.y = 0;
        if (restored) {
          actor.root.position.set(-2, 0, 0.2);
          this.face(actor, { x: -2.9, z: 1 });
        } else if (id === 'restored') {
          const progress = Math.min(this.time / 2, 1);
          const eased = progress * progress * (3 - 2 * progress);
          actor.root.position.set(
            0,
            0.84 + 0.12 * eased - 0.85 * Math.sin((Math.PI / 2) * eased),
            -0.8 + 0.85 * (1 - Math.cos((Math.PI / 2) * eased)),
          );
          actor.sampleAt('SitUp', progress);
          continue;
        } else {
          actor.root.position.set(0, 0.84, z - 0.8);
          clip = 'Recline';
        }
      } else if (name.startsWith('bearer-')) {
        const i = Number(name.split('-')[1]),
          x = i % 2 ? 0.93 : -0.93;
        actor.root.position.set(
          restored ? 3.4 + x : x,
          0,
          (i < 2 ? -0.8 : 0.8) + (restored ? 2 : z),
        );
        this.face(actor, { x: restored ? 3.4 : 0, z: actor.root.position.z });
        clip = restored ? 'Idle' : 'FrameCarry';
      } else {
        const i = Number(name.split('-')[1]),
          town = i < 5;
        actor.root.setEnabled(!this.low || i % 2 === 0);
        actor.root.position.set(
          ((i % 5) - 2) * 1.2,
          0,
          town ? 4 + (i % 2) * 0.8 : -5.5 - (i % 2) * 0.8,
        );
        this.face(actor, { x: -1, z: 0 });
        clip = id === 'wonder' ? 'Gesture' : 'Idle';
      }
      // Idle gestures are sampled from the same bounded clock, including paused/reloaded tableaux.
      actor.sampleAt(
        clip,
        this.reduced || clip === 'FrameCarry' || clip === 'TouchFrame' || clip === 'Recline'
          ? 0
          : (this.time % 2) / 2,
      );
    }
    this.scene.metadata = {
      ...this.scene.metadata,
      nain: { checkpoint: id, restored, time: this.time },
    };
  }
  renderFrame(): void {
    if (document.hidden) {
      this.last = performance.now();
      return;
    }
    const now = performance.now();
    if (this.paused && now - this.last < 100) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    if (!this.paused && !this.reduced) this.time = Math.min(6, this.time + dt);
    this.stage();
    this.engine.getRenderingCanvas()!.dataset.nainTime =
      this.state.road.chapter.checkpoint + ':' + this.time.toFixed(2);
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
  setPaused(value: boolean): void {
    this.paused = value;
    this.last = performance.now();
  }
  activate(): void {
    this.last = performance.now();
  }
  deactivate(): void {
    this.paused = true;
  }
  dispose(): void {
    this.library.dispose();
    this.scene.dispose();
  }
}
