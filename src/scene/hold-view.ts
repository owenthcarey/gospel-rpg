import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';

interface HoldViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HoldCanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface HoldAnchor {
  world: Vector3;
  x: number;
  y: number;
}

/** Compare visible movement in CSS pixels, independent of rendering resolution. */
export class HoldView {
  private rejected = false;
  private constructor(
    private anchors: HoldAnchor[],
    private viewport: HoldViewport,
    private bounds: HoldCanvasBounds,
  ) {}

  static capture(
    transform: Matrix,
    focus: Vector3,
    viewport: HoldViewport,
    bounds: HoldCanvasBounds,
  ) {
    if (
      !validBounds(viewport) ||
      !validBounds(bounds) ||
      !Number.isFinite(viewport.x) ||
      !Number.isFinite(viewport.y) ||
      !Number.isFinite(bounds.left) ||
      !Number.isFinite(bounds.top)
    )
      return undefined;
    const depth = clip(focus, transform);
    if (!depth || depth.z < -1 || depth.z > 1 || transform.determinant() === 0) return undefined;
    const inverse = Matrix.Invert(transform);
    const anchors: HoldAnchor[] = [];
    // These are fixed WORLD points on the original camera's focus plane. Testing corners
    // catches an orbit or zoom around a stationary center; never replace this baseline.
    for (const [x, y] of [
      [0, 0],
      [-0.8, -0.8],
      [-0.8, 0.8],
      [0.8, -0.8],
      [0.8, 0.8],
    ]) {
      const world = Vector3.TransformCoordinates(new Vector3(x, y, depth.z), inverse);
      const screen = project(world, transform, viewport);
      if (!screen) return undefined;
      anchors.push({ world, x: screen.x, y: screen.y });
    }
    // Native DOMRect coordinates are prototype getters, so spread loses their values.
    return new HoldView(
      anchors,
      { ...viewport },
      {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
    );
  }

  changed(transform: Matrix, viewport: HoldViewport, bounds: HoldCanvasBounds): boolean {
    if (this.rejected) return true;
    if (
      bounds.left !== this.bounds.left ||
      bounds.top !== this.bounds.top ||
      bounds.width !== this.bounds.width ||
      bounds.height !== this.bounds.height ||
      viewport.x !== this.viewport.x ||
      viewport.y !== this.viewport.y ||
      viewport.width !== this.viewport.width ||
      viewport.height !== this.viewport.height
    )
      return (this.rejected = true);
    for (const anchor of this.anchors) {
      const screen = project(anchor.world, transform, viewport);
      // Two CSS pixels permit imperceptible follow settling while remaining well below
      // the existing eight-pixel finger movement limit. Movement is cumulative from down.
      if (!screen || Math.hypot(screen.x - anchor.x, screen.y - anchor.y) > 2)
        return (this.rejected = true);
    }
    return false;
  }
}

function validBounds(value: { width: number; height: number }) {
  return (
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

function clip(point: Vector3, transform: Matrix) {
  const m = transform.m;
  const w = point.x * m[3]! + point.y * m[7]! + point.z * m[11]! + m[15]!;
  if (!Number.isFinite(w) || w <= 0) return undefined;
  const x = (point.x * m[0]! + point.y * m[4]! + point.z * m[8]! + m[12]!) / w;
  const y = (point.x * m[1]! + point.y * m[5]! + point.z * m[9]! + m[13]!) / w;
  const z = (point.x * m[2]! + point.y * m[6]! + point.z * m[10]! + m[14]!) / w;
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
}

function project(point: Vector3, transform: Matrix, viewport: HoldViewport) {
  const projected = clip(point, transform);
  if (!projected || projected.z < -1 || projected.z > 1) return undefined;
  return {
    x: viewport.x + ((projected.x + 1) * viewport.width) / 2,
    y: viewport.y + ((1 - projected.y) * viewport.height) / 2,
  };
}
