import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Model } from '../assets';

type Pose = { position: Vector3; scaling: Vector3; rotation: Quaternion };
type Side = 'left' | 'right';
export interface FootSupportContinuation {
  step(dt: number, immediate?: boolean): boolean;
  release(): void;
}
export interface FootSupportOptions {
  stationary: boolean;
  dt: number;
  ground: (x: number, z: number) => number;
  immediate?: boolean;
  frozen?: boolean;
}

const readPose = (node: TransformNode): Pose => ({
  position: node.position.clone(),
  scaling: node.scaling.clone(),
  rotation: node.rotationQuaternion?.clone() ?? Quaternion.FromEulerVector(node.rotation),
});
function writePose(node: TransformNode, pose: Pose): void {
  node.position.copyFrom(pose.position);
  node.scaling.copyFrom(pose.scaling);
  node.rotationQuaternion ??= Quaternion.Identity();
  node.rotationQuaternion.copyFrom(pose.rotation);
}
function matrixPose(matrix: Matrix): Pose {
  const pose = {
    position: Vector3.Zero(),
    scaling: Vector3.One(),
    rotation: Quaternion.Identity(),
  };
  matrix.decompose(pose.scaling, pose.rotation, pose.position);
  return pose;
}

/** Optional traveler presentation; imported rest legs retain the authored grip and upper body. */
export class StationaryFeet {
  private nodes: TransformNode[];
  private rest: Pose[];
  private sampled?: Pose[];
  private displayed?: Pose[];
  private source?: Pose[];
  private stationary = false;
  private elapsed = 0;
  private ground?: FootSupportOptions['ground'];
  private revision = 0;
  private model?: Model;
  private clearances?: (ground: FootSupportOptions['ground']) => Record<Side, number>;
  private continuations = new Set<() => void>();
  private scene?: Scene;
  private sceneObserver?: Observer<Scene>;
  private restoreRootDispose?: () => void;
  private disposed = false;
  get hasPresentation(): boolean {
    return Boolean(this.displayed);
  }
  constructor(
    model: Model,
    clearances: (ground: FootSupportOptions['ground']) => Record<Side, number>,
  ) {
    this.model = model;
    this.clearances = clearances;
    this.nodes = ['thigh_left', 'thigh_right', 'leg_left', 'leg_right'].map(model.socket);
    // Keep the imported basis relative to the placement, before Idle adds its small root lean.
    // Packed rest rotations are not quaternion identity.
    this.rest = this.presentation(model.root);
    // Scene releases meshes before roots; root's observable runs after its children.
    this.scene = model.root.getScene();
    this.sceneObserver = this.scene.onDisposeObservable.add(() => this.dispose());
    const root = model.root;
    const originalDispose = root.dispose;
    const descriptor = Object.getOwnPropertyDescriptor(root, 'dispose');
    // Disposal drops the wrapper's helper reference, even beneath another wrapper.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let owner: StationaryFeet | undefined = this;
    const restore = () => {
      owner = undefined;
      if (root.dispose !== dispose) return;
      if (descriptor) Object.defineProperty(root, 'dispose', descriptor);
      else delete (root as Partial<TransformNode>).dispose;
    };
    const dispose = (...args: Parameters<TransformNode['dispose']>) => {
      if (owner) owner.dispose();
      else restore();
      originalDispose.apply(root, args);
    };
    root.dispose = dispose;
    this.restoreRootDispose = restore;
  }
  /** Sparse animation channels do not overwrite translated thigh branches. */
  restoreSampledPose(): void {
    if (this.disposed || !this.sampled) return;
    this.nodes.forEach((node, index) => writePose(node, this.sampled![index]!));
    this.sampled = undefined;
  }
  /** A caller-owned cosmetic scope; invalidation drops both helper and caller references. */
  continuation(onRelease?: () => void): FootSupportContinuation | undefined {
    if (this.disposed || !this.displayed || !this.ground) return;
    // A released scope must stop retaining its helper and scene callbacks.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let owner: StationaryFeet | undefined = this;
    const revision = this.revision;
    const continuations = this.continuations;
    const release = () => {
      owner = undefined;
      continuations.delete(release);
      onRelease?.();
      onRelease = undefined;
    };
    continuations.add(release);
    return {
      step(dt, immediate = false) {
        if (!owner || owner.revision !== revision || !owner.displayed || !owner.ground) {
          release();
          return false;
        }
        // A settled paused actor has no moving terrain or clip to resample.
        if (owner.stationary && !owner.source) return true;
        if (!immediate && (!Number.isFinite(dt) || dt <= 0)) return true;
        owner.apply({
          stationary: true,
          // Held arrivals settle over 0.32s; ordinary gait transitions remain 0.16s.
          dt: Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) * 0.5 : 0,
          ground: owner.ground,
          immediate,
        });
        return true;
      },
      release,
    };
  }
  reset(): void {
    if (this.disposed) return;
    this.ground = undefined;
    this.revision++;
    for (const release of this.continuations) release();
    this.restoreSampledPose();
    this.displayed = undefined;
    this.source = undefined;
    this.stationary = false;
    this.elapsed = 0;
  }
  apply(options: FootSupportOptions): void {
    if (this.disposed) return;
    this.ground = options.ground;
    this.restoreSampledPose();
    const sampled = this.nodes.map(readPose);
    if (options.frozen && this.displayed) {
      this.putPresentation(this.displayed);
      this.sampled = sampled;
      return;
    }
    if (options.stationary) {
      this.putPresentation(this.rest, this.model!.root);
      this.support(options.ground, false);
    }
    const target = this.presentation();
    if (this.stationary !== options.stationary) {
      this.source = this.displayed;
      this.elapsed = 0;
    }
    this.stationary = options.stationary;
    this.elapsed += Math.max(0, options.dt);
    const fraction =
      options.immediate || options.dt === 0 || !this.displayed
        ? 1
        : Math.min(1, this.elapsed / 0.16);
    if (this.source && fraction < 1) {
      const t = fraction * fraction * (3 - 2 * fraction);
      this.putPresentation(
        target.map((pose, index) => {
          const source = this.source![index]!;
          return {
            position: Vector3.Lerp(source.position, pose.position, t),
            scaling: Vector3.Lerp(source.scaling, pose.scaling, t),
            rotation: Quaternion.Slerp(source.rotation, pose.rotation, t),
          };
        }),
      );
      // Entry/exit interpolation may lower a sandal; lift only that branch when needed.
      this.support(options.ground, true);
    } else this.source = undefined;
    this.displayed = this.presentation();
    this.sampled = options.stationary || this.source ? sampled : undefined;
  }
  private refresh(): void {
    this.model!.root.computeWorldMatrix(true);
    for (const node of this.model!.root.getChildTransformNodes()) node.computeWorldMatrix(true);
  }
  /** Navigation-relative world poses survive model lift/roll changes without moving the grip. */
  private presentation(parent = this.model!.root.parent as TransformNode | null): Pose[] {
    this.refresh();
    const inverse = parent ? Matrix.Invert(parent.computeWorldMatrix(true)) : Matrix.Identity();
    return this.nodes.map((node) => matrixPose(node.getWorldMatrix().multiply(inverse)));
  }
  private putPresentation(
    poses: Pose[],
    parent = this.model!.root.parent as TransformNode | null,
  ): void {
    const navigation = parent?.computeWorldMatrix(true) ?? Matrix.Identity();
    this.nodes.forEach((node, index) => {
      const pose = poses[index]!;
      const world = Matrix.Compose(pose.scaling, pose.rotation, pose.position).multiply(navigation);
      const inverse = Matrix.Invert((node.parent as TransformNode).computeWorldMatrix(true));
      writePose(node, matrixPose(world.multiply(inverse)));
      node.computeWorldMatrix(true);
    });
    this.refresh();
  }
  private support(ground: FootSupportOptions['ground'], onlyPenetration: boolean): void {
    const feet = this.clearances!(ground);
    (['left', 'right'] as const).forEach((side, index) => {
      const offset = onlyPenetration ? Math.max(0, -feet[side]) : -feet[side];
      const node = this.nodes[index]!;
      const inverse = Matrix.Invert((node.parent as TransformNode).computeWorldMatrix(true));
      node.position.addInPlace(Vector3.TransformNormal(new Vector3(0, offset, 0), inverse));
    });
    this.refresh();
  }
  /** Release without restoring or sampling nodes that Babylon is about to destroy. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ground = undefined;
    this.revision++;
    for (const release of this.continuations) release();
    if (this.sceneObserver) this.scene?.onDisposeObservable.remove(this.sceneObserver);
    this.restoreRootDispose?.();
    this.model = this.clearances = undefined;
    this.sampled = this.displayed = this.source = undefined;
    this.scene = this.sceneObserver = this.restoreRootDispose = undefined;
    this.nodes = [];
    this.rest = [];
    this.stationary = false;
    this.elapsed = 0;
  }
}
