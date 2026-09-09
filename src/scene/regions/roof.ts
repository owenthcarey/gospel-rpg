import { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GameState, Point, Settings } from '../../game/types';
import { ROOF_ASSETS, type ActorAsset, type ActorClip } from '../../content/assets';
import { type RoofSceneId } from '../../game/campaign/types';
import { AssetLibrary, type Model } from '../assets';
import { Actor } from '../actors/actor';
import type { RegionView } from './types';

interface RoofComposition {
  alpha: number;
  beta: number;
  radius: number;
  target: [number, number, number];
  roof: boolean;
  patient: ActorClip;
}
const compositions: Record<RoofSceneId, RoofComposition> = {
  house: {
    alpha: -1.1,
    beta: 0.85,
    radius: 19,
    target: [0, 1, 0],
    roof: false,
    patient: 'Recline',
  },
  bearers: {
    alpha: -0.85,
    beta: 0.95,
    radius: 16,
    target: [-2, 1, -4.5],
    roof: false,
    patient: 'Recline',
  },
  roof: { alpha: -0.9, beta: 0.6, radius: 15, target: [0, 2, 0], roof: true, patient: 'Recline' },
  forgiven: {
    alpha: -1.25,
    beta: 0.95,
    radius: 12,
    target: [0, 0.8, 1],
    roof: false,
    patient: 'Recline',
  },
  question: {
    alpha: -2.3,
    beta: 0.9,
    radius: 14,
    target: [1, 0.8, 1],
    roof: false,
    patient: 'Recline',
  },
  authority: {
    alpha: -1,
    beta: 0.92,
    radius: 12,
    target: [0, 1, 1],
    roof: false,
    patient: 'Recline',
  },
  rise: { alpha: -1.3, beta: 0.9, radius: 14, target: [0, 1, 0], roof: false, patient: 'Rise' },
  amazement: {
    alpha: -1.1,
    beta: 0.82,
    radius: 18,
    target: [0, 0.8, -1],
    roof: false,
    patient: 'MatCarry',
  },
};
/** A disposable staging of the written account; the traveler is never a miracle actor. */
export class RoofRegion implements RegionView {
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private library: AssetLibrary;
  private actors = new Map<string, Actor>();
  private mat!: Model;
  private rolled!: Model;
  private roof!: Model;
  private ropes: Mesh[] = [];
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
    this.scene.clearColor = new Color4(0.69, 0.66, 0.54, 1);
    this.scene.skipPointerMovePicking = true;
    this.camera = new ArcRotateCamera(
      'roof-camera',
      -1.1,
      0.85,
      19,
      new Vector3(0, 1, 0),
      this.scene,
    );
    this.camera.minZ = 0.1;
    this.camera.maxZ = 80;
    const sky = new HemisphericLight('room-bounce', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.8;
    sky.groundColor = new Color3(0.4, 0.32, 0.22);
    const sun = new DirectionalLight('roof-light', new Vector3(0.3, -1, 0.5), this.scene);
    sun.position.set(-8, 15, -8);
    sun.intensity = 0.65;
    const shadow = new ShadowGenerator(1024, sun);
    shadow.usePercentageCloserFiltering = true;
    shadow.bias = 0.003;
    shadow.normalBias = 0.04;
    this.library = new AssetLibrary(this.scene, shadow);
    const floor = MeshBuilder.CreateGround('house-floor', { width: 16, height: 20 }, this.scene);
    const material = new StandardMaterial('earthen-floor', this.scene);
    material.diffuseColor = Color3.FromHexString('#ded1b3').toLinearSpace();
    material.specularColor = Color3.Black();
    floor.material = material;
    floor.receiveShadows = true;
    floor.isPickable = false;
    const ropeMaterial = new StandardMaterial('lowering-cords', this.scene);
    ropeMaterial.diffuseColor = Color3.FromHexString('#927c4f');
    for (const x of [-0.5, 0.5])
      for (const z of [-1, 1]) {
        const rope = MeshBuilder.CreateCylinder(
          'lowering-rope',
          { diameter: 0.035, height: 1, tessellation: 6 },
          this.scene,
        );
        rope.material = ropeMaterial;
        rope.position.set(x, 2, z);
        rope.isPickable = false;
        this.ropes.push(rope);
      }
  }
  async load(progress: (message: string) => void): Promise<void> {
    await this.library.load(ROOF_ASSETS, (n, total) =>
      progress(`Preparing Through the Roof · ${n} of ${total}`),
    );
    for (const x of [-4.5, -1.5, 1.5, 4.5]) {
      const wall = this.library.instantiate('room_wall', 'house-back');
      wall.root.position.set(x, 0, 6);
      if (Math.abs(x) > 3) {
        const front = this.library.instantiate('low_wall', 'house-front');
        front.root.position.set(x, 0, -6);
      }
    }
    for (const x of [-6, 6])
      for (const z of [-4.5, -1.5, 1.5, 4.5]) {
        const wall = this.library.instantiate('low_wall', 'house-side');
        wall.root.position.set(x, 0, z);
        wall.root.rotation.y = Math.PI / 2;
      }
    const door = this.library.instantiate('doorway', 'open-doorway');
    door.root.position.set(0, 0, -6);
    for (const x of [-2.25, 2.25]) {
      const wall = this.library.instantiate('low_wall', 'door-side');
      wall.root.position.set(x, 0, -6);
      wall.root.scaling.x = 0.5;
    }
    this.roof = this.library.instantiate('roof_opening', 'opened-roof');
    this.roof.root.position.y = 3.4;
    this.mat = this.library.instantiate('mat_flat', 'lowered-mat');
    this.rolled = this.library.instantiate('mat_rolled', 'carried-mat');
    const make = (id: string, asset: ActorAsset, x: number, z: number) => {
      const actor = new Actor(this.library.instantiate(asset, id));
      actor.root.position.set(x, 0, z);
      actor.face({ x: 0, z: 0 });
      this.actors.set(id, actor);
      return actor;
    };
    make('jesus', 'jesus', 0, 3);
    make('patient', 'healed_man', 0, 0);
    for (let i = 0; i < 4; i++)
      make('bearer-' + i, 'bearer', i % 2 ? 1.25 : -1.25, i < 2 ? -1.2 : 1.2);
    for (let i = 0; i < 8; i++)
      make('neighbor-' + i, 'villager', i < 4 ? -3.5 : 3.5, -2 + (i % 4) * 1.5);
    this.actors.get('patient')!.attach(this.rolled);
    this.update(this.state);
    await this.scene.whenReadyAsync();
  }
  update(state: GameState): void {
    const changed = this.state.campaign.roof.checkpoint !== state.campaign.roof.checkpoint;
    this.state = structuredClone(state);
    if (changed) this.time = 0;
    this.stage(0);
  }
  private stage(dt: number): void {
    const id = this.state.campaign.roof.checkpoint ?? 'house';
    const c = compositions[id];
    this.camera.alpha = c.alpha;
    this.camera.beta = c.beta;
    this.camera.radius = c.radius;
    this.camera.target.set(...c.target);
    const canvas = this.engine.getRenderingCanvas()!;
    const below = canvas.clientWidth <= 900 && canvas.clientHeight > 540;
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
    this.roof?.root.setEnabled(c.roof);
    const lowering = id === 'roof';
    const before = id === 'house' || id === 'bearers';
    const rising = id === 'rise';
    const gathered = id === 'amazement' || (rising && (this.reduced || this.time > 2.1));
    const height = lowering
      ? this.reduced
        ? 0.16
        : 3.45 - Math.min(this.time / 5, 1) * 3.29
      : before
        ? 0.83
        : 0.16;
    this.mat?.root.position.set(before ? -2 : 0, height, before ? -7 : 0);
    this.mat?.root.setEnabled(id !== 'house' && !gathered);
    this.rolled?.root.setEnabled(gathered);
    for (const rope of this.ropes) {
      rope.setEnabled(lowering);
      const x = rope.position.x < 0 ? -0.5 : 0.5,
        z = rope.position.z < 0 ? -1 : 1;
      const bottom = new Vector3(x, height, z),
        top = new Vector3(x * 2.2, 4.3, z * 1.3);
      const delta = top.subtract(bottom);
      const direction = delta.normalizeToNew();
      rope.scaling.y = delta.length();
      rope.position.copyFrom(top.add(bottom).scale(0.5));
      rope.rotationQuaternion = Quaternion.RotationAxis(
        Vector3.Cross(Vector3.Up(), direction).normalize(),
        Math.acos(Vector3.Dot(Vector3.Up(), direction)),
      );
    }
    for (const [name, actor] of this.actors) {
      let clip: ActorClip = 'Idle';
      if (name === 'jesus')
        clip = ['forgiven', 'authority', 'rise'].includes(id) ? 'Gesture' : 'Idle';
      if (name === 'patient') {
        actor.root.setEnabled(id !== 'house');
        const leaving = gathered;
        const out = id === 'amazement' ? 7.5 : Math.min(Math.max(this.time - 2.1, 0) * 0.9, 7.5);
        actor.root.position.set(
          before ? -2 : 0,
          rising || id === 'amazement' ? 0 : height,
          before ? -7 : leaving ? -out : 0,
        );
        actor.root.rotation.y = leaving ? Math.PI : 0;
        clip = gathered
          ? 'MatCarry'
          : rising && (this.reduced || this.time > 1.4)
            ? 'Idle'
            : c.patient;
      }
      if (name.startsWith('bearer-')) {
        actor.root.setEnabled(id !== 'house');
        const i = Number(name.at(-1));
        actor.root.position.set(
          (i % 2 ? 1.25 : -1.25) + (before ? -2 : 0),
          lowering ? 3.5 : 0,
          (i < 2 ? -1.3 : 1.3) + (before ? -7 : 0),
        );
        clip = lowering ? 'Haul' : before ? 'Carry' : 'Idle';
      }
      if (name.startsWith('neighbor-')) {
        actor.root.setEnabled(Number(name.at(-1)) < (this.low ? 4 : 8));
        clip = Number(name.at(-1)) < 2 ? 'Sit' : id === 'amazement' ? 'Gesture' : 'Idle';
      }
      if (!this.paused || (dt === 0 && this.time === 0) || this.reduced)
        actor.sample(clip, dt, this.reduced);
    }
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
    if (!this.paused) this.time += dt;
    this.stage(this.paused ? 0 : dt);
    this.scene.render();
  }
  getPosition(): Point {
    return { ...this.state.position };
  }
  applySettings(s: Settings): void {
    this.reduced = s.reducedMotion;
    this.low = s.quality === 'low';
    this.scene.shadowsEnabled = !this.low;
    this.stage(0);
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
