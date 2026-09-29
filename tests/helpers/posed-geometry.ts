import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

/** Read the actual imported skin at its sampled pose, after Babylon's coordinate conversion. */
export function posedVertices(root: TransformNode, joint?: string): Vector3[] {
  root.computeWorldMatrix(true);
  for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
  return root.getChildMeshes().flatMap((mesh) => {
    mesh.skeleton?.prepare(true);
    const data = mesh.getPositionData(Boolean(mesh.skeleton)) ?? [];
    const joints = mesh.getVerticesData('matricesIndices');
    return Array.from({ length: data.length / 3 }, (_, i) => i)
      .filter((i) => !joint || (joints && mesh.skeleton?.bones[joints[i * 4]!]!.name === joint))
      .map((i) =>
        Vector3.TransformCoordinates(Vector3.FromArray(data, i * 3), mesh.computeWorldMatrix(true)),
      );
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
