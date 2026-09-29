import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Point } from '../../game/types';
import { GROUND_COVER, type AssetId } from '../../content/assets';
import type { AssetLibrary } from '../assets';
import { fbm } from '../presentation/ground';

export interface CoverOptions {
  /** Square half-size around `center` to scatter within. */
  radius: number;
  center?: Point;
  /** Where cover may grow at all (land, outside buildings and water). */
  allowed: (p: Point) => boolean;
  /** Distance to the nearest worn path; cover thins toward and stays off paths. */
  pathDistance?: (p: Point) => number;
  height: (p: Point) => number;
  seed?: number;
  /** Relative density; 1 is a lush field. */
  density?: number;
}
const WEIGHTS: Record<(typeof GROUND_COVER)[number], number> = {
  grass_tuft: 1,
  flowers: 0.12,
  shrub: 0.06,
  pebbles: 0.08,
};
const CAPS = { high: 2600, low: 420 };

function hash(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Deterministic placements for one scatter; exported for tests. */
export function coverPlacements(
  options: CoverOptions,
  quality: 'high' | 'low',
): Record<(typeof GROUND_COVER)[number], Matrix[]> {
  const out = Object.fromEntries(GROUND_COVER.map((id) => [id, [] as Matrix[]])) as Record<
    (typeof GROUND_COVER)[number],
    Matrix[]
  >;
  const seed = options.seed ?? 1;
  const density = (options.density ?? 1) * (quality === 'low' ? 0.3 : 1);
  const step = 1.15;
  const center = options.center ?? { x: 0, z: 0 };
  const cap = CAPS[quality];
  let count = 0;
  for (let gz = -options.radius; gz <= options.radius && count < cap; gz += step)
    for (let gx = -options.radius; gx <= options.radius && count < cap; gx += step) {
      const p = {
        x: center.x + gx + (hash(gx, gz, seed) - 0.5) * step,
        z: center.z + gz + (hash(gz, gx, seed + 3) - 0.5) * step,
      };
      if (!options.allowed(p)) continue;
      // Meadows cluster in broad patches instead of an even carpet.
      const meadow = fbm(p.x * 0.09 + seed, p.z * 0.09 - seed);
      const nearPath = options.pathDistance?.(p) ?? 99;
      if (nearPath < 0.9) continue;
      const edge = nearPath < 2.4 ? 1.6 : 1;
      if (hash(p.x, p.z, seed + 7) > (meadow - 0.25) * 1.6 * density * edge) continue;
      const roll = hash(p.z, p.x, seed + 11);
      let id: (typeof GROUND_COVER)[number] = 'grass_tuft';
      let acc = 0;
      const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
      for (const key of GROUND_COVER) {
        acc += WEIGHTS[key] / total;
        if (roll <= acc) {
          id = key;
          break;
        }
      }
      if (id === 'pebbles' && nearPath > 3.5) id = 'grass_tuft';
      const scale = (id === 'grass_tuft' ? 1.35 : 0.85) + hash(p.x + 1, p.z, seed) * 0.7;
      out[id].push(
        Matrix.Compose(
          new Vector3(scale, scale * (0.85 + hash(p.x, p.z + 2, seed) * 0.3), scale),
          Quaternion.RotationAxis(Vector3.Up(), hash(p.x + 5, p.z, seed) * Math.PI * 2),
          new Vector3(p.x, options.height(p) - 0.01, p.z),
        ),
      );
      count++;
    }
  return out;
}

/**
 * Ground cover drawn with one thin-instanced mesh per kind. Unpickable, never a navigation
 * obstacle, and rebuilt when quality changes. Shares the imported wind-swaying material.
 */
export class GroundCover {
  private meshes: Mesh[] = [];
  constructor(
    private library: AssetLibrary,
    private options: CoverOptions,
  ) {}
  build(quality: 'high' | 'low'): void {
    this.dispose();
    const placements = coverPlacements(this.options, quality);
    for (const id of GROUND_COVER) {
      const matrices = placements[id];
      if (!matrices.length) continue;
      const model = this.library.instantiate(id as AssetId, 'ground-cover:' + id);
      const source = model.root
        .getChildMeshes()
        .find((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
      if (!source) {
        model.root.dispose();
        continue;
      }
      // Bake the glTF handedness conversion so instance matrices are plain world placements.
      source.computeWorldMatrix(true);
      const flat = new Mesh('ground-cover-' + id, this.library.scene);
      source.geometry!.applyToMesh(flat);
      flat.makeGeometryUnique();
      flat.bakeTransformIntoVertices(source.getWorldMatrix());
      flat.material = source.material;
      model.root.dispose();
      flat.isPickable = false;
      flat.receiveShadows = true;
      flat.alwaysSelectAsActiveMesh = true;
      const buffer = new Float32Array(matrices.length * 16);
      matrices.forEach((m, i) => m.copyToArray(buffer, i * 16));
      flat.thinInstanceSetBuffer('matrix', buffer, 16, true);
      const metadata = { assetId: id, placement: 'ground-cover', renderedFrame: -1 };
      flat.metadata = metadata;
      flat.onAfterRenderObservable.add(() => {
        metadata.renderedFrame = this.library.scene.getFrameId();
      });
      this.meshes.push(flat);
    }
  }
  get instances(): number {
    return this.meshes.reduce((n, m) => n + m.thinInstanceCount, 0);
  }
  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose(false, false);
    this.meshes = [];
  }
}
