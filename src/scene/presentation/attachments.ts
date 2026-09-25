import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Actor } from '../actors/actor';

/** Position at the exported forearm tip, including the currently sampled rig pose. */
export function handGrip(actor: Actor, side: 'left' | 'right', space: TransformNode): Vector3 {
  const hand = actor.model.socket('forearm_' + side);
  const world = Vector3.TransformCoordinates(new Vector3(0, 0.2, 0), hand.computeWorldMatrix(true));
  return Vector3.TransformCoordinates(world, Matrix.Invert(space.computeWorldMatrix(true)));
}
/** Keep the imported oar's handle at the hand while rotating its blade. */
export function fitOar(oar: TransformNode, grip: Vector3, yaw: number, pitch: number): void {
  oar.rotation.set(pitch, yaw, 0);
  const handle = Vector3.TransformCoordinates(
    new Vector3(0, 0, -1.05),
    Matrix.RotationYawPitchRoll(yaw, pitch, 0),
  );
  oar.position.copyFrom(grip.subtract(handle));
}
