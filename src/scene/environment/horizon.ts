import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../../game/types';

export interface HorizonOptions {
  center: Point;
  radius: number;
  colors: readonly [string, string, string];
  /** A flat ground annulus from `skirt` meters out to the first ring; omit where water surrounds. */
  skirt?: { from: number; color: string; y?: number };
  /** Angular range (radians) left open, for example the lake side of a shore. */
  open?: { from: number; to: number; depth: number };
  seed?: number;
}

function random(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Layered faceted hill silhouettes. Unlit vertex colors let distance fog carry the atmosphere,
 * and every ring lies outside walkable space.
 */
export function horizonRings(scene: Scene, options: HorizonOptions): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const seed = options.seed ?? 7;
  const push = (x: number, y: number, z: number, c: Color3) => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b, 1);
    return positions.length / 3 - 1;
  };
  // Flat-shaded quads: duplicate vertices so each facet keeps a single tone.
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: Color3, cb: Color3) => {
    const i0 = push(a[0]!, a[1]!, a[2]!, ca),
      i1 = push(b[0]!, b[1]!, b[2]!, ca),
      i2 = push(c[0]!, c[1]!, c[2]!, cb),
      i3 = push(d[0]!, d[1]!, d[2]!, cb);
    indices.push(i0, i2, i1, i1, i2, i3);
  };
  const { x: cx, z: cz } = options.center;
  const segments = 56;
  options.colors.forEach((hex, ring) => {
    const base = Color3.FromHexString(hex);
    const radius = options.radius * (1 + ring * 0.38);
    const peak = 7 + ring * 6;
    const profile = Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      let h =
        peak *
        (0.45 +
          0.3 * Math.sin(a * 3 + seed + ring) +
          0.18 * Math.sin(a * 7 + seed * 2.3 + ring * 1.7) +
          0.22 * random(seed * 31 + ring * 97 + (i % segments)));
      const open = options.open;
      if (open) {
        const inside = a >= open.from && a <= open.to;
        const edge = Math.min(Math.abs(a - open.from), Math.abs(a - open.to));
        if (inside) h *= Math.max(open.depth, 1 - Math.min(1, edge / 0.35) * (1 - open.depth));
      }
      return { a, h: Math.max(1.5, h) };
    });
    for (let i = 0; i < segments; i++) {
      const p = profile[i]!,
        q = profile[i + 1]!;
      const jitter = (random(seed + i * 13 + ring * 7) - 0.5) * 0.08;
      const low = base.scale(0.82 + jitter),
        high = base.scale(1.06 + jitter);
      const r0 = radius * (0.97 + random(seed + i + ring * 3) * 0.06),
        r1 = radius * (0.97 + random(seed + i + 1 + ring * 3) * 0.06);
      const x0 = cx + Math.cos(p.a) * r0,
        z0 = cz + Math.sin(p.a) * r0,
        x1 = cx + Math.cos(q.a) * r1,
        z1 = cz + Math.sin(q.a) * r1;
      quad([x0, -3, z0], [x1, -3, z1], [x0, p.h, z0], [x1, q.h, z1], low, high);
    }
  });
  if (options.skirt) {
    const c = Color3.FromHexString(options.skirt.color);
    const y = options.skirt.y ?? -0.08;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2,
        a1 = ((i + 1) / segments) * Math.PI * 2;
      const inner = options.skirt.from,
        outer = options.radius * 1.02;
      quad(
        [cx + Math.cos(a0) * outer, y, cz + Math.sin(a0) * outer],
        [cx + Math.cos(a1) * outer, y, cz + Math.sin(a1) * outer],
        [cx + Math.cos(a0) * inner, y, cz + Math.sin(a0) * inner],
        [cx + Math.cos(a1) * inner, y, cz + Math.sin(a1) * inner],
        c.scale(0.94),
        c,
      );
    }
  }
  const mesh = new Mesh('horizon-rings', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial('horizon-matte', scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.metadata = { horizon: true };
  mesh.freezeWorldMatrix();
  return mesh;
}
