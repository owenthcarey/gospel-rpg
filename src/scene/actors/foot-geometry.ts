import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Model } from '../assets';

export type FootSide = 'left' | 'right';
const suffix = (name: string) => name.split(':').at(-1);
export function footSide(name: string | undefined): FootSide | undefined {
  if (name === 'leg_left' || name === 'foot_left') return 'left';
  if (name === 'leg_right' || name === 'foot_right') return 'right';
}

/** Validate the paired rigid foot hierarchy before support reads its child transforms. */
export function requireSupportedFootPair(
  model: Model,
): Record<FootSide, TransformNode> | undefined {
  const nodes = model.root.getChildTransformNodes();
  const meshes = model.root.getChildMeshes().filter((mesh) => mesh.getTotalVertices() > 0);
  const candidates = nodes.filter((node) =>
    ['foot_left', 'foot_right'].includes(suffix(node.name)!),
  );
  const boneFeet = meshes.flatMap(
    (mesh) =>
      mesh.skeleton?.bones.filter((bone) =>
        ['foot_left', 'foot_right'].includes(suffix(bone.name)!),
      ) ?? [],
  );
  if (!candidates.length && !boneFeet.length) return;
  const fail = (reason: string): never => {
    throw new Error('Unsupported articulated foot rig: ' + reason);
  };
  if (meshes.length !== 1 || meshes[0]!.getTotalVertices() !== 3112) fail('actor skin domain');
  const mesh = meshes[0]!;
  const skeleton = mesh.skeleton;
  if (!skeleton || skeleton.bones.length !== 16 || boneFeet.length !== 2) fail('bone domain');
  if (mesh.numBoneInfluencers !== 4 || !mesh.computeBonesUsingShaders || mesh.morphTargetManager)
    fail('skin mode');
  const pair = {} as Record<FootSide, TransformNode>;
  for (const side of ['left', 'right'] as const) {
    const matches = candidates.filter((node) => suffix(node.name) === 'foot_' + side);
    if (matches.length !== 1) fail('complete unique ' + side + ' foot');
    const foot = matches[0]!;
    const leg = model.socket('leg_' + side);
    const bones = skeleton!.bones.filter((bone) => suffix(bone.name) === 'foot_' + side);
    if (
      foot.parent !== leg ||
      bones.length !== 1 ||
      bones[0]!.getTransformNode() !== foot ||
      bones[0]!.getParent()?.getTransformNode() !== leg
    )
      fail(side + ' parent/link');
    if (!(foot instanceof TransformNode) || foot.isDisposed() || leg.isDisposed())
      fail(side + ' lifetime');
    pair[side] = foot;
  }
  const positions = mesh.getVerticesData('position');
  const joints = mesh.getVerticesData('matricesIndices');
  const weights = mesh.getVerticesData('matricesWeights');
  if (
    !positions ||
    positions.length !== 3112 * 3 ||
    !joints ||
    joints.length !== 3112 * 4 ||
    !weights ||
    weights.length !== joints.length
  )
    fail('attribute domain');
  for (let vertex = 0; vertex < 3112; vertex++) {
    for (let axis = 0; axis < 3; axis++)
      if (!Number.isFinite(positions![vertex * 3 + axis])) fail('nonfinite position');
    for (let slot = 0; slot < 4; slot++) {
      const joint = joints![vertex * 4 + slot]!;
      if (!Number.isInteger(joint) || joint < 0 || joint >= 16) fail('palette index');
      if (weights![vertex * 4 + slot] !== (slot === 0 ? 1 : 0)) fail('nonrigid weight');
    }
  }
  return pair;
}
