import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color3, Vector3 } from '@babylonjs/core/Maths/math';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { AssetId } from '../content/assets';
import { capernaumScenery, villagePatches } from '../content/harbor/scenery';
import {
  HARBOR_CELLS,
  harborPosition,
  cargoPosition,
  plankPosition,
  traceHarbor,
} from '../game/harbor/arrangement';
import type { HarborState } from '../game/harbor/types';
import type { AssetLibrary, Model } from './assets';

function matte(scene: Scene, name: string, color: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(color).toLinearSpace();
  m.specularColor = Color3.Black();
  return m;
}
export function dressVillage(scene: Scene, library: AssetLibrary, region: string): void {
  const batches = new Map<AssetId, Model[]>();
  for (const p of capernaumScenery[region] ?? []) {
    const model = library.instantiate(p.asset, 'village-detail:' + p.asset);
    model.root.position.set(p.x, p.y ?? 0, p.z);
    model.root.rotation.y = p.rotation ?? 0;
    model.root.scaling.setAll(p.scale ?? 1);
    const group = batches.get(p.asset) ?? [];
    group.push(model);
    batches.set(p.asset, group);
  }
  for (const [id, models] of batches) library.batch(id, models);
  const patches = (villagePatches[region] ?? []).map(([x, z, width, height], i) => {
    const mesh = MeshBuilder.CreateDisc(
      'village-worn-ground-' + i,
      { radius: 1, tessellation: 9 },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.scaling.set(width / 2, height / 2, 1);
    mesh.position.set(x, 0.006, z);
    mesh.isPickable = false;
    return mesh;
  });
  if (patches.length) {
    const merged = Mesh.MergeMeshes(patches, true, true)!;
    merged.material = matte(
      scene,
      'village-worn-ground',
      region === 'gathering-house' || region === 'bakehouse' ? '#c7ad78' : '#bcb582',
    );
    merged.isPickable = false;
  }
}

/** The same coordinates power the solver, readable plan, geometry and storage bays. */
export class HarborPresentation {
  private plank: Model;
  private nets: Model;
  private jars: Model;
  private rope: Mesh;
  private route: LinesMesh;
  constructor(
    private scene: Scene,
    library: AssetLibrary,
  ) {
    const stones: Model[] = [];
    for (const cell of HARBOR_CELLS.filter((c) => c.x !== 1)) {
      const p = harborPosition(cell),
        m = library.instantiate('quay_stones', 'landing-stone');
      m.root.position.set(p.x, 0, p.z);
      stones.push(m);
    }
    library.batch('quay_stones', stones);
    const wet = MeshBuilder.CreateGround('landing-wet-strip', { width: 1.15, height: 3.45 }, scene);
    const center = harborPosition({ x: 1, z: 1 });
    wet.position.set(center.x, 0.018, center.z);
    wet.material = matte(scene, 'landing-water-marks', '#678f91');
    wet.isPickable = false;
    this.plank = library.instantiate('crossing_plank', 'working-crossing-plank', 'harbor-plank');
    this.nets = library.instantiate('net_folded', 'working-net-cargo', 'harbor-nets');
    this.nets.root.scaling.setAll(0.75);
    this.jars = library.instantiate('amphora', 'working-jar-cargo', 'harbor-jars');
    this.jars.root.scaling.setAll(0.7);
    const entry = harborPosition({ x: 0, z: 1 });
    this.rope = MeshBuilder.CreateTube(
      'landing-loose-rope',
      {
        path: [
          new Vector3(entry.x - 0.48, 0.12, entry.z - 0.49),
          new Vector3(entry.x - 0.15, 0.08, entry.z),
          new Vector3(entry.x - 0.48, 0.12, entry.z + 0.49),
        ],
        radius: 0.032,
        tessellation: 6,
      },
      scene,
    );
    this.rope.material = matte(scene, 'landing-flax', '#ccb780');
    this.rope.isPickable = true;
    this.rope.metadata = { interactionId: 'harbor-entrance' };
    for (const [id, c] of [
      ['nets', { x: 0, z: 3.1 }],
      ['jars', { x: 2, z: -1.1 }],
    ] as const) {
      const p = harborPosition(c),
        bay = MeshBuilder.CreateTorus(
          'landing-storage-' + id,
          { diameter: 0.95, thickness: 0.028, tessellation: 20 },
          scene,
        );
      bay.position.set(p.x, 0.04, p.z);
      bay.material = this.rope.material;
      bay.isPickable = false;
    }
    this.route = MeshBuilder.CreateLines(
      'landing-tested-route',
      { points: [Vector3.Zero(), new Vector3(0.01, 0, 0)], updatable: false },
      scene,
    );
    this.route.isPickable = false;
  }
  update(h: HarborState): void {
    const p = plankPosition(h),
      n = cargoPosition(h, 'nets'),
      j = cargoPosition(h, 'jars');
    this.plank.root.position.set(p.x, 0.08, p.z);
    this.plank.root.rotation.y = (h.turn * Math.PI) / 2;
    this.nets.root.position.set(n.x, h.cargo.nets ? 0.02 : 0.12, n.z);
    this.jars.root.position.set(j.x, h.cargo.jars ? 0 : 0.12, j.z);
    this.rope.setEnabled(!h.cleared);
    this.route.dispose();
    const trace = traceHarbor(h);
    const points = trace.path.map((cell) => {
      const p = harborPosition(cell);
      return new Vector3(p.x, 0.27, p.z);
    });
    this.route = MeshBuilder.CreateLines(
      'landing-tested-route',
      { points: points.length > 1 ? points : [Vector3.Zero(), new Vector3(0.01, 0, 0)] },
      this.scene,
    );
    this.route.color = Color3.FromHexString(trace.route ? '#fff0af' : '#e6ae70');
    this.route.isPickable = false;
    this.route.setEnabled(h.tested && points.length > 1);
  }
}
