import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { RUN_SPEED } from '../../game/run';

/** Radians the upper body leans forward at full running pace. */
const RUN_LEAN = 0.2;
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Space } from '@babylonjs/core/Maths/math.axis';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { ActorClip } from '../../content/assets';
import type { Point } from '../../game/types';
import { distance } from '../../game/pathfinding';
import type { Model } from '../assets';
import { turnToward } from '../../game/presence';
import {
  StationaryFeet,
  type FootSupportOptions,
  type FootSupportContinuation,
} from './stationary-feet';
import { LocomotionClearance, type ActorGround } from './locomotion-clearance';
import { requireSupportedFootPair, footSide } from './foot-geometry';

/** A single dialogue owns these samples; unrelated Actor samples revoke retained blends. */
export interface ConversationPoseScope {
  readonly active: boolean;
  sample(name: ActorClip, dt: number, still?: boolean): void;
  /** Undefined keeps the existing unsupported-pose fallback; false is an invalid/consumed scope. */
  restore(
    heading: number,
    locomotion?: ReturnType<LocomotionClearance['bookmark']>,
  ): boolean | undefined;
  release(): void;
}

/** Samples Blender clips using simulation time; no Babylon auto-animation clock. */
export class Actor {
  readonly root: TransformNode;
  private clips = new Map<ActorClip, AnimationGroup>();
  private current?: AnimationGroup;
  private currentName?: ActorClip;
  private elapsed = 0;
  private ordinarySample = false;
  private conversationPose?: { group?: AnimationGroup; release: () => void };
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
  private body?: TransformNode | null;
  private feet?: {
    mesh: AbstractMesh;
    points: { x: number; y: number; z: number; joint: number; side: 'left' | 'right' }[];
  }[];
  private previousPose: {
    target: TransformNode;
    position: Vector3;
    scaling: Vector3;
    rotation: Quaternion | null;
  }[] = [];
  private stationaryFeet?: StationaryFeet;
  private locomotionClearance?: LocomotionClearance;
  constructor(
    readonly model: Model,
    private blendTransitions = false,
    options: { stationaryFeet?: boolean; locomotionClearance?: { ground: ActorGround } } = {},
  ) {
    this.root = model.root;
    requireSupportedFootPair(model);
    if (options.stationaryFeet)
      this.stationaryFeet = new StationaryFeet(model, (ground) => this.footClearance(ground));
    if (options.locomotionClearance)
      this.locomotionClearance = new LocomotionClearance(
        model,
        options.locomotionClearance.ground,
        () => {
          this.feet = undefined;
          this.locomotionClearance = undefined;
        },
      );
    for (const group of model.animations) {
      const name = group.name.split(':').at(-1) as ActorClip;
      this.clips.set(name, group);
    }
    this.setClip('Idle');
  }
  /** Unsupported sources keep their existing clear/held continuation fallback. */
  private releaseRetainedConversationPose(): void {
    if (this.conversationPose?.group) this.conversationPose.release();
  }
  setClip(name: ActorClip): void {
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    this.selectClip(name);
  }
  private selectClip(name: ActorClip): void {
    this.locomotionClearance?.resetSample();
    this.stationaryFeet?.restoreSampledPose();
    if (!['Idle', 'Walk', 'Carry', 'MatCarry'].includes(name)) this.stationaryFeet?.reset();
    if (this.currentName === name) return;
    this.captureTransitionPose();
    // A genuine unfinished source blend remains paused, with its real runtime frame.
    if (this.current !== this.conversationPose?.group) this.current?.stop();
    this.current = this.clips.get(name);
    if (!this.current) throw new Error('Character is missing animation ' + name);
    this.currentName = name;
    this.elapsed = 0;
    this.current.start(true).pause();
    this.sampledFrame = this.current.from;
    this.current.goToFrame(this.sampledFrame);
  }
  private captureTransitionPose(): void {
    if (!this.blendTransitions || !this.current) return;
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
  sample(name: ActorClip, dt: number, still = false): void {
    this.releaseRetainedConversationPose();
    this.samplePose(name, dt, still);
  }
  private samplePose(name: ActorClip, dt: number, still: boolean): void {
    this.ordinarySample = false;
    this.locomotionClearance?.clear();
    this.stationaryFeet?.restoreSampledPose();
    if (this.oneShot && !still) {
      this.selectClip(this.oneShot.name);
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
    this.selectClip(name);
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
    this.applyRunLean(name, still);
    this.locomotionClearance?.apply(this.currentName ?? 'Idle', still, this.performing);
    this.ordinarySample = !still && !this.conversationPose && ['Idle', 'Walk'].includes(name);
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
  /**
   * Running leans the upper body into the stride. Walking pace and slower never lean; the
   * clip rewrites the body each sample, so the lean never accumulates.
   */
  private applyRunLean(name: ActorClip, still: boolean): void {
    if (still || (name !== 'Walk' && name !== 'Carry')) return;
    const lean = Math.max(0, Math.min(1, (this.strideRate - 1.15) / 0.45)) * RUN_LEAN;
    if (lean < 0.001) return;
    if (this.body === undefined) {
      try {
        this.body = this.model.socket('body');
      } catch {
        this.body = null;
      }
    }
    this.body?.rotate(Vector3.Right(), lean, Space.LOCAL);
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
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    this.locomotionClearance?.reset();
    this.stationaryFeet?.reset();
    // A new accepted gesture may restart the clip currently on screen. Blend
    // from that displayed pose just as we do when changing to another clip.
    if (this.oneShot?.name === name && this.currentName === name) this.captureTransitionPose();
    this.oneShot = { name, time: 0 };
    this.setClip(name);
  }
  /** Resume the requested base pose on the next sample, retaining its normal blend. */
  cancelAction(): void {
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    this.locomotionClearance?.reset();
    this.oneShot = undefined;
  }
  /** A bounded presentation pose, reconstructed directly from its local scene clock. */
  sampleAt(name: ActorClip, progress: number): void {
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    this.locomotionClearance?.reset();
    this.stationaryFeet?.reset();
    this.oneShot = undefined;
    this.setClip(name);
    this.sampledFrame =
      this.current!.from +
      Math.max(0, Math.min(1, progress)) * (this.current!.to - this.current!.from);
    this.current!.goToFrame(this.sampledFrame);
    this.previousPose = [];
  }
  /** An exact finite pose driven by the cosmetic bench clock, without a second animation clock. */
  sampleActionAt(name: ActorClip, progress: number): void {
    this.sampleAt(name, progress);
    if (progress < 1) this.oneShot = { name, time: progress * this.clipDuration(name) };
  }
  clipDuration(name: ActorClip): number {
    const clip = this.clips.get(name);
    if (!clip) throw new Error('Character is missing animation ' + name);
    const fps = clip.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    return (clip.to - clip.from) / fps;
  }
  /** A composed traveler presentation currently exists; exact poses and ordinary NPCs opt out. */
  get hasFootSupport(): boolean {
    return Boolean(this.stationaryFeet?.hasPresentation);
  }
  /** Advance only an existing held lower-body composition; playback and navigation stay fixed. */
  footSupportContinuation(): FootSupportContinuation | undefined {
    const clip = this.playback.clip;
    if (!['Carry', 'MatCarry'].includes(clip) || this.performing) return;
    // The mutable owner is deliberately cleared when this scope is released.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let owner: Actor | undefined = this;
    const scope = this.stationaryFeet?.continuation(() => {
      owner = undefined;
    });
    if (!scope) return;
    return {
      step(dt, immediate) {
        if (!owner || !owner.hasFootSupport || owner.playback.clip !== clip || owner.performing) {
          owner = undefined;
          scope.release();
          return false;
        }
        if (scope.step(dt, immediate)) return true;
        owner = undefined;
        scope.release();
        return false;
      },
      release() {
        owner = undefined;
        scope.release();
      },
    };
  }
  /** Compose after terrain lift and roll; exact finite poses and ordinary NPCs stay authored. */
  supportFeet(options: FootSupportOptions): void {
    if (!['Idle', 'Walk', 'Carry', 'MatCarry'].includes(this.playback.clip)) {
      this.stationaryFeet?.reset();
      return;
    }
    this.stationaryFeet?.apply(options);
  }
  /** Lowest actual sandal vertex; cached rigid vertices avoid deforming the whole skin each tick. */
  soleHeight(): number {
    const feet = this.footClearance();
    return Math.min(feet.left, feet.right);
  }
  /** Each posed foot's lowest clearance above terrain at its own world coordinates. */
  footClearance(ground: (x: number, z: number) => number = FLAT_GROUND): {
    left: number;
    right: number;
  } {
    this.feet ??= this.root.getChildMeshes().flatMap((mesh) => {
      const positions = mesh.getVerticesData('position');
      const joints = mesh.getVerticesData('matricesIndices');
      if (!positions || !joints || !mesh.skeleton) return [];
      const points = [];
      for (let i = 0; i < positions.length / 3; i++) {
        const joint = joints[i * 4]!;
        const name = mesh.skeleton.bones[joint]?.name.split(':').at(-1);
        const side = footSide(name);
        if (side)
          points.push({
            x: positions[i * 3]!,
            y: positions[i * 3 + 1]!,
            z: positions[i * 3 + 2]!,
            joint,
            side,
          });
      }
      return [{ mesh, points }];
    });
    this.root.computeWorldMatrix(true);
    for (const node of this.root.getChildTransformNodes()) node.computeWorldMatrix(true);
    const clearance = { left: Infinity, right: Infinity };
    for (const { mesh, points } of this.feet) {
      mesh.skeleton!.prepare(true);
      const bones = mesh.skeleton!.getTransformMatrices(mesh);
      const world = mesh.computeWorldMatrix(true).m;
      for (const p of points) {
        const at = p.joint * 16;
        const x = p.x * bones[at]! + p.y * bones[at + 4]! + p.z * bones[at + 8]! + bones[at + 12]!;
        const y =
          p.x * bones[at + 1]! + p.y * bones[at + 5]! + p.z * bones[at + 9]! + bones[at + 13]!;
        const z =
          p.x * bones[at + 2]! + p.y * bones[at + 6]! + p.z * bones[at + 10]! + bones[at + 14]!;
        const worldX = x * world[0]! + y * world[4]! + z * world[8]! + world[12]!;
        const worldY = x * world[1]! + y * world[5]! + z * world[9]! + world[13]!;
        const worldZ = x * world[2]! + y * world[6]! + z * world[10]! + world[14]!;
        clearance[p.side] = Math.min(clearance[p.side], worldY - ground(worldX, worldZ));
      }
    }
    return clearance;
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
  restorePose(
    pose: ReturnType<Actor['snapshotPose']>,
    locomotion?: ReturnType<LocomotionClearance['bookmark']>,
  ): void {
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    this.locomotionClearance?.reset(!locomotion);
    this.stationaryFeet?.reset();
    this.setClip(pose.clip);
    this.elapsed = pose.elapsed;
    this.oneShot = pose.oneShot;
    this.sampledFrame = pose.frame;
    this.current?.goToFrame(pose.frame);
    this.previousPose = [];
    locomotion?.restore();
  }
  /** Preserve only an actual unfinished ordinary blend; exact/held/finite sources keep their fallback. */
  conversationPoseScope(): ConversationPoseScope {
    this.conversationPose?.release();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let owner: Actor | undefined = this;
    let root: TransformNode | undefined = this.root;
    let scene: ReturnType<TransformNode['getScene']> | undefined = root.getScene();
    let parent = root.parent;
    const targets = new Set(
      this.model.animations
        .flatMap((group) => group.targetedAnimations.map((animation) => animation.target))
        .filter((node): node is TransformNode => node instanceof TransformNode),
    );
    if (this.head) targets.add(this.head);
    const eligible =
      this.blendTransitions &&
      this.ordinarySample &&
      !this.performing &&
      !this.hasFootSupport &&
      this.previousPose.length > 0 &&
      this.blendTime < 0.16 &&
      this.current?.isStarted &&
      !this.current.isPlaying &&
      !root.isDisposed() &&
      root.isEnabled() &&
      [...targets].every(
        (target) => !target.isDisposed() && target.isEnabled() && target.isDescendantOf(root!),
      );
    let saved = eligible
      ? {
          group: this.current!,
          pose: this.snapshotPose(),
          blendTime: this.blendTime,
          strideRate: this.strideRate,
          lookTarget: this.lookTarget?.clone() ?? null,
          lookYaw: this.lookYaw,
          locals: [...targets].map((target) => ({
            target,
            parent: target.parent,
            position: target.position.clone(),
            scaling: target.scaling.clone(),
            euler: target.rotation.clone(),
            rotation: target.rotationQuaternion?.clone() ?? null,
          })),
          previous: this.previousPose.map((value) => ({
            ...value,
            position: value.position.clone(),
            scaling: value.scaling.clone(),
            rotation: value.rotation?.clone() ?? null,
          })),
        }
      : undefined;
    // No disposable model, skeleton or animation group is cloned.
    let unsubscribe: (() => void)[] = [];
    const state = { group: saved?.group, release: () => release() };
    const valid = () =>
      Boolean(
        owner &&
        root &&
        scene &&
        !scene.isDisposed &&
        !root.isDisposed() &&
        root.isEnabled() &&
        root.parent === parent &&
        owner.conversationPose === state &&
        (!saved ||
          (owner.clips.get(saved.pose.clip) === saved.group &&
            scene.animationGroups.includes(saved.group) &&
            saved.group.isStarted &&
            !saved.group.isPlaying &&
            saved.locals.every(
              (value) =>
                !value.target.isDisposed() &&
                value.target.isEnabled() &&
                value.target.parent === value.parent &&
                value.target.isDescendantOf(root!),
            ))),
      );
    function release(keepSource = false) {
      if (!owner) return;
      if (!keepSource && saved && owner.current !== saved.group) saved.group.stop(true);
      if (owner.conversationPose === state) owner.conversationPose = undefined;
      for (const remove of unsubscribe) remove();
      unsubscribe = [];
      saved = undefined;
      state.group = undefined;
      owner = undefined;
      root = undefined;
      // The scope retains no scene or parent after it has been consumed.
      scene = undefined;
      parent = null;
      targets.clear();
    }
    this.conversationPose = state;
    const disposed = root.onDisposeObservable.add(() => release());
    unsubscribe.push(() => root?.onDisposeObservable.remove(disposed));
    const disabled = root.onEffectiveEnabledStateChangedObservable.add((enabled) => {
      if (!enabled) release();
    });
    unsubscribe.push(() => root?.onEffectiveEnabledStateChangedObservable.remove(disabled));
    const sceneDisposed = scene.onDisposeObservable.add(() => release());
    unsubscribe.push(() => scene?.onDisposeObservable.remove(sceneDisposed));
    return {
      get active() {
        if (valid()) return true;
        release();
        return false;
      },
      sample(name, dt, still = false) {
        if (!valid()) {
          release();
          return;
        }
        owner!.samplePose(name, dt, still);
      },
      restore(heading, locomotion) {
        if (!valid()) {
          release();
          return false;
        }
        const actor = owner!,
          source = saved;
        if (!source) {
          release();
          return undefined;
        }
        // Consume before writing; retain the actual paused source without start/seek/sample.
        release(true);
        actor.locomotionClearance?.reset(!locomotion);
        actor.stationaryFeet?.reset();
        if (actor.current !== source.group) actor.current?.stop();
        actor.current = source.group;
        actor.currentName = source.pose.clip;
        actor.elapsed = source.pose.elapsed;
        actor.oneShot = undefined;
        actor.sampledFrame = source.pose.frame;
        actor.blendTime = source.blendTime;
        actor.strideRate = source.strideRate;
        actor.lookTarget = source.lookTarget;
        actor.lookYaw = source.lookYaw;
        actor.previousPose = source.previous;
        for (const value of source.locals) {
          value.target.position.copyFrom(value.position);
          value.target.scaling.copyFrom(value.scaling);
          value.target.rotation.copyFrom(value.euler);
          if (value.rotation) {
            if (value.target.rotationQuaternion)
              value.target.rotationQuaternion.copyFrom(value.rotation);
            else value.target.rotationQuaternion = value.rotation;
          } else value.target.rotationQuaternion = null;
        }
        actor.root.rotation.y = heading;
        actor.ordinarySample = true;
        locomotion?.restore();
        return true;
      },
      release() {
        release();
      },
    };
  }
  setStrideSpeed(speed: number): void {
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    // Running reaches RUN_SPEED times the walk; the cycle keeps pace with the ground.
    this.strideRate = Math.max(0, Math.min(RUN_SPEED, speed / 3.25));
  }
  /** A normal stopped Carry displays frame zero; its next step starts there too. */
  resetStoppedCarryPhase(requested: ActorClip): void {
    if (requested !== 'Carry' || this.currentName !== 'Carry' || this.oneShot) return;
    this.elapsed = 0;
  }
  /** No-op for unopted actors; navigation controllers clear before relocating a sampled pose. */
  clearLocomotionPresentation(): void {
    this.locomotionClearance?.clear();
  }
  refreshLocomotionPresentation(): void {
    this.locomotionClearance?.refresh();
  }
  setLocomotionReducedMotion(value: boolean): void {
    this.locomotionClearance?.setReducedMotion(value);
  }
  suppressLocomotionPresentation(value: boolean): void {
    if (!value) this.releaseRetainedConversationPose();
    this.locomotionClearance?.suppress(value);
  }
  bookmarkLocomotionPresentation() {
    return this.locomotionClearance?.bookmark();
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
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
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
    let remaining = dt * 1.35,
      traveled = 0;
    while (this.route.length && remaining > 0) {
      const point = this.route[0]!;
      const current = { x: this.root.position.x, z: this.root.position.z };
      const d = distance(current, point);
      if (d === 0) {
        this.route.shift();
        continue;
      }
      this.root.rotation.y = turnToward(
        this.root.rotation.y,
        Math.PI + Math.atan2(point.x - current.x, point.z - current.z),
        dt,
      );
      this.moving = true;
      if (d <= remaining) {
        traveled += d;
        this.root.position.x = point.x;
        this.root.position.z = point.z;
        this.route.shift();
        remaining -= d;
      } else {
        traveled += remaining;
        this.root.position.x += ((point.x - current.x) / d) * remaining;
        this.root.position.z += ((point.z - current.z) / d) * remaining;
        remaining = 0;
      }
    }
    this.setStrideSpeed(this.moving && dt > 0 && remaining > 0 ? traveled / dt : 1.35);
    this.sample(this.moving ? 'Walk' : this.idle, dt, still);
  }
  face(point: Point): void {
    this.root.rotation.y =
      Math.PI + Math.atan2(point.x - this.root.position.x, point.z - this.root.position.z);
  }
  attach(model: Model, socket = 'carry_socket'): void {
    this.releaseRetainedConversationPose();
    this.ordinarySample = false;
    model.root.parent = this.model.socket(socket);
    model.root.position.copyFrom(Vector3.Zero());
    model.root.rotation.setAll(0);
    // The GLB's coordinate conversion is already inherited from the socket.
    model.root.scaling.setAll(1);
  }
  dispose(): void {
    this.conversationPose?.release();
    this.ordinarySample = false;
    this.stationaryFeet?.dispose();
    this.locomotionClearance?.dispose();
    for (const animation of this.clips.values()) animation.dispose();
    this.root.dispose();
  }
}
const FLAT_GROUND = () => 0;
