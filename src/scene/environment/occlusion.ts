import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

/** Reusable geometry probe; dithered scenery retains its real collision and pick geometry. */
export class ScenerySightline {
  private ray = new Ray(Vector3.Zero(), Vector3.Zero());

  blocks(meshes: readonly AbstractMesh[], camera: Vector3, player: Vector3): boolean {
    this.ray.origin.copyFrom(camera);
    for (const height of [0.9, 1.6]) {
      this.ray.direction.copyFrom(player);
      this.ray.direction.y += height;
      this.ray.direction.subtractInPlace(camera);
      this.ray.length = this.ray.direction.length();
      if (this.ray.length < 0.001) continue;
      this.ray.direction.scaleInPlace(1 / this.ray.length);
      for (const mesh of meshes) {
        if (!mesh.isEnabled() || !mesh.isVisible) continue;
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        if (!this.ray.intersectsBoxMinMax(box.minimumWorld, box.maximumWorld)) continue;
        // Bounds reject distant scenery cheaply. The final mesh test avoids
        // dissolving rotated scenery whose empty bounding-box corner crosses the view.
        const hit = this.ray.intersectsMesh(mesh, true);
        if (hit.hit && hit.distance < this.ray.length - 0.05) return true;
      }
    }
    return false;
  }
}
