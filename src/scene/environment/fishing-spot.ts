import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../../game/types';
import type { Ripple } from '../presentation/water';

const BUBBLES = 9;

/** Where a bubble sits in the spot and when it rises, fixed per bubble. */
export function bubbleLayout(i: number): { dx: number; dz: number; offset: number } {
  const angle = i * 2.399963;
  const radius = 0.18 + ((i * 37) % 9) * 0.07;
  return { dx: Math.cos(angle) * radius, dz: Math.sin(angle) * radius, offset: (i * 0.618) % 1 };
}

/** A bubble swells, then pops: zero at the start and end of each cycle. */
export function bubbleScale(phase: number): number {
  const p = phase - Math.floor(phase);
  return p < 0.8 ? Math.sin((p / 0.8) * Math.PI) : 0;
}

/**
 * A classic fishing spot: a cluster of small bubbles that swell and pop above one ring of
 * ripples. Cosmetic; one thin-instanced submission, held still with Reduce motion.
 */
export class FishingSpot {
  readonly mesh: Mesh;
  private matrices = new Float32Array(BUBBLES * 16);
  constructor(
    scene: Scene,
    readonly at: Point,
    private y: number,
  ) {
    this.mesh = CreateSphere('fishing-spot-bubbles', { segments: 2, diameter: 0.2 }, scene);
    const material = new StandardMaterial('fishing-spot-foam', scene);
    material.diffuseColor = Color3.FromHexString('#e8f4f6');
    material.emissiveColor = Color3.FromHexString('#7f9fa8');
    material.specularColor = Color3.Black();
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.tick(0, false);
  }
  tick(time: number, reduced: boolean): void {
    const scale = new Vector3(),
      rotation = Quaternion.Identity(),
      position = new Vector3();
    for (let i = 0; i < BUBBLES; i++) {
      const { dx, dz, offset } = bubbleLayout(i);
      // Reduced motion holds a calm, readable cluster rather than an empty spot.
      const phase = reduced ? 0.4 + offset * 0.2 : time * 0.85 + offset;
      const size = bubbleScale(phase);
      scale.setAll(Math.max(0.0001, size * (0.55 + offset * 0.6)));
      scale.y *= 0.6;
      position.set(this.at.x + dx, this.y + 0.02 + size * 0.03, this.at.z + dz);
      Matrix.ComposeToRef(scale, rotation, position, Matrix.Identity()).copyToArray(
        this.matrices,
        i * 16,
      );
    }
    this.mesh.thinInstanceBufferUpdated('matrix');
  }
  ripple(): Ripple {
    return { x: this.at.x, z: this.at.z, radius: 0.7, strength: 0.65 };
  }
  dispose(): void {
    this.mesh.material?.dispose();
    this.mesh.dispose();
  }
}
