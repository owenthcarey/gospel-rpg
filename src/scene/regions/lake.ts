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
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GameState, Point, Settings } from '../../game/types';
import { beatFor, type Staging } from '../../content/episode/scenes';
import { LAKE_ASSETS, type ActorAsset, type ActorClip } from '../../content/assets';
import { AssetLibrary, type Model } from '../assets';
import { Actor } from '../actors/actor';
import type { RegionView } from './types';

interface Composition {
  boat: [number, number];
  partner: [number, number];
  target: [number, number, number];
  radius: number;
  alpha: number;
  beta: number;
  simon: ActorClip;
  jesus: ActorClip;
  partners: ActorClip;
  net: 'none' | 'folded' | 'cast' | 'full';
  cargo: boolean;
}
const compositions: Record<Staging, Composition> = {
  shore: {
    boat: [-7, 0],
    partner: [-6, 6],
    target: [-8, 0.5, 1],
    radius: 20,
    alpha: -1.1,
    beta: 0.85,
    simon: 'Idle',
    jesus: 'Sit',
    partners: 'Idle',
    net: 'folded',
    cargo: false,
  },
  teaching: {
    boat: [-5, 0],
    partner: [-6, 6],
    target: [-6, 0.8, 1],
    radius: 17,
    alpha: -1.05,
    beta: 0.9,
    simon: 'Sit',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'folded',
    cargo: false,
  },
  rowing: {
    boat: [0, 0],
    partner: [-5, 6],
    target: [0, 0.6, 1],
    radius: 16,
    alpha: -0.9,
    beta: 0.9,
    simon: 'Row',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'folded',
    cargo: false,
  },
  lowering: {
    boat: [1, 1],
    partner: [-4, 7],
    target: [1, 0.4, 1],
    radius: 14,
    alpha: -0.8,
    beta: 0.82,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'cast',
    cargo: false,
  },
  catch: {
    boat: [1, 1],
    partner: [-3, 6],
    target: [1.4, 0.5, 1],
    radius: 14,
    alpha: -0.8,
    beta: 0.83,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Gesture',
    net: 'full',
    cargo: false,
  },
  partners: {
    boat: [1, 1],
    partner: [3.5, 2],
    target: [2.3, 0.6, 1.6],
    radius: 16,
    alpha: -0.8,
    beta: 0.85,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Haul',
    net: 'full',
    cargo: true,
  },
  kneeling: {
    boat: [1, 1],
    partner: [3.5, 2],
    target: [1, 0.9, 1],
    radius: 12,
    alpha: -0.9,
    beta: 0.85,
    simon: 'Kneel',
    jesus: 'Sit',
    partners: 'Idle',
    net: 'folded',
    cargo: true,
  },
  calling: {
    boat: [1, 1],
    partner: [3.5, 2],
    target: [1.7, 0.9, 1],
    radius: 13,
    alpha: -0.95,
    beta: 0.9,
    simon: 'Kneel',
    jesus: 'Gesture',
    partners: 'Idle',
    net: 'folded',
    cargo: true,
  },
  return: {
    boat: [-7, 0],
    partner: [-5.5, 5],
    target: [-7, 0.6, 1],
    radius: 19,
    alpha: -1.05,
    beta: 0.88,
    simon: 'Row',
    jesus: 'Sit',
    partners: 'Row',
    net: 'folded',
    cargo: true,
  },
};

/** Disposable presentation region. No spatial player input, physics or quest rewards. */
export class LakeRegion implements RegionView {
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private library: AssetLibrary;
  private shadow: ShadowGenerator;
  private boats: Model[] = [];
  private actors = new Map<string, Actor>();
  private extras: Actor[] = [];
  private oars: TransformNode[] = [];
  private nets = new Map<string, Model>();
  private cargo: Model[] = [];
  private ripples: Mesh[] = [];
  private paused = true;
  private reduced = false;
  private current?: Composition;
  private staging: Staging = 'shore';
  private checkpoint = '';
  private last = 0;
  private time = 0;
  private shorePosition: Point;
  private disposed = false;
  private entrance = 0;
  private startingBoatPositions: Vector3[] = [];
  private startCamera?: { target: Vector3; radius: number; alpha: number; beta: number };
  constructor(
    private engine: Engine,
    state: GameState,
  ) {
    this.shorePosition = { ...state.position };
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.58, 0.72, 0.72, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.58, 0.72, 0.72);
    this.scene.fogDensity = 0.008;
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
    const sky = new HemisphericLight('lake-sky', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.6;
    sky.diffuse = new Color3(0.94, 0.96, 1);
    sky.groundColor = new Color3(0.42, 0.38, 0.24);
    const sun = new DirectionalLight('lake-sun', new Vector3(0.6, -1.5, 0.8), this.scene);
    sun.position.set(-20, 30, -15);
    sun.intensity = 0.72;
    sun.diffuse = new Color3(1, 0.97, 0.88);
    this.shadow = new ShadowGenerator(1024, sun);
    this.shadow.usePercentageCloserFiltering = true;
    this.shadow.darkness = 0.22;
    this.shadow.bias = 0.002;
    this.library = new AssetLibrary(this.scene, this.shadow);
    this.environment();
  }
  private material(name: string, hex: string, alpha = 1): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    return material;
  }
  private environment(): void {
    const lake = MeshBuilder.CreateGround('open-water', { width: 160, height: 160 }, this.scene);
    lake.position.set(25, -0.16, 5);
    lake.material = this.material('deep-water', '#619d9f');
    lake.isPickable = false;
    const shore = MeshBuilder.CreateGround('distant-shore', { width: 30, height: 100 }, this.scene);
    shore.position.set(-27, 0.01, 0);
    shore.material = this.material('shore-sand', '#d5c48d');
    shore.receiveShadows = true;
    shore.isPickable = false;
    const shallows = MeshBuilder.CreateGround(
      'lake-shallows',
      { width: 8, height: 100 },
      this.scene,
    );
    shallows.position.set(-9, -0.13, 0);
    shallows.material = this.material('lake-shallow-material', '#83b3a7', 0.65);
    shallows.isPickable = false;
    const rippleMaterial = this.material('lake-ripple-material', '#cee4d8', 0.3);
    for (let i = 0; i < 36; i++) {
      const ripple = MeshBuilder.CreateGround(
        'lake-ripple-' + i,
        { width: 0.5 + (i % 5) * 0.35, height: 0.027 },
        this.scene,
      );
      ripple.position.set(-10 + ((i * 7.3) % 38), -0.1, -18 + ((i * 11.7) % 48));
      ripple.material = rippleMaterial;
      ripple.isPickable = false;
      this.ripples.push(ripple);
    }
    const hillMaterial = this.material('lake-hills', '#9fae86');
    const hills: Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const hill = MeshBuilder.CreateIcoSphere(
        'lake-hill',
        { radius: 1, subdivisions: 1 },
        this.scene,
      );
      hill.position.set(-45 + i * 10, -3, 40 + (i % 3) * 3);
      hill.scaling.set(12, 6 + (i % 4), 10);
      hill.material = hillMaterial;
      hill.isPickable = false;
      hills.push(hill);
    }
    Mesh.MergeMeshes(hills, true, true);
  }
  async load(progress: (message: string) => void): Promise<void> {
    await this.library.load(LAKE_ASSETS, (loaded, total) =>
      progress('Opening a view of the lake · ' + loaded + ' of ' + total),
    );
    for (let i = 0; i < 2; i++) {
      const boat = this.library.instantiate('boat', 'lake-boat-' + i);
      boat.root.scaling.set(1.35, 1, 1.25);
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
        cargo.root.position.set(j % 2 === 0 ? 0.3 : -0.3, 0.14, -0.75 + j * 0.7);
        cargo.root.scaling.setAll(0.68);
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
    for (let i = 0; i < 8; i++) {
      const actor = new Actor(
        this.library.instantiate(i % 3 === 0 ? 'miriam' : 'villager', 'shore-listener-' + i),
      );
      actor.root.position.set(-12.4 - (i % 2) * 1.1, 0, -3.4 + Math.floor(i / 2) * 1.55);
      actor.root.rotation.y = Math.PI / 2;
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
    await this.scene.whenReadyAsync();
  }
  update(state: GameState): void {
    this.shorePosition = { ...state.position };
    if (!state.episode.checkpoint || state.episode.checkpoint === this.checkpoint) return;
    this.checkpoint = state.episode.checkpoint;
    this.staging = beatFor(state.episode.checkpoint).staging;
    this.current = compositions[this.staging];
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
      const target = new Vector3(destinations[i]![0], c.cargo ? -0.34 : -0.2, destinations[i]![1]);
      const from = this.startingBoatPositions[i] ?? target;
      Vector3.LerpToRef(from, target, t, model.root.position);
      if (!this.reduced) {
        model.root.position.y += Math.sin(this.time * 1.1 + i) * 0.022;
        model.root.rotation.z = Math.sin(this.time * 0.65 + i) * 0.012;
      } else model.root.rotation.z = 0;
    });
    const cameraTarget = Vector3.FromArray(c.target);
    const canvas = this.engine.getRenderingCanvas()!;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const captionsBelow = width <= 900 && height > 540;
    const radius = c.radius * (captionsBelow ? Math.max(1, 0.9 / (width / height)) : 1);
    if (captionsBelow) {
      // Shift along the camera's vertical plane to center the action above the captions.
      const down = new Vector3(
        Math.cos(c.alpha) * Math.cos(c.beta),
        -Math.sin(c.beta),
        Math.sin(c.alpha) * Math.cos(c.beta),
      );
      cameraTarget.addInPlace(down.scale(radius * Math.tan(this.camera.fov / 2) * 0.48));
    } else {
      cameraTarget.y -= 0.4;
      cameraTarget.addInPlace(new Vector3(-Math.sin(c.alpha), 0, Math.cos(c.alpha)).scale(3.5));
    }
    if (this.startCamera && t < 1) {
      Vector3.LerpToRef(this.startCamera.target, cameraTarget, t, this.camera.target);
      this.camera.radius = this.startCamera.radius + (radius - this.startCamera.radius) * t;
      this.camera.alpha = this.startCamera.alpha + (c.alpha - this.startCamera.alpha) * t;
      this.camera.beta = this.startCamera.beta + (c.beta - this.startCamera.beta) * t;
    } else {
      this.camera.target.copyFrom(cameraTarget);
      this.camera.radius = radius;
      this.camera.alpha = c.alpha;
      this.camera.beta = c.beta;
    }
    const rowing = this.staging === 'rowing' || this.staging === 'return';
    this.oars.forEach((oar, i) => {
      oar.rotation.z =
        this.reduced || !rowing ? 0 : Math.sin(this.time * 2.4) * 0.22 * (i % 2 ? -1 : 1);
      oar.rotation.y =
        ((i % 2 ? 1 : -1) * Math.PI) / 2 +
        (this.reduced || !rowing ? 0 : Math.cos(this.time * 2.4) * 0.2);
    });
    const net = this.nets.get(c.net);
    if (net && c.net !== 'folded') {
      net.root.position.y = c.net === 'cast' ? 0.04 : 0.6;
      if (!this.reduced) net.root.position.y += Math.sin(this.time * 1.2) * 0.08;
    }
    this.ripples.forEach(
      (ripple, i) =>
        (ripple.scaling.x = this.reduced ? 1 : 0.85 + Math.sin(this.time * 0.65 + i) * 0.2),
    );
  }
  renderFrame(): void {
    if (this.disposed || document.hidden) return;
    const now = performance.now();
    if (this.paused && now - this.last < 100) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    if (!this.paused) {
      this.time += dt;
      this.positionScene(dt);
      for (const actor of this.actors.values()) actor.tick(dt, this.reduced);
      for (const actor of this.extras) actor.tick(dt, this.reduced);
    } else this.positionScene(0);
    this.scene.render();
  }
  applySettings(settings: Settings): void {
    this.reduced = settings.reducedMotion;
    this.scene.shadowsEnabled = settings.quality === 'high';
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
    this.library.dispose();
    this.scene.dispose();
  }
}
