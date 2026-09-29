import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { applyCameraPose, cameraPose, type CameraPose } from './framing';

export interface ShotOptions {
  /** Establish the composition immediately: restores, replays and reduced motion. */
  instant?: boolean;
  /** Seconds for the move; bounded so reading is never kept waiting. */
  duration?: number;
}
export interface ShotMotion {
  running: boolean;
  reduced: boolean;
  /** 0–1: gentle breathing drift while a composition holds. */
  drift?: number;
  /** 0–1: restrained handheld shake, used only by the storm. */
  shake?: number;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function wrap(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

/**
 * Moves a presentation camera between framed poses. Checkpoints request a shot by key; a new
 * key eases from wherever the camera is, so Continue during a move retargets rather than
 * queues. The same key with a new pose (for example a resized reading panel) updates the
 * destination in place. Purely cosmetic: shots never gate progress or reading.
 */
export class ShotDirector {
  private key = '';
  private from?: CameraPose;
  private to?: CameraPose;
  private t = 1;
  private duration = 2.4;
  private time = 0;
  constructor(private camera: ArcRotateCamera) {}
  get moving(): boolean {
    return this.t < 1;
  }
  get progress(): number {
    return this.t;
  }
  shot(key: string, pose: CameraPose, options: ShotOptions = {}): void {
    const clone = { ...pose, target: pose.target.clone() };
    if (options.instant || !this.to) {
      this.key = key;
      this.to = clone;
      this.from = clone;
      this.t = 1;
      applyCameraPose(this.camera, clone);
      return;
    }
    if (key === this.key) {
      this.to = clone;
      if (this.t >= 1) applyCameraPose(this.camera, clone);
      return;
    }
    this.key = key;
    this.from = cameraPose(this.camera);
    this.to = clone;
    this.t = 0;
    this.duration = Math.max(0.6, Math.min(3.2, options.duration ?? 2.4));
  }
  tick(dt: number, motion: ShotMotion): void {
    if (!this.to || !this.from) return;
    if (motion.reduced) {
      this.t = 1;
      applyCameraPose(this.camera, this.to);
      return;
    }
    if (motion.running) {
      this.t = Math.min(1, this.t + dt / this.duration);
      this.time += dt;
    }
    const e = ease(this.t);
    const f = this.from,
      g = this.to;
    const pose: CameraPose = {
      alpha: f.alpha + wrap(g.alpha - f.alpha) * e,
      beta: f.beta + (g.beta - f.beta) * e,
      radius: f.radius + (g.radius - f.radius) * e,
      target: Vector3.Lerp(f.target, g.target, e),
    };
    // A slow, barely perceptible breath keeps held compositions alive.
    const drift = (motion.drift ?? 1) * 0.012;
    pose.alpha += Math.sin(this.time * 0.21) * drift;
    pose.beta += Math.sin(this.time * 0.17 + 1.3) * drift * 0.5;
    pose.radius *= 1 + Math.sin(this.time * 0.13) * drift * 0.6;
    const shake = motion.shake ?? 0;
    if (shake > 0) {
      pose.alpha += (Math.sin(this.time * 2.3) + Math.sin(this.time * 3.7) * 0.5) * 0.006 * shake;
      pose.beta += Math.sin(this.time * 2.9 + 0.7) * 0.005 * shake;
    }
    applyCameraPose(this.camera, pose);
  }
}
