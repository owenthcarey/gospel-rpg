import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { ActionMotion } from '../../content/campaign/actions';
import type { Point } from '../../game/types';
import { PresentationClock } from '../../game/presence';

/** A short grounded accent marks an accepted physical action. Never a pick target or reward. */
export class ActionFeedback {
  private ring: Mesh;
  private material: StandardMaterial;
  private clock = new PresentationClock();
  private running = false;
  constructor(scene: Scene) {
    this.ring = MeshBuilder.CreateTorus(
      'accepted-work-accent',
      { diameter: 0.8, thickness: 0.025, tessellation: 24 },
      scene,
    );
    this.material = new StandardMaterial('work-accent-matte', scene);
    this.material.diffuseColor = Color3.FromHexString('#e7cf94').toLinearSpace();
    this.material.emissiveColor = Color3.FromHexString('#95805a').toLinearSpace();
    this.material.specularColor = Color3.Black();
    this.ring.material = this.material;
    this.ring.isPickable = false;
    this.ring.setEnabled(false);
  }
  play(motion: ActionMotion, point: Point, height: number, reduced: boolean): void {
    this.clock.reset();
    this.running = !reduced;
    this.ring.position.set(point.x, height + 0.06, point.z);
    this.ring.scaling.setAll(1);
    this.material.alpha = 0.75;
    this.ring.metadata = { acceptedMotion: motion };
    this.ring.setEnabled(this.running);
  }
  tick(dt: number, active: boolean, reduced: boolean): void {
    if (reduced) {
      this.running = false;
      this.ring.setEnabled(false);
    }
    if (!this.running) return;
    const t = this.clock.advance(dt, active) / 1.15;
    this.ring.scaling.setAll(1 + t * 0.8);
    this.material.alpha = 0.75 * (1 - t);
    if (t >= 1) {
      this.running = false;
      this.ring.setEnabled(false);
    }
  }
  dispose(): void {
    this.ring.dispose();
    this.material.dispose();
  }
}
