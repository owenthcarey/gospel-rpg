import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AssetLibrary, Model } from '../assets';
import type { Actor } from './actor';
/** A fitted seat/support in the ordinary or Gospel hull; earlier boats are unchanged. */
export function boatSupport(
  parent: TransformNode,
  name: string,
  width: number,
  depth: number,
  y: number,
  z: number,
): void {
  const seat = MeshBuilder.CreateBox(name, { width, depth, height: 0.08 }, parent.getScene());
  seat.parent = parent;
  seat.position.set(0, y, z);
  seat.isPickable = false;
  const material = new StandardMaterial(name + '-wood', parent.getScene());
  material.diffuseColor = Color3.FromHexString('#aa8e5e').toLinearSpace();
  material.specularColor = Color3.Black();
  seat.material = material;
}
/** A hull, supported seated rower and two oars share one navigation transform. */
export class TravelerBoat {
  readonly model: Model;
  private oars: TransformNode[] = [];
  private time = 0;
  constructor(
    library: AssetLibrary,
    parent: TransformNode,
    private actor: Actor,
  ) {
    this.model = library.instantiate('boat', 'traveler-boat');
    this.model.root.parent = parent;
    this.model.root.scaling.set(1.35, 1, 1.25);
    this.model.root.position.y = -0.03;
    boatSupport(parent, 'rower-seat', 1.45, 0.34, 0.57, -0.45);
    actor.root.parent = parent;
    actor.root.position.set(0, 0.19, -0.45);
    for (const side of [-1, 1]) {
      const oar = library.instantiate('oar', 'traveler-oar-' + side).root;
      oar.parent = parent;
      this.oars.push(oar);
    }
  }
  pose(moving: boolean, dt: number, still: boolean): void {
    if (moving && !still) this.time += dt;
    const phase = still || !moving ? 0 : (this.time % 1.2) / 1.2;
    this.actor.root.position.set(0, 0.19, -0.45);
    this.actor.root.rotation.set(0, 0, 0);
    this.actor.sampleAt('Row', phase);
    const parent = this.model.root.parent as TransformNode;
    const inverse = Matrix.Invert(parent.computeWorldMatrix(true));
    this.oars.forEach((oar, i) => {
      const side = i ? 1 : -1;
      // Follow the exported forearm tip, including the Row clip's torso movement.
      const hand = this.actor.model.socket(i ? 'forearm_right' : 'forearm_left');
      const grip = Vector3.TransformCoordinates(
        new Vector3(0, 0.2, 0),
        hand.computeWorldMatrix(true),
      );
      const localGrip = Vector3.TransformCoordinates(grip, inverse);
      const yaw = side * (Math.PI / 2 + Math.sin(phase * Math.PI * 2) * 0.16);
      const pitch = 0.3;
      oar.rotation.set(pitch, yaw, 0);
      const handle = Vector3.TransformCoordinates(
        new Vector3(0, 0, -1.05),
        Matrix.RotationYawPitchRoll(yaw, pitch, 0),
      );
      oar.position.copyFrom(localGrip.subtract(handle));
    });
  }
}
