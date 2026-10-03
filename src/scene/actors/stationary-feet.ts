import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Model } from '../assets';

type Pose = { position: Vector3; scaling: Vector3; rotation: Quaternion };
type Side = 'left' | 'right';
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
  get hasPresentation(): boolean {
    return Boolean(this.displayed);
  }
  constructor(
    private model: Model,
    private clearances: (ground: FootSupportOptions['ground']) => Record<Side, number>,
  ) {
    this.nodes = ['thigh_left', 'thigh_right', 'leg_left', 'leg_right'].map(model.socket);
    // Keep the imported basis relative to the placement, before Idle adds its small root lean.
    // Packed rest rotations are not quaternion identity.
    this.rest = this.presentation(model.root);
  }
  /** Sparse animation channels do not overwrite translated thigh branches. */
  restoreSampledPose(): void {
    if (!this.sampled) return;
    this.nodes.forEach((node, index) => writePose(node, this.sampled![index]!));
    this.sampled = undefined;
  }
  reset(): void {
    this.restoreSampledPose();
    this.displayed = undefined;
    this.source = undefined;
    this.stationary = false;
    this.elapsed = 0;
  }
  apply(options: FootSupportOptions): void {
    this.restoreSampledPose();
    const sampled = this.nodes.map(readPose);
    if (options.frozen && this.displayed) {
      this.putPresentation(this.displayed);
      this.sampled = sampled;
      return;
    }
    if (options.stationary) {
      this.putPresentation(this.rest, this.model.root);
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
    this.model.root.computeWorldMatrix(true);
    for (const node of this.model.root.getChildTransformNodes()) node.computeWorldMatrix(true);
  }
  /** Navigation-relative world poses survive model lift/roll changes without moving the grip. */
  private presentation(parent = this.model.root.parent as TransformNode | null): Pose[] {
    this.refresh();
    const inverse = parent ? Matrix.Invert(parent.computeWorldMatrix(true)) : Matrix.Identity();
    return this.nodes.map((node) => matrixPose(node.getWorldMatrix().multiply(inverse)));
  }
  private putPresentation(
    poses: Pose[],
    parent = this.model.root.parent as TransformNode | null,
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
    const feet = this.clearances(ground);
    (['left', 'right'] as const).forEach((side, index) => {
      const offset = onlyPenetration ? Math.max(0, -feet[side]) : -feet[side];
      const node = this.nodes[index]!;
      const inverse = Matrix.Invert((node.parent as TransformNode).computeWorldMatrix(true));
      node.position.addInPlace(Vector3.TransformNormal(new Vector3(0, offset, 0), inverse));
    });
    this.refresh();
  }
}
