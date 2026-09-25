import { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Settings } from '../../game/types';
import { environmentFor } from '../../content/environment';
import { StageEnvironment } from '../environment/stage';
import { WaterPresentation } from '../presentation/water';
import { backdropTerrain, fbm } from '../presentation/ground';

/**
 * The welcome backdrop: dawn over the lake, built entirely from code. It requests no models,
 * saves nothing and is disposed when the first journey region opens.
 */
export class TitleView {
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private stage: StageEnvironment;
  private water: WaterPresentation;
  private boats: TransformNode[] = [];
  private time = 0;
  private last = 0;
  private reduced = false;
  private paused = false;
  constructor(private engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.skipPointerMovePicking = true;
    // Looking east from the northern shore toward the sunrise over the water.
    this.camera = new ArcRotateCamera(
      'title-camera',
      Math.PI,
      1.4,
      34,
      new Vector3(30, 3.5, 7),
      this.scene,
    );
    this.camera.fov = 0.72;
    this.camera.minZ = 0.3;
    this.camera.maxZ = 400;
    this.stage = new StageEnvironment(this.scene, this.camera, environmentFor('title'), {
      sky: 360,
      horizon: { center: { x: 30, z: 0 }, radius: 150, seed: 29 },
      ground: () => 0,
      shadowCenter: new Vector3(0, 0, 0),
    });
    this.water = new WaterPresentation(this.scene, {
      name: 'title-lake',
      width: 380,
      depth: 380,
      x: 150,
      y: -0.12,
      land: [{ x: -500 + 2, z: 0, halfX: 500, halfZ: 1000 }],
      wobble: { amplitude: 2.4, frequency: 0.09 },
    });
    this.stage.attachWater(this.water);
    backdropTerrain(this.scene, {
      reserve: { minX: -8, maxX: 400, minZ: -400, maxZ: 400 },
      size: 300,
      style: 'shore',
      water: (p) => p.x > 2 + 2.4 * Math.sin(p.z * 0.09),
    });
    this.foreground();
    for (const [x, z, s] of [
      [48, -6, 1],
      [88, 26, 0.8],
    ] as const)
      this.boats.push(this.sailBoat(x, z, s));
  }
  /** Low shore stones and reeds framing the lower left of the view. */
  private foreground(): void {
    const positions: number[] = [],
      indices: number[] = [],
      colors: number[] = [];
    const stone = Color3.FromHexString('#8a8573'),
      reed = Color3.FromHexString('#6f7a45'),
      head = Color3.FromHexString('#8c6a45');
    const push = (x: number, y: number, z: number, c: Color3) => {
      positions.push(x, y, z);
      colors.push(c.r, c.g, c.b, 1);
      return positions.length / 3 - 1;
    };
    for (let i = 0; i < 26; i++) {
      const x = -2 + fbm(i, 3) * 6,
        z = -18 + i * 1.6 + (fbm(i, 7) - 0.5) * 3;
      const r = 0.3 + fbm(i, 11) * 0.7;
      const base = push(x, 0.5 * r, z, stone.scale(0.9 + fbm(i, 13) * 0.2));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        push(x + Math.cos(a) * r, -0.05, z + Math.sin(a) * r, stone.scale(0.8));
      }
      for (let k = 0; k < 6; k++) indices.push(base, base + 1 + ((k + 1) % 6), base + 1 + k);
    }
    for (let i = 0; i < 90; i++) {
      const x = -1 + fbm(i, 21) * 4.5,
        z = -20 + fbm(i, 23) * 44;
      const h = 0.8 + fbm(i, 29) * 1.2,
        lean = 0.15 + fbm(i, 31) * 0.3;
      const a = push(x - 0.03, 0, z, reed),
        b = push(x + 0.03, 0, z, reed),
        c = push(x + lean, h, z + 0.02, head);
      indices.push(a, c, b, a, b, c);
    }
    const mesh = new Mesh('title-foreground', this.scene);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = this.stage.material('title-foreground-matte', '#ffffff');
    mesh.material.backFaceCulling = false;
    mesh.isPickable = false;
  }
  /** A small fishing boat with a furled-looking sail, as a distant silhouette. */
  private sailBoat(x: number, z: number, scale: number): TransformNode {
    const root = new TransformNode('title-boat', this.scene);
    const hull = MeshBuilder.CreateCylinder(
      'title-hull',
      { height: 4.2, diameterTop: 1.5, diameterBottom: 1.5, tessellation: 8, arc: 0.5 },
      this.scene,
    );
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.scaling.set(1, 1, 0.55);
    hull.parent = root;
    hull.material = this.stage.material('title-hull-wood', '#6b5238');
    hull.material.backFaceCulling = false;
    const mast = MeshBuilder.CreateCylinder(
      'title-mast',
      { height: 4.6, diameter: 0.12, tessellation: 5 },
      this.scene,
    );
    mast.position.y = 2.3;
    mast.parent = root;
    mast.material = hull.material;
    const sail = new Mesh('title-sail', this.scene);
    const data = new VertexData();
    data.positions = [0, 4.4, 0, 0, 0.9, -0.2, 0, 0.9, 2.3];
    data.indices = [0, 1, 2];
    data.normals = [1, 0, 0, 1, 0, 0, 1, 0, 0];
    data.applyToMesh(sail);
    sail.material = this.stage.material('title-sail-linen', '#e9dcc0');
    sail.material.backFaceCulling = false;
    sail.parent = root;
    root.position.set(x, 0, z);
    root.scaling.setAll(scale);
    root.rotation.y = 0.5;
    this.stage.shadow.addShadowCaster(hull);
    return root;
  }
  async load(): Promise<void> {
    await this.scene.whenReadyAsync();
  }
  applySettings(settings: Settings): void {
    this.reduced = settings.reducedMotion;
    this.water.quality(settings.quality === 'low');
    this.stage.applySettings(settings);
  }
  setPaused(value: boolean): void {
    this.paused = value;
  }
  renderFrame(): void {
    if (document.hidden) {
      this.last = 0;
      return;
    }
    const now = performance.now();
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
    this.last = now;
    const running = !this.paused && !this.reduced;
    if (running) this.time += dt;
    // A slow breathing drift keeps the view alive without drawing attention.
    this.camera.alpha = Math.PI + Math.sin(this.time * 0.05) * 0.035;
    this.camera.beta = 1.4 + Math.sin(this.time * 0.07) * 0.012;
    this.boats.forEach((boat, i) => {
      boat.position.x += running ? dt * 0.12 * (i ? -0.6 : 1) : 0;
      boat.position.y = Math.sin(this.time * 0.9 + i) * 0.06;
      boat.rotation.z = Math.sin(this.time * 0.7 + i) * 0.025;
    });
    this.water.tick(this.time, this.reduced);
    this.water.setRipples(
      this.boats.map((b) => ({ x: b.position.x, z: b.position.z, radius: 2.2, strength: 0.35 })),
    );
    this.stage.setView(new Vector3(40, 4, 0));
    this.stage.tick(dt, running);
    this.scene.render();
  }
  dispose(): void {
    this.water.dispose();
    this.stage.dispose();
    this.scene.dispose();
    this.engine.getRenderingCanvas()?.removeAttribute('data-title');
  }
}
