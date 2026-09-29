import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/thinInstanceMesh';

interface Caster {
  node: TransformNode;
  radius: number;
  /** Stretch along the node's forward axis, for hulls. */
  length: number;
}
const MAX_CASTERS = 64;

/**
 * Soft blob shadows grounding people, hulls and held objects. One draw call through thin
 * instances; unpickable and independent of navigation.
 */
export class ContactShadows {
  readonly mesh: Mesh;
  private casters: Caster[] = [];
  private matrices = new Float32Array(MAX_CASTERS * 16);
  private strength = 1;
  constructor(
    scene: Scene,
    private ground: (x: number, z: number) => number,
  ) {
    this.mesh = MeshBuilder.CreateDisc('contact-shadows', { radius: 1, tessellation: 24 }, scene);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.bakeCurrentTransformIntoVertices();
    const count = this.mesh.getTotalVertices();
    const positions = this.mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const colors: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.hypot(positions[i * 3]!, positions[i * 3 + 2]!);
      colors.push(0, 0, 0, 0.42 * (1 - r) * (1 - r));
    }
    this.mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    this.mesh.hasVertexAlpha = true;
    const material = new StandardMaterial('contact-shadow-matte', scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.zOffset = -2;
    material.disableDepthWrite = true;
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.metadata = { contactShadows: true };
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh.thinInstanceCount = 0;
  }
  add(node: TransformNode, radius = 0.42, length = 1): void {
    if (this.casters.length >= MAX_CASTERS || this.casters.some((c) => c.node === node)) return;
    this.casters.push({ node, radius, length });
  }
  remove(node: TransformNode): void {
    this.casters = this.casters.filter((c) => c.node !== node);
  }
  /** Softer blobs beside real shadow maps; fuller blobs where there are none. */
  setStrength(value: number): void {
    this.strength = value;
    this.mesh.visibility = Math.max(0, Math.min(1, value));
    this.mesh.setEnabled(value > 0);
  }
  update(): void {
    if (this.strength <= 0) return;
    let n = 0;
    const scale = new Vector3(),
      position = new Vector3();
    this.casters = this.casters.filter((c) => !c.node.isDisposed());
    for (const caster of this.casters) {
      if (!caster.node.isEnabled()) continue;
      const at = caster.node.getAbsolutePosition();
      const ground = this.ground(at.x, at.z);
      // Lift the shadow with its caster, fading as the object leaves the ground.
      const lift = Math.max(0, at.y - ground);
      if (lift > 1.4) continue;
      const fade = 1 - lift / 1.4;
      scale.set(
        caster.radius * (1 + lift * 0.4),
        1,
        caster.radius * caster.length * (1 + lift * 0.4),
      );
      position.set(at.x, ground + 0.035, at.z);
      Matrix.ComposeToRef(
        scale.scaleInPlace(0.6 + fade * 0.4),
        caster.node.absoluteRotationQuaternion,
        position,
        TMP,
      );
      TMP.copyToArray(this.matrices, n * 16);
      n++;
    }
    this.mesh.thinInstanceCount = n;
    this.mesh.thinInstanceBufferUpdated('matrix');
  }
  dispose(): void {
    this.mesh.material?.dispose();
    this.mesh.dispose();
  }
}
const TMP = new Matrix();
