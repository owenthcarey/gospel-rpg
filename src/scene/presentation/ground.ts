import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../../game/types';
import { noise } from '../../game/presence';

export type PathSegment = readonly [Point, Point, number];

/** Local wear blends into the same floor palette, instead of reading as a pool of light. */
export function wornAreas(
  scene: Scene,
  areas: readonly (readonly number[])[],
  inside: boolean,
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const shades = (
    inside ? ['#dcd2bf', '#d9cfbc', '#d7cdba'] : ['#cfc8ae', '#cdc6ad', '#cac4ac']
  ).map((hex) => Color3.FromHexString(hex).toLinearSpace());
  for (const [x, z, width, depth] of areas) {
    const base = positions.length / 3;
    for (let ring = 0; ring < 3; ring++) {
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6,
          radius = [0.08, 0.65, 1][ring]!;
        const r = radius * (0.94 + noise(i + x!, z!) * 0.12);
        positions.push(
          x! + ((Math.cos(angle) * width!) / 2) * r,
          0.006,
          z! + ((Math.sin(angle) * depth!) / 2) * r,
        );
        const c = shades[ring]!;
        colors.push(c.r, c.g, c.b, 1);
        const a = base + ring * 12 + i,
          b = base + ring * 12 + ((i + 1) % 12);
        if (ring < 2) indices.push(a, b, a + 12, b, b + 12, a + 12);
      }
    }
    for (let i = 1; i < 11; i++) indices.push(base, base + i, base + i + 1);
  }
  const mesh = new Mesh('village-worn-ground', scene),
    data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  data.normals = positions.map((_, i) => (i % 3 === 1 ? 1 : 0));
  data.applyToMesh(mesh);
  const material = new StandardMaterial('village-worn-earth', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}

/** A sloping visual water edge outside the walkable terrain; no new collision or pick plane. */
export function shorelineBank(
  scene: Scene,
  name: string,
  edge: (z: number) => number,
  from: number,
  to: number,
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [],
    normals: number[] = [];
  const palette = ['#c7bda1', '#bcb398', '#9eaa97', '#7c9f96'].map((c) =>
    Color3.FromHexString(c).toLinearSpace(),
  );
  const count = Math.ceil((to - from) / 0.8);
  for (let i = 0; i <= count; i++) {
    const z = from + ((to - from) * i) / count;
    for (let j = 0; j < 4; j++) {
      const offset = [-0.06, 0.25, 0.7, 1.4][j]!;
      positions.push(
        edge(z) + offset + (j > 0 ? (noise(i, j) - 0.5) * 0.16 : 0),
        [-0.008, -0.06, -0.16, -0.3][j]!,
        z,
      );
      const c = palette[j]!;
      colors.push(c.r, c.g, c.b, 1);
      if (i < count && j < 3) {
        const p = i * 4 + j;
        indices.push(p, p + 1, p + 4, p + 1, p + 5, p + 4);
      }
    }
  }
  const mesh = new Mesh(name, scene),
    data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial(name + '-sand', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}
/** Feathered, irregular path ribbons share one opaque vertex-colored mesh and never change collision. */
export function wornPaths(
  scene: Scene,
  name: string,
  segments: readonly PathSegment[],
  height: (p: Point) => number = () => 0,
  colors = ['#d2c3a9', '#cebea4', '#c3b69f'],
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    palette: number[] = [];
  const shades = colors.map((hex) => Color3.FromHexString(hex).toLinearSpace());
  for (const [a, b, width] of segments) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.001 || width <= 0) continue;
    const count = Math.max(2, Math.ceil(length / 0.7));
    const nx = -(b.z - a.z) / length,
      nz = (b.x - a.x) / length;
    const base = positions.length / 3;
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      const bend = Math.sin(t * Math.PI) * Math.sin(t * 8 + a.x) * 0.16;
      const variation = 0.92 + noise(x, z) * 0.2;
      for (let strip = 0; strip < 5; strip++) {
        const edge = [-0.63, -0.44, 0, 0.44, 0.63][strip]!;
        const offset =
          width * edge * variation +
          bend +
          (strip === 0 || strip === 4 ? (noise(x + strip, z) - 0.5) * 0.28 : 0);
        const p = { x: x + nx * offset, z: z + nz * offset };
        positions.push(p.x, height(p) + 0.022 + (strip === 2 ? 0.003 : 0), p.z);
        const color = shades[strip === 0 || strip === 4 ? 2 : strip === 2 ? 0 : 1]!.scale(
          0.96 + noise(x + strip, z) * 0.08,
        );
        palette.push(color.r, color.g, color.b, 1);
      }
      if (i < count)
        for (let j = 0; j < 4; j++) {
          const q = base + i * 5 + j;
          indices.push(q, q + 5, q + 1, q + 1, q + 5, q + 6);
        }
    }
  }
  const mesh = new Mesh(name, scene),
    data = new VertexData(),
    normals: number[] = [];
  data.positions = positions;
  data.indices = indices;
  data.colors = palette;
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial(name + '-earth', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = { ground: true };
  return mesh;
}

/** Ground accents are broad color patches with chipped outlines, all in one submission. */
export function groundMosaic(
  scene: Scene,
  name: string,
  bounds: { min: number; max: number },
  land: (p: Point) => boolean,
  height: (p: Point) => number,
  inside = false,
  paletteHex?: readonly string[],
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const palette = (
    paletteHex ??
    (inside
      ? ['#d7cdba', '#d9cfbc', '#d5cbb8', '#dad0bd']
      : ['#b1b38b', '#b5b68b', '#b8b68a', '#afaf85', '#b6b58a'])
  ).map((c) => Color3.FromHexString(c).toLinearSpace());
  const step = inside ? 1.6 : 2.1;
  for (let z = bounds.min; z < bounds.max; z += step)
    for (let x = bounds.min; x < bounds.max; x += step) {
      if (!land({ x, z }) || noise(x, z) < 0.42) continue;
      const cx = x + (noise(x + 1, z) - 0.5) * step,
        cz = z + (noise(x, z + 1) - 0.5) * step;
      const radius = step * (0.38 + noise(x + 2, z) * 0.45),
        base = positions.length / 3;
      const center = { x: cx, z: cz };
      if (!land(center)) continue;
      const color = palette[Math.floor(noise(x, z + 4) * palette.length)]!;
      positions.push(cx, height(center) + 0.004, cz);
      colors.push(color.r, color.g, color.b, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          r = radius * (0.7 + noise(x + i, z) * 0.4);
        const p = { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
        positions.push(p.x, height(p) + 0.004, p.z);
        colors.push(color.r, color.g, color.b, 1);
        indices.push(base, base + 1 + i, base + 1 + ((i + 1) % 8));
      }
    }
  const mesh = new Mesh(name, scene),
    data = new VertexData(),
    normals: number[] = [];
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial(name + '-palette', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const fx = x - ix,
    fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx),
    uz = fz * fz * (3 - 2 * fz);
  const a = noise(ix, iz),
    b = noise(ix + 1, iz),
    c = noise(ix, iz + 1),
    d = noise(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
/** Deterministic fractal noise in [0, 1] for painted ground and rolling backdrop hills. */
export function fbm(x: number, z: number, octaves = 4): number {
  let value = 0,
    amplitude = 0.5,
    total = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x, z) * amplitude;
    total += amplitude;
    x = x * 2.03 + 17.1;
    z = z * 2.03 + 3.7;
    amplitude *= 0.5;
  }
  return value / total;
}

/** Irregular coast margin shared with the water shader's shore distance. */
export function coastMargin(p: Point): number {
  return (
    1.2 +
    0.8 * Math.sin(p.x * 0.35 + Math.sin(p.z * 0.21) * 2) +
    0.45 * Math.sin(p.z * 0.47 + p.x * 0.13)
  );
}

export type GroundStyle = 'village' | 'dry' | 'shore' | 'lane';
const GROUND_PALETTES: Record<GroundStyle, readonly [string, string, string, string]> = {
  // lush, dry, earth, distant
  village: ['#7f8b5f', '#9f9870', '#8c7a5b', '#879178'],
  dry: ['#848b60', '#a49a74', '#978063', '#8f9278'],
  shore: ['#8a965f', '#9d9a6e', '#958464', '#8b9679'],
  lane: ['#9d8d6f', '#a49474', '#8c7b62', '#948a72'],
};
/** Broad painted variation shared by the playable floor and the backdrop, so they meet seamlessly. */
export function groundColor(p: Point, style: GroundStyle, rise = 0): Color3 {
  const [lush, dry, earth, far] = GROUND_PALETTES[style].map((hex) => Color3.FromHexString(hex));
  const broad = fbm(p.x * 0.045 + 3, p.z * 0.045 - 7);
  const fine = fbm(p.x * 0.21 - 11, p.z * 0.21 + 5, 3);
  let color = Color3.Lerp(lush!, dry!, Math.min(1, Math.max(0, (broad - 0.36) / 0.3)));
  color = Color3.Lerp(color, earth!, Math.max(0, (fine - 0.6) / 0.25) * 0.55);
  color = color.scale(0.95 + fine * 0.1);
  if (rise > 0) color = Color3.Lerp(color, far!, Math.min(0.7, rise * 0.12));
  // Display-space colors: chosen as they should read under the neutral grade.
  return color;
}

/** Repaint a playable floor with the shared ground palette; positions are unchanged. */
export function paintGround(mesh: Mesh, style: GroundStyle, land?: (p: Point) => boolean): void {
  const positions = mesh.getVerticesData('position')!;
  const world = mesh.computeWorldMatrix(true).asArray();
  const colors: number[] = [];
  const sand = Color3.FromHexString('#b3a47d'),
    wet = Color3.FromHexString('#7d7a60');
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]! + world[12]!,
      z = positions[i + 2]! + world[14]!;
    let c = groundColor({ x, z }, style);
    // A pale strand at the water's edge, darkening where the bank slopes under.
    if (land && !land({ x, z })) c = Color3.Lerp(sand, wet, Math.min(1, -positions[i + 1]! * 2.2));
    else if (land && [1, -1].some((d) => !land({ x: x + d, z }) || !land({ x, z: z + d })))
      c = Color3.Lerp(c, sand, 0.6);
    colors.push(c.r, c.g, c.b, 1);
  }
  mesh.setVerticesData('color', colors);
}

/**
 * Rolling land beyond the playable square that meets the horizon rings. It lies under the floor
 * inside the reserve, sinks below any water, and is never pickable or walkable.
 */
export function backdropTerrain(
  scene: Scene,
  options: {
    reserve: { minX: number; maxX: number; minZ: number; maxZ: number };
    size: number;
    style: GroundStyle;
    base?: (p: Point) => number;
    water?: (p: Point) => boolean;
    rise?: (p: Point) => number;
  },
): Mesh {
  const { reserve, size } = options;
  const step = 2;
  const n = Math.ceil(size / step);
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const half = (n * step) / 2;
  const outside = (x: number, z: number) =>
    Math.max(reserve.minX - x, x - reserve.maxX, reserve.minZ - z, z - reserve.maxZ, 0);
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const x = -half + i * step,
        z = -half + j * step;
      const p = { x, z };
      const d = outside(x, z);
      const lift = (options.rise?.(p) ?? 1) * Math.min(1, d / 26);
      const hills = lift * lift * (3 - 2 * lift) * (4.5 + fbm(x * 0.035, z * 0.035) * 9);
      let y = (options.base?.(p) ?? 0) + hills - (d > 0 ? 0.02 : 0.12);
      if (options.water?.(p)) y = Math.min(y, -0.9);
      positions.push(x, y, z);
      const c = groundColor(p, options.style, hills);
      colors.push(c.r, c.g, c.b, 1);
    }
  // Quads well inside the reserve lie under the region's own ground: skip them so they cost
  // neither vertices nor (unsorted, overdrawn) fragments.
  const hidden = (x: number, z: number) =>
    Math.min(x - reserve.minX, reserve.maxX - x, z - reserve.minZ, reserve.maxZ - z) >= step;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -half + i * step,
        z = -half + j * step;
      if (hidden(x, z) && hidden(x + step, z + step)) continue;
      const a = j * (n + 1) + i;
      // Babylon's left-handed front faces wind clockwise when viewed from above.
      indices.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
    }
  const mesh = new Mesh('backdrop-terrain', scene),
    data = new VertexData(),
    normals: number[] = [];
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial('backdrop-earth', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.metadata = { backdrop: true };
  mesh.freezeWorldMatrix();
  return mesh;
}
