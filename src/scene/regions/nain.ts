import type { ScreenRect } from '../../game/presence';
import { applyCameraPose, frameSubject } from '../presentation/framing';
import { backdropTerrain, paintGround, wornPaths } from '../presentation/ground';
import { StageEnvironment } from '../environment/stage';
import { GroundCover } from '../environment/cover';
import { environmentFor } from '../../content/environment';
import { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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
  private readingBounds?: ScreenRect;
  private last = 0;
  private paused = true;
  private reduced = false;
  private low = false;
  private stage: StageEnvironment;
  private cover?: GroundCover;
  private coverQuality?: 'high' | 'low';
  constructor(
    private engine: Engine,
    state: GameState,
  ) {
    this.state = structuredClone(state);
    this.scene = new Scene(engine);
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
    this.stage = new StageEnvironment(this.scene, this.camera, environmentFor('nain-account'), {
      sky: 120,
      horizon: { center: { x: 0, z: 6 }, radius: 60, seed: 31 },
      shadowCenter: new Vector3(0, 0, 2),
    });
    this.library = new AssetLibrary(this.scene, this.stage.shadow);
    const floor = MeshBuilder.CreateGround(
      'nain-earth',
      { width: 70, height: 70, subdivisions: 70 },
      this.scene,
    );
    floor.material = this.stage.material('nain-earth-matte', '#ffffff');
    paintGround(floor, 'dry');
    floor.receiveShadows = true;
    floor.isPickable = false;
    wornPaths(this.scene, 'gate-road', [
      [{ x: 0, z: -20 }, { x: 0, z: 6 }, 4.2],
      [{ x: 0, z: 6 }, { x: 0.8, z: 22 }, 3],
    ]);
    backdropTerrain(this.scene, {
      reserve: { minX: -20, maxX: 20, minZ: -20, maxZ: 22 },
      size: 200,
      style: 'dry',
    });
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
    this.cover = new GroundCover(this.library, {
      radius: 20,
      seed: 13,
      height: () => 0,
      pathDistance: (p) => Math.abs(p.x) - 2.2,
      allowed: (p) => p.z < 4.8 || Math.abs(p.x) > 13.5,
    });
    this.compose();
    await this.scene.whenReadyAsync();
  }
  update(state: GameState): void {
    if (this.state.road.chapter.checkpoint !== state.road.chapter.checkpoint) this.time = 0;
    this.state = structuredClone(state);
    this.compose();
  }
  private face(actor: Actor, target: Point): void {
    actor.face(target);
  }
  private compose(): void {
    if (!this.frame) return;
    const id = this.state.road.chapter.checkpoint ?? 'approach',
      c = compositions[id];
    const canvas = this.engine.getRenderingCanvas()!;
    applyCameraPose(
      this.camera,
      frameSubject(
        this.camera,
        canvas.clientWidth,
        canvas.clientHeight,
        Vector3.FromArray(c.target),
        c.radius * Math.tan(this.camera.fov / 2) * 0.58,
        c.alpha,
        c.beta,
        this.readingBounds,
      ),
    );
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
  get atmosphere(): string {
    return this.stage.label;
  }
  setReadingBounds(rect?: ScreenRect): void {
    this.readingBounds = rect;
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
    this.compose();
    this.engine.getRenderingCanvas()!.dataset.nainTime =
      this.state.road.chapter.checkpoint + ':' + this.time.toFixed(2);
    this.stage.setView(this.camera.target);
    this.stage.tick(dt, !this.paused);
    this.scene.render();
  }
  getPosition(): Point {
    return { ...this.state.position };
  }
  applySettings(s: Settings): void {
    this.reduced = s.reducedMotion;
    this.low = s.quality === 'low';
    this.stage.applySettings(s);
    const quality = s.quality === 'low' ? 'low' : 'high';
    if (this.cover && this.coverQuality !== quality) {
      this.coverQuality = quality;
      this.cover.build(quality);
    }
    this.compose();
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
    this.cover?.dispose();
    this.library.dispose();
    this.stage.dispose();
    this.scene.dispose();
  }
}
