import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { WorkTarget, ScreenPreview } from '../content/exploration/work';
import { REST_LAYOUTS, supplyPosition } from '../game/galilee/arrangement';
import type { GameState } from '../game/types';
import { checkArrangement } from '../game/galilee/arrangement';
import { groundHeight } from '../content/campaign/layouts';

export interface WorkRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface CameraBookmark {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
  min: number | null;
  max: number | null;
}

/** Presentation owns temporary camera/preview geometry; it never writes GameState. */
export class WorkPresentation {
  private bookmark?: CameraBookmark;
  private target?: WorkTarget;
  private bounds?: WorkRect;
  private cameraGoal?: Vector3;
  private ring: Mesh;
  private approach: Mesh;
  private preview: Mesh[] = [];
  private gold: StandardMaterial;
  private proposal: StandardMaterial;
  private approachMaterial: StandardMaterial;
  private viewportKey = '';
  private needsFrame = false;
  constructor(
    private scene: Scene,
    private camera: ArcRotateCamera,
    private canvas: HTMLCanvasElement,
  ) {
    this.gold = this.material('work-selection-gold', '#e9c36a');
    this.proposal = this.material('work-proposal-blue', '#6bccdf');
    this.approachMaterial = this.material('work-approach', '#99c4ad');
    this.ring = MeshBuilder.CreateTorus(
      'selected-work-target',
      { diameter: 1.3, thickness: 0.035, tessellation: 32 },
      scene,
    );
    this.ring.material = this.gold;
    this.approach = MeshBuilder.CreateGround(
      'work-southern-approach',
      { width: 1, height: 1.6 },
      scene,
    );
    this.approach.material = this.approachMaterial;
    // A broken outline distinguishes proposed placement from solid, placed furniture.
    for (let i = 0; i < 18; i++) {
      const part = MeshBuilder.CreateBox(
        'work-screen-preview-' + i,
        { width: i < 12 ? 0.24 : 0.045, height: i < 12 ? 0.045 : 0.38, depth: 0.045 },
        scene,
      );
      part.material = this.proposal;
      this.preview.push(part);
    }
    for (const mesh of [this.ring, this.approach, ...this.preview]) {
      mesh.isPickable = false;
      mesh.setEnabled(false);
    }
  }
  private material(name: string, hex: string): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
    material.emissiveColor = material.diffuseColor.scale(0.25);
    material.specularColor = Color3.Black();
    return material;
  }
  get active(): boolean {
    return !!this.target;
  }
  get focusPoint(): Vector3 | undefined {
    return this.cameraGoal;
  }
  get id(): string | undefined {
    return this.target?.id;
  }
  select(target: WorkTarget | undefined, state: GameState, preview?: ScreenPreview): void {
    if (!target) {
      this.clear();
      return;
    }
    if (!this.bookmark)
      this.bookmark = {
        alpha: this.camera.alpha,
        beta: this.camera.beta,
        radius: this.camera.radius,
        target: this.camera.target.clone(),
        min: this.camera.lowerRadiusLimit,
        max: this.camera.upperRadiusLimit,
      };
    const changed = this.target?.id !== target.id;
    this.target = target;
    if (changed) {
      this.needsFrame = true;
      this.viewportKey = '';
    }
    const height = groundHeight(state.region, target.point);
    this.ring.position.set(target.point.x, height + 0.055, target.point.z);
    this.ring.setEnabled(true);
    this.cameraGoal = new Vector3(
      target.focus.center.x,
      groundHeight(state.region, target.focus.center),
      target.focus.center.z,
    );
    this.preview.forEach((mesh) => mesh.setEnabled(false));
    this.approach.setEnabled(!!target.site);
    if (target.site) {
      const site = REST_LAYOUTS[target.site];
      const p = { x: site.x, z: site.z - 2.35 };
      this.approach.position.set(p.x, groundHeight(state.region, p) + 0.045, p.z);
      const direction = preview?.direction ?? state.galilee.shelter.screen;
      const blocked =
        state.galilee.shelter.site === target.site &&
        state.galilee.shelter.placed.includes('screen') &&
        direction === 2;
      this.approachMaterial.diffuseColor = Color3.FromHexString(
        blocked ? '#c28269' : '#99c4ad',
      ).toLinearSpace();
      // A diagonal marking is visible when the proposed or committed approach is blocked.
      this.approach.rotation.y = blocked ? Math.PI / 4 : 0;
      this.approach.scaling.x = blocked ? 0.4 : 1;
    }
    if (preview) this.showPreview(state, preview);
    this.scene.metadata = {
      ...this.scene.metadata,
      work: { target: target.id, preview: preview ?? null },
    };
  }
  private showPreview(s: GameState, preview: ScreenPreview): void {
    const p = supplyPosition(preview.site, 'screen', preview.direction),
      y = groundHeight(s.region, p) + 0.06;
    const angle = (preview.direction * Math.PI) / 2;
    const supported = checkArrangement({ ...s.galilee.shelter, screen: preview.direction }).ready;
    this.proposal.diffuseColor = Color3.FromHexString(
      supported ? '#6bccdf' : '#e2b177',
    ).toLinearSpace();
    this.preview.forEach((mesh, i) => {
      const top = i >= 6,
        n = i % 6;
      const x = i < 12 ? (n - 2.5) * 0.28 : i < 15 ? -0.82 : 0.82;
      mesh.position.set(
        p.x + Math.cos(angle) * x,
        y + (i < 12 ? (top ? 1.65 : 0.05) : 0.35 + ((i - 12) % 3) * 0.51),
        p.z - Math.sin(angle) * x,
      );
      mesh.rotation.y = angle;
      mesh.setEnabled(true);
    });
  }
  setBounds(rect?: WorkRect): void {
    this.bounds = rect;
  }
  frame(): void {
    this.needsFrame = true;
  }
  tick(reduced: boolean, dt: number): void {
    if (!this.target || !this.cameraGoal) return;
    const w = Math.max(1, this.canvas.clientWidth),
      h = Math.max(1, this.canvas.clientHeight);
    const rect = this.bounds;
    // Reserve the actual panel rectangle, including large text and landscape reflow.
    const side = w >= 700;
    const view = side
      ? new Viewport(0, 0, Math.max(0.2, (rect?.left ?? w - 360) / w), 1)
      : new Viewport(
          0,
          Math.min(0.65, (h - (rect?.top ?? h * 0.56)) / h),
          1,
          Math.max(0.35, (rect?.top ?? h * 0.56) / h),
        );
    const key = [w, h, view.x, view.y, view.width, view.height].join(':');
    if (key !== this.viewportKey) {
      this.camera.viewport = view;
      this.viewportKey = key;
      this.needsFrame = true;
    }
    if (this.needsFrame) {
      const aspect = (w * view.width) / (h * view.height);
      const radius =
        (this.target.focus.radius / Math.tan(this.camera.fov / 2) / Math.min(1, aspect)) * 1.25;
      this.camera.lowerRadiusLimit = 6;
      this.camera.upperRadiusLimit = Math.max(45, radius * 1.5);
      this.camera.radius = radius;
      this.camera.alpha = -Math.PI / 2 - 0.2;
      this.camera.beta = 0.68;
      this.needsFrame = false;
    }
    if (reduced) this.camera.target.copyFrom(this.cameraGoal);
    else
      Vector3.LerpToRef(
        this.camera.target,
        this.cameraGoal,
        1 - Math.exp(-dt * 8),
        this.camera.target,
      );
  }
  clear(): void {
    if (this.bookmark) {
      const b = this.bookmark;
      this.camera.alpha = b.alpha;
      this.camera.beta = b.beta;
      this.camera.radius = b.radius;
      this.camera.target.copyFrom(b.target);
      this.camera.lowerRadiusLimit = b.min;
      this.camera.upperRadiusLimit = b.max;
      this.camera.inertialAlphaOffset =
        this.camera.inertialBetaOffset =
        this.camera.inertialRadiusOffset =
          0;
    }
    this.camera.viewport = new Viewport(0, 0, 1, 1);
    this.bookmark = undefined;
    this.target = undefined;
    this.cameraGoal = undefined;
    this.bounds = undefined;
    this.ring.setEnabled(false);
    this.approach.setEnabled(false);
    this.preview.forEach((m) => m.setEnabled(false));
    this.scene.metadata = { ...this.scene.metadata, work: null };
  }
  dispose(): void {
    this.clear();
    [this.ring, this.approach, ...this.preview].forEach((m) => m.dispose());
    [this.gold, this.proposal, this.approachMaterial].forEach((m) => m.dispose());
  }
}
