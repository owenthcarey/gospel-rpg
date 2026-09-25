import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Space } from '@babylonjs/core/Maths/math.axis';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ActorClip } from '../../content/assets';
import type { Point } from '../../game/types';
import { distance } from '../../game/pathfinding';
import type { Model } from '../assets';
import { turnToward } from '../../game/presence';

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
  private oneShot?: { name: ActorClip; time: number };
  private sampledFrame = 0;
  private blendTime = 0;
  private strideRate = 1;
  private lookTarget: Vector3 | null = null;
  private lookYaw = 0;
  private head?: TransformNode | null;
  private previousPose: {
    target: TransformNode;
    position: Vector3;
    scaling: Vector3;
    rotation: Quaternion | null;
  }[] = [];
  constructor(
    readonly model: Model,
    private blendTransitions = false,
  ) {
    this.root = model.root;
    for (const group of model.animations) {
      const name = group.name.split(':').at(-1) as ActorClip;
      this.clips.set(name, group);
    }
    this.setClip('Idle');
  }
  setClip(name: ActorClip): void {
    if (this.currentName === name) return;
    if (this.blendTransitions && this.current) {
      const nodes = new Set(
        this.current.targetedAnimations
          .map((a) => a.target)
          .filter((node): node is TransformNode => node instanceof TransformNode),
      );
      this.previousPose = [...nodes].map((target) => ({
        target,
        position: target.position.clone(),
        scaling: target.scaling.clone(),
        rotation: target.rotationQuaternion?.clone() ?? null,
      }));
      this.blendTime = 0;
    }
    this.current?.stop();
    this.current = this.clips.get(name);
    if (!this.current) throw new Error('Character is missing animation ' + name);
    this.currentName = name;
    this.elapsed = 0;
    this.current.start(true).pause();
    this.sampledFrame = this.current.from;
    this.current.goToFrame(this.sampledFrame);
  }
  sample(name: ActorClip, dt: number, still = false): void {
    if (this.oneShot && !still) {
      this.setClip(this.oneShot.name);
      this.oneShot.time += dt;
      const fps = this.current!.targetedAnimations[0]?.animation.framePerSecond ?? 60;
      const frame = this.current!.from + this.oneShot.time * fps;
      this.sampledFrame = Math.min(frame, this.current!.to);
      this.current!.goToFrame(this.sampledFrame);
      if (frame < this.current!.to) {
        this.blendPose(dt, still);
        this.applyLook(dt, still);
        return;
      }
    }
    this.oneShot = undefined;
    this.setClip(name);
    if (!this.current) return;
    if (!still)
      this.elapsed += dt * (['Walk', 'Carry', 'MatCarry'].includes(name) ? this.strideRate : 1);
    const fps = this.current.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    const length = this.current.to - this.current.from;
    this.sampledFrame =
      this.current.from + (still ? 0 : (this.elapsed * fps) % Math.max(length, 1));
    this.current.goToFrame(this.sampledFrame);
    this.blendPose(dt, still);
    this.applyLook(dt, still);
  }
  /**
   * Glance toward a world point, or back to the clip's own heading with `null`. Cosmetic:
   * only the head turns, bounded, and only while an exploration actor is sampled.
   */
  lookAt(point: Vector3 | null): void {
    this.lookTarget = point;
  }
  private applyLook(dt: number, still: boolean): void {
    if (!this.lookTarget && Math.abs(this.lookYaw) < 0.001) return;
    if (this.head === undefined) {
      try {
        this.head = this.model.socket('head');
      } catch {
        this.head = null;
      }
    }
    if (!this.head) return;
    let desired = 0;
    if (this.lookTarget && !still) {
      const at = this.root.getAbsolutePosition();
      const toward = Math.atan2(this.lookTarget.x - at.x, this.lookTarget.z - at.z);
      let delta = toward - (this.root.rotation.y - Math.PI);
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      // Beyond a comfortable glance the body would turn instead; stay forward.
      desired = Math.abs(delta) < 1.6 ? Math.max(-0.7, Math.min(0.7, delta)) : 0;
    }
    this.lookYaw = still ? 0 : this.lookYaw + (desired - this.lookYaw) * (1 - Math.exp(-dt * 5));
    if (Math.abs(this.lookYaw) >= 0.001) this.head.rotate(Vector3.Up(), this.lookYaw, Space.WORLD);
  }
  /** Simulation-time transition; exact presentation poses bypass this opt-in exploration blend. */
  private blendPose(dt: number, still: boolean): void {
    if (!this.previousPose.length) return;
    if (still) {
      this.previousPose = [];
      return;
    }
    this.blendTime += dt;
    const t = Math.min(1, this.blendTime / 0.16);
    for (const p of this.previousPose) {
      Vector3.LerpToRef(p.position, p.target.position, t, p.target.position);
      Vector3.LerpToRef(p.scaling, p.target.scaling, t, p.target.scaling);
      if (p.rotation && p.target.rotationQuaternion)
        Quaternion.SlerpToRef(
          p.rotation,
          p.target.rotationQuaternion,
          t,
          p.target.rotationQuaternion,
        );
    }
    if (t === 1) this.previousPose = [];
  }
  playOnce(name: ActorClip): void {
    this.oneShot = { name, time: 0 };
    this.setClip(name);
  }
  /** A bounded presentation pose, reconstructed directly from its local scene clock. */
  sampleAt(name: ActorClip, progress: number): void {
    this.oneShot = undefined;
    this.setClip(name);
    this.sampledFrame =
      this.current!.from +
      Math.max(0, Math.min(1, progress)) * (this.current!.to - this.current!.from);
    this.current!.goToFrame(this.sampledFrame);
    this.previousPose = [];
  }
  get performing(): boolean {
    return Boolean(this.oneShot);
  }
  get playback() {
    return {
      clip: this.currentName ?? 'Idle',
      frame: this.sampledFrame,
      action: this.oneShot?.name ?? '',
    };
  }
  snapshotPose() {
    return {
      clip: this.currentName ?? 'Idle',
      frame: this.sampledFrame,
      elapsed: this.elapsed,
      oneShot: this.oneShot ? { ...this.oneShot } : undefined,
    };
  }
  restorePose(pose: ReturnType<Actor['snapshotPose']>): void {
    this.setClip(pose.clip);
    this.elapsed = pose.elapsed;
    this.oneShot = pose.oneShot;
    this.sampledFrame = pose.frame;
    this.current?.goToFrame(pose.frame);
    this.previousPose = [];
  }
  setStrideSpeed(speed: number): void {
    this.strideRate = Math.max(0.2, Math.min(1.5, speed / 3.25));
  }
  turnTo(point: Point, dt: number, rate = 12): void {
    const at = this.root.getAbsolutePosition();
    const heading = Math.PI + Math.atan2(point.x - at.x, point.z - at.z);
    this.root.rotation.y = turnToward(this.root.rotation.y, heading, dt, rate);
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
      this.root.rotation.y = turnToward(
        this.root.rotation.y,
        Math.PI + Math.atan2(point.x - current.x, point.z - current.z),
        dt,
      );
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
    this.setStrideSpeed(1.35);
    this.sample(this.moving ? 'Walk' : this.idle, dt, still);
  }
  face(point: Point): void {
    this.root.rotation.y =
      Math.PI + Math.atan2(point.x - this.root.position.x, point.z - this.root.position.z);
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
