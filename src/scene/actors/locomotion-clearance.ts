import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { ActorClip } from '../../content/assets';
import type { Model } from '../assets';

export type ActorGround = (x: number, z: number) => number;
type SandalMesh = {
  mesh: AbstractMesh;
  points: { x: number; y: number; z: number; joint: number }[];
};

/** Opted-in ordinary NPC clearance; translates the visual body without changing its authored rig. */
export class LocomotionClearance {
  private root?: TransformNode;
  private visual?: TransformNode;
  private scene?: Scene;
  private originalY: number;
  private reduced = false;
  private suppressed = false;
  private ordinary = false;
  private disabledObserver?: Observer<boolean>;
  private sceneObserver?: Observer<Scene>;
  private restoreRootDispose?: () => void;
  private disposed = false;
  private sandals: SandalMesh[] = [];
  private matrices = new Map<TransformNode, { local: Matrix; world: Matrix; epoch: number }>();
  private epoch = 0;
  private rotation = Quaternion.Identity();

  constructor(
    model: Model,
    private ground: ActorGround | undefined,
    private released: (() => void) | undefined,
  ) {
    const root = model.root;
    this.root = root;
    this.scene = root.getScene();
    this.visual = root.getChildTransformNodes(true).find((node) => node.name.endsWith(':visual'));
    if (!this.visual) throw new Error('Locomotion clearance requires a model visual wrapper');
    this.originalY = this.visual.position.y;
    for (const mesh of root.getChildMeshes()) {
      const positions = mesh.getVerticesData('position');
      const joints = mesh.getVerticesData('matricesIndices');
      if (!positions || !joints || !mesh.skeleton) continue;
      const points: SandalMesh['points'] = [];
      for (let i = 0; i < positions.length / 3; i++) {
        const joint = joints[i * 4]!;
        const name = mesh.skeleton.bones[joint]?.name.split(':').at(-1);
        if (name === 'leg_left' || name === 'leg_right')
          points.push({
            x: positions[i * 3]!,
            y: positions[i * 3 + 1]!,
            z: positions[i * 3 + 2]!,
            joint,
          });
      }
      if (points.length) this.sandals.push({ mesh, points });
    }
    this.disabledObserver = root.onEffectiveEnabledStateChangedObservable.add((enabled) => {
      if (!enabled) this.reset();
    });
    // Scene releases meshes before transform roots; root's disposal observable is too late.
    this.sceneObserver = this.scene.onDisposeObservable.add(() => this.dispose());
    const originalDispose = root.dispose;
    const descriptor = Object.getOwnPropertyDescriptor(root, 'dispose');
    const dispose = (...args: Parameters<TransformNode['dispose']>) => {
      this.dispose();
      originalDispose.apply(root, args);
    };
    root.dispose = dispose;
    this.restoreRootDispose = () => {
      if (root.dispose !== dispose) return;
      if (descriptor) Object.defineProperty(root, 'dispose', descriptor);
      else delete (root as Partial<TransformNode>).dispose;
    };
  }

  /** Remove only the visual offset before sampling or moving the navigation root. */
  clear(): void {
    if (this.visual) this.visual.position.y = this.originalY;
  }
  reset(): void {
    this.clear();
    this.ordinary = false;
  }
  setReducedMotion(value: boolean): void {
    if (this.reduced === value) return;
    this.reduced = value;
    // Recompose the existing ordinary pose before a paused menu can reveal it.
    this.refresh();
  }
  suppress(value: boolean): void {
    this.suppressed = value;
    this.reset();
  }
  apply(clip: ActorClip, still: boolean, performing: boolean): void {
    // Reduced Walk stays authored, but remains a source for the normal-mode handoff.
    this.ordinary =
      !performing && (clip === 'Idle' || (clip === 'Walk' && (!still || this.reduced)));
    this.refresh();
  }
  /** A controller reset can relocate an already sampled ordinary pose without resampling it. */
  refresh(): void {
    this.clear();
    if (
      !this.ordinary ||
      this.reduced ||
      this.suppressed ||
      this.disposed ||
      !this.root?.isEnabled() ||
      !this.visual ||
      !this.ground
    )
      return;
    const lift = Math.max(0, -this.minimum());
    if (Number.isFinite(lift)) this.visual.position.y = this.originalY + lift;
  }
  /** Compose packed local transforms without advancing Babylon's navigation-root cache.
   * Several simulation substeps share one render ID; forcing that cache changes turnTo's
   * absolute position compared with the authored controller on its next substep.
   */
  private world(node: TransformNode): Matrix {
    let entry = this.matrices.get(node);
    if (!entry) {
      entry = { local: Matrix.Identity(), world: Matrix.Identity(), epoch: -1 };
      this.matrices.set(node, entry);
    }
    if (entry.epoch === this.epoch) return entry.world;
    Quaternion.RotationYawPitchRollToRef(
      node.rotation.y,
      node.rotation.x,
      node.rotation.z,
      this.rotation,
    );
    Matrix.ComposeToRef(
      node.scaling,
      node.rotationQuaternion ?? this.rotation,
      node.position,
      entry.local,
    );
    if (node.parent instanceof TransformNode)
      entry.local.multiplyToRef(this.world(node.parent), entry.world);
    else entry.world.copyFrom(entry.local);
    entry.epoch = this.epoch;
    return entry.world;
  }
  private minimum(): number {
    this.epoch++;
    let minimum = Infinity;
    for (const { mesh, points } of this.sandals) {
      mesh.skeleton!.prepare(true);
      const bones = mesh.skeleton!.getTransformMatrices(mesh),
        world = this.world(mesh).m;
      for (const p of points) {
        const at = p.joint * 16;
        const x = p.x * bones[at]! + p.y * bones[at + 4]! + p.z * bones[at + 8]! + bones[at + 12]!;
        const y =
          p.x * bones[at + 1]! + p.y * bones[at + 5]! + p.z * bones[at + 9]! + bones[at + 13]!;
        const z =
          p.x * bones[at + 2]! + p.y * bones[at + 6]! + p.z * bones[at + 10]! + bones[at + 14]!;
        const worldX = x * world[0]! + y * world[4]! + z * world[8]! + world[12]!;
        const worldY = x * world[1]! + y * world[5]! + z * world[9]! + world[13]!;
        const worldZ = x * world[2]! + y * world[6]! + z * world[10]! + world[14]!;
        minimum = Math.min(minimum, worldY - this.ground!(worldX, worldZ));
      }
    }
    return minimum;
  }
  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    if (this.disabledObserver)
      this.root?.onEffectiveEnabledStateChangedObservable.remove(this.disabledObserver);
    if (this.sceneObserver) this.scene?.onDisposeObservable.remove(this.sceneObserver);
    this.restoreRootDispose?.();
    this.released?.();
    this.root = this.visual = undefined;
    this.scene = undefined;
    this.ground = this.released = this.restoreRootDispose = undefined;
    this.disabledObserver = this.sceneObserver = undefined;
    this.sandals = [];
    this.matrices.clear();
  }
}
