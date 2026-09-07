import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { ArcRotateCameraPointersInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import '@babylonjs/core/Culling/ray';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import {
  buildings,
  interactables,
  isLand,
  obstacles,
  props,
  shoreline,
  trees,
  type Interactable,
  type Placement,
} from '../content/region';
import { distance, findPath, WalkGrid } from '../game/pathfinding';
import type { Point, Settings } from '../game/types';

export interface WorldCallbacks {
  interact: (id: string) => void;
  notice: (message: string) => void;
  frame: (point: Point, labels: ScreenLabel[], heading: number, nearest: string | null) => void;
}
export interface ScreenLabel {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export class World {
  readonly grid = new WalkGrid(obstacles, isLand);
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private shadow: ShadowGenerator;
  private containers = new Map<string, AssetContainer>();
  private player!: TransformNode;
  private playerModel!: TransformNode;
  private marker: Mesh;
  private path: Point[] = [];
  private destination?: string;
  private keys = new Set<string>();
  private paused = true;
  private reducedMotion = false;
  private waterLines: Mesh[] = [];
  private boats: TransformNode[] = [];
  private people = new Map<string, TransformNode>();
  private time = 0;
  private lastFrame = 0;
  private lastRender = 0;
  private position: Point = { x: -1, z: -3 };
  private cleanup: (() => void)[] = [];

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
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    this.engine.renderEvenInBackground = false;
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.7, 0.78, 0.73, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.7, 0.78, 0.73);
    this.scene.fogDensity = 0.01;
    this.scene.collisionsEnabled = false;
    this.scene.skipPointerMovePicking = true;
    this.camera = new ArcRotateCamera(
      'journey-camera',
      -Math.PI / 2 - 0.45,
      0.78,
      33,
      new Vector3(0, 0, 2),
      this.scene,
    );
    this.camera.lowerRadiusLimit = 16;
    this.camera.upperRadiusLimit = 46;
    this.camera.lowerBetaLimit = 0.42;
    this.camera.upperBetaLimit = 1.16;
    this.camera.panningSensibility = 0;
    this.camera.wheelDeltaPercentage = 0.015;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 220;
    this.camera.fov = 0.7;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    const pointers = this.camera.inputs.attached.pointers;
    if (pointers instanceof ArcRotateCameraPointersInput) {
      pointers.buttons = [2];
      pointers.angularSensibilityX = 1000;
      pointers.angularSensibilityY = 1000;
      pointers.pinchDeltaPercentage = 0.01;
    }
    const sky = new HemisphericLight('soft-sky', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.6;
    sky.diffuse = new Color3(0.94, 0.96, 1);
    sky.groundColor = new Color3(0.36, 0.31, 0.2);
    const sun = new DirectionalLight('morning-sun', new Vector3(0.7, -1.5, 0.8), this.scene);
    sun.position.set(-22, 38, -20);
    sun.intensity = 0.72;
    sun.diffuse = new Color3(1, 0.97, 0.88);
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 100;
    sun.autoCalcShadowZBounds = true;
    this.shadow = new ShadowGenerator(1024, sun);
    this.shadow.usePercentageCloserFiltering = true;
    this.shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadow.darkness = 0.25;
    this.shadow.bias = 0.002;
    this.shadow.normalBias = 0.04;
    this.makeTerrain();
    this.makeWater();
    this.makePaths();
    this.makeDocks();
    this.makeDistantLandscape();
    this.marker = MeshBuilder.CreateTorus(
      'walk-destination',
      { diameter: 0.7, thickness: 0.035, tessellation: 32 },
      this.scene,
    );
    this.marker.material = this.material('destination-gold', '#efd38f', 0.8);
    this.marker.position.y = 0.045;
    this.marker.isPickable = false;
    this.marker.setEnabled(false);
    this.bindInput();
  }

  async load(onProgress: (message: string) => void): Promise<void> {
    const assetNames = [
      ...new Set(
        [...buildings, ...trees, ...props, ...interactables.filter((p) => p.asset)]
          .map((p) => p.asset!)
          .concat(['traveler', 'rock', 'reeds']),
      ),
    ];
    let loaded = 0;
    // A small concurrency cap avoids spiking memory on mobile browsers.
    const queue = [...assetNames];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const name = queue.shift()!;
          const container = await LoadAssetContainerAsync(
            `${import.meta.env.BASE_URL}assets/models/${name}.glb`,
            this.scene,
          );
          this.containers.set(name, container);
          onProgress(`Preparing Galilee · ${++loaded} of ${assetNames.length}`);
        }
      }),
    );
    for (const p of [...buildings, ...trees, ...props]) this.place(p);
    for (const person of interactables) {
      if (!person.asset) continue;
      const node = this.place({ ...person, asset: person.asset }, person.id);
      if (person.kind === 'person') {
        node.rotation.y = person.id === 'miriam' ? 2.8 : -0.8;
        this.people.set(person.id, node);
      }
    }
    for (let i = 0; i < 30; i++) {
      const z = -24 + i * 1.7;
      const x = shoreline(z);
      this.place({
        asset: i % 3 === 0 ? 'reeds' : 'rock',
        x: x - 0.1 + Math.sin(i * 3) * 0.45,
        z,
        scale: 0.45 + (i % 4) * 0.16,
      });
    }
    this.player = new TransformNode('player', this.scene);
    this.playerModel = this.place({ asset: 'traveler', x: 0, z: 0 });
    this.playerModel.parent = this.player;
    const ring = MeshBuilder.CreateTorus(
      'player-ring',
      { diameter: 0.92, thickness: 0.025, tessellation: 40 },
      this.scene,
    );
    ring.material = this.material('player-ring-material', '#fff1c6', 0.65);
    ring.parent = this.player;
    ring.position.y = 0.045;
    ring.isPickable = false;
    this.setPosition(this.position, true);
    await this.scene.whenReadyAsync();
    this.engine.runRenderLoop(() => this.render());
  }

  private material(name: string, hex: string, alpha = 1): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
    m.specularColor = Color3.Black();
    m.alpha = alpha;
    return m;
  }
  private place(p: Placement, interactionId?: string): TransformNode {
    const container = this.containers.get(p.asset);
    if (!container) throw new Error(`Missing asset: ${p.asset}`);
    const instance = container.instantiateModelsToScene(
      (name) => `${interactionId ?? p.asset}-${name}`,
      false,
      { doNotInstantiate: true },
    );
    const anchor = new TransformNode(`${p.asset}-anchor`, this.scene);
    instance.rootNodes.forEach((node) => {
      node.parent = anchor;
    });
    anchor.position.set(p.x, p.asset === 'boat' && p.x > shoreline(p.z) ? -0.25 : 0, p.z);
    anchor.rotation.y = (p.rotation ?? 0) + (p.asset.startsWith('house') ? Math.PI : 0);
    anchor.scaling.setAll(p.scale ?? 1);
    anchor.getChildMeshes().forEach((mesh) => {
      mesh.receiveShadows = true;
      mesh.isPickable = Boolean(interactionId);
      mesh.metadata = interactionId ? { interactionId } : null;
      this.shadow.addShadowCaster(mesh);
    });
    if (p.asset === 'boat' && p.x > shoreline(p.z)) this.boats.push(anchor);
    return anchor;
  }

  private makeTerrain(): void {
    const positions: number[] = [],
      indices: number[] = [],
      colors: number[] = [];
    const sand = Color3.FromHexString('#d8c48e'),
      grass = Color3.FromHexString('#adb476'),
      dry = Color3.FromHexString('#c5ba83');
    for (let z = -36; z < 42; z += 2) {
      for (let x = -42; x < 12; x += 2) {
        const edge0 = shoreline(z),
          edge1 = shoreline(z + 2);
        if (x > edge0 && x > edge1) continue;
        const left0 = Math.min(x, edge0),
          right0 = Math.min(x + 2, edge0);
        const left1 = Math.min(x, edge1),
          right1 = Math.min(x + 2, edge1);
        const base = positions.length / 3;
        positions.push(left0, 0, z, right0, 0, z, left1, 0, z + 2, right1, 0, z + 2);
        // Babylon's left-handed front faces wind clockwise when viewed from above.
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        const grassy = x < -9 || (z > 10 && x < 4) || z < -12;
        const color = (x > edge0 - 3 ? sand : grassy ? grass : dry)
          .scale(0.99 + this.random(x * 7 + z * 13) * 0.02)
          .toLinearSpace();
        for (let i = 0; i < 4; i++) colors.push(color.r, color.g, color.b, 1);
      }
    }
    const mesh = new Mesh('walkable-terrain', this.scene),
      data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = this.material('terrain', '#ffffff');
    mesh.receiveShadows = true;
    mesh.metadata = { ground: true };
  }
  private random(seed: number): number {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  private makeWater(): void {
    const water = MeshBuilder.CreateGround(
      'galilee',
      { width: 180, height: 180, subdivisions: 1 },
      this.scene,
    );
    water.position.set(45, -0.18, 5);
    water.material = this.material('lake-blue', '#71aeb2');
    water.isPickable = false;
    const shallows = MeshBuilder.CreateGround('shallows', { width: 10, height: 85 }, this.scene);
    shallows.position.set(13.4, -0.16, 4);
    shallows.material = this.material('shallow-turquoise', '#89b9ad', 0.65);
    shallows.isPickable = false;
    const rippleMaterial = this.material('soft-water-glints', '#e6eee0', 0.33);
    rippleMaterial.disableLighting = true;
    rippleMaterial.emissiveColor = Color3.FromHexString('#d4e6d5');
    for (let i = 0; i < 115; i++) {
      const line = MeshBuilder.CreateGround(
        `ripple-${i}`,
        { width: 0.5 + this.random(i + 2) * 3, height: 0.025 + this.random(i + 9) * 0.035 },
        this.scene,
      );
      line.position.set(10.5 + this.random(i + 10) * 58, -0.12, -35 + this.random(i + 20) * 90);
      line.material = rippleMaterial;
      line.isPickable = false;
      this.waterLines.push(line);
    }
  }

  private makePaths(): void {
    const pathMaterial = this.material('worn-path', '#dfcd9c');
    const segments: [Point, Point, number][] = [
      [{ x: -4, z: -26 }, { x: -3, z: 1 }, 2.6],
      [{ x: -3, z: 1 }, { x: 0, z: 22 }, 2.8],
      [{ x: -20, z: -1 }, { x: 8, z: -1 }, 2.5],
      [{ x: -3, z: 8 }, { x: -16, z: 8 }, 1.8],
      [{ x: 4, z: -10 }, { x: 6, z: 10 }, 1.5],
    ];
    segments.forEach(([a, b, width], i) => {
      const path = MeshBuilder.CreateGround(
        `footpath-${i}`,
        { width, height: distance(a, b) },
        this.scene,
      );
      path.position.set((a.x + b.x) / 2, 0.016, (a.z + b.z) / 2);
      path.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      path.material = pathMaterial;
      path.receiveShadows = true;
      path.metadata = { ground: true };
    });
    const pebbleMat = this.material('path-pebbles', '#b9ab83');
    for (let i = 0; i < 48; i++) {
      const x = -4 + this.random(i + 33) * 2.5,
        z = -22 + this.random(i + 61) * 43;
      const stone = MeshBuilder.CreateBox(
        `path-stone-${i}`,
        {
          width: 0.14 + this.random(i) * 0.19,
          height: 0.035,
          depth: 0.1 + this.random(i + 6) * 0.18,
        },
        this.scene,
      );
      stone.position.set(x, 0.034, z);
      stone.rotation.y = i;
      stone.material = pebbleMat;
      stone.isPickable = false;
    }
  }

  private makeDocks(): void {
    const wood = this.material('dock-wood', '#83694a'),
      dark = this.material('dock-posts', '#65553c');
    for (let i = 0; i < 16; i++) {
      const plank = MeshBuilder.CreateBox(
        `jetty-plank-${i}`,
        { width: 0.34, height: 0.12, depth: 1.75 },
        this.scene,
      );
      plank.position.set(7.7 + i * 0.35, 0.04, 2.8);
      plank.material = wood;
      plank.isPickable = false;
      plank.receiveShadows = true;
    }
    for (const x of [8.2, 10.3, 12.7])
      for (const z of [2, 3.6]) {
        const post = MeshBuilder.CreateCylinder(
          'jetty-post',
          { diameter: 0.16, height: 1.1, tessellation: 6 },
          this.scene,
        );
        post.position.set(x, 0.15, z);
        post.material = dark;
        post.isPickable = false;
        this.shadow.addShadowCaster(post);
      }
  }

  private makeDistantLandscape(): void {
    const materials = ['#a5b491', '#99ac8b', '#b1bc98'].map((c, i) =>
      this.material(`distant-hill-${i}`, c),
    );
    for (let i = 0; i < 17; i++) {
      const hill = MeshBuilder.CreateIcoSphere(
        `distant-hill-${i}`,
        { radius: 1, subdivisions: 1, flat: true },
        this.scene,
      );
      hill.position.set(-58 + i * 8, -2, 43 + this.random(i) * 14);
      hill.scaling.set(
        10 + this.random(i + 3) * 6,
        5 + this.random(i + 5) * 8,
        10 + this.random(i + 7) * 6,
      );
      hill.material = materials[i % 3]!;
      hill.isPickable = false;
    }
  }

  private bindInput(): void {
    const down = (e: KeyboardEvent) => {
      if (
        this.paused ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'q',
          'e',
          'r',
        ].includes(key)
      )
        e.preventDefault();
      this.keys.add(key);
      if (key === 'e' && !e.repeat) {
        const nearest = this.nearest();
        if (nearest) this.navigate(nearest.id);
        else this.callbacks.notice('Move closer to a person or a place to interact.');
      }
      if (key === 'r' && !e.repeat) this.resetCamera();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const clear = () => this.keys.clear();
    const context = (e: Event) => e.preventDefault();
    const resize = () => this.engine.resize();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    window.addEventListener('resize', resize);
    this.canvas.addEventListener('contextmenu', context);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', resize);
      this.canvas.removeEventListener('contextmenu', context);
    });
    this.scene.onPointerObservable.add((info) => {
      if (this.paused || info.type !== PointerEventTypes.POINTERTAP || info.event.button !== 0)
        return;
      const pick = info.pickInfo;
      if (!pick?.hit) return;
      const id = pick.pickedMesh?.metadata?.interactionId as string | undefined;
      if (id) this.navigate(id);
      else if (pick.pickedPoint && pick.pickedMesh?.metadata?.ground)
        this.walkTo({ x: pick.pickedPoint.x, z: pick.pickedPoint.z });
    });
  }

  walkTo(target: Point): boolean {
    if (this.paused) return false;
    const cell = this.grid.nearest(target, 3);
    const path = cell ? findPath(this.grid, this.position, cell) : [];
    if (!path.length) {
      this.callbacks.notice('That path is out of reach. Try the village paths.');
      return false;
    }
    this.path = path;
    this.destination = undefined;
    this.marker.position.set(cell!.x, 0.045, cell!.z);
    this.marker.setEnabled(true);
    return true;
  }
  navigate(id: string): void {
    if (this.paused) return;
    const target = interactables.find((p) => p.id === id);
    if (!target) return;
    if (distance(this.position, target) < 2.35) {
      this.stop();
      this.face(target);
      this.callbacks.interact(id);
      return;
    }
    // Choose the shortest reachable approach cell, not the center of an obstacle.
    const candidates: Point[] = [];
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++) {
        const p = { x: Math.round(target.x) + x, z: Math.round(target.z) + z };
        if (this.grid.walkable(p) && distance(p, target) < 2.25) candidates.push(p);
      }
    candidates.sort((a, b) => distance(a, this.position) - distance(b, this.position));
    for (const p of candidates) {
      if (this.walkTo(p)) {
        this.destination = id;
        return;
      }
    }
    this.callbacks.notice('There is no clear path to that place.');
  }
  private face(target: Point): void {
    if (this.playerModel)
      this.playerModel.rotation.y = Math.atan2(
        target.x - this.position.x,
        target.z - this.position.z,
      );
  }
  nearest(): Interactable | undefined {
    return [...interactables]
      .filter((p) => distance(p, this.position) < 2.6)
      .sort((a, b) => distance(a, this.position) - distance(b, this.position))[0];
  }
  stop(): void {
    this.path = [];
    this.destination = undefined;
    this.marker.setEnabled(false);
    this.keys.clear();
  }
  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.stop();
  }
  setPosition(p: Point, snap = false): void {
    this.position = this.grid.walkable(p) ? { ...p } : (this.grid.nearest(p) ?? { x: -1, z: -3 });
    if (this.player) this.player.position.set(this.position.x, 0, this.position.z);
    if (snap) this.camera.target.set(this.position.x, 0, this.position.z + 2);
    this.stop();
  }
  getPosition(): Point {
    return { ...this.position };
  }
  resetCamera(): void {
    this.camera.alpha = -Math.PI / 2 - 0.45;
    this.camera.beta = 0.78;
    this.camera.radius = 33;
  }
  rotate(direction: number): void {
    this.camera.alpha += direction * 0.2;
  }
  zoom(direction: number): void {
    this.camera.radius = Math.max(16, Math.min(46, this.camera.radius + direction * 3));
  }
  applySettings(settings: Settings): void {
    this.reducedMotion = settings.reducedMotion;
    this.scene.shadowsEnabled = settings.quality === 'high';
    this.engine.setHardwareScalingLevel(
      settings.quality === 'low'
        ? Math.max(1.5, window.devicePixelRatio)
        : Math.max(1, window.devicePixelRatio / 1.5),
    );
    this.engine.resize();
  }
  private simulate(dt: number): void {
    if (!this.paused && !document.hidden) {
      this.time += dt;
      const dx =
        Number(this.keys.has('d') || this.keys.has('arrowright')) -
        Number(this.keys.has('a') || this.keys.has('arrowleft'));
      const dz =
        Number(this.keys.has('w') || this.keys.has('arrowup')) -
        Number(this.keys.has('s') || this.keys.has('arrowdown'));
      let moving = false;
      if (dx || dz) {
        this.path = [];
        this.destination = undefined;
        this.marker.setEnabled(false);
        const forward = new Vector3(-Math.cos(this.camera.alpha), 0, -Math.sin(this.camera.alpha));
        const right = new Vector3(forward.z, 0, -forward.x);
        const movement = forward
          .scale(dz)
          .add(right.scale(dx))
          .normalize()
          .scale(dt * 3.25);
        const next = { x: this.position.x + movement.x, z: this.position.z + movement.z };
        const diagonalSafe =
          this.grid.walkable({ x: next.x, z: this.position.z }) &&
          this.grid.walkable({ x: this.position.x, z: next.z });
        if (this.grid.walkable(next) && diagonalSafe) {
          this.face(next);
          this.position = next;
          moving = true;
        }
      } else if (this.path.length) {
        const next = this.path[0]!,
          dist = distance(this.position, next);
        if (dist < dt * 3.25) {
          this.position = { ...next };
          this.path.shift();
        } else {
          this.face(next);
          const t = (dt * 3.25) / dist;
          this.position.x += (next.x - this.position.x) * t;
          this.position.z += (next.z - this.position.z) * t;
          moving = true;
        }
        if (!this.path.length) {
          this.marker.setEnabled(false);
          const id = this.destination;
          this.destination = undefined;
          if (id) {
            const target = interactables.find((p) => p.id === id)!;
            if (distance(this.position, target) < 2.4) {
              this.face(target);
              this.callbacks.interact(id);
            }
          }
        }
      }
      if (this.keys.has('q')) this.camera.alpha += dt * 0.8;
      this.player.position.set(this.position.x, 0, this.position.z);
      this.playerModel.position.y =
        moving && !this.reducedMotion ? Math.abs(Math.sin(this.time * 11)) * 0.07 : 0;
      this.playerModel.rotation.z =
        moving && !this.reducedMotion ? Math.sin(this.time * 11) * 0.025 : 0;
      const target = new Vector3(this.position.x, 0, this.position.z + 2);
      if (this.reducedMotion) this.camera.target.copyFrom(target);
      else Vector3.LerpToRef(this.camera.target, target, 1 - Math.exp(-dt * 3), this.camera.target);
    }
  }
  private render(): void {
    const now = performance.now();
    // Menus and the welcome screen do not need a full-rate 3D render loop.
    if (document.hidden || (this.paused && now - this.lastRender < 100)) return;
    const elapsed = this.lastRender ? (now - this.lastRender) / 1000 : 0;
    this.lastRender = now;
    // Consume slow frames in collision-safe steps; discard only long suspension gaps.
    let remaining = Math.min(elapsed, 0.25);
    while (remaining > 0.00001) {
      const step = Math.min(remaining, 0.05);
      this.simulate(step);
      remaining -= step;
    }
    if (!this.reducedMotion && !document.hidden) {
      this.boats.forEach((boat, i) => {
        boat.position.y = -0.25 + Math.sin(this.time * 1.1 + i) * 0.025;
        boat.rotation.z = Math.sin(this.time * 0.7 + i) * 0.018;
      });
      this.waterLines.forEach((line, i) => {
        line.scaling.x = 0.8 + Math.sin(this.time * 0.65 + i) * 0.22;
      });
      this.people.forEach((person, id) => {
        person.position.y = Math.sin(this.time * 1.4 + id.length) * 0.008;
      });
    }
    this.scene.render();
    if (performance.now() - this.lastFrame > 45) {
      this.lastFrame = performance.now();
      const width = this.engine.getRenderWidth(),
        height = this.engine.getRenderHeight();
      const rect = this.canvas.getBoundingClientRect();
      const labels = interactables.map((p) => {
        const v = Vector3.Project(
          new Vector3(p.x, p.kind === 'person' ? 2.18 : 1.9, p.z),
          Matrix.Identity(),
          this.scene.getTransformMatrix(),
          this.camera.viewport.toGlobal(width, height),
        );
        return {
          id: p.id,
          x: (v.x / width) * rect.width,
          y: (v.y / height) * rect.height,
          visible: v.z > 0 && v.z < 1 && v.x > 0 && v.x < width && v.y > 0 && v.y < height,
        };
      });
      this.callbacks.frame(this.position, labels, this.camera.alpha, this.nearest()?.id ?? null);
    }
  }
  dispose(): void {
    this.cleanup.forEach((fn) => fn());
    this.engine.stopRenderLoop();
    this.containers.forEach((c) => c.dispose());
    this.scene.dispose();
    this.engine.dispose();
  }
}
