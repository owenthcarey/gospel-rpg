import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../../game/types';
import { noise } from '../../game/presence';

export type PathSegment = readonly [Point, Point, number];
export interface GroundReserve {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const groundPaintLayers = new WeakMap<Mesh, Mesh>();

/** Height of a square ground grid at a local point, from its own vertices (nearest sample). */
export function floorHeight(mesh: Mesh, p: Point): number {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const count = Math.round(Math.sqrt(positions.length / 3));
  const size = mesh.getBoundingInfo().boundingBox.extendSize;
  const i = Math.round(((p.x + size.x) / (size.x * 2)) * (count - 1));
  // Babylon ground rows run from +Z to -Z, opposite to their increasing X columns.
  const j = Math.round(((size.z - p.z) / (size.z * 2)) * (count - 1));
  const k = (Math.max(0, Math.min(count - 1, j)) * count + Math.max(0, Math.min(count - 1, i))) * 3;
  return positions[k + 1] ?? 0;
}

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
    inside ? ['#baaa8d', '#b6a589', '#ae9e84'] : ['#baa376', '#b49d72', '#ae976b']
  ).map((hex) => Color3.FromHexString(hex));
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
  const palette = ['#c4b17f', '#b9a77a', '#979675', '#6d8791'].map((c) => Color3.FromHexString(c));
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
/** Irregular paths use solid painted bands in one mesh, with their existing footprint and heights. */
export function wornPaths(
  scene: Scene,
  name: string,
  segments: readonly PathSegment[],
  height: (p: Point) => number = () => 0,
  colors = ['#bfa373', '#b89b6b', '#a78d62'],
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    palette: number[] = [];
  const shades = colors.map((hex) => Color3.FromHexString(hex));
  const middle = Color3.Lerp(shades[0]!, shades[1]!, 0.35),
    edgeShade = Color3.Lerp(shades[1]!, shades[2]!, 0.7);
  for (const [a, b, width] of segments) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.001 || width <= 0) continue;
    const count = Math.max(2, Math.ceil(length / 0.7));
    const nx = -(b.z - a.z) / length,
      nz = (b.x - a.x) / length;
    const rows: { x: number; y: number; z: number }[][] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      const bend = Math.sin(t * Math.PI) * Math.sin(t * 8 + a.x) * 0.16;
      const variation = 0.92 + noise(x, z) * 0.2;
      const row: { x: number; y: number; z: number }[] = [];
      for (let strip = 0; strip < 5; strip++) {
        const edge = [-0.63, -0.44, 0, 0.44, 0.63][strip]!;
        const offset =
          width * edge * variation +
          bend +
          (strip === 0 || strip === 4 ? (noise(x + strip, z) - 0.5) * 0.28 : 0);
        const p = { x: x + nx * offset, z: z + nz * offset };
        row.push({ ...p, y: height(p) + 0.022 + (strip === 2 ? 0.003 : 0) });
      }
      rows.push(row);
    }
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 4; j++) {
        const quad = [rows[i]![j]!, rows[i + 1]![j]!, rows[i]![j + 1]!, rows[i + 1]![j + 1]!];
        const x = (quad[0]!.x + quad[3]!.x) / 2,
          z = (quad[0]!.z + quad[3]!.z) / 2;
        // Duplicate boundary vertices so color interpolation cannot blur one band into another.
        // Broad, quiet variation keeps the path readable without speckled decoration.
        const color = (j === 0 || j === 3 ? edgeShade : middle).scale(
          0.98 + noise(Math.floor(x / 3), Math.floor(z / 3)) * 0.04,
        );
        const base = positions.length / 3;
        for (const p of quad) {
          positions.push(p.x, p.y, p.z);
          palette.push(color.r, color.g, color.b, 1);
        }
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
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
  options: { step?: number; coverage?: number; surface?: Mesh } = {},
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const palette = (
    paletteHex ??
    (inside
      ? ['#b9aa8d', '#b6a789', '#b3a486', '#bdad90']
      : ['#7b8d51', '#7f9054', '#85935a', '#738449', '#809054'])
  ).map((c) => Color3.FromHexString(c));
  const step = options.step ?? (inside ? 1.6 : 2.1);
  const surface = options.surface;
  const surfacePositions = surface?.getVerticesData(VertexBuffer.PositionKind);
  const surfaceIndices = surface?.getIndices();
  const surfaceWorld = surface?.computeWorldMatrix(true).asArray();
  const triangles =
    surfacePositions && surfaceIndices && surfaceWorld
      ? Array.from({ length: surfaceIndices.length / 3 }, (_, i) => {
          const points = [0, 1, 2].map((n) => {
            const k = surfaceIndices[i * 3 + n]! * 3;
            return {
              x: surfacePositions[k]! + surfaceWorld[12]!,
              y: surfacePositions[k + 1]! + surfaceWorld[13]!,
              z: surfacePositions[k + 2]! + surfaceWorld[14]!,
            };
          });
          return {
            points,
            minX: Math.min(...points.map((p) => p.x)),
            maxX: Math.max(...points.map((p) => p.x)),
            minZ: Math.min(...points.map((p) => p.z)),
            maxZ: Math.max(...points.map((p) => p.z)),
          };
        })
      : undefined;
  for (let z = bounds.min; z < bounds.max; z += step)
    for (let x = bounds.min; x < bounds.max; x += step) {
      if (!land({ x, z }) || noise(x, z) < 1 - (options.coverage ?? 0.58)) continue;
      const cx =
          x + (triangles ? 0.5 + (noise(x + 1, z) - 0.5) * 0.12 : noise(x + 1, z) - 0.5) * step,
        cz = z + (triangles ? 0.5 + (noise(x, z + 1) - 0.5) * 0.12 : noise(x, z + 1) - 0.5) * step;
      // Surface paint stays inside each broad cell, avoiding coplanar overlapping patches.
      let radius =
        step * (triangles ? 0.36 + noise(x + 2, z) * 0.08 : 0.38 + noise(x + 2, z) * 0.45);
      const center = { x: cx, z: cz };
      if (!land(center)) continue;
      if (inside) {
        // Shrink whole patches at the room boundary: clipping a triangle fan can reverse faces.
        const margin = Math.min(cx - bounds.min, bounds.max - cx, cz - bounds.min, bounds.max - cz);
        radius = Math.min(radius, margin / 1.1);
        if (radius < 0.12) continue;
      }
      const color = palette[Math.floor(noise(x, z + 4) * palette.length)]!;
      const outline = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4,
          r = radius * (triangles ? 0.86 + noise(x + i, z) * 0.12 : 0.7 + noise(x + i, z) * 0.4);
        return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
      });
      if (triangles) {
        // Keep whole patches on their permitted surface, including any flat paint reserve.
        if (!outline.every(land)) continue;
        const minX = Math.min(...outline.map((p) => p.x)),
          maxX = Math.max(...outline.map((p) => p.x)),
          minZ = Math.min(...outline.map((p) => p.z)),
          maxZ = Math.max(...outline.map((p) => p.z));
        // Clip the paint to the existing floor triangles instead of spanning a hill with a fan.
        // Interpolating each cut edge preserves the exact ground plane beneath the patch.
        for (const triangle of triangles) {
          if (
            triangle.maxX < minX ||
            triangle.minX > maxX ||
            triangle.maxZ < minZ ||
            triangle.minZ > maxZ
          )
            continue;
          let polygon = triangle.points;
          for (let edge = 0; edge < outline.length && polygon.length; edge++) {
            const a = outline[edge]!,
              b = outline[(edge + 1) % outline.length]!;
            const side = (p: Point) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
            const clipped: typeof polygon = [];
            for (let n = 0; n < polygon.length; n++) {
              const start = polygon[n]!,
                end = polygon[(n + 1) % polygon.length]!;
              const from = side(start),
                to = side(end);
              if (from >= 0) clipped.push(start);
              if (from >= 0 !== to >= 0) {
                const t = from / (from - to);
                clipped.push({
                  x: start.x + (end.x - start.x) * t,
                  y: start.y + (end.y - start.y) * t,
                  z: start.z + (end.z - start.z) * t,
                });
              }
            }
            polygon = clipped;
          }
          if (polygon.length < 3) continue;
          const base = positions.length / 3;
          for (const p of polygon) {
            positions.push(p.x, p.y + 0.004, p.z);
            colors.push(color.r, color.g, color.b, 1);
          }
          for (let i = 1; i < polygon.length - 1; i++) indices.push(base, base + i, base + i + 1);
        }
        continue;
      }
      const base = positions.length / 3;
      positions.push(cx, height(center) + 0.004, cz);
      colors.push(color.r, color.g, color.b, 1);
      for (const [i, p] of outline.entries()) {
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

/**
 * An interior floor of laid flagstones in running-bond rows: each stone a slightly
 * different warm grey, separated by dark grout, merged into one submission.
 */
export function flagstoneFloor(
  scene: Scene,
  name: string,
  bounds: { min: number; max: number },
  land: (p: Point) => boolean,
  height: (p: Point) => number,
): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const palette = ['#b3a68a', '#aa9d80', '#bcae90', '#a59779', '#b8ab8e'].map((c) =>
    Color3.FromHexString(c),
  );
  const grout = 0.045,
    depth = 0.62;
  const quad = (x0: number, z0: number, x1: number, z1: number, color: Color3, lift: number) => {
    const base = positions.length / 3;
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ] as const) {
      positions.push(x, height({ x, z }) + lift, z);
      colors.push(color.r, color.g, color.b, 1);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // A grout bed under the stones keeps every gap the same dark line.
  const span = bounds.max - bounds.min;
  quad(bounds.min, bounds.min, bounds.max, bounds.max, Color3.FromHexString('#6f6553'), 0.003);
  let row = 0;
  for (let z = bounds.min; z < bounds.max - 0.05; z += depth, row++) {
    const z1 = Math.min(bounds.max, z + depth);
    let x = bounds.min - (row % 2) * 0.45;
    while (x < bounds.max - 0.05) {
      const width = 0.75 + noise(x * 3.1, z * 2.7) * 0.5;
      const x0 = Math.max(bounds.min, x),
        x1 = Math.min(bounds.max, x + width);
      const center = { x: (x0 + x1) / 2, z: (z + z1) / 2 };
      if (x1 - x0 > grout * 2 && land(center)) {
        const shade = palette[Math.floor(noise(x0 * 5.3, z * 4.1) * palette.length)]!;
        // A few stones sit a touch darker with wear near the room's busy middle.
        const worn = Math.abs(center.x) + Math.abs(center.z) < span * 0.22 ? 0.95 : 1;
        quad(x0 + grout, z + grout, x1 - grout, z1 - grout, shade.scale(worn), 0.006);
      }
      x += width;
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
  village: ['#678144', '#879452', '#947b52', '#6c8059'],
  dry: ['#788748', '#a99c63', '#987c51', '#8c946a'],
  shore: ['#738c48', '#939d58', '#9b855b', '#758960'],
  lane: ['#a08c68', '#b09a74', '#927957', '#9b8c70'],
};
/** Broad painted variation shared by the playable floor and the backdrop, so they meet seamlessly. */
export function groundColor(p: Point, style: GroundStyle, rise = 0): Color3 {
  const [lush, dry, earth, far] = GROUND_PALETTES[style].map((hex) => Color3.FromHexString(hex));
  // Paint broad, discrete earth tones rather than a continuous noisy color wash.
  const x = Math.floor(p.x / 2) * 2,
    z = Math.floor(p.z / 2) * 2;
  const broad = Math.floor(fbm(x * 0.045 + 3, z * 0.045 - 7) * 6) / 6;
  const fine = Math.floor(fbm(x * 0.21 - 11, z * 0.21 + 5, 3) * 5) / 5;
  let color = Color3.Lerp(lush!, dry!, Math.min(1, Math.max(0, (broad - 0.36) / 0.3)));
  color = Color3.Lerp(color, earth!, Math.max(0, (fine - 0.6) / 0.25) * 0.55);
  color = color.scale(0.95 + fine * 0.1);
  if (rise > 0) color = Color3.Lerp(color, far!, Math.min(0.7, rise * 0.12));
  // Display-space colors shared by the floor, paths, procedural props and imported geometry.
  return color;
}

/** Repaint a playable floor with the shared ground palette; positions are unchanged. */
export function paintGround(
  mesh: Mesh,
  style: GroundStyle,
  land?: (p: Point) => boolean,
  options: { mosaic?: boolean; reserve?: GroundReserve } = {},
): void {
  groundPaintLayers.get(mesh)?.dispose(false, true);
  groundPaintLayers.delete(mesh);
  const positions = mesh.getVerticesData('position')!;
  const world = mesh.computeWorldMatrix(true).asArray();
  const colors: number[] = [];
  const sand = Color3.FromHexString('#c2ad7d'),
    wet = Color3.FromHexString('#8a8768');
  const base = Color3.FromHexString(GROUND_PALETTES[style][0]).scale(1.02);
  const transitionWidth = 6;
  const distanceToEdge = (p: Point) => {
    const reserve = options.reserve;
    return reserve
      ? Math.min(p.x - reserve.minX, reserve.maxX - p.x, p.z - reserve.minZ, reserve.maxZ - p.z)
      : Infinity;
  };
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]! + world[12]!,
      z = positions[i + 2]! + world[14]!;
    const p = { x, z };
    const borderMix = Math.max(0, Math.min(1, 1 - distanceToEdge(p) / transitionWidth));
    let c = options.mosaic && borderMix === 0 ? base : groundColor(p, style);
    // Return to the shared palette where backdrop hills rise above the playable floor.
    if (options.mosaic && borderMix > 0 && borderMix < 1) c = Color3.Lerp(base, c, borderMix);
    // A pale strand at the water's edge, darkening where the bank slopes under.
    if (land && !land({ x, z })) c = Color3.Lerp(sand, wet, Math.min(1, -positions[i + 1]! * 2.2));
    else if (land && [1, -1].some((d) => !land({ x: x + d, z }) || !land({ x, z: z + d })))
      c = Color3.Lerp(c, sand, 0.6);
    colors.push(c.r, c.g, c.b, 1);
  }
  mesh.setVerticesData('color', colors);
  if (options.mosaic) {
    const bounds = mesh.getBoundingInfo().boundingBox;
    const dry = Color3.FromHexString(GROUND_PALETTES[style][1]);
    const paint = groundMosaic(
      mesh.getScene(),
      mesh.name + '-paint',
      {
        min: Math.max(bounds.minimumWorld.x, bounds.minimumWorld.z),
        max: Math.min(bounds.maximumWorld.x, bounds.maximumWorld.z),
      },
      (p) => (!land || land(p)) && distanceToEdge(p) >= transitionWidth,
      () => 0,
      false,
      [base.scale(0.96), base.scale(1.04), Color3.Lerp(base, dry, 0.12)].map((c) =>
        c.toHexString(),
      ),
      { step: 6, coverage: 0.38, surface: mesh },
    );
    groundPaintLayers.set(mesh, paint);
  }
}

/**
 * Rolling land beyond the playable square that meets the horizon rings. It lies under the floor
 * inside the reserve, sinks below any water, and is never pickable or walkable.
 */
export function backdropTerrain(
  scene: Scene,
  options: {
    reserve: GroundReserve;
    size: number;
    style: GroundStyle;
    base?: (p: Point) => number;
    water?: (p: Point) => boolean;
    rise?: (p: Point) => number;
  },
): Mesh {
  const { reserve, size } = options;
  const step = 3;
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
  // neither vertices nor overdrawn fragments (opaque meshes draw in material order, not depth).
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
  mesh.convertToFlatShadedMesh();
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
