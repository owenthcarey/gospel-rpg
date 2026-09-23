import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { compositionArea, type ScreenRect } from '../../game/presence';

export interface CameraPose {
  target: Vector3;
  alpha: number;
  beta: number;
  radius: number;
}
export function cameraPose(camera: ArcRotateCamera): CameraPose {
  return {
    target: camera.target.clone(),
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
  };
}
/** Fit a subject sphere into the actual unoccluded part of a full-canvas camera. */
export function frameSubject(
  camera: ArcRotateCamera,
  width: number,
  height: number,
  center: Vector3,
  extent: number,
  alpha: number,
  beta: number,
  panel?: ScreenRect,
): CameraPose {
  const area = compositionArea(width, height, panel);
  const tangent = Math.tan(camera.fov / 2);
  const aspect = width / Math.max(1, height);
  const available = Math.min(
    ((area.right - area.left) / Math.max(1, width)) * aspect,
    (area.bottom - area.top) / Math.max(1, height),
  );
  const radius = Math.max(4, (extent * 1.18) / Math.max(0.05, tangent * available));
  const right = new Vector3(-Math.sin(alpha), 0, Math.cos(alpha));
  const up = new Vector3(
    -Math.cos(alpha) * Math.cos(beta),
    Math.sin(beta),
    -Math.sin(alpha) * Math.cos(beta),
  );
  const nx = (area.left + area.right) / width - 1;
  const ny = 1 - (area.top + area.bottom) / height;
  const target = center
    .subtract(right.scale(nx * radius * tangent * aspect))
    .subtract(up.scale(ny * radius * tangent));
  return { target, alpha, beta, radius };
}
export function applyCameraPose(camera: ArcRotateCamera, pose: CameraPose): void {
  camera.alpha = pose.alpha;
  camera.beta = pose.beta;
  camera.radius = pose.radius;
  camera.target.copyFrom(pose.target);
}
