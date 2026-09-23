import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';

/** Floor textiles have no collision, height or interaction authority. */
export function interiorTextiles(scene: Scene, room: 'gathering-house' | 'bakehouse'): Mesh {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [],
    normals: number[] = [];
  const swatches = ['#ac7657', '#cfb891', '#737e68'].map((hex) =>
    Color3.FromHexString(hex).toLinearSpace(),
  );
  const rugs =
    room === 'gathering-house'
      ? [
          [0, 2.1, 2.3, 3.8],
          [-4, 2, 0.9, 3.2],
          [4, 2, 0.9, 3.2],
        ]
      : [[2.8, 3, 2.2, 1.1]];
  for (const [x, z, w, d] of rugs) {
    const bands = Math.ceil(d! / 0.12);
    for (let i = 0; i < bands; i++) {
      const base = positions.length / 3,
        a = z! - d! / 2 + (i * d!) / bands,
        b = a + d! / bands;
      const fringe = i === 0 || i === bands - 1 ? 0.035 : 0;
      positions.push(
        x! - w! / 2,
        0.015,
        a - fringe,
        x! + w! / 2,
        0.015,
        a - fringe,
        x! - w! / 2,
        0.015,
        b + fringe,
        x! + w! / 2,
        0.015,
        b + fringe,
      );
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      const c = swatches[i < 3 || i > bands - 4 ? 2 : i % 7 < 2 ? 0 : 1]!;
      for (let j = 0; j < 4; j++) {
        colors.push(c.r, c.g, c.b, 1);
        normals.push(0, 1, 0);
      }
    }
  }
  const mesh = new Mesh('inhabited-room-textiles', scene),
    data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial('woven-floor-colors', scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}
