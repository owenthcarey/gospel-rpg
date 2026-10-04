import assert from 'node:assert/strict';
import membership from '../fixtures/villager-foot-membership.json';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

type Side = 'left' | 'right';
const semanticJoint = (name: string) =>
  name
    .split(':')
    .at(-1)!
    .replace(/\.\d+$/, '');

/** Source polygons identify the actual articulated soles; no rest-height classifier. */
export function authoredFootMembership(mesh: AbstractMesh): typeof membership | undefined {
  const skeleton = mesh.skeleton,
    bones = skeleton?.bones ?? [],
    feet = bones.filter((bone) => /^foot_(left|right)$/.test(semanticJoint(bone.name)));
  if (!feet.length) return;
  assert.equal(mesh.getTotalVertices(), 3112, 'pinned articulated skin vertex domain');
  assert.equal(bones.length, 16, 'complete articulated bone palette');
  assert.equal(feet.length, 2, 'complete unique foot pair');
  assert.equal(mesh.numBoneInfluencers, 4);
  assert.equal(mesh.computeBonesUsingShaders, true);
  assert.ok(!mesh.morphTargetManager);
  const indices = mesh.getVerticesData('matricesIndices')!,
    weights = mesh.getVerticesData('matricesWeights')!;
  assert.equal(indices?.length, 3112 * 4);
  assert.equal(weights?.length, 3112 * 4);
  const lower = { left: [] as number[], right: [] as number[] },
    foot = { left: [] as number[], right: [] as number[] };
  for (let vertex = 0; vertex < 3112; vertex++) {
    for (let slot = 0; slot < 4; slot++) {
      const joint = indices[vertex * 4 + slot]!;
      assert.ok(Number.isInteger(joint) && joint >= 0 && joint < 16);
      assert.equal(weights[vertex * 4 + slot], slot === 0 ? 1 : 0);
    }
    const name = semanticJoint(bones[indices[vertex * 4]!]!.name);
    for (const side of ['left', 'right'] as const) {
      if (name === 'leg_' + side || name === 'foot_' + side) lower[side].push(vertex);
      if (name === 'foot_' + side) foot[side].push(vertex);
    }
  }
  for (const side of ['left', 'right'] as const) {
    const matched = feet.filter((bone) => semanticJoint(bone.name) === 'foot_' + side);
    assert.equal(matched.length, 1);
    const bone = matched[0]!,
      node = bone.getTransformNode();
    assert.ok(node && !node.isDisposed());
    assert.equal(semanticJoint(bone.getParent()!.name), 'leg_' + side);
    assert.equal(node.parent, bone.getParent()!.getTransformNode());
    assert.equal(lower[side].length, 324);
    assert.equal(foot[side].length, 288);
    assert.deepEqual(lower[side], membership.lower[side]);
    assert.deepEqual(foot[side], membership.foot[side]);
    assert.equal(new Set(membership.sole[side]).size, 16);
    assert.ok(membership.sole[side].every((id) => foot[side].includes(id)));
  }
  return membership;
}

/** Complete calf plus foot envelope, preserving the legacy primary-leg domain. */
export function posedLowerVertices(root: TransformNode): Vector3[] {
  root.computeWorldMatrix(true);
  for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
  return root.getChildMeshes().flatMap((mesh) => {
    const authored = authoredFootMembership(mesh);
    mesh.skeleton?.prepare(true);
    const data = mesh.getPositionData(Boolean(mesh.skeleton)) ?? [],
      joints = mesh.getVerticesData('matricesIndices'),
      world = mesh.computeWorldMatrix(true);
    return (['left', 'right'] as Side[]).flatMap((side) => {
      const ids = authored
        ? authored.lower[side]
        : Array.from({ length: data.length / 3 }, (_, i) => i).filter(
            (i) => joints && mesh.skeleton?.bones[joints[i * 4]!]!.name === 'leg_' + side,
          );
      return ids.map((i) => Vector3.TransformCoordinates(Vector3.FromArray(data, i * 3), world));
    });
  });
}

/** Read the actual imported skin at its sampled pose, after Babylon's coordinate conversion. */
export function posedVertices(root: TransformNode, joint?: string): Vector3[] {
  root.computeWorldMatrix(true);
  for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
  return root.getChildMeshes().flatMap((mesh) => {
    mesh.skeleton?.prepare(true);
    const data = mesh.getPositionData(Boolean(mesh.skeleton)) ?? [];
    const joints = mesh.getVerticesData('matricesIndices'),
      world = mesh.computeWorldMatrix(true);
    return Array.from({ length: data.length / 3 }, (_, i) => i)
      .filter((i) => !joint || (joints && mesh.skeleton?.bones[joints[i * 4]!]!.name === joint))
      .map((i) => Vector3.TransformCoordinates(Vector3.FromArray(data, i * 3), world));
  });
}
/** Bake a review-only copy of visible Babylon geometry in Blender's Z-up coordinates. */
export function bakedGeometry(scene: Scene) {
  for (const node of scene.transformNodes) node.computeWorldMatrix(true);
  return scene.meshes
    .filter((mesh) => mesh.isEnabled() && mesh.isVisible && mesh.getTotalVertices())
    .map((mesh) => {
      mesh.skeleton?.prepare(true);
      const data = mesh.getPositionData(Boolean(mesh.skeleton))!;
      return {
        name: mesh.name,
        vertices: Array.from({ length: data.length / 3 }, (_, i) => {
          const p = Vector3.TransformCoordinates(
            Vector3.FromArray(data, i * 3),
            mesh.computeWorldMatrix(true),
          );
          return [p.x, -p.z, p.y];
        }),
        indices: Array.from(mesh.getIndices()!),
        colors: Array.from(mesh.getVerticesData('color') ?? []),
        faceColors: Array.from({ length: mesh.getTotalIndices() / 3 }, (_, i) => {
          const material = mesh.subMeshes
            .find((sub) => i * 3 >= sub.indexStart && i * 3 < sub.indexStart + sub.indexCount)
            ?.getMaterial() as unknown as {
            albedoColor?: { asArray(): number[] };
            diffuseColor?: { asArray(): number[] };
          };
          return material?.albedoColor?.asArray() ?? material?.diffuseColor?.asArray() ?? [1, 1, 1];
        }),
      };
    });
}
/** Smallest distance between two vertex sets, without spreading every pair onto the stack. */
export function nearestDistance(a: readonly Vector3[], b: readonly Vector3[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, Vector3.DistanceSquared(p, q));
  return Math.sqrt(best);
}
