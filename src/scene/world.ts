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
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from './assets';
import { Actor } from './actors/actor';
import { NeighborhoodActivity } from './actors/neighborhood';
import { GalileeActivity } from './actors/galilee';
import { localGalileePlaces } from '../content/galilee/places';
import { RoadActivity } from './actors/road';
import { isRoadRegion } from '../game/road/types';
import { roadPlaces } from '../content/road/places';
import { regions } from '../content/regions';
import {
  campaignLayout,
  groundHeight,
  layoutObstacles,
  type ExplorationLayout,
} from '../content/campaign/layouts';
import { neighborhoodPlaces } from '../content/campaign/places';
import { explorationAssets } from '../content/inventories';
import { LifeActivity } from './actors/life';
import type { ExplorationRegion } from '../game/campaign/types';
import type { ActionMotion } from '../content/campaign/actions';
import { VillageActivity } from './actors/village';
import { isActorAsset, type AssetId } from '../content/assets';
import { bindExplorationInput } from './input';
import { approachPath, stepPath, clearancePosition } from '../game/navigation';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import {
  buildings,
  interactables,
  episodePlaces,
  activeInteractables,
  isLand,
  obstacles,
  props,
  shoreline,
  trees,
  type Interactable,
  type Placement,
} from '../content/region';
import { distance, findPath, WalkGrid } from '../game/pathfinding';
import { newGame, type GameState, type Point, type Settings } from '../game/types';

export interface WorldCallbacks {
  walkCheckpoint: () => void;
  roadCheckpoint: (step: number) => void;
  interact: (id: string) => void;
  notice: (message: string) => void;
  frame: (
    point: Point,
    labels: ScreenLabel[],
    heading: number,
    nearest: string | null,
    destination?: string,
  ) => void;
}
export interface ScreenLabel {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export class World {
  grid: WalkGrid;
  private layout?: ExplorationLayout;
  private neighborhood?: NeighborhoodActivity;
  private road?: RoadActivity;
  private life!: LifeActivity;
  private seatedAction?: { time: number; x: number; z: number; started: boolean };
  private cutaways: { node: TransformNode; kind: string }[] = [];
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private shadow: ShadowGenerator;
  private library: AssetLibrary;
  private actorPlayer!: Actor;
  private galilee?: GalileeActivity;
  private guidance: 'full' | 'explore' = 'full';
  private occluders: {
    node: TransformNode;
    height: number;
    x: number;
    z: number;
    scaleY: number;
  }[] = [];
  private actors = new Map<string, Actor>();
  private activity!: VillageActivity;
  private state: GameState = newGame();
  private destinations: Interactable[] = activeInteractables(this.state);
  private player!: TransformNode;
  private playerModel!: TransformNode;
  private marker: Mesh;
  private routeDots: Mesh[] = [];
  private strideTime = 0;
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
  private cameraAspectScale = 1;
  private position: Point = { x: -1, z: -3 };
  private cleanup: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: WorldCallbacks,
    engine: Engine,
    initial: GameState = newGame(),
  ) {
    this.state = structuredClone(initial);
    this.layout = campaignLayout(initial.region);
    this.grid = this.layout
      ? new WalkGrid(
          layoutObstacles(initial),
          this.layout.terrain,
          this.layout.bounds.min,
          this.layout.bounds.max,
        )
      : new WalkGrid(obstacles, isLand);
    this.engine = engine;
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
    this.library = new AssetLibrary(this.scene, this.shadow);
    if (this.layout) {
      const floor = MeshBuilder.CreateGround(
        'walkable-terrain',
        {
          width: this.layout.inside ? 16 : 100,
          height: this.layout.inside ? 16 : 100,
          subdivisions: this.layout.height ? 100 : 1,
        },
        this.scene,
      );
      floor.material = this.material(
        'neighborhood-ground',
        this.layout.inside ? '#ddcfae' : '#b1b780',
      );
      floor.receiveShadows = true;
      floor.metadata = { ground: true };
      if (this.layout.height) this.conformToGround(floor);
      const pathMaterial = this.material('worn-paths', '#d7c194');
      const junctions = new Map<string, { point: Point; width: number }>();
      for (const [a, b, width] of this.layout.paths) {
        const path = MeshBuilder.CreateGround(
          'lane-path',
          {
            width,
            height: distance(a, b),
            subdivisions: this.layout.height ? Math.ceil(distance(a, b)) : 1,
          },
          this.scene,
        );
        path.position.set((a.x + b.x) / 2, 0.012, (a.z + b.z) / 2);
        path.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        if (this.layout.height) this.conformToGround(path, 0.014);
        path.material = pathMaterial;
        path.metadata = { ground: true };
        if (this.layout.height)
          for (const point of [a, b]) {
            const key = point.x + ',' + point.z;
            if ((junctions.get(key)?.width ?? 0) < width) junctions.set(key, { point, width });
          }
      }
      for (const { point, width } of junctions.values())
        this.makePathJunction(point, width, pathMaterial);
      if (initial.region === 'galilean-road') {
        const lake = MeshBuilder.CreateGround(
          'distant-galilee',
          { width: 80, height: 38 },
          this.scene,
        );
        lake.position.set(53, -0.13, -20);
        lake.material = this.material('distant-lake-blue', '#80aaa9');
        lake.isPickable = false;
      }
      this.camera.lowerRadiusLimit = this.layout.camera.min;
      this.camera.upperRadiusLimit = this.layout.camera.max;
      this.resetCamera();
      if (this.layout.inside) {
        this.scene.fogDensity = 0;
        sky.intensity = 0.8;
      }
    } else {
      this.makeTerrain();
      this.makeWater();
      this.makePaths();
      this.makeDocks();
      this.makeDistantLandscape();
    }
    this.marker = MeshBuilder.CreateTorus(
      'walk-destination',
      { diameter: 0.7, thickness: 0.035, tessellation: 32 },
      this.scene,
    );
    this.marker.material = this.material('destination-gold', '#efd38f', 0.8);
    this.marker.position.y = 0.045;
    this.marker.isPickable = false;
    this.marker.setEnabled(false);
    const routeMaterial = this.material('route-gold', '#e8d19a', 0.65);
    routeMaterial.emissiveColor = Color3.FromHexString('#8d7950');
    for (let i = 0; i < 32; i++) {
      const dot = MeshBuilder.CreateGround(
        `route-step-${i}`,
        { width: 0.11, height: 0.11 },
        this.scene,
      );
      dot.material = routeMaterial;
      dot.isPickable = false;
      dot.rotation.y = Math.PI / 4;
      dot.setEnabled(false);
      this.routeDots.push(dot);
    }
    this.bindInput();
  }

  async load(onProgress: (message: string) => void): Promise<void> {
    await this.library.load(
      explorationAssets(this.state.region as ExplorationRegion),
      (loaded, total) => {
        onProgress(
          'Preparing ' + regions[this.state.region].title + ' · ' + loaded + ' of ' + total,
        );
      },
    );
    if (this.layout) {
      for (const p of this.layout.decor) {
        const node = this.place(p);
        node.position.y = groundHeight(this.state.region, p) + (p.y ?? 0);
        node.scaling.x *= p.scaleX ?? 1;
        if (p.cutaway) this.cutaways.push({ node, kind: p.cutaway });
      }
    } else for (const p of [...buildings, ...trees, ...props]) this.place(p);
    for (const person of this.layout
      ? isRoadRegion(this.state.region)
        ? [
            ...roadPlaces[this.state.region].filter((p) => p.id !== 'neri'),
            ...localGalileePlaces(this.state),
          ]
        : (neighborhoodPlaces[this.state.region as keyof typeof neighborhoodPlaces] ?? [])
      : [...interactables, ...episodePlaces].filter((p) => !['james', 'john'].includes(p.id))) {
      if (!person.asset) continue;
      const node = this.place({ ...person, asset: person.asset }, person.id);
      if (person.kind === 'person') {
        node.rotation.y = person.id === 'miriam' ? 2.8 : -0.8;
        this.people.set(person.id, node);
      }
    }
    for (let i = 0; i < (this.layout ? 0 : 30); i++) {
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
    const playerModel = this.library.instantiate('traveler', 'traveler');
    this.actorPlayer = new Actor(playerModel, true);
    this.playerModel = playerModel.root;
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
    if (isRoadRegion(this.state.region))
      this.road = new RoadActivity(
        this.library,
        this.state.region,
        () => this.grid,
        this.callbacks.roadCheckpoint,
      );
    else if (this.layout)
      this.neighborhood = new NeighborhoodActivity(
        this.library,
        this.actors,
        () => this.grid,
        this.callbacks.walkCheckpoint,
        this.state.region,
      );
    else
      this.activity = new VillageActivity(
        this.library,
        this.scene,
        this.grid,
        this.actorPlayer,
        this.people,
        this.boats,
      );
    this.life = new LifeActivity(
      this.library,
      this.actorPlayer,
      this.state.region as ExplorationRegion,
    );
    this.galilee = new GalileeActivity(
      this.library,
      this.scene,
      this.state.region as ExplorationRegion,
    );
    this.update(this.state);
    this.setPosition(this.position, true);
    await this.scene.whenReadyAsync();
  }

  private material(name: string, hex: string, alpha = 1): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
    m.specularColor = Color3.Black();
    m.alpha = alpha;
    return m;
  }
  private place(p: Placement, interactionId?: string): TransformNode {
    const model = this.library.instantiate(
      p.asset as AssetId,
      interactionId ?? p.asset,
      interactionId,
    );
    const anchor = model.root;
    if (isActorAsset(p.asset)) this.actors.set(interactionId ?? p.asset, new Actor(model));
    anchor.position.set(
      p.x,
      p.asset === 'boat' && p.x > shoreline(p.z) ? -0.25 : groundHeight(this.state.region, p),
      p.z,
    );
    anchor.rotation.y =
      (p.rotation ?? 0) + (!this.layout && p.asset.startsWith('house') ? Math.PI : 0);
    anchor.scaling.setAll(p.scale ?? 1);
    if (p.asset === 'boat' && p.x > shoreline(p.z)) this.boats.push(anchor);
    if (['olive', 'cypress', 'palm'].includes(p.asset))
      this.occluders.push({
        node: anchor,
        height: 3.5 * (p.scale ?? 1),
        x: p.x,
        z: p.z,
        scaleY: anchor.scaling.y,
      });
    return anchor;
  }

  private makePathJunction(point: Point, width: number, material: StandardMaterial): void {
    const positions = [point.x, groundHeight(this.state.region, point) + 0.014, point.z],
      indices: number[] = [];
    for (let i = 0; i < 12; i++) {
      const x = point.x + (Math.cos((i * Math.PI) / 6) * width) / 2,
        z = point.z + (Math.sin((i * Math.PI) / 6) * width) / 2;
      positions.push(x, groundHeight(this.state.region, { x, z }) + 0.014, z);
      indices.push(0, i + 1, ((i + 1) % 12) + 1);
    }
    const mesh = new Mesh('path-junction', this.scene),
      data = new VertexData(),
      normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }
  private conformToGround(mesh: Mesh, offset = 0): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const world = mesh.computeWorldMatrix(true);
    for (let i = 0; i < positions.length; i += 3) {
      const p = Vector3.TransformCoordinates(
        new Vector3(positions[i]!, 0, positions[i + 2]!),
        world,
      );
      positions[i + 1] = groundHeight(this.state.region, p) + offset - mesh.position.y;
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, mesh.getIndices()!, normals);
    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();
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
    for (let i = 0; i < 48; i++) {
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
    this.cleanup.push(
      bindExplorationInput({
        scene: this.scene,
        canvas: this.canvas,
        keys: this.keys,
        paused: () => this.paused,
        navigate: (id) => this.navigate(id),
        walk: (point) => {
          this.walkTo(point);
        },
        nearest: () => this.nearest()?.id,
        resetCamera: () => this.resetCamera(),
        notice: this.callbacks.notice,
      }),
    );
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
    this.marker.position.set(cell!.x, groundHeight(this.state.region, cell!) + 0.045, cell!.z);
    this.marker.setEnabled(true);
    this.showRoute();
    return true;
  }
  navigate(id: string): void {
    if (this.paused) return;
    const target = this.destinations.find((p) => p.id === id);
    if (!target) return;
    if (distance(this.position, target) < 2.35) {
      this.stop();
      this.face(target);
      this.callbacks.interact(id);
      return;
    }
    const path = approachPath(this.grid, this.position, target);
    if (!path.length) {
      this.callbacks.notice('There is no clear path to that place.');
      return;
    }
    this.path = path;
    this.destination = id;
    const end = path.at(-1)!;
    this.marker.position.set(end.x, groundHeight(this.state.region, end) + 0.045, end.z);
    this.marker.setEnabled(true);
    this.showRoute();
  }

  private face(target: Point): void {
    if (this.playerModel)
      this.playerModel.rotation.y = Math.atan2(
        target.x - this.position.x,
        target.z - this.position.z,
      );
  }
  nearest(): Interactable | undefined {
    return [...this.destinations]
      .filter((p) => distance(p, this.position) < 2.6)
      .sort((a, b) => distance(a, this.position) - distance(b, this.position))[0];
  }
  stop(): void {
    this.path = [];
    this.destination = undefined;
    this.marker.setEnabled(false);
    this.routeDots.forEach((dot) => dot.setEnabled(false));
    this.poseTraveler(false, 0);
    this.keys.clear();
  }
  private showRoute(): void {
    this.routeDots.forEach((dot, i) => {
      const point = this.path[i * 2];
      dot.setEnabled(Boolean(point) && this.guidance === 'full');
      if (point) dot.position.set(point.x, groundHeight(this.state.region, point) + 0.04, point.z);
    });
  }
  private poseTraveler(moving: boolean, dt: number): void {
    if (!this.playerModel) return;
    if (this.paused && this.actorPlayer.performing && !this.reducedMotion) return;
    if (this.seatedAction && !this.reducedMotion) {
      const seat = this.seatedAction;
      if (!this.paused) seat.time += dt;
      const arriving = seat.time < 0.8,
        sitting = seat.time >= 0.8 && seat.time < 3.3;
      const amount = arriving
        ? seat.time / 0.8
        : sitting
          ? 1
          : Math.max(0, 1 - (seat.time - 3.3) / 0.8);
      this.playerModel.position.set(seat.x * amount, 0, seat.z * amount);
      this.playerModel.rotation.y = sitting
        ? Math.PI
        : Math.atan2(seat.x, seat.z) + (arriving ? 0 : Math.PI);
      if (sitting && !seat.started) {
        this.actorPlayer.playOnce('SitDown');
        seat.started = true;
      }
      if (!this.paused) this.actorPlayer.sample(sitting ? 'Idle' : 'Walk', dt);
      if (seat.time < 4.1) return;
      this.playerModel.position.set(0, 0, 0);
      this.seatedAction = undefined;
    }
    if (this.seatedAction && this.reducedMotion) {
      this.seatedAction = undefined;
      this.playerModel.position.set(0, 0, 0);
    }
    if (moving && !this.reducedMotion) this.strideTime += dt;
    else this.strideTime = 0;
    const clip = this.state.campaign.carrying
      ? 'Carry'
      : (this.neighborhood?.playerClip(moving) ??
        this.activity?.playerClip(moving, Boolean(this.state.episode.carrying)) ??
        (moving ? 'Walk' : 'Idle'));
    this.actorPlayer?.sample(
      clip,
      dt,
      this.reducedMotion ||
        this.paused ||
        (clip === 'Carry' && !moving && !this.actorPlayer.performing),
    );
    this.playerModel.position.y = this.reducedMotion
      ? 0
      : moving
        ? Math.abs(Math.sin((this.strideTime * Math.PI * 2) / 0.8)) * 0.035
        : Math.sin(this.time * 1.8) * 0.004;
    this.playerModel.rotation.z =
      moving && !this.reducedMotion ? Math.sin((this.strideTime * Math.PI * 2) / 0.8) * 0.016 : 0;
  }
  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.stop();
  }
  setPosition(p: Point, snap = false): void {
    this.position = this.grid.walkable(p) ? { ...p } : (this.grid.nearest(p) ?? { x: -1, z: -3 });
    if (this.player)
      this.player.position.set(
        this.position.x,
        groundHeight(this.state.region, this.position),
        this.position.z,
      );
    if (snap) this.camera.target.copyFrom(this.cameraTarget());
    this.stop();
  }
  getPosition(): Point {
    return { ...this.position };
  }
  private fitCamera(): void {
    if (!this.layout) return;
    const scale = Math.max(
      1,
      0.9 / (this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight)),
    );
    if (Math.abs(scale - this.cameraAspectScale) < 0.001) return;
    this.camera.radius *= scale / this.cameraAspectScale;
    this.camera.lowerRadiusLimit = this.layout.camera.min * scale;
    this.camera.upperRadiusLimit = this.layout.camera.max * scale;
    this.cameraAspectScale = scale;
  }
  private cameraTarget(): Vector3 {
    if (this.layout?.inside) return new Vector3(0, 0, 0);
    if (this.layout)
      return new Vector3(
        Math.max(-5, Math.min(5, this.position.x)),
        groundHeight(this.state.region, this.position),
        Math.max(-4, Math.min(6, this.position.z + 3)),
      );
    return new Vector3(this.position.x, 0, this.position.z + 2);
  }
  resetCamera(): void {
    this.camera.alpha = -Math.PI / 2 - 0.45;
    this.camera.beta = this.layout?.camera.beta ?? 0.78;
    this.camera.radius = (this.layout?.camera.radius ?? 33) * this.cameraAspectScale;
  }
  rotate(direction: number): void {
    this.camera.alpha += direction * 0.2;
  }
  zoom(direction: number): void {
    this.camera.radius = Math.max(
      this.camera.lowerRadiusLimit ?? 16,
      Math.min(this.camera.upperRadiusLimit ?? 46, this.camera.radius + direction * 3),
    );
  }
  applySettings(settings: Settings): void {
    this.guidance = settings.guidance ?? 'full';
    this.showRoute();
    this.galilee?.settings(settings);
    this.reducedMotion = settings.reducedMotion;
    this.activity?.settings(settings);
    this.neighborhood?.settings(settings);
    this.road?.settings(settings);
    this.life?.settings(settings);
    if (this.reducedMotion) {
      this.poseTraveler(false, 0);
      this.boats.forEach((boat) => {
        boat.position.y = -0.25;
        boat.rotation.z = 0;
      });
      this.people.forEach((person) => {
        person.position.y = groundHeight(this.state.region, {
          x: person.position.x,
          z: person.position.z,
        });
      });
      this.waterLines.forEach((line) => {
        line.scaling.x = 1;
      });
    }
    this.scene.shadowsEnabled = settings.quality === 'high';
  }
  private simulate(dt: number): void {
    if (!this.paused && !document.hidden) {
      this.time += dt;
      this.activity?.tick(dt, false);
      this.neighborhood?.tick(dt, this.position);
      this.road?.tick(dt, this.position, this.destination === 'neri');
      this.life?.tick(dt);
      this.galilee?.tick(dt);
      for (const [id, actor] of this.actors)
        if (id !== 'amos' || !this.neighborhood) actor.tick(dt, this.reducedMotion);
      const dx =
        Number(this.keys.has('d') || this.keys.has('arrowright')) -
        Number(this.keys.has('a') || this.keys.has('arrowleft'));
      const dz =
        Number(this.keys.has('w') || this.keys.has('arrowup')) -
        Number(this.keys.has('s') || this.keys.has('arrowdown'));
      let moving = false;
      if ((dx || dz) && !this.seatedAction) {
        if (this.path.length) this.routeDots.forEach((dot) => dot.setEnabled(false));
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
      } else if (this.path.length && !this.seatedAction) {
        const step = stepPath(
          this.position,
          this.path,
          dt *
            (this.destination === 'amos-waypoint' || this.destination === 'neri-meeting'
              ? 0.44
              : 1),
        );
        if (step.facing) this.face(step.facing);
        this.position = step.position;
        this.path = step.path;
        moving = step.moving;
        this.showRoute();
        if (step.arrived) {
          this.marker.setEnabled(false);
          const id = this.destination;
          this.destination = undefined;
          const target = this.destinations.find((p) => p.id === id);
          if (target && distance(this.position, target) < 2.4) {
            this.face(target);
            this.callbacks.interact(target.id);
          }
        }
      }
      if (this.keys.has('q')) this.camera.alpha += dt * 0.8;
      this.player.position.set(
        this.position.x,
        groundHeight(this.state.region, this.position),
        this.position.z,
      );
      this.poseTraveler(moving && !this.paused, dt);
      const target = this.cameraTarget();
      if (this.reducedMotion) this.camera.target.copyFrom(target);
      else Vector3.LerpToRef(this.camera.target, target, 1 - Math.exp(-dt * 3), this.camera.target);
    }
  }
  private render(): void {
    this.fitCamera();
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
    }
    for (const { node, kind } of this.cutaways) {
      // Hide roofs completely and lower camera-facing walls, retaining a readable outline.
      if (kind === 'roof') node.setEnabled(false);
      else {
        const towardCamera =
          node.position.x * Math.cos(this.camera.alpha) +
            node.position.z * Math.sin(this.camera.alpha) >
          1;
        node.scaling.y = towardCamera ? 0.22 : 1;
      }
    }
    // Lower only foliage crossing the camera-to-traveler sightline; retain its trunk and collision.
    const cameraPoint = this.camera.position,
      focus = this.player.position;
    const vx = cameraPoint.x - focus.x,
      vz = cameraPoint.z - focus.z,
      length = vx * vx + vz * vz;
    for (const o of this.occluders) {
      const t = length ? ((o.x - focus.x) * vx + (o.z - focus.z) * vz) / length : -1;
      const separation = Math.hypot(o.x - focus.x - vx * t, o.z - focus.z - vz * t);
      const rayHeight = focus.y + 1 + (cameraPoint.y - focus.y - 1) * t;
      const blocks =
        t > 0 &&
        t < 1 &&
        separation < 1.25 &&
        groundHeight(this.state.region, o) + o.height > rayHeight;
      o.node.scaling.y = o.scaleY * (blocks ? 0.38 : 1);
    }
    const companion = this.neighborhood?.position();
    if (companion)
      this.destinations = this.destinations.map((p) =>
        p.id === 'amos' ? { ...p, ...companion } : p,
      );
    const neri = this.road?.position();
    this.canvas.dataset.roadCompanion = neri
      ? JSON.stringify({
          ...neri,
          region: this.state.region,
          step: this.state.road.company.step,
          stage: this.state.road.company.stage,
        })
      : '';
    if (neri)
      this.destinations = this.destinations.map((p) => (p.id === 'neri' ? { ...p, ...neri } : p));
    this.scene.render();
    const playback = this.actorPlayer.playback;
    this.canvas.dataset.actorPose = playback.clip;
    this.canvas.dataset.actorFrame = playback.frame.toFixed(2);
    this.canvas.dataset.actionMotion = this.seatedAction ? 'SitDown' : playback.action;
    if (performance.now() - this.lastFrame > 45) {
      this.lastFrame = performance.now();
      const width = this.engine.getRenderWidth(),
        height = this.engine.getRenderHeight();
      const rect = this.canvas.getBoundingClientRect();
      const labels = this.destinations.map((p) => {
        const v = Vector3.Project(
          new Vector3(
            p.x,
            groundHeight(this.state.region, p) + (p.kind === 'person' ? 2.18 : 1.9),
            p.z,
          ),
          Matrix.Identity(),
          this.scene.getTransformMatrix(),
          this.camera.viewport.toGlobal(width, height),
        );
        return {
          id: p.id,
          x: this.layout
            ? Math.max(95, Math.min(rect.width - 95, (v.x / width) * rect.width))
            : (v.x / width) * rect.width,
          y: (v.y / height) * rect.height,
          visible:
            v.z > 0 &&
            v.z < 1 &&
            v.x > 0 &&
            v.x < width &&
            v.y > 0 &&
            v.y < height &&
            (this.guidance === 'full' ||
              distance(p, this.position) < 5 ||
              p.id === this.destination),
        };
      });
      this.callbacks.frame(
        this.position,
        labels,
        this.camera.alpha,
        this.nearest()?.id ?? null,
        this.destination,
      );
    }
  }
  activate(): void {
    this.camera.attachControl(this.canvas, true);
    this.lastRender = performance.now();
  }
  deactivate(): void {
    this.setPaused(true);
    this.camera.detachControl();
  }
  renderFrame(): void {
    this.render();
  }
  update(state: GameState): void {
    this.state = structuredClone(state);
    this.destinations = activeInteractables(state);
    this.activity?.update(state);
    if (this.layout)
      this.grid = new WalkGrid(
        layoutObstacles(state),
        this.layout.terrain,
        this.layout.bounds.min,
        this.layout.bounds.max,
      );
    this.neighborhood?.update(state);
    this.road?.update(state);
    this.life?.update(state);
    this.galilee?.update(state);
    // Newly placed furniture may cover an old standing point; keep an escape route.
    if (this.player && !this.grid.walkable(this.position)) {
      const site = this.destinations.find((p) => p.id === 'rest-' + state.galilee.shelter.site);
      this.setPosition(clearancePosition(this.grid, this.position, site), true);
    }
    // Cancel approaches when an actor departs or a carried object disappears.
    if (this.destination && !this.destinations.some((p) => p.id === this.destination)) this.stop();
  }
  getCompanionPosition(): Point | undefined {
    return this.neighborhood?.position();
  }
  getRoadCompanionPosition(): Point | undefined {
    return this.road?.position();
  }
  performInteraction(motion?: ActionMotion, target?: string): void {
    if (!motion) this.activity?.perform();
    else {
      const place = this.destinations.find((p) => p.id === target);
      if (motion === 'SitDown' && place && !this.reducedMotion) {
        this.stop();
        this.seatedAction = {
          time: 0,
          x: place.x - 0.45 - this.position.x,
          z: place.z - this.position.z,
          started: false,
        };
        return;
      }
      if (place) this.face(place);
      this.actorPlayer.playOnce(motion);
      if (this.reducedMotion) this.poseTraveler(false, 0);
    }
  }
  dispose(): void {
    this.deactivate();
    this.cleanup.forEach((fn) => fn());
    this.activity?.dispose();
    this.neighborhood?.dispose();
    this.library.dispose();
    this.scene.dispose();
  }
}
