import { lakeCompositions, type LakeComposition } from '../../content/episode/composition';
import type { ScreenRect } from '../../game/presence';
import { frameSubject } from '../presentation/framing';
import { boatSupport } from '../actors/boat';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { fitOar, handGrip } from '../presentation/attachments';
import { backdropTerrain, groundMosaic, shorelineBank } from '../presentation/ground';
import { StageEnvironment } from '../environment/stage';
import { GroundCover } from '../environment/cover';
import { environmentFor } from '../../content/environment';
import { WaterPresentation } from '../presentation/water';
import { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GameState, Point, Settings } from '../../game/types';
import { LAKE_ASSETS, type ActorAsset } from '../../content/assets';
import { AssetLibrary, type Model } from '../assets';
import { Actor } from '../actors/actor';
import type { RegionView } from './types';

/** Disposable presentation region. No spatial player input, physics or quest rewards. */
export class LakeRegion implements RegionView {
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private library: AssetLibrary;
  private shadow: ShadowGenerator;
  private stage: StageEnvironment;
  private cover?: GroundCover;
  private coverQuality?: 'high' | 'low';
  private boats: Model[] = [];
  private actors = new Map<string, Actor>();
  private extras: Actor[] = [];
  private oars: TransformNode[] = [];
  private nets = new Map<string, Model>();
  private netCords?: LinesMesh;
  private shoreNets: Model[] = [];
  private cargo: Model[] = [];
  private water!: WaterPresentation;
  private paused = true;
  private reduced = false;
  private current?: LakeComposition;
  private readingBounds?: ScreenRect;
  private checkpoint = '';
  private last = 0;
  private time = 0;
  private shorePosition: Point;
  private disposed = false;
  private dirty = true;
  private entrance = 0;
  private startingBoatPositions: Vector3[] = [];
  private startCamera?: { target: Vector3; radius: number; alpha: number; beta: number };
  constructor(
    private engine: Engine,
    state: GameState,
  ) {
    this.shorePosition = { ...state.position };
    this.scene = new Scene(engine);
    this.scene.skipPointerMovePicking = true;
    this.camera = new ArcRotateCamera(
      'lake-camera',
      -1.1,
      0.85,
      20,
      new Vector3(-8, 0.5, 1),
      this.scene,
    );
    this.camera.fov = 0.65;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 160;
    this.stage = new StageEnvironment(this.scene, this.camera, environmentFor('lake-gennesaret'), {
      sky: 150,
      horizon: { center: { x: 8, z: 4 }, radius: 70, seed: 5 },
      ground: (x) => (x < -12 ? 0 : -0.16),
    });
    this.shadow = this.stage.shadow;
    this.library = new AssetLibrary(this.scene, this.shadow);
    this.environment();
  }
  private material(name: string, hex: string, alpha = 1): StandardMaterial {
    return this.stage.material(name, hex, alpha);
  }
  private environment(): void {
    this.water = new WaterPresentation(this.scene, {
      name: 'open-water',
      width: 160,
      depth: 160,
      x: 25,
      z: 5,
      y: -0.16,
      shore: -12,
    });
    this.stage.attachWater(this.water);
    const shore = MeshBuilder.CreateGround('distant-shore', { width: 30, height: 100 }, this.scene);
    shore.position.set(-27, 0.01, 0);
    shore.material = this.material('shore-sand', '#ffffff');
    const sand = Color3.FromHexString('#c6b99b').toLinearSpace();
    shore.setVerticesData(
      'color',
      Array.from({ length: shore.getTotalVertices() }, () => [sand.r, sand.g, sand.b, 1]).flat(),
    );
    shore.receiveShadows = true;
    shore.isPickable = false;
    shorelineBank(this.scene, 'lake-shore-bank', () => -12, -40, 40);
    groundMosaic(
      this.scene,
      'lake-shore-earth',
      { min: -40, max: 40 },
      (p) => p.x < -13,
      () => 0.01,
      false,
      ['#c5b89b', '#c7ba9c', '#c6b99a', '#c7b99b'],
    );
    backdropTerrain(this.scene, {
      reserve: { minX: -42, maxX: 60, minZ: -40, maxZ: 40 },
      size: 220,
      style: 'shore',
      water: (p) => p.x > -13,
    });
  }
  async load(progress: (message: string) => void): Promise<void> {
    await this.library.load(LAKE_ASSETS, (loaded, total) =>
      progress('Opening a view of the lake · ' + loaded + ' of ' + total),
    );
    for (let i = 0; i < 2; i++) {
      const boat = this.library.instantiate('boat', 'lake-boat-' + i);
      boat.root.scaling.set(1.35, 1, 1.25);
      boatSupport(boat.root, 'lake-forward-seat-' + i, 1.15, 0.25, 0.59, 1.05);
      boatSupport(boat.root, 'lake-rear-seat-' + i, 1.15, 0.25, 0.59, -0.65);
      this.boats.push(boat);
      for (const [side, x] of [
        ['left', -1],
        ['right', 1],
      ] as const) {
        const oar = this.library.instantiate('oar', 'boat-' + i + '-oar-' + side);
        oar.root.parent = boat.root;
        oar.root.position.set(x * 0.9, 0.65, 0);
        oar.root.rotation.y = (x * Math.PI) / 2;
        this.oars.push(oar.root);
      }
      for (let j = 0; j < 3; j++) {
        const cargo = this.library.instantiate('basket_fish', 'boat-' + i + '-catch-' + j);
        cargo.root.parent = boat.root;
        // Bow/stern wells and the spare side leave the actors' feet and knees clear.
        cargo.root.position.set(j === 1 ? -0.42 : 0, 0.1, [-1.45, 0.05, 1.72][j]!);
        cargo.root.scaling.setAll(j === 2 ? 0.45 : 0.55);
        this.cargo.push(cargo);
      }
    }
    const person = (id: ActorAsset, boatIndex: number, z: number, yaw: number) => {
      const actor = new Actor(this.library.instantiate(id, 'lake-' + id));
      actor.root.parent = this.boats[boatIndex]!.root;
      actor.root.position.set(0, 0.22, z);
      // Compensate boat scaling to retain the same human proportions.
      actor.root.scaling.set(1 / 1.35, 1, 1 / 1.25);
      actor.root.rotation.y = yaw;
      this.actors.set(id, actor);
    };
    person('jesus', 0, 1.05, Math.PI);
    person('simon', 0, -0.65, 0);
    person('james', 1, 0.85, Math.PI);
    person('john', 1, -0.65, 0);
    for (const [id, asset] of [
      ['folded', 'net_folded'],
      ['cast', 'net_cast'],
      ['full', 'net_full'],
    ] as const) {
      const model = this.library.instantiate(asset, 'lake-net-' + id);
      model.root.parent = this.boats[0]!.root;
      model.root.position.set(id === 'folded' ? 0.25 : 1.15, id === 'cast' ? 0.05 : 0.55, 0.25);
      this.nets.set(id, model);
    }
    this.netCords = MeshBuilder.CreateLineSystem(
      'net-working-cords',
      {
        lines: [
          [new Vector3(), new Vector3(), new Vector3()],
          [new Vector3(), new Vector3(), new Vector3()],
        ],
        updatable: true,
      },
      this.scene,
    );
    this.netCords.color = Color3.FromHexString('#c4b280');
    this.netCords.isPickable = false;
    this.netCords.parent = this.boats[0]!.root;
    for (const [x, z] of [
      [-12.3, 0],
      [-12.3, 4],
    ]) {
      const net = this.library.instantiate('net_folded', 'shore-washing-net');
      net.root.position.set(x!, 0.03, z!);
      this.shoreNets.push(net);
    }
    for (let i = 0; i < 8; i++) {
      const actor = new Actor(
        this.library.instantiate(i % 3 === 0 ? 'miriam' : 'villager', 'shore-listener-' + i),
      );
      actor.root.position.set(-12.4 - (i % 2) * 1.1, 0, -3.4 + Math.floor(i / 2) * 1.55);
      actor.root.rotation.y = Math.PI / 2;
      this.stage.contact.add(actor.root, 0.4);
      this.extras.push(actor);
    }
    for (let i = 0; i < 8; i++) {
      const rock = this.library.instantiate(i % 3 ? 'rock' : 'reeds', 'lake-edge-' + i);
      rock.root.position.set(-11.7, 0, -10 + i * 3);
      rock.root.scaling.setAll(0.55);
    }
    for (let i = 0; i < 3; i++) {
      const house = this.library.instantiate('house', 'shore-house-' + i);
      house.root.position.set(-18 - (i % 2) * 4, 0, -5 + i * 8);
      house.root.rotation.y = Math.PI;
    }
    const palm = this.library.instantiate('palm', 'shore-palm');
    palm.root.position.set(-14, 0, 7);
    this.cover = new GroundCover(this.library, {
      center: { x: -27, z: 2 },
      radius: 15,
      seed: 9,
      height: () => 0,
      allowed: (p) => p.x < -14.6 && !(p.x > -24.5 && p.x < -15.5 && p.z > -8 && p.z < 13),
    });
    await this.scene.whenReadyAsync();
  }
  update(state: GameState): void {
    this.shorePosition = { ...state.position };
    if (!state.episode.checkpoint || state.episode.checkpoint === this.checkpoint) return;
    this.checkpoint = state.episode.checkpoint;
    this.dirty = true;
    this.current = lakeCompositions[state.episode.checkpoint];
    this.entrance = this.reduced ? 4 : 0;
    this.startingBoatPositions = this.boats.map((boat) => boat.root.position.clone());
    this.startCamera = {
      target: this.camera.target.clone(),
      radius: this.camera.radius,
      alpha: this.camera.alpha,
      beta: this.camera.beta,
    };
    this.time = 0;
    for (const [id, net] of this.nets) net.root.setEnabled(id === this.current.net);
    for (const cargo of this.cargo) cargo.root.setEnabled(this.current.cargo);
    this.actors.get('simon')!.pose(this.current.simon);
    this.actors.get('jesus')!.pose(this.current.jesus);
    this.actors.get('james')!.pose(this.current.partners);
    this.actors.get('john')!.pose(this.current.partners);
    // Every restored checkpoint establishes a complete composition, never an in-between pose.
    if (!this.last || this.reduced) this.entrance = 4;
    this.positionScene(0);
  }
  private positionScene(dt: number): void {
    if (!this.current) return;
    const c = this.current;
    this.entrance = Math.min(4, this.entrance + dt);
    const linear = this.reduced ? 1 : this.entrance / 4;
    const t = linear * linear * (3 - 2 * linear);
    const destinations = [c.boat, c.partner];
    this.boats.forEach((model, i) => {
      // The loaded hull settles, while its actual +0.10 m interior floor stays
      // above the maximum wave even at the low point of the cosmetic bob/roll.
      const target = new Vector3(destinations[i]![0], c.cargo ? -0.2 : -0.16, destinations[i]![1]);
      const from = this.startingBoatPositions[i] ?? target;
      Vector3.LerpToRef(from, target, t, model.root.position);
      if (!this.reduced) {
        model.root.position.y += Math.sin(this.time * 1.1 + i) * 0.022;
        model.root.rotation.z = Math.sin(this.time * 0.65 + i) * 0.012;
      } else model.root.rotation.z = 0;
    });
    const canvas = this.engine.getRenderingCanvas()!;
    const framed = frameSubject(
      this.camera,
      canvas.clientWidth,
      canvas.clientHeight,
      Vector3.FromArray(c.target),
      c.extent,
      c.alpha,
      c.beta,
      this.readingBounds,
    );
    const cameraTarget = framed.target,
      radius = framed.radius;
    if (this.startCamera && t < 1) {
      Vector3.LerpToRef(this.startCamera.target, cameraTarget, t, this.camera.target);
      this.camera.radius = this.startCamera.radius + (radius - this.startCamera.radius) * t;
      this.camera.alpha = this.startCamera.alpha + (c.alpha - this.startCamera.alpha) * t;
      this.camera.beta = this.startCamera.beta + (c.beta - this.startCamera.beta) * t;
    } else {
      // Held compositions breathe very slightly, like the other Gospel accounts' shots.
      const drift = this.reduced ? 0 : 0.012;
      this.camera.target.copyFrom(cameraTarget);
      this.camera.radius = radius * (1 + Math.sin(this.time * 0.13) * drift * 0.6);
      this.camera.alpha = c.alpha + Math.sin(this.time * 0.21) * drift;
      this.camera.beta = c.beta + Math.sin(this.time * 0.17 + 1.3) * drift * 0.5;
    }
    this.stagePeople(t);
    const net = this.nets.get(c.net);
    if (net && c.net !== 'folded') {
      net.root.position.y = c.net === 'cast' ? 0.04 : 0.6;
      if (!this.reduced) net.root.position.y += Math.sin(this.time * 1.2) * 0.08;
    }
    if (this.netCords) {
      const working = c.net === 'cast' || c.net === 'full';
      this.netCords.setEnabled(working);
      if (working && net)
        MeshBuilder.CreateLineSystem(
          'net-working-cords',
          {
            lines: (['left', 'right'] as const).map((side, i) => [
              handGrip(this.actors.get('simon')!, side, this.boats[0]!.root),
              new Vector3(0.86, 0.66, i ? 0.65 : -0.25),
              new Vector3(1.5, net.root.position.y + 0.08, i ? 0.8 : -0.1),
            ]),
            instance: this.netCords,
          },
          this.scene,
        );
    }
    this.stageOars();
    this.water.tick(this.time, this.reduced);
    this.water.setRipples(
      this.boats.map((b) => ({
        x: b.root.position.x,
        z: b.root.position.z,
        radius: 1.9,
        strength: t < 1 ? 0.8 : 0.4,
      })),
    );
    this.scene.metadata = {
      ...this.scene.metadata,
      lake: { checkpoint: this.checkpoint, time: this.time, entrance: t, extent: c.extent },
    };
    canvas.dataset.lakeTime = this.checkpoint + ':' + this.time.toFixed(2);
  }
  private stageOars(): void {
    this.oars.forEach((oar, i) => {
      const boat = this.boats[Math.floor(i / 2)]!.root,
        actor = this.actors.get(i < 2 ? 'simon' : 'john')!;
      const side = i % 2 ? 'right' : 'left',
        sign = i % 2 ? 1 : -1;
      const rowing = actor.playback.clip === 'Row',
        seated = actor.playback.clip === 'Sit';
      if (rowing || seated)
        fitOar(
          oar,
          handGrip(actor, side, boat),
          sign * (Math.PI / 2 + (this.reduced || !rowing ? 0 : Math.sin(this.time * 2.4) * 0.16)),
          0.3,
        );
      else {
        oar.rotation.set(0, 0, 0);
        oar.position.set(sign * 0.48, 0.22, 0);
      }
    });
  }
  private stagePeople(transition: number): void {
    const work = ['lowering', 'abundance', 'partners'].includes(this.checkpoint);
    for (const [id, actor] of this.actors) {
      const boatIndex = id === 'jesus' || id === 'simon' ? 0 : 1;
      const front = id === 'jesus' || id === 'james';
      const returning = this.checkpoint === 'return' && (this.reduced || transition >= 0.8);
      if (this.checkpoint === 'gathering' && id !== 'jesus') {
        actor.root.parent = null;
        actor.root.scaling.setAll(1);
        actor.root.position.set(
          id === 'john' ? -14.1 : -13.1,
          0,
          id === 'simon' ? 0 : id === 'james' ? 3.7 : 4.8,
        );
        actor.face({ x: -11, z: id === 'simon' ? 0 : 4 });
      } else if (returning) {
        actor.root.parent = null;
        actor.root.scaling.setAll(1);
        const index = ['jesus', 'simon', 'james', 'john'].indexOf(id);
        actor.root.position.set(-12.3 - (index % 2) * 1.1, 0, -0.4 + Math.floor(index / 2) * 1.9);
        actor.face({ x: -18, z: 3 });
        actor.pose('Listen');
      } else {
        actor.root.parent = this.boats[boatIndex]!.root;
        actor.root.scaling.set(1 / 1.35, 1, 1 / 1.25);
        const seated = ['Sit', 'Row'].includes(actor.playback.clip);
        actor.root.position.set(
          id === 'simon' && work ? 0.12 : 0,
          seated ? 0.22 : 0.1,
          seated ? (front ? 1.05 : -0.65) : front ? 1.3 : -0.1,
        );
        actor.root.rotation.y = front ? 0 : Math.PI;
        if (id === 'jesus' && ['gathering', 'teaching'].includes(this.checkpoint))
          actor.root.rotation.y = Math.PI / 2;
        if (id === 'simon' && work) {
          actor.root.position.z = 0.25;
          actor.root.rotation.y = -Math.PI / 2;
        }
      }
    }
    this.shoreNets.forEach((net) => net.root.setEnabled(this.checkpoint === 'gathering'));
    this.extras.forEach((actor, i) => {
      actor.root.position.set(
        (this.checkpoint === 'return' ? -15.5 : -12.4) - (i % 2) * 1.1,
        0,
        -3.4 + Math.floor(i / 2) * 1.55,
      );
    });
  }
  get atmosphere(): string {
    return this.stage.label;
  }
  setReadingBounds(rect?: ScreenRect): void {
    this.readingBounds = rect;
    this.dirty = true;
  }
  renderFrame(): void {
    if (this.disposed || document.hidden) return;
    const now = performance.now();
    if (this.paused && !this.dirty && now - this.last < 100) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    if (!this.paused) {
      if (!this.reduced) this.time += dt;
      this.positionScene(dt);
      for (const actor of this.actors.values()) actor.tick(dt, this.reduced);
      for (const actor of this.extras) actor.tick(dt, this.reduced);
    } else this.positionScene(0);
    this.stageOars();
    this.stage.setView(this.camera.target);
    this.stage.tick(dt, !this.paused);
    this.scene.render();
    this.dirty = false;
  }
  applySettings(settings: Settings): void {
    this.reduced = settings.reducedMotion;
    this.water.quality(settings.quality === 'low');
    this.stage.applySettings(settings);
    const quality = settings.quality === 'low' ? 'low' : 'high';
    if (this.cover && this.coverQuality !== quality) {
      this.coverQuality = quality;
      this.cover.build(quality);
    }
    this.extras.forEach((actor, i) => actor.root.setEnabled(settings.quality === 'high' || i < 4));
    if (this.reduced) {
      this.entrance = 4;
      this.positionScene(0);
      for (const actor of this.actors.values()) actor.tick(0, true);
    }
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  getPosition(): Point {
    return { ...this.shorePosition };
  }
  activate(): void {
    this.last = 0;
  }
  deactivate(): void {
    this.paused = true;
  }
  dispose(): void {
    this.disposed = true;
    this.deactivate();
    for (const actor of [...this.actors.values(), ...this.extras]) actor.dispose();
    this.water.dispose();
    this.cover?.dispose();
    this.library.dispose();
    this.stage.dispose();
    this.scene.dispose();
  }
}
