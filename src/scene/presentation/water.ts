import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3, Vector2, Vector3 } from '@babylonjs/core/Maths/math';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { EnvironmentProfile } from '../../content/environment';

const MAX_LAND = 4;
const MAX_RIPPLES = 6;

const vertexSource = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float time;
uniform float strength;
varying vec3 vWater;
varying vec3 vNormal;
varying float vWave;
void main(void) {
  vec3 p = position;
  vec3 w = (world * vec4(p, 1.0)).xyz;
  float a = w.x * .56 + w.z * .31 - time * 1.2;
  float b = w.z * .85 - w.x * .17 + time * .72;
  float c = w.x * 1.6 + w.z * .8 - time * 1.9;
  // The same profile as waterHeight() in game/presence, with its analytic slope.
  float wave = sin(a) * .62 + sin(b) * .24 + sin(c) * .14;
  float dx = cos(a) * .62 * .56 - cos(b) * .24 * .17 + cos(c) * .14 * 1.6;
  float dz = cos(a) * .62 * .31 + cos(b) * .24 * .85 + cos(c) * .14 * .8;
  p.y += wave * strength;
  vWater = vec3(w.x, w.y + wave * strength, w.z);
  vNormal = normalize(vec3(-dx * strength * 2.2, 1.0, -dz * strength * 2.2));
  vWave = wave;
  gl_Position = worldViewProjection * vec4(p, 1.0);
}`;

const fragmentSource = `
precision highp float;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 foamColor;
uniform vec3 skyZenith;
uniform vec3 skyHorizon;
uniform vec3 sunColor;
uniform vec3 toSun;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec3 cameraPosition;
uniform float time;
uniform float strength;
uniform float storm;
uniform float linearOutput;
uniform float still;
uniform float lowDetail;
uniform vec4 land[${MAX_LAND}];
uniform float landCount;
uniform vec2 wobble;
uniform float coast;
uniform vec4 ripples[${MAX_RIPPLES}];
uniform float rippleCount;
varying vec3 vWater;
varying vec3 vNormal;
varying float vWave;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float shoreDistance(vec2 p) {
  float d = 1000.0;
  for (int i = 0; i < ${MAX_LAND}; i++) {
    if (float(i) >= landCount) break;
    vec2 q = p - land[i].xy;
    q.x -= wobble.x * sin(p.y * wobble.y);
    vec2 e = abs(q) - land[i].zw;
    d = min(d, length(max(e, 0.0)) + min(max(e.x, e.y), 0.0));
  }
  // Matches coastMargin() in presentation/ground: visual shores only ever grow past the walkable box.
  float margin = 1.2 + 0.8 * sin(p.x * 0.35 + sin(p.y * 0.21) * 2.0) + 0.45 * sin(p.y * 0.47 + p.x * 0.13);
  return d - coast * margin;
}
void main(void) {
  vec2 p = vWater.xz;
  float t = still > 0.5 ? 0.0 : time;
  // Fine moving ripples perturb the broad wave normal.
  float eye = length(cameraPosition - vWater);
  // Fine ripples fade with distance so far water keeps one coherent sun path instead of aliasing.
  float detail = (1.0 - smoothstep(18.0, 70.0, eye)) * (1.0 - lowDetail);
  // Irregular drifting ripples (noise, not sines) so glints scatter instead of tiling.
  vec2 r1 = vec2(0.0), r2 = vec2(0.0);
  if (detail > 0.001) {
    vec2 q1 = p * 1.3 + vec2(t * 0.35, -t * 0.22);
    vec2 q2 = p * 2.9 + vec2(-t * 0.5, t * 0.41) + 11.0;
    r1 = vec2(noise(q1) - noise(q1 + vec2(0.35, 0.0)), noise(q1) - noise(q1 + vec2(0.0, 0.35))) * 3.2;
    r2 = vec2(noise(q2) - noise(q2 + vec2(0.3, 0.0)), noise(q2) - noise(q2 + vec2(0.0, 0.3))) * 2.6;
  }
  vec3 n = normalize(vNormal + vec3(r1 * 0.045 + r2 * 0.025, 0.0).xzy * (1.0 + storm) * detail);
  vec3 view = normalize(cameraPosition - vWater);
  float d = shoreDistance(p);
  float shallow = 1.0 - smoothstep(0.0, 7.0, d);
  float broad = noise(p * 0.07) * 0.5 + noise(p * 0.19 + 7.0) * 0.5;
  vec3 color = mix(deepColor, shallowColor, clamp(shallow * 0.85 + broad * 0.12, 0.0, 0.92));
  color *= 0.8 + 0.25 * max(dot(n, toSun), 0.0);
  // Sky reflection at glancing angles.
  vec3 reflected = reflect(-view, n);
  vec3 sky = mix(skyHorizon, skyZenith, clamp(reflected.y * 1.6, 0.0, 1.0));
  float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.0);
  color = mix(color, sky, fresnel * 0.6);
  // Crisp sun glints rather than streaks.
  float glint = pow(max(dot(reflect(-toSun, n), view), 0.0), mix(24.0, 140.0, detail));
  color += sunColor * smoothstep(0.25, 0.75, glint) * (1.0 - storm * 0.8) * mix(0.7, 1.4, detail);
  // Lapping foam along every shore, broken by drifting noise.
  float lap = sin(t * 1.25 - d * 3.5) * 0.5 + 0.5;
  float edge = 1.0 - smoothstep(0.0, 0.35 + lap * 0.45, d);
  float grain = noise(p * 2.6 + vec2(t * 0.15, -t * 0.1));
  float foam = edge * smoothstep(0.25, 0.6, grain + edge * 0.45);
  // Rings around hulls and wading people.
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (float(i) >= rippleCount || lowDetail > 0.5) break;
    float rd = length(p - ripples[i].xy) - ripples[i].z;
    if (rd > 0.0 && rd < 2.4)
      foam += ripples[i].w * smoothstep(0.8, 1.0, sin(rd * 5.0 - t * 2.6 + grain * 2.5)) * (1.0 - rd / 2.4) * 0.35;
  }
  // Whitecaps on storm crests.
  float crest = smoothstep(0.55, 0.95, vWave) * smoothstep(0.35, 0.7, noise(p * 0.9 + t * 0.3));
  foam += crest * storm * 0.9;
  color = mix(color, foamColor, clamp(foam, 0.0, 1.0));
  float visibility = exp(-pow(eye * fogDensity, 2.0));
  color = mix(fogColor, color, clamp(visibility, 0.0, 1.0));
  gl_FragColor = vec4(linearOutput > 0.5 ? pow(max(color, 0.0), vec3(2.2)) : min(color, 1.0), 1.0);
}`;

/** Land as axis-aligned boxes in world space, for shore depth and foam. */
export interface LandBox {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
}
export interface Ripple {
  x: number;
  z: number;
  radius: number;
  strength: number;
}

/** One draw call for a coherent surface. Navigation and boat positions stay on their own plane. */
export class WaterPresentation {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private storm = 0;
  private low = false;
  private stormy = false;
  private profile?: EnvironmentProfile;
  constructor(
    scene: Scene,
    options: {
      name: string;
      width: number;
      depth: number;
      x?: number;
      z?: number;
      y?: number;
      /** Legacy: land lies west of this x. */
      shore?: number;
      land?: readonly LandBox[];
      wobble?: { amplitude: number; frequency: number };
      /** Irregular coast margin in meters (see coastMargin). */
      coast?: number;
      interactive?: boolean;
      storm?: boolean;
    },
  ) {
    this.mesh = MeshBuilder.CreateGround(
      options.name,
      { width: options.width, height: options.depth, subdivisions: 64 },
      scene,
    );
    this.mesh.position.set(options.x ?? 0, options.y ?? -0.18, options.z ?? 0);
    this.mesh.isPickable = options.interactive ?? false;
    this.mesh.metadata = { ground: options.interactive ?? false, waterPresentation: true };
    this.material = new ShaderMaterial(
      options.name + '-surface',
      scene,
      { vertexSource, fragmentSource },
      {
        attributes: ['position'],
        uniforms: [
          'worldViewProjection',
          'world',
          'cameraPosition',
          'time',
          'strength',
          'storm',
          'still',
          'lowDetail',
          'deepColor',
          'shallowColor',
          'foamColor',
          'skyZenith',
          'skyHorizon',
          'sunColor',
          'toSun',
          'fogColor',
          'fogDensity',
          'linearOutput',
          'land',
          'landCount',
          'wobble',
          'coast',
          'ripples',
          'rippleCount',
        ],
      },
    );
    this.mesh.material = this.material;
    const land = [...(options.land ?? [])];
    if (options.shore !== undefined)
      land.push({ x: options.shore - 500, z: 0, halfX: 500, halfZ: 1000 });
    this.material.setArray4(
      'land',
      Array.from({ length: MAX_LAND }, (_, i) => {
        const box = land[i];
        return box ? [box.x, box.z, box.halfX, box.halfZ] : [0, 0, 0, 0];
      }).flat(),
    );
    this.material.setFloat('landCount', Math.min(MAX_LAND, land.length));
    this.material.setVector2(
      'wobble',
      new Vector2(options.wobble?.amplitude ?? 0, options.wobble?.frequency ?? 0),
    );
    this.material.setFloat('coast', options.coast ?? 0);
    this.setRipples([]);
    this.material.setFloat('lowDetail', 0);
    this.stormy = options.storm ?? false;
    this.material.setVector3('cameraPosition', Vector3.Zero());
    this.applyEnvironment(undefined, new Vector3(0.3, 0.8, 0.4), false);
    this.setStorm(options.storm ? 1 : 0);
    this.tick(0, true);
  }
  /** Shares the stage's sky, sun, fog and output space. */
  applyEnvironment(
    profile: EnvironmentProfile | undefined,
    toSun: Vector3,
    linearOutput: boolean,
  ): void {
    this.profile = profile;
    const m = this.material;
    m.setColor3('skyZenith', Color3.FromHexString(profile?.sky.zenith ?? '#7fa6c0'));
    m.setColor3('skyHorizon', Color3.FromHexString(profile?.sky.horizon ?? '#dfe6d8'));
    m.setColor3('sunColor', Color3.FromHexString(profile?.sun.color ?? '#fff0d0'));
    m.setVector3('toSun', toSun.normalizeToNew());
    m.setColor3('fogColor', Color3.FromHexString(profile?.fog.color ?? '#cfdcd4'));
    m.setFloat('fogDensity', profile?.fog.density ?? 0.008);
    m.setFloat('linearOutput', linearOutput ? 1 : 0);
    this.setStorm(this.storm);
  }
  setStorm(value: number): void {
    this.storm = Math.max(0, Math.min(1, value));
    const m = this.material;
    m.setFloat('storm', this.stormy ? this.storm : 0);
    m.setColor3(
      'deepColor',
      Color3.Lerp(Color3.FromHexString('#2c6272'), Color3.FromHexString('#1d3440'), this.storm),
    );
    m.setColor3(
      'shallowColor',
      Color3.Lerp(Color3.FromHexString('#6fae9e'), Color3.FromHexString('#3f6470'), this.storm),
    );
    m.setColor3(
      'foamColor',
      Color3.Lerp(Color3.FromHexString('#e6efe2'), Color3.FromHexString('#c9d7d6'), this.storm),
    );
  }
  /** Cosmetic rings, for example around a moving hull. Never affects navigation. */
  setRipples(ripples: readonly Ripple[]): void {
    this.material.setArray4(
      'ripples',
      Array.from({ length: MAX_RIPPLES }, (_, i) => {
        const r = ripples[i];
        return r ? [r.x, r.z, r.radius, r.strength] : [0, 0, 0, 0];
      }).flat(),
    );
    this.material.setFloat('rippleCount', Math.min(MAX_RIPPLES, ripples.length));
  }
  quality(low: boolean): void {
    this.low = low;
    this.material.setFloat('lowDetail', low ? 1 : 0);
  }
  tick(time: number, reduced: boolean): void {
    this.material.setFloat('time', reduced ? 0 : time);
    this.material.setFloat('still', reduced ? 1 : 0);
    this.material.setFloat('strength', this.low ? this.storm * 0.12 : 0.018 + this.storm * 0.2);
    const camera = this.mesh.getScene().activeCamera;
    if (camera) this.material.setVector3('cameraPosition', camera.globalPosition);
  }
  get environment(): EnvironmentProfile | undefined {
    return this.profile;
  }
  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}
