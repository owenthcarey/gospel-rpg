import { ActionFeedback } from './presentation/action';
import { harborPlaces } from '../content/harbor/places';
import { WaterPresentation } from './presentation/water';
import {
  wornPaths,
  groundMosaic,
  shorelineBank,
  paintGround,
  backdropTerrain,
  coastMargin,
  groundColor,
  type GroundStyle,
} from './presentation/ground';
import { ConversationPresentation } from './presentation/conversation';
import { applyCameraPose, cameraPose, type CameraPose } from './presentation/framing';
import { turnToward, type ScreenRect } from '../game/presence';
import { HarborPresentation, dressVillage } from './harbor';
import { EverydayActivity } from './actors/everyday';
import { WorkPresentation, type WorkRect } from './work';
import type { WorkTarget, ScreenPreview } from '../content/exploration/work';
import { ConnectionActivity } from './actors/connection';
import { passageObstacles } from '../content/connection/presentation';
import { isLakeRegion } from '../game/lake/types';
import { normalizeHeading } from '../game/lake/navigation';
import { localLakePlaces, boatkeeper } from '../content/lake/places';
import { TravelerBoat } from './actors/boat';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { ArcRotateCameraPointersInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { StageEnvironment } from './environment/stage';
import { stylePlugin, WIND_SHAPES, type StylePlugin } from './environment/matte';
import { GroundCover, type CoverOptions } from './environment/cover';
import { environmentFor } from '../content/environment';
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
import { approachPath, stepPath, clearancePosition, smoothPath } from '../game/navigation';
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
  requestNavigate?: (id: string) => void;
  manualMove?: () => void;
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

/** Height of a regular ground grid at a point, from its own vertices (nearest sample). */
function floorHeight(mesh: Mesh, p: Point): number {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const count = Math.round(Math.sqrt(positions.length / 3));
  const size = mesh.getBoundingInfo().boundingBox.extendSize;
  const i = Math.round(((p.x + size.x) / (size.x * 2)) * (count - 1));
  const j = Math.round(((p.z + size.z) / (size.z * 2)) * (count - 1));
  const k = (Math.max(0, Math.min(count - 1, j)) * count + Math.max(0, Math.min(count - 1, i))) * 3;
  return positions[k + 1] ?? 0;
}
const VILLAGE_PATHS: [Point, Point, number][] = [
  [{ x: -4, z: -26 }, { x: -3, z: 1 }, 2.6],
  [{ x: -3, z: 1 }, { x: 0, z: 22 }, 2.8],
  [{ x: -20, z: -1 }, { x: 8, z: -1 }, 2.5],
  [{ x: -3, z: 8 }, { x: -16, z: 8 }, 1.8],
  [{ x: 4, z: -10 }, { x: 6, z: 10 }, 1.5],
];
/** Distance from a point to the nearest path edge (negative on the path). */
function pathDistance(p: Point, segments: readonly (readonly [Point, Point, number])[]): number {
  let best = Infinity;
  for (const [a, b, width] of segments) {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
    );
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) - width * 0.63);
  }
  return best;
}
function groundStyle(region: string): GroundStyle {
  if (['galilean-road', 'roadside-farm', 'nain-gate'].includes(region)) return 'dry';
  if (['reed-landing', 'sheltered-cove'].includes(region)) return 'shore';
  return 'village';
}

export class World {
  grid: WalkGrid;
  private layout?: ExplorationLayout;
  private workView?: WorkPresentation;
  private actionFeedback?: ActionFeedback;
  private conversationView?: ConversationPresentation;
  private active = false;
  private travelerBoat?: TravelerBoat;
  private mooredBoat?: TransformNode;
  private lakeCompany?: Actor;
  private neighborhood?: NeighborhoodActivity;
  private road?: RoadActivity;
  private life!: LifeActivity;
  private connection!: ConnectionActivity;
  private seatedAction?: { time: number; x: number; z: number; started: boolean };
  private cutaways: { node: TransformNode; kind: string }[] = [];
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private shadow: ShadowGenerator;
  private stage: StageEnvironment;
  private cover?: GroundCover;
  private floor?: Mesh;
  private coverQuality?: 'high' | 'low';
  private arrival?: {
    t: number;
    from: { alpha: number; beta: number; radius: number };
    to: { alpha: number; beta: number; radius: number };
    limits: [number | null, number | null];
  };
  private library: AssetLibrary;
  private actorPlayer!: Actor;
  private galilee?: GalileeActivity;
  private guidance: 'full' | 'explore' = 'full';
  private occluders: {
    node: TransformNode;
    height: number;
    x: number;
    z: number;
    fade: StylePlugin[];
    amount: number;
  }[] = [];
  private actors = new Map<string, Actor>();
  private activity!: VillageActivity;
  private harbor?: HarborPresentation;
  private everyday?: EverydayActivity;
  private state: GameState = newGame();
  private destinations: Interactable[] = activeInteractables(this.state);
  private player!: TransformNode;
  private playerModel!: TransformNode;
  private marker: Mesh;
  private routeDots: Mesh[] = [];
  private strideTime = 0;
  private walkRamp = 0;
  private pendingRotation = 0;
  private cameraReturn?: { from: CameraPose; to: CameraPose; t: number };
  private lastPace = 1;
  private path: Point[] = [];
  private destination?: string;
  private keys = new Set<string>();
  private paused = true;
  private reducedMotion = false;
  private waterLines: Mesh[] = [];
  private water?: WaterPresentation;
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
    this.camera.upperBetaLimit = 1.32;
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
    const region = initial.region;
    this.stage = new StageEnvironment(this.scene, this.camera, environmentFor(region), {
      sky: 200,
      horizon:
        region === 'galilee-water' || this.layout?.inside
          ? undefined
          : this.layout
            ? { center: { x: 0, z: 0 }, radius: 88, seed: region.length * 7 }
            : { center: { x: -10, z: 3 }, radius: 92, seed: 11 },
      ground: (x, z) => (region === 'galilee-water' ? -0.05 : groundHeight(region, { x, z })),
    });
    this.shadow = this.stage.shadow;
    this.library = new AssetLibrary(this.scene, this.shadow);
    if (this.layout) {
      const inside = this.layout.inside;
      const shore = isLakeRegion(initial.region) && initial.region !== 'galilee-water';
      const floor = MeshBuilder.CreateGround(
        'walkable-terrain',
        {
          width: inside ? 12.6 : 100,
          height: inside ? 12.6 : 100,
          subdivisions: inside ? 1 : 100,
        },
        this.scene,
      );
      floor.material = this.material('neighborhood-ground', '#ffffff');
      floor.receiveShadows = true;
      floor.metadata = { ground: true };
      this.floor = floor;
      if (this.layout.height) this.conformToGround(floor);
      if (shore) this.shapeShore(floor);
      if (inside) {
        // Use the same lighting path as the worn surfaces; a diffuse color is
        // clamped before vertex color in StandardMaterial and would make the base brighter.
        const earth = Color3.FromHexString('#b4a283');
        floor.setVerticesData(
          VertexBuffer.ColorKind,
          Array.from({ length: floor.getTotalVertices() }, () => [
            earth.r,
            earth.g,
            earth.b,
            1,
          ]).flat(),
        );
      } else
        paintGround(
          floor,
          groundStyle(initial.region),
          shore ? (p) => floorHeight(floor, p) > -0.01 : undefined,
        );
      wornPaths(this.scene, 'worn-regional-paths', this.layout.paths, (p) =>
        groundHeight(initial.region, p),
      );
      if (inside) {
        // The lane outside the doorway: the room sits in a street, not in empty space.
        const lane = MeshBuilder.CreateGround(
          'surrounding-lane',
          { width: 60, height: 60, subdivisions: 40 },
          this.scene,
        );
        lane.position.y = -0.03;
        lane.material = this.material('surrounding-lane-earth', '#ffffff');
        paintGround(lane, 'lane');
        lane.receiveShadows = true;
        lane.isPickable = false;
      }
      if (inside)
        groundMosaic(
          this.scene,
          'regional-earth',
          { min: -5.8, max: 5.8 },
          this.layout.terrain,
          (p) => groundHeight(initial.region, p),
          true,
        );
      if (initial.region === 'galilee-water') floor.setEnabled(false);
      else if (!inside)
        backdropTerrain(this.scene, {
          reserve: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 },
          size: 260,
          style: groundStyle(initial.region),
          base: (p) => groundHeight(initial.region, p),
          water: shore
            ? (p) => p.z < 13 && !(Math.abs(p.x) < 14 && p.z > -8)
            : initial.region === 'galilean-road'
              ? (p) => p.x > 30 && p.z < 0 && p.z > -40
              : undefined,
          rise: shore ? (p) => Math.min(1, Math.max(0, (p.z - 14) / 10)) : undefined,
        });
      if (isLakeRegion(initial.region)) this.makeCrossingTerrain();
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
    } else {
      this.makeTerrain();
      backdropTerrain(this.scene, {
        reserve: { minX: -42, maxX: 12, minZ: -36, maxZ: 42 },
        size: 280,
        style: 'village',
        water: (p) => p.x > shoreline(p.z) - 0.6,
      });
      this.makeWater();
      this.makePaths();
      this.makeDocks();
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
        if (p.asset === 'oven')
          this.stage.atmosphere.addSmoke(new Vector3(p.x, node.position.y + 1.25, p.z), 0.7);
      }
    } else {
      for (const p of [...buildings, ...trees, ...props]) this.place(p);
      // Courtyard ovens behind two homes: a quiet sign of an ordinary morning.
      for (const [x, z] of [
        [-10.5, 7.5],
        [-16, -7],
      ])
        this.stage.atmosphere.addSmoke(new Vector3(x!, 0.9, z!), 0.9);
    }
    for (const person of this.layout
      ? isLakeRegion(this.state.region)
        ? localLakePlaces(this.state)
        : isRoadRegion(this.state.region)
          ? [
              ...roadPlaces[this.state.region].filter((p) => p.id !== 'neri'),
              ...localGalileePlaces(this.state),
            ]
          : (neighborhoodPlaces[this.state.region as keyof typeof neighborhoodPlaces] ?? [])
      : [...interactables, ...episodePlaces, ...harborPlaces, boatkeeper].filter(
          (p) => !['james', 'john'].includes(p.id),
        )) {
      if (!person.asset) continue;
      const node = this.place({ ...person, asset: person.asset }, person.id);
      if (person.kind === 'person') {
        node.rotation.y = person.id === 'miriam' ? 2.8 : -0.8;
        this.people.set(person.id, node);
      }
    }
    const shoreRocks = [];
    for (let i = 0; i < (this.layout ? 0 : 30); i++) {
      const z = -24 + i * 1.7;
      const x = shoreline(z);
      const model = this.library.instantiate(i % 3 === 0 ? 'reeds' : 'rock', 'shore-detail-' + i);
      model.root.position.set(x - 0.1 + Math.sin(i * 3) * 0.45, 0, z);
      model.root.scaling.setAll(0.45 + (i % 4) * 0.16);
      if (i % 3 !== 0) shoreRocks.push(model);
    }
    this.library.batch('rock', shoreRocks);
    dressVillage(this.scene, this.library, this.state.region);
    if (this.state.region === 'capernaum')
      this.harbor = new HarborPresentation(this.scene, this.library);
    this.everyday = new EverydayActivity(this.library, this.actors, this.state);
    this.workView = new WorkPresentation(this.scene, this.camera, this.canvas);
    this.player = new TransformNode('player', this.scene);
    const playerModel = this.library.instantiate('traveler', 'traveler');
    this.actorPlayer = new Actor(playerModel, true);
    this.playerModel = playerModel.root;
    this.playerModel.parent = this.player;
    this.conversationView = new ConversationPresentation(this.camera, this.canvas);
    this.actionFeedback = new ActionFeedback(this.scene);
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
    else if (this.layout && !isLakeRegion(this.state.region))
      this.neighborhood = new NeighborhoodActivity(
        this.library,
        this.actors,
        () => this.grid,
        this.callbacks.walkCheckpoint,
        this.state.region,
      );
    else if (!this.layout)
      this.activity = new VillageActivity(
        this.library,
        this.scene,
        this.grid,
        this.actorPlayer,
        this.people,
        this.boats,
      );
    this.connection = new ConnectionActivity(this.library, this.state);
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
    if (this.state.region === 'galilee-water') {
      this.travelerBoat = new TravelerBoat(this.library, this.player, this.actorPlayer);
      this.player.rotation.y = this.state.lake.boat.heading;
      ring.scaling.setAll(2.2);
    } else if (isLakeRegion(this.state.region) || this.state.region === 'capernaum') {
      this.mooredBoat = this.library.instantiate('boat', 'ordinary-moored-boat').root;
      this.mooredBoat.position.set(
        this.state.region === 'capernaum' ? 10 : 0,
        -0.03,
        this.state.region === 'capernaum' ? -4 : -10,
      );
      if (this.state.region === 'sheltered-cove') {
        this.lakeCompany = new Actor(
          this.library.instantiate('villager', 'cove-resting-company'),
          true,
        );
        this.lakeCompany.root.position.set(-5, 0.08, 7);
        this.lakeCompany.root.rotation.y = Math.PI;
      }
    }
    this.update(this.state);
    this.setPosition(this.position, true);
    const cover = this.coverOptions();
    if (cover) this.cover = new GroundCover(this.library, cover);
    await this.scene.whenReadyAsync();
  }
  /** Ground cover grows on open land only: never on paths, water, sand or blocked cells. */
  private coverOptions(): CoverOptions | undefined {
    const region = this.state.region;
    if (region === 'galilee-water' || this.layout?.inside) return undefined;
    const height = (p: Point) => groundHeight(region, p);
    if (!this.layout)
      return {
        center: { x: -14, z: 3 },
        radius: 30,
        seed: 3,
        height,
        pathDistance: (p) => pathDistance(p, VILLAGE_PATHS),
        allowed: (p) =>
          p.x < shoreline(p.z) - 3 &&
          p.x > -44 &&
          p.z > -36 &&
          p.z < 42 &&
          (!isLand(p) || this.grid.walkable(p)),
      };
    const layout = this.layout;
    const bound = layout.bounds.max;
    const shore = isLakeRegion(region);
    return {
      radius: 26,
      seed: region.length,
      height,
      density: region === 'capernaum-lanes' ? 0.6 : 1,
      pathDistance: (p) => pathDistance(p, layout.paths),
      allowed: (p) => {
        if (shore && this.floor && floorHeight(this.floor, p) < -0.01) return false;
        if (shore && layout.terrain(p) && Math.abs(p.x) < 14 && p.z < -5) return false;
        return Math.abs(p.x) <= bound && Math.abs(p.z) <= bound ? this.grid.walkable(p) : true;
      },
    };
  }

  private makeCrossingTerrain(): void {
    const afloat = this.state.region === 'galilee-water';
    this.water = new WaterPresentation(this.scene, {
      name: 'crossing-water',
      width: 160,
      depth: 160,
      z: afloat ? 0 : -60,
      y: afloat ? -0.04 : -0.12,
      interactive: afloat,
      land: afloat
        ? [
            { x: -40, z: 0, halfX: 18, halfZ: 50 },
            { x: 40, z: 0, halfX: 18, halfZ: 50 },
            { x: -5, z: 3, halfX: 2.5, halfZ: 2 },
          ]
        : [
            { x: 0, z: 3, halfX: 14, halfZ: 11 },
            { x: 0, z: 513, halfX: 1000, halfZ: 500 },
          ],
      coast: afloat ? 0 : 1,
    });
    this.stage.attachWater(this.water);
    if (afloat) {
      const sand = this.material('crossing-sand', '#b6ac87');
      for (const [x, z, width, height] of [
        [-40, 0, 36, 100],
        [40, 0, 36, 100],
        [-5, 3, 5, 4],
      ]) {
        const bank = MeshBuilder.CreateGround(
          'crossing-bank',
          { width: width!, height: height! },
          this.scene,
        );
        bank.position.set(x!, 0.01, z!);
        bank.material = sand;
        bank.isPickable = false;
      }
    }
  }
  /** Cosmetic rings around floating hulls; the steered boat's rings strengthen while moving. */
  private hullRipples() {
    const hulls = [
      ...this.boats.map((node) => ({ node, strength: 0.35 })),
      ...(this.mooredBoat?.isEnabled() ? [{ node: this.mooredBoat, strength: 0.3 }] : []),
      ...(this.travelerBoat
        ? [{ node: this.player, strength: this.path.length || this.keys.size ? 0.9 : 0.4 }]
        : []),
    ];
    return hulls.map(({ node, strength }) => {
      const at = node.getAbsolutePosition();
      return { x: at.x, z: at.z, radius: 1.5, strength };
    });
  }
  /**
   * An establishing move for a first journey: from a wide view over the shore down to the
   * traveler. Cosmetic; any camera input or reduced motion ends it at the gameplay view.
   */
  playArrival(): void {
    if (this.reducedMotion) return;
    const to = { alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius };
    this.arrival = {
      t: 0,
      from: {
        alpha: to.alpha - 0.85,
        beta: Math.min(1.34, to.beta + 0.5),
        radius: to.radius * 1.9,
      },
      to,
      limits: [this.camera.upperRadiusLimit, this.camera.upperBetaLimit],
    };
    this.camera.upperRadiusLimit = this.arrival.from.radius;
    this.camera.upperBetaLimit = 1.4;
    Object.assign(this.camera, this.arrival.from);
  }
  private tickArrival(dt: number): void {
    const a = this.arrival;
    if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / 4.2);
    const e = k * k * (3 - 2 * k);
    const interrupted = this.keys.size > 0 || this.path.length > 0;
    this.camera.alpha = a.from.alpha + (a.to.alpha - a.from.alpha) * e;
    this.camera.beta = a.from.beta + (a.to.beta - a.from.beta) * e;
    this.camera.radius = a.from.radius + (a.to.radius - a.from.radius) * e;
    if (k >= 1 || interrupted || this.reducedMotion) {
      Object.assign(this.camera, a.to);
      [this.camera.upperRadiusLimit, this.camera.upperBetaLimit] = a.limits;
      this.arrival = undefined;
    }
  }
  get atmosphere(): string {
    return this.stage.label;
  }
  getBoatHeading(): number | undefined {
    return this.travelerBoat ? normalizeHeading(this.player.rotation.y) : undefined;
  }

  private material(name: string, hex: string, alpha = 1): StandardMaterial {
    return this.stage.material(name, hex, alpha);
  }
  private place(p: Placement, interactionId?: string): TransformNode {
    const model = this.library.instantiate(
      p.asset as AssetId,
      interactionId ?? p.asset,
      interactionId,
    );
    const anchor = model.root;
    if (isActorAsset(p.asset)) this.actors.set(interactionId ?? p.asset, new Actor(model, true));
    anchor.position.set(
      p.x,
      p.asset === 'boat' && p.x > shoreline(p.z) ? -0.25 : groundHeight(this.state.region, p),
      p.z,
    );
    anchor.rotation.y =
      (p.rotation ?? 0) + (!this.layout && p.asset.startsWith('house') ? Math.PI : 0);
    anchor.scaling.setAll(p.scale ?? 1);
    if (p.asset === 'boat' && p.x > shoreline(p.z)) this.boats.push(anchor);
    if (['olive', 'cypress', 'palm'].includes(p.asset)) {
      // Each view-blocking tree owns a material so it can dissolve on its own.
      const fade = anchor.getChildMeshes().flatMap((mesh) => {
        const source = mesh.material as StandardMaterial | null;
        if (!source) return [];
        const material = source.clone(source.name + ':fade:' + this.occluders.length);
        const plugin = stylePlugin(material);
        plugin.configure(WIND_SHAPES[p.asset], true);
        mesh.material = material;
        return [plugin];
      });
      this.occluders.push({
        node: anchor,
        height: 3.5 * (p.scale ?? 1),
        x: p.x,
        z: p.z,
        fade,
        amount: 1,
      });
    }
    return anchor;
  }

  /** Slope unwalkable floor down under the lake so the water meets a real bank. */
  private shapeShore(mesh: Mesh): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    // Land continues behind the landing; only its lake-facing sides fall away.
    const land = (p: Point) => this.layout!.terrain(p) || p.z > 13;
    for (let i = 0; i < positions.length; i += 3) {
      const p = { x: positions[i]!, z: positions[i + 2]! };
      if (land(p)) continue;
      let nearest = 7;
      for (let dz = -6; dz <= 6; dz += 0.5)
        for (let dx = -6; dx <= 6; dx += 0.5)
          if (land({ x: p.x + dx, z: p.z + dz })) nearest = Math.min(nearest, Math.hypot(dx, dz));
      const beyond = nearest - coastMargin(p);
      positions[i + 1] = beyond <= 0 ? 0 : -0.55 * Math.min(1, beyond / 2.5);
    }
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, mesh.getIndices()!, normals);
    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();
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
    const sand = Color3.FromHexString('#b8a882');
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
        const color =
          x > edge0 - 3
            ? sand.scale(0.96 + this.random(x * 7 + z * 13) * 0.08)
            : groundColor({ x: x + 1, z: z + 1 }, 'village');
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
    shorelineBank(this.scene, 'capernaum-shore-bank', shoreline, -36, 42);
    this.water = new WaterPresentation(this.scene, {
      name: 'galilee',
      width: 180,
      depth: 180,
      x: 45,
      z: 5,
      land: [{ x: 9.3 - 500, z: 0, halfX: 500, halfZ: 1000 }],
      wobble: { amplitude: 1.5, frequency: 0.16 },
    });
    this.stage.attachWater(this.water);
  }

  private makePaths(): void {
    wornPaths(this.scene, 'village-footpaths', VILLAGE_PATHS);
    const pebbleMat = this.material('path-pebbles', '#b9ab83');
    const pebbles: Mesh[] = [];
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
      pebbles.push(stone);
    }
    this.mergeStatic(pebbles, 'path-stones');
  }

  /** Preserve static same-material geometry in one submission. No actor or GLB source is instanced. */
  private mergeStatic(meshes: Mesh[], name: string, shadow = false): Mesh {
    const { receiveShadows, isPickable } = meshes[0]!;
    const merged = Mesh.MergeMeshes(meshes, true, true)!;
    merged.name = name;
    merged.isPickable = isPickable;
    merged.receiveShadows = receiveShadows;
    if (shadow) this.shadow.addShadowCaster(merged);
    return merged;
  }

  private makeDocks(): void {
    const wood = this.material('dock-wood', '#83694a'),
      dark = this.material('dock-posts', '#65553c');
    const planks: Mesh[] = [],
      posts: Mesh[] = [];
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
      planks.push(plank);
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
        posts.push(post);
      }
    this.mergeStatic(planks, 'jetty-planks');
    this.mergeStatic(posts, 'jetty-posts', true);
  }

  private bindInput(): void {
    this.cleanup.push(
      bindExplorationInput({
        scene: this.scene,
        canvas: this.canvas,
        keys: this.keys,
        paused: () => this.paused,
        navigate: (id) =>
          this.callbacks.requestNavigate ? this.callbacks.requestNavigate(id) : this.navigate(id),
        manualMove: this.callbacks.manualMove,
        walk: (point) => {
          this.callbacks.manualMove?.();
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
    const path = cell
      ? smoothPath(this.grid, this.position, findPath(this.grid, this.position, cell))
      : [];
    if (!path.length) {
      this.callbacks.notice(
        this.travelerBoat
          ? 'That route is out of reach. Try the open water or choose a landing on the map.'
          : 'That path is out of reach. Try the village paths.',
      );
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
    const path = smoothPath(
      this.grid,
      this.position,
      approachPath(this.grid, this.position, target),
    );
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

  private face(target: Point, dt?: number): void {
    if (this.travelerBoat) {
      this.player.rotation.y = normalizeHeading(
        Math.atan2(target.x - this.position.x, target.z - this.position.z),
      );
      return;
    }
    if (this.playerModel) {
      const heading = Math.PI + Math.atan2(target.x - this.position.x, target.z - this.position.z);
      this.playerModel.rotation.y =
        dt && !this.reducedMotion ? turnToward(this.playerModel.rotation.y, heading, dt) : heading;
    }
  }
  nearest(): Interactable | undefined {
    return [...this.destinations]
      .filter((p) => distance(p, this.position) < 2.6)
      .sort((a, b) => distance(a, this.position) - distance(b, this.position))[0];
  }
  stop(): void {
    this.walkRamp = 0;
    this.path = [];
    this.destination = undefined;
    this.marker.setEnabled(false);
    this.routeDots.forEach((dot) => dot.setEnabled(false));
    this.poseTraveler(false, 0);
    this.keys.clear();
  }
  /** Route dots every 1.6 m along the remaining straight legs. */
  private showRoute(): void {
    const points: Point[] = [];
    let at = this.position;
    let carry = 1.6;
    for (const next of this.path) {
      const d = distance(at, next);
      while (carry <= d && points.length < this.routeDots.length) {
        const t = carry / d;
        points.push({ x: at.x + (next.x - at.x) * t, z: at.z + (next.z - at.z) * t });
        carry += 1.6;
      }
      carry -= d;
      at = next;
    }
    this.routeDots.forEach((dot, i) => {
      const point = points[i];
      dot.setEnabled(Boolean(point) && this.guidance === 'full');
      if (point) dot.position.set(point.x, groundHeight(this.state.region, point) + 0.04, point.z);
    });
  }
  /** Ease into a walk and settle on arrival; never changes the route or its destination. */
  private pace(dt: number): number {
    this.walkRamp = Math.min(1, this.walkRamp + dt * 5);
    let remaining = 0,
      at = this.position;
    for (const next of this.path) {
      remaining += distance(at, next);
      at = next;
      if (remaining > 1.5) break;
    }
    this.lastPace = this.walkRamp * Math.min(1, 0.4 + remaining / 1.4);
    return this.lastPace;
  }
  private poseTraveler(moving: boolean, dt: number): void {
    if (!this.playerModel) return;
    if (this.travelerBoat) {
      this.travelerBoat.pose(moving, dt, this.reducedMotion || this.paused);
      return;
    }
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
    if (moving && !this.reducedMotion) {
      const before = Math.floor(this.strideTime / 0.4);
      this.strideTime += dt;
      if (Math.floor(this.strideTime / 0.4) !== before)
        this.stage.atmosphere.footstep(this.player.position.add(new Vector3(0, 0.05, 0)));
    } else this.strideTime = 0;
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
    if (this.travelerBoat && snap) this.player.rotation.y = this.state.lake.boat.heading;
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
    if (!this.layout || this.workView?.active || this.conversationView?.active) return;
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
    if (this.workView?.focusPoint) return this.workView.focusPoint;
    if (this.state.region === 'galilee-water')
      return new Vector3(this.position.x * 0.65, 0, this.position.z * 0.65 + 2);
    if (this.layout?.inside) return new Vector3(0, 0, 0);
    if (this.layout) {
      // The land beyond each region is dressed now, so the view may follow further out.
      const reach = this.layout.bounds.max - 9;
      return new Vector3(
        Math.max(-reach, Math.min(reach, this.position.x)),
        groundHeight(this.state.region, this.position),
        Math.max(
          -reach + 1,
          Math.min(reach + 1, this.position.z + this.layout.camera.targetOffset * 2),
        ),
      );
    }
    return new Vector3(this.position.x, 0, this.position.z + 2);
  }
  resetCamera(): void {
    if (this.workView?.active) {
      this.workView.frame();
      return;
    }
    this.pendingRotation = 0;
    this.camera.alpha = -Math.PI / 2 - 0.45;
    this.camera.beta = this.layout?.camera.beta ?? 0.78;
    this.camera.radius = (this.layout?.camera.radius ?? 33) * this.cameraAspectScale;
  }
  /** Rotation buttons ease through a quarter of a turn step instead of jumping. */
  rotate(direction: number): void {
    if (this.reducedMotion) this.camera.alpha += direction * 0.3;
    else this.pendingRotation += direction * 0.3;
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
    this.connection?.settings(settings);
    this.everyday?.settings(settings);
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
    this.water?.quality(settings.quality === 'low');
    this.water?.tick(this.time, this.reducedMotion);
    this.stage.applySettings(settings);
    if (this.cover && this.coverQuality !== settings.quality) {
      this.coverQuality = settings.quality;
      this.cover.build(settings.quality);
    }
  }
  private simulate(dt: number): void {
    if (!this.paused && !document.hidden) {
      this.time += dt;
      this.activity?.tick(dt, false);
      this.neighborhood?.tick(dt, this.position);
      this.road?.tick(dt, this.position, this.destination === 'neri');
      this.life?.tick(dt);
      this.connection?.tick(dt);
      this.galilee?.tick(dt);
      this.lakeCompany?.sample('Sit', dt, this.reducedMotion);
      // Nearby people glance at the traveler; conversations direct their own gaze.
      const head = new Vector3(this.position.x, this.player.position.y + 1.6, this.position.z);
      for (const actor of this.actors.values())
        if (!this.conversationView?.active)
          actor.lookAt(distance(this.position, actor.root.position) < 4.5 ? head : null);
      for (const [id, actor] of this.actors)
        if ((id !== 'amos' || !this.neighborhood) && !this.everyday?.owns(id))
          actor.tick(dt, this.reducedMotion);
      this.everyday?.tick(dt, this.position);
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
          this.face(next, dt);
          this.position = next;
          moving = true;
        }
      } else if (this.path.length && !this.seatedAction) {
        const step = stepPath(
          this.position,
          this.path,
          dt *
            this.pace(dt) *
            (this.destination === 'amos-waypoint' || this.destination === 'neri-meeting'
              ? 0.44
              : 1),
        );
        if (step.facing) this.face(step.facing, dt);
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
      this.actorPlayer.setStrideSpeed(
        (this.destination === 'amos-waypoint' || this.destination === 'neri-meeting'
          ? 1.43
          : 3.25) * (this.path.length ? Math.max(0.45, this.lastPace) : 1),
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
    if (
      document.hidden ||
      (this.paused &&
        (!this.conversationView?.animated || this.reducedMotion) &&
        now - this.lastRender < 100)
    )
      return;
    const elapsed = this.lastRender ? (now - this.lastRender) / 1000 : 0;
    this.lastRender = now;
    this.workView?.tick(this.reducedMotion, Math.min(elapsed, 0.1));
    if (!this.paused) this.tickArrival(Math.min(elapsed, 0.1));
    if (this.cameraReturn) {
      const r = this.cameraReturn;
      r.t = Math.min(1, r.t + Math.min(elapsed, 0.1) / 0.7);
      const e = r.t * r.t * (3 - 2 * r.t);
      this.camera.alpha = r.from.alpha + (r.to.alpha - r.from.alpha) * e;
      this.camera.beta = r.from.beta + (r.to.beta - r.from.beta) * e;
      this.camera.radius = r.from.radius + (r.to.radius - r.from.radius) * e;
      Vector3.LerpToRef(r.from.target, r.to.target, e, this.camera.target);
      if (r.t >= 1) this.cameraReturn = undefined;
    }
    if (Math.abs(this.pendingRotation) > 0.0005) {
      const step = this.pendingRotation * (1 - Math.exp(-Math.min(elapsed, 0.1) * 10));
      this.camera.alpha += step;
      this.pendingRotation -= step;
    }
    if (this.active) this.conversationView?.tick(Math.min(elapsed, 0.1), this.reducedMotion);
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
    this.water?.tick(this.time, this.reducedMotion);
    this.water?.setRipples(this.hullRipples());
    this.actionFeedback?.tick(
      Math.min(elapsed, 0.1),
      this.active && !this.paused,
      this.reducedMotion,
    );
    for (const { node, kind } of this.cutaways) {
      // Hide roofs completely and lower camera-facing walls, retaining a readable outline.
      if (kind === 'roof') node.setEnabled(false);
      else {
        const towardCamera =
          node.position.x * Math.cos(this.camera.alpha) +
            node.position.z * Math.sin(this.camera.alpha) >
          1;
        const target = towardCamera ? 0.22 : 1;
        node.scaling.y = this.reducedMotion
          ? target
          : node.scaling.y +
            (target - node.scaling.y) * (1 - Math.exp(-Math.min(elapsed, 0.1) * 9));
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
      // Dissolve rather than shrink: silhouette and collision stay put, the traveler shows through.
      const target = blocks ? 0.3 : 1;
      o.amount = this.reducedMotion
        ? target
        : o.amount + (target - o.amount) * (1 - Math.exp(-Math.min(elapsed, 0.1) * 8));
      for (const plugin of o.fade) plugin.fade = o.amount;
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
    this.stage.setView(this.camera.target);
    this.stage.tick(Math.min(elapsed, 0.1), this.active && !this.paused);
    this.scene.render();
    const playback = this.actorPlayer.playback;
    this.canvas.dataset.boatHeading = String(this.getBoatHeading() ?? '');
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
    this.active = true;
    this.camera.attachControl(this.canvas, true);
    this.lastRender = performance.now();
  }
  deactivate(): void {
    this.active = false;
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
        [...layoutObstacles(state), ...passageObstacles(state)],
        this.layout.terrain,
        this.layout.bounds.min,
        this.layout.bounds.max,
      );
    if (!this.layout) this.grid = new WalkGrid([...obstacles, ...passageObstacles(state)], isLand);
    this.neighborhood?.update(state);
    this.road?.update(state);
    this.life?.update(state);
    this.connection?.update(state);
    this.galilee?.update(state);
    this.harbor?.update(state.harbor);
    this.everyday?.update(state);
    this.people.get('joel')?.setEnabled(state.road.chapter.stage === 'complete');
    this.mooredBoat?.setEnabled(
      state.road.chapter.stage === 'complete' && state.lake.boat.berth === state.region,
    );
    this.lakeCompany?.root.setEnabled(
      state.lake.trail.stage === 'complete' || state.lake.chapter.stage === 'complete',
    );
    // Newly placed furniture may cover an old standing point; keep an escape route.
    if (this.player && !this.grid.walkable(this.position)) {
      const site = this.destinations.find((p) => p.id === 'rest-' + state.galilee.shelter.site);
      this.setPosition(clearancePosition(this.grid, this.position, site), true);
    }
    // Cancel approaches when an actor departs or a carried object disappears.
    if (this.destination && !this.destinations.some((p) => p.id === this.destination)) this.stop();
  }
  setWorkFocus(target?: WorkTarget, preview?: ScreenPreview): void {
    if (target) this.conversationView?.clear();
    if (target) this.stop();
    this.workView?.select(target, this.state, preview);
    this.canvas.dataset.workTarget = target?.id ?? '';
    this.canvas.dataset.workPreview = preview ? String(preview.direction) : '';
  }
  setWorkBounds(rect?: WorkRect): void {
    this.workView?.setBounds(rect);
  }
  setConversation(id?: string, rect?: ScreenRect, paused = false): void {
    if (!id || this.travelerBoat) {
      if (this.conversationView?.active && !this.reducedMotion) {
        // Restore the exact bookmark, then glide there from the conversation framing.
        const from = cameraPose(this.camera);
        this.conversationView.clear();
        this.cameraReturn = { from, to: cameraPose(this.camera), t: 0 };
        applyCameraPose(this.camera, from);
      } else this.conversationView?.clear();
      return;
    }
    this.cameraReturn = undefined;
    const actor =
      id === 'neri'
        ? this.road?.conversationActor
        : (this.actors.get(id) ?? this.activity?.conversationActor(id));
    if (
      !actor ||
      !actor.root.isEnabled() ||
      distance(this.position, actor.root.getAbsolutePosition()) > 4.5
    ) {
      this.conversationView?.clear();
      return;
    }
    this.conversationView?.select(id, actor, this.actorPlayer, rect);
    this.conversationView?.setPaused(paused);
  }
  frameWork(): void {
    this.workView?.frame();
  }
  getCompanionPosition(): Point | undefined {
    return this.neighborhood?.position();
  }
  getRoadCompanionPosition(): Point | undefined {
    return this.road?.position();
  }
  performInteraction(motion?: ActionMotion, target?: string): void {
    this.conversationView?.clear();
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
      if (place) {
        this.actionFeedback?.play(
          motion,
          place,
          groundHeight(this.state.region, place),
          this.reducedMotion,
        );
        this.face(place);
        this.actors.get(place.id)?.face(this.position);
      }
      this.actorPlayer.playOnce(motion);
      if (this.reducedMotion) this.poseTraveler(false, 0);
    }
  }
  dispose(): void {
    this.actionFeedback?.dispose();
    this.water?.dispose();
    this.conversationView?.dispose();
    this.workView?.dispose();
    this.deactivate();
    this.cleanup.forEach((fn) => fn());
    this.activity?.dispose();
    this.neighborhood?.dispose();
    this.everyday?.dispose();
    this.cover?.dispose();
    this.library.dispose();
    this.stage.dispose();
    this.scene.dispose();
  }
}
