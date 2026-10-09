import { ActionFeedback } from './presentation/action';
import { InteractionFeedback } from './interaction';
import { examineText } from '../content/examine';
import { installClassicCameraInput } from './classic-camera-input';
import { harborPlaces } from '../content/harbor/places';
import { WaterPresentation } from './presentation/water';
import {
  wornPaths,
  flagstoneFloor,
  shorelineBank,
  paintGround,
  backdropTerrain,
  coastMargin,
  groundColor,
  floorHeight,
  type GroundStyle,
} from './presentation/ground';
import { ConversationPresentation, conversationAnchor } from './presentation/conversation';
import { applyCameraPose, cameraPose, type CameraPose } from './presentation/framing';
import { turnToward, type ScreenRect } from '../game/presence';
import { HarborPresentation, dressVillage } from './harbor';
import { storedJarObstacles } from '../game/harbor/arrangement';
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
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { StageEnvironment } from './environment/stage';
import { stylePlugin, WIND_SHAPES, type StylePlugin } from './environment/matte';
import { ScenerySightline } from './environment/occlusion';
import { GroundCover, type CoverOptions } from './environment/cover';
import { environmentFor } from '../content/environment';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { GroundMesh } from '@babylonjs/core/Meshes/groundMesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AssetLibrary } from './assets';
import { Actor } from './actors/actor';
import {
  benchMotion,
  benchRoutePose,
  benchSeatAmount,
  BENCH_FRONT_CLEARANCE,
  BENCH_TURN_TIME,
  BENCH_WALK_SPEED,
  type BenchMotion,
} from './bench-motion';
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
import type { ActorClip } from '../content/assets';
import { VillageActivity } from './actors/village';
import { isActorAsset, type AssetId } from '../content/assets';
import { bindExplorationInput, type ExplorationInputBinding, type ScreenClick } from './input';
import {
  approachPath,
  stepPath,
  clearancePosition,
  smoothPath,
  slideStep,
} from '../game/navigation';
import '@babylonjs/core/Culling/ray';
import {
  buildings,
  FISHING_SPOT,
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
import { PausedCadence } from './presentation/cadence';
import { VILLAGE_PATHS } from '../content/terrain';
import { FRESH_RUN, RUN_SPEED, tickRun, toggleRun, type RunState } from '../game/run';
import { FishingSpot } from './environment/fishing-spot';

export type CompassPoint = 'north' | 'east' | 'south' | 'west';
/** Camera orbit angles that look toward each compass point (north is +z, east is +x). */
export const COMPASS_ALPHA: Readonly<Record<CompassPoint, number>> = {
  north: -Math.PI / 2,
  east: Math.PI,
  south: Math.PI / 2,
  west: 0,
};

export interface WorldCallbacks {
  requestNavigate?: (id: string) => void;
  manualMove?: () => void;
  walkCheckpoint: () => void;
  roadCheckpoint: (step: number) => void;
  interact: (id: string) => void;
  notice: (message: string) => void;
  /** Running or its energy changed by a whole point. */
  run?: (state: RunState) => void;
  /** The session's running state, carried into each newly loaded region. */
  runState?: () => RunState;
  frame: (
    point: Point,
    labels: ScreenLabel[],
    heading: number,
    nearest: string | null,
    destination?: string,
    walkTarget?: Point,
    /** The traveler's head on screen, for overhead speech. */
    head?: { x: number; y: number },
  ) => void;
}
/** The shared lifecycle of optional exploration controllers. Ticks keep their own inputs. */
interface WorldActivity {
  settings?(settings: Settings): void;
  update?(state: GameState): void;
  dispose?(): void;
}
export interface ScreenLabel {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

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
  private boatMoving = false;
  private mooredBoat?: TransformNode;
  private lakeCompany?: Actor;
  private neighborhood?: NeighborhoodActivity;
  private road?: RoadActivity;
  private life!: LifeActivity;
  private connection!: ConnectionActivity;
  private seatedAction?: BenchMotion;
  private cutaways: { node: TransformNode; kind: string }[] = [];
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private shadow: ShadowGenerator;
  private stage: StageEnvironment;
  private cover?: GroundCover;
  private floor?: GroundMesh;
  private actorGround = (x: number, z: number): number => this.renderedActorHeight(x, z);
  private renderedActorHeight(x: number, z: number): number {
    return this.floor?.getHeightAtCoordinates(x, z) ?? 0;
  }
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
  private scenerySightline = new ScenerySightline();
  private occluders: {
    node: TransformNode;
    kind: 'foliage' | 'solid';
    meshes: AbstractMesh[];
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
  private playerRing?: Mesh;
  private marker: Mesh;
  private interactionFeedback?: InteractionFeedback;
  private explorationInput?: ExplorationInputBinding;
  private routeDots: Mesh[] = [];
  private strideTime = 0;
  private walkRamp = 0;
  private run: RunState = FRESH_RUN;
  private fishingSpot?: FishingSpot;
  private pendingRotation = 0;
  private dataCache = new Map<string, string>();
  private cameraReturn?: { from: CameraPose; to: CameraPose; t: number };
  private lastPace = 1;
  private path: Point[] = [];
  private destination?: string;
  private keys = new Set<string>();
  private paused = true;
  private reducedMotion = false;
  private water?: WaterPresentation;
  private boats: TransformNode[] = [];
  private people = new Map<string, TransformNode>();
  private time = 0;
  private lastFrame = 0;
  private lastRender = 0;
  private cadence = new PausedCadence();
  private cameraAspectScale = 1;
  private position: Point = { x: -1, z: -3 };
  private cleanup: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: WorldCallbacks,
    engine: Engine,
    initial: GameState = newGame(),
    quality: Settings['quality'] = 'high',
  ) {
    this.run = callbacks.runState?.() ?? FRESH_RUN;
    this.state = structuredClone(initial);
    this.layout = campaignLayout(initial.region);
    this.grid = this.layout
      ? new WalkGrid(
          layoutObstacles(initial),
          this.layout.terrain,
          this.layout.bounds.min,
          this.layout.bounds.max,
        )
      : new WalkGrid([...obstacles, ...storedJarObstacles(initial)], isLand);
    this.engine = engine;
    this.scene = new Scene(this.engine);
    // Pointerdown still focuses the world; releasing into Choose Option keeps its menu focus.
    this.scene.preventDefaultOnPointerUp = false;
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
    this.camera.inertia = 0.72;

    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    installClassicCameraInput(this.camera, {
      enabled: () => this.active && !this.paused,
      manual: () => {
        this.finishCameraTransition();
        this.pendingRotation = 0;
      },
    });
    const region = initial.region;
    this.stage = new StageEnvironment(this.scene, this.camera, environmentFor(region), {
      quality,
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
    this.library = new AssetLibrary(
      this.scene,
      this.shadow,
      region === 'galilee-water' ? undefined : this.stage.contact,
    );
    if (this.layout) {
      const inside = this.layout.inside;
      const shore = isLakeRegion(initial.region) && initial.region !== 'galilee-water';
      const floor = CreateGround(
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
          {
            mosaic: ['galilean-road', 'roadside-farm'].includes(initial.region),
            reserve: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 },
          },
        );
      if (this.layout.paths.length)
        wornPaths(this.scene, 'worn-regional-paths', this.layout.paths, (p) =>
          groundHeight(initial.region, p),
        );
      if (inside) {
        // A darker cutaway surround gives the room an edge; the pale doorstep keeps
        // the doorway connected to the village without an empty field of room color.
        const lane = CreateGround(
          'surrounding-lane',
          { width: 60, height: 60, subdivisions: 40 },
          this.scene,
        );
        lane.position.y = -0.03;
        lane.material = this.material('surrounding-lane-stone', '#555448');
        lane.receiveShadows = true;
        lane.isPickable = false;
        const doorstep = CreateGround('exterior-doorstep', { width: 2.8, height: 4 }, this.scene);
        doorstep.position.set(0, -0.02, -8.1);
        doorstep.material = this.material('doorstep-earth', '#a18f68');
        doorstep.receiveShadows = true;
        doorstep.isPickable = false;
      }
      if (inside)
        flagstoneFloor(
          this.scene,
          'regional-earth',
          { min: -5.8, max: 5.8 },
          this.layout.terrain,
          (p) => groundHeight(initial.region, p),
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
        const lake = CreateGround('distant-galilee', { width: 80, height: 38 }, this.scene);
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
    this.marker = CreateTorus(
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
      const dot = CreateGround(`route-step-${i}`, { width: 0.11, height: 0.11 }, this.scene);
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
        const node = this.place(p, p.interactionId);
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
    // Hulls drawn up on the shore keep their outline: no reeds or rocks through a boat.
    const hulls = props.filter((p) => p.asset === 'boat');
    for (let i = 0; i < (this.layout ? 0 : 30); i++) {
      const z = -24 + i * 1.7;
      const x = shoreline(z) - 0.1 + Math.sin(i * 3) * 0.45;
      if (hulls.some((hull) => Math.hypot(hull.x - x, hull.z - z) < 1.7)) continue;
      // Nor on the jetty's planks (makeDocks: x 7.7–13.1, z 2.8 ± 0.9).
      if (x > 7.4 && x < 13.4 && Math.abs(z - 2.8) < 1.2) continue;
      const model = this.library.instantiate(i % 3 === 0 ? 'reeds' : 'rock', 'shore-detail-' + i);
      model.root.position.set(x, 0, z);
      model.root.scaling.setAll(0.45 + (i % 4) * 0.16);
      if (i % 3 !== 0) shoreRocks.push(model);
    }
    this.library.batch('rock', shoreRocks);
    for (const awning of dressVillage(this.scene, this.library, this.state.region))
      this.registerOccluder('door_awning', awning);
    if (this.state.region === 'capernaum')
      this.harbor = new HarborPresentation(this.scene, this.library);
    this.everyday = new EverydayActivity(this.library, this.actors, this.state, this.actorGround);
    this.workView = new WorkPresentation(this.scene, this.camera, this.canvas);
    this.player = new TransformNode('player', this.scene);
    const playerModel = this.library.instantiate('traveler', 'traveler');
    this.actorPlayer = new Actor(playerModel, true, { stationaryFeet: true });
    this.playerModel = playerModel.root;
    this.playerModel.parent = this.player;
    this.conversationView = new ConversationPresentation(this.camera, this.canvas);
    this.actionFeedback = new ActionFeedback(this.scene);
    const ring = CreateTorus(
      'player-ring',
      { diameter: 0.92, thickness: 0.025, tessellation: 40 },
      this.scene,
    );
    this.playerRing = ring;
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
        this.actorGround,
      );
    else if (this.layout && !isLakeRegion(this.state.region))
      this.neighborhood = new NeighborhoodActivity(
        this.library,
        this.actors,
        () => this.grid,
        this.callbacks.walkCheckpoint,
        this.state.region,
        this.actorGround,
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
      this.mooredBoat = this.library.instantiate(
        'boat',
        'ordinary-moored-boat',
        'board-' + this.state.region,
      ).root;
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
      coast: 1,
    });
    this.stage.attachWater(this.water);
    if (afloat) {
      // Banks and the islet share the water shader's irregular coast, so foam meets real land.
      const box = (p: Point, cx: number, cz: number, hx: number, hz: number) => {
        const ex = Math.abs(p.x - cx) - hx,
          ez = Math.abs(p.z - cz) - hz;
        return Math.hypot(Math.max(ex, 0), Math.max(ez, 0)) + Math.min(Math.max(ex, ez), 0);
      };
      const land = (p: Point) =>
        Math.min(box(p, -40, 0, 18, 50), box(p, 40, 0, 18, 50), box(p, -5, 3, 2.5, 2)) -
          coastMargin(p) <
        0;
      for (const [x, z, width, depth] of [
        [-42, 0, 44, 110],
        [42, 0, 44, 110],
        [-5, 3, 12, 11],
      ] as const) {
        const bank = CreateGround(
          'crossing-bank',
          { width, height: depth, subdivisions: Math.round(Math.max(width, depth) / 1.2) },
          this.scene,
        );
        bank.position.set(x, 0, z);
        const positions = bank.getVerticesData(VertexBuffer.PositionKind)!;
        for (let i = 0; i < positions.length; i += 3) {
          const p = { x: positions[i]! + x, z: positions[i + 2]! + z };
          const inland = Math.max(0, Math.abs(p.x) - 26);
          positions[i + 1] = land(p) ? 0.02 + Math.min(1.6, inland * 0.12) : -0.4;
        }
        const normals: number[] = [];
        VertexData.ComputeNormals(positions, bank.getIndices()!, normals);
        bank.setVerticesData(VertexBuffer.PositionKind, positions);
        bank.setVerticesData(VertexBuffer.NormalKind, normals);
        bank.material = this.material('crossing-bank-earth', '#ffffff');
        paintGround(bank, 'shore', land);
        bank.receiveShadows = true;
        bank.isPickable = false;
      }
    }
  }
  /** Cosmetic rings around floating hulls; the steered boat's rings strengthen while moving. */
  private hullRipples() {
    const hulls = [
      ...this.boats.map((node) => ({ node, strength: 0.35 })),
      ...(this.mooredBoat?.isEnabled() ? [{ node: this.mooredBoat, strength: 0.3 }] : []),
      ...(this.travelerBoat ? [{ node: this.player, strength: this.boatMoving ? 0.9 : 0.4 }] : []),
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
  /** Test-facing canvas attributes, written only when their value changes. */
  private setData(key: string, value: string): void {
    if (this.dataCache.get(key) === value) return;
    this.dataCache.set(key, value);
    this.canvas.dataset[key] = value;
  }
  /** Every optional scene controller, registered once for settings, state and disposal. */
  private activities(): WorldActivity[] {
    const harbor = this.harbor;
    const all: (WorldActivity | undefined)[] = [
      this.activity,
      this.neighborhood,
      this.road,
      this.life,
      this.connection,
      this.galilee,
      this.everyday,
      harbor && { update: (state: GameState) => harbor.update(state.harbor) },
    ];
    return all.filter((a): a is WorldActivity => Boolean(a));
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
    if (isActorAsset(p.asset)) {
      const laneAmos =
        this.state.region === 'capernaum-lanes' &&
        p.asset === 'amos' &&
        (interactionId ?? p.asset) === 'amos';
      this.actors.set(
        interactionId ?? p.asset,
        new Actor(
          model,
          true,
          laneAmos ? { locomotionClearance: { ground: this.actorGround } } : {},
        ),
      );
    }
    anchor.position.set(
      p.x,
      p.asset === 'boat' && p.x > shoreline(p.z) ? -0.25 : groundHeight(this.state.region, p),
      p.z,
    );
    anchor.rotation.y =
      (p.rotation ?? 0) + (!this.layout && p.asset.startsWith('house') ? Math.PI : 0);
    anchor.scaling.setAll(p.scale ?? 1);
    if (p.asset === 'boat' && p.x > shoreline(p.z)) this.boats.push(anchor);
    this.registerOccluder(p.asset, anchor);
    return anchor;
  }
  private registerOccluder(asset: string, anchor: TransformNode): void {
    const foliage = ['olive', 'cypress', 'palm'].includes(asset);
    if (
      foliage ||
      ['house', 'house_large', 'market', 'farm_shelter', 'door_awning'].includes(asset)
    ) {
      // Each view-blocking placement owns a material so other scenery remains opaque.
      const meshes = anchor.getChildMeshes();
      const fade = meshes.flatMap((mesh) => {
        const source = mesh.material as StandardMaterial | null;
        if (!source) return [];
        const material = new StandardMaterial(
          source.name + ':fade:' + this.occluders.length,
          this.scene,
        );
        material.diffuseColor = source.diffuseColor.clone();
        material.specularColor = Color3.Black();
        material.backFaceCulling = source.backFaceCulling;
        const plugin = stylePlugin(material);
        plugin.configure(WIND_SHAPES[asset], true);
        mesh.material = material;
        return [plugin];
      });
      this.occluders.push({
        kind: foliage ? 'foliage' : 'solid',
        node: anchor,
        meshes,
        fade,
        amount: 1,
      });
    }
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
    // The lake starts just inside the shore rather than far under the village, where land
    // hides it but software renderers still shade it. Its grid keeps the same 180/64 m cells.
    const cell = 180 / 64,
      cells = 47,
      east = 135;
    this.water = new WaterPresentation(this.scene, {
      name: 'galilee',
      width: cell * cells,
      depth: 180,
      x: east - (cell * cells) / 2,
      z: 5,
      cellsX: cells,
      land: [{ x: 9.3 - 500, z: 0, halfX: 500, halfZ: 1000 }],
      wobble: { amplitude: 1.5, frequency: 0.16 },
    });
    this.stage.attachWater(this.water);
    // Offshore of the landing, clear of the moored boats.
    this.fishingSpot = new FishingSpot(this.scene, FISHING_SPOT, -0.18);
    this.cleanup.push(() => this.fishingSpot?.dispose());
  }

  private makePaths(): void {
    wornPaths(this.scene, 'village-footpaths', VILLAGE_PATHS);
    const pebbleMat = this.material('path-pebbles', '#b9ab83');
    const pebbles: Mesh[] = [];
    for (let i = 0; i < 48; i++) {
      const x = -4 + this.random(i + 33) * 2.5,
        z = -22 + this.random(i + 61) * 43;
      const stone = CreateBox(
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
      const plank = CreateBox(
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
        const post = CreateCylinder(
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
    const navigate = (id: string, click?: ScreenClick) => {
      this.interactionFeedback?.prepareNavigate(id, click);
      if (this.callbacks.requestNavigate) this.callbacks.requestNavigate(id);
      else this.navigate(id);
    };
    const walk = (point: Point, click?: ScreenClick) => {
      this.callbacks.manualMove?.();
      if (this.walkTo(point) && click) this.interactionFeedback?.accepted('ground', click);
    };
    this.interactionFeedback = new InteractionFeedback({
      scene: this.scene,
      canvas: this.canvas,
      paused: () => this.paused,
      place: (id) => this.destinations.find((p) => p.id === id),
      navigate,
      walk,
      movementLabel: this.state.region === 'galilee-water' ? 'Steer here' : 'Walk here',
      examine: (place) => examineText(place, this.state),
      notice: this.callbacks.notice,
      cancelTap: () => this.explorationInput?.cancelTap(),
    });
    this.explorationInput = bindExplorationInput({
      scene: this.scene,
      canvas: this.canvas,
      keys: this.keys,
      paused: () => this.paused,
      navigate,
      manualMove: this.callbacks.manualMove,
      walk,
      nearest: () => this.nearest()?.id,
      resetCamera: () => this.resetCamera(),
      notice: this.callbacks.notice,
    });
    this.cleanup.push(() => this.explorationInput?.dispose());
  }

  walkTo(target: Point): boolean {
    if (this.paused) return false;
    const path = smoothPath(this.grid, this.position, findPath(this.grid, this.position, target));
    if (!path.length) {
      this.callbacks.notice(
        this.travelerBoat
          ? 'That route is out of reach. Try the open water or choose a landing on the map.'
          : 'That path is out of reach. Try the village paths.',
      );
      return false;
    }
    this.clearSeatedAction();
    this.path = path;
    this.destination = undefined;
    const end = path.at(-1)!;
    this.marker.position.set(end.x, groundHeight(this.state.region, end) + 0.045, end.z);
    this.marker.setEnabled(true);
    this.showRoute();
    return true;
  }
  navigate(id: string): void {
    if (this.paused) {
      this.interactionFeedback?.completeNavigate(id, false);
      return;
    }
    const target = this.destinations.find((p) => p.id === id);
    if (!target) {
      this.interactionFeedback?.completeNavigate(id, false);
      return;
    }
    this.clearSeatedAction();
    if (distance(this.position, target) < 2.35) {
      this.stop();
      this.face(target);
      this.interactionFeedback?.completeNavigate(id, true);
      this.callbacks.interact(id);
      return;
    }
    const path = smoothPath(
      this.grid,
      this.position,
      approachPath(this.grid, this.position, target),
    );
    if (!path.length) {
      this.interactionFeedback?.completeNavigate(id, false);
      this.callbacks.notice('There is no clear path to that place.');
      return;
    }
    this.path = path;
    this.destination = id;
    const end = path.at(-1)!;
    this.marker.position.set(end.x, groundHeight(this.state.region, end) + 0.045, end.z);
    this.marker.setEnabled(true);
    this.showRoute();
    this.interactionFeedback?.completeNavigate(id, true);
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
  private clearSeatedAction(): void {
    if (!this.seatedAction) return;
    const heading = this.seatedAction.heading;
    this.seatedAction = undefined;
    this.actorPlayer.cancelAction();
    this.actorPlayer.sampleAt('Idle', 0);
    this.playerModel.position.set(0, 0, 0);
    this.playerModel.rotation.set(0, heading, 0);
    this.playerRing?.position.set(0, 0.045, 0);
  }
  /** Follow the displayed land actor without moving its navigation or camera anchor. */
  private syncPlayerRing(): void {
    if (!this.playerRing || this.travelerBoat) return;
    this.playerModel.computeWorldMatrix(true);
    const displayed = this.playerModel.getAbsolutePosition();
    this.floor?.computeWorldMatrix(true);
    const height = this.floor
      ? this.floor.getHeightAtCoordinates(displayed.x, displayed.z)
      : groundHeight(this.state.region, { x: displayed.x, z: displayed.z });
    this.playerRing.position.set(
      this.playerModel.position.x,
      height - this.player.getAbsolutePosition().y + 0.045,
      this.playerModel.position.z,
    );
  }
  stop(cancelSeat = true): void {
    if (cancelSeat) this.clearSeatedAction();
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
  private poseTraveler(moving: boolean, dt: number, speed = 0): void {
    if (!this.playerModel) return;
    if (this.travelerBoat) {
      this.boatMoving = moving;
      this.travelerBoat.pose(moving, dt, this.reducedMotion || this.paused);
      return;
    }
    if (this.seatedAction && this.reducedMotion) this.clearSeatedAction();
    if (this.paused && (this.seatedAction || this.actorPlayer.performing) && !this.reducedMotion)
      return;
    if (this.seatedAction) {
      const seat = this.seatedAction;
      seat.time += dt;
      const approachTime = seat.length / BENCH_WALK_SPEED;
      const sittingStart = approachTime + BENCH_TURN_TIME;
      const sittingEnd = sittingStart + this.actorPlayer.clipDuration('SitDown');
      const retreating = seat.time >= sittingEnd;
      this.playerModel.rotation.z = 0;
      if (seat.time < approachTime || retreating) {
        const traveled = Math.min(
          seat.length,
          (retreating ? seat.time - sittingEnd : seat.time) * BENCH_WALK_SPEED,
        );
        const pose = benchRoutePose(seat, traveled, retreating);
        this.playerModel.position.set(pose.x, 0, pose.z);
        this.playerModel.rotation.y = pose.heading;
        const phase = (traveled / (BENCH_WALK_SPEED * this.actorPlayer.clipDuration('Walk'))) % 1;
        this.actorPlayer.sampleAt('Walk', phase);
        // This check is cosmetic: ground the sandals without changing authored navigation.
        const ground = groundHeight(this.state.region, {
          x: this.position.x + pose.x,
          z: this.position.z + pose.z,
        });
        this.playerModel.position.y = Math.max(0, ground - this.actorPlayer.soleHeight());
      } else if (seat.time < sittingStart) {
        const front = seat.route.at(-1)!;
        const initial = benchRoutePose(seat, seat.length).heading;
        const turn = Math.atan2(Math.sin(Math.PI - initial), Math.cos(Math.PI - initial));
        this.playerModel.position.set(front.x, 0, front.z);
        this.playerModel.rotation.y =
          initial + turn * ((seat.time - approachTime) / BENCH_TURN_TIME);
        this.actorPlayer.sampleAt('Idle', 0);
        this.playerModel.position.y = Math.max(
          0,
          groundHeight(this.state.region, this.position) - this.actorPlayer.soleHeight(),
        );
      } else {
        const phase = (seat.time - sittingStart) / this.actorPlayer.clipDuration('SitDown');
        this.playerModel.position.set(
          seat.bench.x - 0.45,
          0,
          seat.bench.z + BENCH_FRONT_CLEARANCE * (1 - benchSeatAmount(phase)),
        );
        this.playerModel.rotation.y = Math.PI;
        this.actorPlayer.sampleActionAt('SitDown', phase);
      }
      this.syncPlayerRing();
      if (seat.time < sittingEnd + approachTime) return;
      this.clearSeatedAction();
    }
    if (moving && !this.reducedMotion) {
      const before = Math.floor(this.strideTime / 0.4);
      // Match the clip and ground accents to actual travel, including easing, wall sliding
      // and companion pace. A slow walk must not keep a full-speed bounce or dust rhythm.
      this.strideTime += (dt * speed) / 3.25;
      if (Math.floor(this.strideTime / 0.4) !== before)
        this.stage.atmosphere.footstep(this.player.position.add(new Vector3(0, 0.05, 0)));
    } else this.strideTime = 0;
    const clip = this.state.campaign.carrying
      ? 'Carry'
      : (this.neighborhood?.playerClip(moving) ??
        this.activity?.playerClip(moving, Boolean(this.state.episode.carrying)) ??
        (moving ? 'Walk' : 'Idle'));
    this.actorPlayer.setStrideSpeed(speed);
    if (
      clip === 'Carry' &&
      !moving &&
      !this.paused &&
      !this.reducedMotion &&
      !this.actorPlayer.performing
    )
      this.actorPlayer.resetStoppedCarryPhase(clip);
    this.actorPlayer?.sample(
      clip,
      dt,
      this.reducedMotion ||
        this.paused ||
        (clip === 'Carry' && !moving && !this.actorPlayer.performing),
    );
    // The displayed pose can still be a finite action while its requested base is Carry.
    // Measure after sampling/blending and roll, without moving the navigation transform.
    const grounded = ['Idle', 'Walk', 'Carry', 'MatCarry'].includes(this.actorPlayer.playback.clip);
    this.playerModel.position.y =
      grounded || this.reducedMotion
        ? 0
        : moving
          ? Math.abs(Math.sin((this.strideTime * Math.PI * 2) / 0.8)) * 0.035
          : Math.sin(this.time * 1.8) * 0.004;
    this.playerModel.rotation.z =
      moving && !this.reducedMotion ? Math.sin((this.strideTime * Math.PI * 2) / 0.8) * 0.016 : 0;
    if (grounded) {
      this.floor?.computeWorldMatrix(true);
      const ground = this.floor;
      const height = ground
        ? (x: number, z: number) => ground.getHeightAtCoordinates(x, z)
        : () => 0;
      const feet = this.actorPlayer.footClearance(height);
      this.playerModel.position.y = Math.max(0, -Math.min(feet.left, feet.right));
      this.actorPlayer.supportFeet({
        stationary: !moving || this.reducedMotion,
        dt,
        ground: height,
        immediate: this.reducedMotion || dt === 0,
        // Settings may deliberately resolve a static pose while the world remains paused.
        frozen: this.paused && !this.reducedMotion,
      });
    }
  }
  /** Toggle running; an empty store keeps the traveler walking until it refills. */
  toggleRun(): RunState {
    this.setRun(toggleRun(this.run ?? FRESH_RUN));
    return this.run;
  }
  private setRun(next: RunState): void {
    // Test doubles may build a world without its constructor; treat that as a fresh store.
    const previous = this.run ?? FRESH_RUN;
    this.run = next;
    if (next.on !== previous.on || Math.floor(next.energy) !== Math.floor(previous.energy))
      this.callbacks?.run?.(next);
  }
  /** Companion walks keep their shared pace and the lake keeps its rowing pace. */
  private get runPace(): number {
    return this.run?.on &&
      this.state.region !== 'galilee-water' &&
      this.destination !== 'amos-waypoint' &&
      this.destination !== 'neri-meeting'
      ? RUN_SPEED
      : 1;
  }
  setPaused(value: boolean): void {
    this.paused = value;
    this.interactionFeedback?.setPaused(value);
    if (value) {
      this.explorationInput?.clear();
      this.stop(false);
      this.stopCameraMotion();
    }
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
    if (!this.layout || this.workView?.active || this.conversationView?.active || document.hidden)
      return;
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    // Keep the last valid fit until the canvas has a displayed extent.
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const scale = Math.max(1, 0.9 / (width / height));
    if (Math.abs(scale - this.cameraAspectScale) < 0.001) return;
    const ratio = scale / this.cameraAspectScale;
    this.camera.radius *= ratio;
    // Resize the same return path, without restarting its visible duration.
    if (this.cameraReturn) {
      this.cameraReturn.from.radius *= ratio;
      this.cameraReturn.to.radius *= ratio;
    }
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
      this.frameWork();
      return;
    }
    this.finishCameraTransition();
    this.stopCameraMotion();
    this.camera.alpha = -Math.PI / 2 - 0.45;
    this.camera.beta = this.layout?.camera.beta ?? 0.78;
    this.camera.radius = (this.layout?.camera.radius ?? 33) * this.cameraAspectScale;
  }
  private stopCameraMotion(): void {
    this.camera.inertialAlphaOffset = 0;
    this.camera.inertialBetaOffset = 0;
    this.camera.inertialRadiusOffset = 0;
    this.pendingRotation = 0;
  }
  faceNorth(): void {
    this.look('north');
  }
  /** Turn the camera to look toward a compass point, as the classic compass menu does. */
  look(direction: CompassPoint): void {
    if (this.workView?.active) return;
    this.finishCameraTransition();
    this.camera.inertialAlphaOffset = 0;
    const alpha = COMPASS_ALPHA[direction];
    const turn = Math.atan2(
      Math.sin(alpha - this.camera.alpha),
      Math.cos(alpha - this.camera.alpha),
    );
    if (this.reducedMotion) {
      this.pendingRotation = 0;
      this.camera.alpha += turn;
    } else this.pendingRotation = turn;
  }
  private finishCameraTransition(): void {
    if (this.arrival) {
      Object.assign(this.camera, this.arrival.to);
      [this.camera.upperRadiusLimit, this.camera.upperBetaLimit] = this.arrival.limits;
      this.arrival = undefined;
    }
    if (this.cameraReturn) {
      const to = this.cameraReturn.to;
      this.camera.alpha = to.alpha;
      this.camera.beta = to.beta;
      this.camera.radius = to.radius;
      this.camera.target.copyFrom(to.target);
      this.cameraReturn = undefined;
    }
  }
  /** Rotation buttons ease through a quarter of a turn step instead of jumping. */
  rotate(direction: number): void {
    this.finishCameraTransition();
    if (this.reducedMotion) this.camera.alpha += direction * 0.3;
    else this.pendingRotation += direction * 0.3;
  }
  zoom(direction: number): void {
    this.finishCameraTransition();
    this.camera.radius = Math.max(
      this.camera.lowerRadiusLimit ?? 16,
      Math.min(this.camera.upperRadiusLimit ?? 46, this.camera.radius + direction * 3),
    );
  }
  applySettings(settings: Settings): void {
    this.guidance = settings.guidance ?? 'full';
    this.showRoute();
    this.reducedMotion = settings.reducedMotion;
    for (const activity of this.activities()) activity.settings?.(settings);
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
      const beforeMove = this.position;
      const runPace = this.runPace;
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
          .scale(dt * 3.25 * runPace);
        const next = slideStep(this.grid, this.position, { x: movement.x, z: movement.z });
        if (distance(this.position, next) > 0.00001) {
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
            runPace *
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
      const travelSpeed = dt > 0 ? distance(beforeMove, this.position) / dt : 0;
      this.setRun(
        tickRun(
          this.run ?? FRESH_RUN,
          dt,
          runPace > 1 && moving ? distance(beforeMove, this.position) : 0,
        ),
      );
      // Accepted work is cosmetic: once the traveler actually leaves, resume their
      // walk instead of carrying a stationary work pose along the route.
      if (travelSpeed > 0 && !this.seatedAction && this.actorPlayer.performing)
        this.actorPlayer.cancelAction();
      this.poseTraveler(moving && !this.paused, dt, travelSpeed);
      const target = this.cameraTarget();
      if (this.reducedMotion) this.camera.target.copyFrom(target);
      else Vector3.LerpToRef(this.camera.target, target, 1 - Math.exp(-dt * 3), this.camera.target);
    }
  }
  private updateOcclusion(elapsed: number): void {
    // Dialogue frames both people; a crown can hide the speaker without hiding the traveler.
    const cameraPoint = this.camera.position,
      focus = this.player.position,
      participants =
        !this.travelerBoat && !this.workView?.active
          ? this.conversationView?.occlusionAnchors
          : undefined;
    for (const o of this.occluders) {
      const blocks = participants
        ? participants.some((point) => this.scenerySightline.blocks(o.meshes, cameraPoint, point))
        : this.scenerySightline.blocks(o.meshes, cameraPoint, focus);
      // Live dialogue needs a clearer window through leaves to frame both people.
      // Architecture and fabric retain their existing fade.
      // Geometry, shadows and collision remain in place throughout the transition.
      const target = blocks ? (o.kind === 'solid' ? 0.18 : participants ? 0.12 : 0.3) : 1;
      o.amount = this.reducedMotion
        ? target
        : o.amount + (target - o.amount) * (1 - Math.exp(-Math.min(elapsed, 0.1) * 8));
      for (const plugin of o.fade) plugin.fade = o.amount;
    }
  }
  private render(): void {
    const now = performance.now();
    // Menus and the welcome screen do not need a full-rate 3D render loop.
    if (
      document.hidden ||
      (this.paused &&
        (!this.conversationView?.animated || this.reducedMotion) &&
        !this.cadence.due(now))
    )
      return;
    this.fitCamera();
    const elapsed = this.lastRender ? (now - this.lastRender) / 1000 : 0;
    this.lastRender = now;
    this.cadence.rendered(now);
    this.workView?.tick(this.reducedMotion, Math.min(elapsed, 0.1));
    if (this.active && !this.paused && elapsed > 0 && this.keys.has('q')) {
      this.finishCameraTransition();
      this.pendingRotation = 0;
    }
    if (!this.paused) this.tickArrival(Math.min(elapsed, 0.1));
    // Camera commands keep their visible duration on slow frames. Foreground refreshes
    // already discard suspension time; collision-safe simulation retains its own cap below.
    if (this.cameraReturn) {
      const r = this.cameraReturn;
      r.t = Math.min(1, r.t + elapsed / 0.7);
      const e = r.t * r.t * (3 - 2 * r.t);
      this.camera.alpha = r.from.alpha + (r.to.alpha - r.from.alpha) * e;
      this.camera.beta = r.from.beta + (r.to.beta - r.from.beta) * e;
      this.camera.radius = r.from.radius + (r.to.radius - r.from.radius) * e;
      Vector3.LerpToRef(r.from.target, r.to.target, e, this.camera.target);
      if (r.t >= 1) this.cameraReturn = undefined;
    }
    if (Math.abs(this.pendingRotation) > 0.0005) {
      const step = this.pendingRotation * (1 - Math.exp(-elapsed * 10));
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
    }
    this.water?.tick(this.time, this.reducedMotion);
    this.fishingSpot?.tick(this.time, this.reducedMotion);
    this.water?.setRipples([
      ...this.hullRipples(),
      ...(this.fishingSpot ? [this.fishingSpot.ripple()] : []),
    ]);
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
    // Orbit, camera returns and following may have changed the camera this frame.
    // Resolve its position before probing, including instant reduced-motion turns.
    this.camera.getViewMatrix();
    this.updateOcclusion(elapsed);
    const companion = this.neighborhood?.position();
    if (companion)
      this.destinations = this.destinations.map((p) =>
        p.id === 'amos' ? { ...p, ...companion } : p,
      );
    const neri = this.road?.position();
    this.setData(
      'roadCompanion',
      neri
        ? JSON.stringify({
            ...neri,
            region: this.state.region,
            step: this.state.road.company.step,
            stage: this.state.road.company.stage,
          })
        : '',
    );
    if (neri)
      this.destinations = this.destinations.map((p) => (p.id === 'neri' ? { ...p, ...neri } : p));
    this.stage.setView(this.camera.target);
    this.stage.tick(Math.min(elapsed, 0.1), this.active && !this.paused);
    this.scene.render();
    const playback = this.actorPlayer.playback;
    this.setData('boatHeading', String(this.getBoatHeading() ?? ''));
    this.setData('actorPose', playback.clip);
    this.setData('actorFrame', playback.frame.toFixed(2));
    this.setData('actorHeading', String(this.playerModel?.rotation.y ?? Number.NaN));
    this.setData('actionMotion', this.seatedAction ? 'SitDown' : playback.action);
    if (performance.now() - this.lastFrame > 45) this.publishFrame();
  }
  /** Publish the HUD now, so a pause shows the minimap where the traveler actually stopped. */
  flushFrame(): void {
    if (this.active && this.player) this.publishFrame();
  }
  /** Hand the HUD this frame's position, labels and heading; every 45 ms while rendering. */
  private publishFrame(): void {
    this.lastFrame = performance.now();
    const width = this.engine.getRenderWidth(),
      height = this.engine.getRenderHeight();
    const rect = this.canvas.getBoundingClientRect();
    const labels = this.destinations.map((p) => {
      const hull =
        p.id === 'board-' + this.state.region && this.mooredBoat?.isEnabled()
          ? this.mooredBoat.getAbsolutePosition()
          : undefined;
      // Keep the standing name clearance above Neri's actual seated head attachment.
      const seatedHead =
        p.id === 'neri' &&
        this.state.road.company.stage === 'complete' &&
        this.road?.conversationActor.root.isEnabled()
          ? this.road.conversationActor.model.socket('head').getAbsolutePosition()
          : undefined;
      const anchor = seatedHead ?? hull;
      const v = Vector3.Project(
        new Vector3(
          anchor?.x ?? p.x,
          (anchor?.y ?? groundHeight(this.state.region, p)) +
            (seatedHead ? 0.78 : p.kind === 'person' ? 2.18 : 1.9),
          anchor?.z ?? p.z,
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
          (this.guidance === 'full' || distance(p, this.position) < 5 || p.id === this.destination),
      };
    });
    const head = Vector3.Project(
      new Vector3(this.player.position.x, this.player.position.y + 2.18, this.player.position.z),
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(width, height),
    );
    this.callbacks.frame(
      this.position,
      labels,
      this.camera.alpha,
      this.nearest()?.id ?? null,
      this.destination,
      this.path.at(-1),
      head.z > 0 && head.z < 1
        ? { x: (head.x / width) * rect.width, y: (head.y / height) * rect.height }
        : undefined,
    );
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
  refreshFrame(resetClock = true): void {
    if (resetClock) this.lastRender = 0;
    this.cadence.invalidate();
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
    if (!this.layout)
      this.grid = new WalkGrid(
        [...obstacles, ...storedJarObstacles(state), ...passageObstacles(state)],
        isLand,
      );
    for (const activity of this.activities())
      if (activity !== this.activity) activity.update?.(state);
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
    if (target && this.cameraReturn) {
      // Work owns the next frame; retain the ordinary destination for its bookmark.
      applyCameraPose(this.camera, this.cameraReturn.to);
      this.cameraReturn = undefined;
    }
    // A new Work frame replaces old camera motion; live same-target updates retain input.
    if (target && target.id !== this.workView?.id) this.stopCameraMotion();
    // Work close restores its bookmark; a step started inside Work ends at that handoff.
    if (!target && this.workView?.active) this.stopCameraMotion();
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
        // Reading owns its viewport fit; restore the ordinary layout at its current size.
        this.fitCamera();
        this.cameraReturn = { from, to: cameraPose(this.camera), t: 0 };
        applyCameraPose(this.camera, from);
      } else {
        this.conversationView?.clear();
        this.fitCamera();
      }
      return;
    }
    this.cameraReturn = undefined;
    const actor =
      id === 'neri'
        ? this.road?.conversationActor
        : (this.actors.get(id) ?? this.activity?.conversationActor(id));
    const anchor = actor ? conversationAnchor(actor) : undefined;
    if (!actor || !anchor || distance(this.position, anchor) > 4.5) {
      this.conversationView?.clear();
      return;
    }
    this.conversationView?.select(id, actor, this.actorPlayer, rect);
    this.conversationView?.setPaused(paused);
  }
  frameWork(): void {
    if (this.workView?.active) this.stopCameraMotion();
    this.workView?.frame();
  }
  getCompanionPosition(): Point | undefined {
    return this.neighborhood?.position();
  }
  getRoadCompanionPosition(): Point | undefined {
    return this.road?.position();
  }
  /** A burst of sparks over the traveler when a story completes. */
  fireworks(): void {
    this.stage.atmosphere.fireworks(this.player.position.add(new Vector3(0, 1.9, 0)));
  }
  /** A cosmetic emote: the traveler stops, then plays the gesture once. */
  emote(clip: ActorClip): boolean {
    if (this.paused || this.seatedAction || this.travelerBoat) return false;
    this.stop();
    this.conversationView?.clear();
    this.actorPlayer.playOnce(clip);
    if (this.reducedMotion) this.poseTraveler(false, 0);
    return true;
  }
  performInteraction(motion?: ActionMotion, target?: string): void {
    if (motion !== 'SitDown') this.clearSeatedAction();
    this.conversationView?.clear();
    if (!motion) this.activity?.perform();
    else {
      const place = this.destinations.find((p) => p.id === target);
      if (motion === 'SitDown' && place && !this.reducedMotion) {
        this.stop();
        this.actorPlayer.cancelAction();
        this.seatedAction = benchMotion(this.position, place, this.playerModel.rotation.y);
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
    this.interactionFeedback?.dispose();
    this.actionFeedback?.dispose();
    this.water?.dispose();
    this.conversationView?.dispose();
    this.workView?.dispose();
    this.deactivate();
    this.cleanup.forEach((fn) => fn());
    for (const activity of this.activities()) activity.dispose?.();
    this.cover?.dispose();
    this.library.dispose();
    this.stage.dispose();
    this.scene.dispose();
  }
}
