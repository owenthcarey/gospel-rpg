import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ActorClip } from '../../content/assets';
import type { Point } from '../../game/types';
import { distance } from '../../game/pathfinding';
import type { Model } from '../assets';

/** Samples Blender clips using simulation time; no Babylon auto-animation clock. */
export class Actor {
  readonly root: TransformNode;
  private clips = new Map<ActorClip, AnimationGroup>();
  private current?: AnimationGroup;
  private currentName?: ActorClip;
  private elapsed = 0;
  private route: Point[] = [];
  private idle: ActorClip = 'Idle';
  private moving = false;
  constructor(readonly model: Model) {
    this.root = model.root;
    for (const group of model.animations) {
      const name = group.name.split(':').at(-1) as ActorClip;
      this.clips.set(name, group);
    }
    this.setClip('Idle');
  }
  setClip(name: ActorClip): void {
    if (this.currentName === name) return;
    this.current?.stop();
    this.current = this.clips.get(name);
    if (!this.current) throw new Error('Character is missing animation ' + name);
    this.currentName = name;
    this.elapsed = 0;
    this.current.start(true).pause();
    this.current.goToFrame(this.current.from);
  }
  sample(name: ActorClip, dt: number, still = false): void {
    this.setClip(name);
    if (!this.current) return;
    if (!still) this.elapsed += dt;
    const fps = this.current.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    const length = this.current.to - this.current.from;
    this.current.goToFrame(
      this.current.from + (still ? 0 : (this.elapsed * fps) % Math.max(length, 1)),
    );
  }
  pose(name: ActorClip): void {
    this.idle = name;
    this.setClip(name);
  }
  walk(path: readonly Point[]): void {
    this.route = path.map((point) => ({ ...point }));
  }
  tick(dt: number, still: boolean): void {
    this.moving = false;
    if (still && this.route.length) {
      const end = this.route.at(-1)!;
      this.root.position.x = end.x;
      this.root.position.z = end.z;
      this.route = [];
    }
    let remaining = dt * 1.35;
    while (this.route.length && remaining > 0) {
      const point = this.route[0]!;
      const current = { x: this.root.position.x, z: this.root.position.z };
      const d = distance(current, point);
      this.root.rotation.y = Math.atan2(point.x - current.x, point.z - current.z);
      this.moving = true;
      if (d <= remaining) {
        this.root.position.x = point.x;
        this.root.position.z = point.z;
        this.route.shift();
        remaining -= d;
      } else {
        this.root.position.x += ((point.x - current.x) / d) * remaining;
        this.root.position.z += ((point.z - current.z) / d) * remaining;
        remaining = 0;
      }
    }
    this.sample(this.moving ? 'Walk' : this.idle, dt, still);
  }
  face(point: Point): void {
    this.root.rotation.y = Math.atan2(
      point.x - this.root.position.x,
      point.z - this.root.position.z,
    );
  }
  attach(model: Model, socket = 'carry_socket'): void {
    model.root.parent = this.model.socket(socket);
    model.root.position.copyFrom(Vector3.Zero());
    model.root.rotation.setAll(0);
    // The GLB's coordinate conversion is already inherited from the socket.
    model.root.scaling.setAll(1);
  }
  dispose(): void {
    for (const animation of this.clips.values()) animation.dispose();
    this.root.dispose();
  }
}
