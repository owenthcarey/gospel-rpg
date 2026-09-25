import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { AmbientParticles, EnvironmentProfile, Flock } from '../../content/environment';

interface AmbientDefinition {
  capacity: number;
  rate: number;
  build(system: ParticleSystem): void;
}
/** Soft round sprite generated at runtime; no downloaded image or canvas. */
function spriteTexture(scene: Scene): RawTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.max(0, 1 - r);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
  const texture = RawTexture.CreateRGBATexture(data, size, size, scene, false);
  texture.hasAlpha = true;
  texture.name = 'atmosphere-sprite';
  return texture;
}

const AMBIENT: Record<AmbientParticles, AmbientDefinition> = {
  motes: {
    capacity: 90,
    rate: 9,
    build(s) {
      s.minEmitBox = new Vector3(-6, 0.3, -6);
      s.maxEmitBox = new Vector3(6, 3.4, 6);
      s.color1 = new Color4(1, 0.93, 0.75, 0.55);
      s.color2 = new Color4(1, 0.86, 0.62, 0.35);
      s.colorDead = new Color4(1, 0.9, 0.7, 0);
      s.minSize = 0.025;
      s.maxSize = 0.06;
      s.minLifeTime = 6;
      s.maxLifeTime = 10;
      s.direction1 = new Vector3(-0.05, 0.02, -0.05);
      s.direction2 = new Vector3(0.05, 0.06, 0.05);
      s.minEmitPower = 0.3;
      s.maxEmitPower = 0.6;
      s.blendMode = ParticleSystem.BLENDMODE_ADD;
    },
  },
  pollen: {
    capacity: 80,
    rate: 7,
    build(s) {
      s.minEmitBox = new Vector3(-14, 0.2, -14);
      s.maxEmitBox = new Vector3(14, 2.6, 14);
      s.color1 = new Color4(1, 0.97, 0.82, 0.6);
      s.color2 = new Color4(1, 0.93, 0.7, 0.4);
      s.colorDead = new Color4(1, 0.95, 0.8, 0);
      s.minSize = 0.03;
      s.maxSize = 0.07;
      s.minLifeTime = 5;
      s.maxLifeTime = 9;
      s.direction1 = new Vector3(0.15, -0.02, 0.05);
      s.direction2 = new Vector3(0.35, 0.05, 0.2);
      s.minEmitPower = 0.4;
      s.maxEmitPower = 0.9;
      s.blendMode = ParticleSystem.BLENDMODE_ADD;
    },
  },
  insects: {
    capacity: 40,
    rate: 6,
    build(s) {
      s.minEmitBox = new Vector3(-10, 0.3, -10);
      s.maxEmitBox = new Vector3(10, 1.1, 10);
      s.color1 = new Color4(0.22, 0.19, 0.12, 0.85);
      s.color2 = new Color4(0.3, 0.26, 0.15, 0.7);
      s.colorDead = new Color4(0.3, 0.26, 0.15, 0);
      s.minSize = 0.018;
      s.maxSize = 0.03;
      s.minLifeTime = 2;
      s.maxLifeTime = 4;
      s.direction1 = new Vector3(-0.6, -0.1, -0.6);
      s.direction2 = new Vector3(0.6, 0.2, 0.6);
      s.minEmitPower = 0.3;
      s.maxEmitPower = 0.8;
      s.minAngularSpeed = -4;
      s.maxAngularSpeed = 4;
      s.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    },
  },
  spray: {
    capacity: 160,
    rate: 70,
    build(s) {
      s.minEmitBox = new Vector3(-2.2, 0, -2.2);
      s.maxEmitBox = new Vector3(2.2, 0.3, 2.2);
      s.color1 = new Color4(0.86, 0.92, 0.94, 0.4);
      s.color2 = new Color4(0.78, 0.86, 0.9, 0.25);
      s.colorDead = new Color4(0.8, 0.88, 0.9, 0);
      s.minSize = 0.1;
      s.maxSize = 0.3;
      s.minScaleY = 0.6;
      s.maxScaleY = 1.8;
      s.minLifeTime = 0.6;
      s.maxLifeTime = 1.1;
      s.direction1 = new Vector3(-1, 2.5, -1);
      s.direction2 = new Vector3(2, 4, 1);
      s.gravity = new Vector3(0, -9, 0);
      s.minEmitPower = 0.6;
      s.maxEmitPower = 1.2;
      s.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    },
  },
  rain: {
    capacity: 900,
    rate: 700,
    build(s) {
      s.minEmitBox = new Vector3(-16, 10, -16);
      s.maxEmitBox = new Vector3(16, 13, 16);
      s.color1 = new Color4(0.8, 0.87, 0.92, 0.6);
      s.color2 = new Color4(0.72, 0.8, 0.86, 0.42);
      s.colorDead = new Color4(0.7, 0.78, 0.84, 0);
      s.minSize = 0.03;
      s.maxSize = 0.045;
      s.minScaleY = 9;
      s.maxScaleY = 14;
      s.minLifeTime = 0.9;
      s.maxLifeTime = 1.2;
      s.direction1 = new Vector3(2.2, -12, 0.6);
      s.direction2 = new Vector3(2.8, -14, 1.2);
      s.minEmitPower = 1;
      s.maxEmitPower = 1;
      s.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
      s.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    },
  },
  glints: {
    capacity: 0,
    rate: 0,
    build() {},
  },
};

interface Bird {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  size: number;
}
/** One merged, unpickable mesh per flock; vertices are posed on the CPU each frame. */
class FlockView {
  readonly mesh: Mesh;
  private birds: Bird[];
  private positions: Float32Array;
  constructor(
    scene: Scene,
    private kind: Flock,
    count: number,
  ) {
    const gull = kind === 'gulls';
    this.birds = Array.from({ length: count }, (_, i) => ({
      angle: i * 2.39,
      radius: (gull ? 18 : 9) + (i % 3) * (gull ? 5 : 2.5),
      height: (gull ? 13 : 6.5) + ((i * 7) % 5) * (gull ? 1.4 : 0.6),
      speed: (gull ? 0.09 : 0.24) * (i % 2 ? 1 : -1) * (0.85 + (i % 4) * 0.08),
      phase: i * 1.7,
      size: gull ? 0.55 : 0.2,
    }));
    const vertices = count * 5;
    this.positions = new Float32Array(vertices * 3);
    const indices: number[] = [],
      colors: number[] = [];
    const body = Color3.FromHexString(gull ? '#f1efe8' : '#6e5a45'),
      tip = Color3.FromHexString(gull ? '#8c8f93' : '#4d3f31');
    for (let b = 0; b < count; b++) {
      const o = b * 5;
      // nose, tail, left tip, right tip, back
      indices.push(o, o + 2, o + 4, o, o + 4, o + 3, o + 4, o + 2, o + 1, o + 4, o + 1, o + 3);
      for (const c of [body, body, tip, tip, body]) colors.push(c.r, c.g, c.b, 1);
    }
    this.mesh = new Mesh('flock-' + kind, scene);
    const data = new VertexData();
    data.positions = Array.from(this.positions);
    data.indices = indices;
    data.colors = colors;
    data.normals = Array.from({ length: vertices }, () => [0, 1, 0]).flat();
    data.applyToMesh(this.mesh, true);
    const material = new StandardMaterial('flock-matte-' + kind, scene);
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.diffuseColor = Color3.Black();
    material.backFaceCulling = false;
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.metadata = { flock: kind };
  }
  pose(time: number, center: Vector3): void {
    const p = this.positions;
    this.birds.forEach((bird, i) => {
      const a = bird.angle + time * bird.speed;
      const wander = Math.sin(time * 0.13 + bird.phase) * 3;
      const x = center.x + Math.cos(a) * (bird.radius + wander),
        z = center.z + Math.sin(a) * (bird.radius + wander),
        y = center.y + bird.height + Math.sin(time * 0.4 + bird.phase) * 0.8;
      // Heading along the tangent of the circle.
      const dir = Math.sign(bird.speed);
      const fx = -Math.sin(a) * dir,
        fz = Math.cos(a) * dir;
      const rx = fz,
        rz = -fx;
      const flap = Math.sin(time * (this.kind === 'gulls' ? 5 : 13) + bird.phase);
      const glide =
        this.kind === 'gulls' ? 0.35 + 0.65 * Math.max(0, Math.sin(time * 0.5 + bird.phase)) : 1;
      const s = bird.size;
      const set = (k: number, px: number, py: number, pz: number) => {
        p[(i * 5 + k) * 3] = px;
        p[(i * 5 + k) * 3 + 1] = py;
        p[(i * 5 + k) * 3 + 2] = pz;
      };
      set(0, x + fx * s * 0.6, y, z + fz * s * 0.6);
      set(1, x - fx * s * 0.7, y + s * 0.05, z - fz * s * 0.7);
      const lift = flap * glide * s * 0.55;
      set(2, x + rx * s * 1.6 - fx * s * 0.2, y + lift, z + rz * s * 1.6 - fz * s * 0.2);
      set(3, x - rx * s * 1.6 - fx * s * 0.2, y + lift, z - rz * s * 1.6 - fz * s * 0.2);
      set(4, x, y + s * 0.12, z);
    });
    this.mesh.updateVerticesData('position', this.positions, false, false);
  }
  dispose(): void {
    this.mesh.material?.dispose();
    this.mesh.dispose();
  }
}

/**
 * Cosmetic life: ambient particles, smoke, footstep dust and birds. Pooled and capped per
 * quality; paused with the scene; hidden under reduced motion. Never saved or pickable.
 */
export class Atmosphere {
  private sprite!: RawTexture;
  private ambient = new Map<AmbientParticles, ParticleSystem>();
  private smoke: ParticleSystem[] = [];
  private dust!: ParticleSystem;
  private built = false;
  private pendingSmoke: { at: Vector3; scale: number }[] = [];
  private profile: EnvironmentProfile;
  private flock?: FlockView;
  private flockKind: Flock | null = null;
  private time = 0;
  private low = false;
  private reduced = false;
  private running = true;
  private focus = new Vector3();
  private flockCenter = new Vector3();
  private centered = false;
  private intensity = 1;
  constructor(
    private scene: Scene,
    profile: EnvironmentProfile,
  ) {
    this.profile = profile;
  }
  /** Built on the first running frame, so region loading never waits on particle effects. */
  private build(): void {
    this.built = true;
    const scene = this.scene;
    this.sprite = spriteTexture(scene);
    this.dust = new ParticleSystem('footstep-dust', 60, scene);
    this.dust.particleTexture = this.sprite;
    this.dust.color1 = new Color4(0.78, 0.7, 0.55, 0.45);
    this.dust.color2 = new Color4(0.7, 0.62, 0.48, 0.3);
    this.dust.colorDead = new Color4(0.7, 0.62, 0.48, 0);
    this.dust.minSize = 0.12;
    this.dust.maxSize = 0.28;
    this.dust.minLifeTime = 0.5;
    this.dust.maxLifeTime = 0.9;
    this.dust.direction1 = new Vector3(-0.4, 0.25, -0.4);
    this.dust.direction2 = new Vector3(0.4, 0.5, 0.4);
    this.dust.minEmitPower = 0.3;
    this.dust.maxEmitPower = 0.6;
    this.dust.emitRate = 0;
    this.dust.manualEmitCount = 0;
    this.dust.emitter = new Vector3();
    this.dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.dust.start();
    this.setProfile(this.profile);
    for (const { at, scale } of this.pendingSmoke) this.addSmoke(at, scale);
    this.pendingSmoke = [];
  }
  setProfile(profile: EnvironmentProfile): void {
    this.profile = profile;
    if (!this.built) return;
    for (const [kind, system] of this.ambient)
      if (!profile.particles.includes(kind)) {
        system.dispose();
        this.ambient.delete(kind);
      }
    for (const kind of profile.particles) {
      if (this.ambient.has(kind) || !AMBIENT[kind].capacity) continue;
      const definition = AMBIENT[kind];
      const system = new ParticleSystem('ambient-' + kind, definition.capacity, this.scene);
      system.particleTexture = this.sprite;
      system.emitter = this.focus.clone();
      definition.build(system);
      system.preWarmCycles = 60;
      system.preWarmStepOffset = 5;
      this.ambient.set(kind, system);
      this.applyRate(kind, system);
      if (!this.reduced) system.start();
    }
    if (profile.flock !== this.flockKind) {
      this.flock?.dispose();
      this.flock = profile.flock
        ? new FlockView(this.scene, profile.flock, profile.flock === 'gulls' ? 7 : 9)
        : undefined;
      this.flockKind = profile.flock;
      this.flock?.mesh.setEnabled(!this.reduced);
    }
  }
  /** Fade weather such as rain with a continuous amount, for example the storm's rising wind. */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
    for (const [kind, system] of this.ambient) this.applyRate(kind, system);
  }
  private applyRate(kind: AmbientParticles, system: ParticleSystem): void {
    const weather = kind === 'rain' || kind === 'spray';
    system.emitRate = AMBIENT[kind].rate * (this.low ? 0.35 : 1) * (weather ? this.intensity : 1);
  }
  addSmoke(at: Vector3, scale = 1): void {
    if (!this.built) {
      this.pendingSmoke.push({ at: at.clone(), scale });
      return;
    }
    const s = new ParticleSystem('hearth-smoke', 40, this.scene);
    s.particleTexture = this.sprite;
    s.emitter = at.clone();
    s.minEmitBox = new Vector3(-0.08, 0, -0.08);
    s.maxEmitBox = new Vector3(0.08, 0.1, 0.08);
    s.color1 = new Color4(0.86, 0.84, 0.8, 0.28);
    s.color2 = new Color4(0.76, 0.74, 0.7, 0.2);
    s.colorDead = new Color4(0.8, 0.8, 0.78, 0);
    s.minSize = 0.25 * scale;
    s.maxSize = 0.55 * scale;
    s.minLifeTime = 3;
    s.maxLifeTime = 5;
    s.direction1 = new Vector3(0.05, 0.5, 0.02);
    s.direction2 = new Vector3(0.25, 0.8, 0.12);
    s.minEmitPower = 0.35;
    s.maxEmitPower = 0.55;
    s.emitRate = this.low ? 3 : 6;
    s.addSizeGradient(0, 0.4);
    s.addSizeGradient(1, 1.8);
    s.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    s.preWarmCycles = 80;
    if (!this.reduced) s.start();
    this.smoke.push(s);
  }
  /** A small puff at a footfall; purely cosmetic. */
  footstep(at: Vector3): void {
    if (this.reduced || !this.running || !this.built) return;
    (this.dust.emitter as Vector3).copyFrom(at);
    this.dust.manualEmitCount = this.low ? 2 : 4;
  }
  setFocus(point: Vector3): void {
    this.focus.copyFrom(point);
    for (const system of this.ambient.values()) (system.emitter as Vector3).copyFrom(point);
    // Birds follow slowly so they drift across the view instead of orbiting the player.
    if (!this.centered) this.flockCenter.copyFrom(point);
    else Vector3.LerpToRef(this.flockCenter, point, 0.002, this.flockCenter);
    this.centered = true;
  }
  tick(dt: number, running: boolean): void {
    this.running = running;
    if (!this.built) {
      if (!running) return;
      this.build();
    }
    const speed = running && !this.reduced ? 0.01 : 0;
    for (const system of [...this.ambient.values(), ...this.smoke, this.dust])
      system.updateSpeed = speed;
    if (running && !this.reduced) this.time += dt;
    if (this.flock && !this.reduced) this.flock.pose(this.time, this.flockCenter);
  }
  applySettings(low: boolean, reduced: boolean): void {
    this.low = low;
    this.reduced = reduced;
    if (!this.built) return;
    for (const [kind, system] of this.ambient) {
      this.applyRate(kind, system);
      if (reduced) system.stop();
      else if (!system.isStarted()) system.start();
    }
    for (const s of this.smoke) {
      s.emitRate = low ? 3 : 6;
      if (reduced) s.stop();
      else if (!s.isStarted()) s.start();
    }
    if (reduced) this.dust.reset();
    this.flock?.mesh.setEnabled(!reduced);
  }
  dispose(): void {
    if (!this.built) return;
    for (const s of [...this.ambient.values(), ...this.smoke, this.dust]) s.dispose(false);
    this.flock?.dispose();
    this.sprite.dispose();
  }
}
