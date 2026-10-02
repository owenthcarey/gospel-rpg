import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
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
varying float vWave;
void main(void) {
  vec3 p = position;
  vec3 w = (world * vec4(p, 1.0)).xyz;
  float a = w.x * .56 + w.z * .31 - time * 1.2;
  float b = w.z * .85 - w.x * .17 + time * .72;
  float c = w.x * 1.6 + w.z * .8 - time * 1.9;
  // The same broad wave phase as waterHeight() keeps storm hulls on the surface.
  float wave = sin(a) * .62 + sin(b) * .24 + sin(c) * .14;
  p.y += wave * strength;
  vWater = vec3(w.x, w.y + wave * strength, w.z);
  vWave = wave;
  gl_Position = worldViewProjection * vec4(p, 1.0);
}`;

const fragmentSource = `
precision highp float;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 foamColor;
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
varying float vWave;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
  float eye = length(cameraPosition - vWater);
  float d = shoreDistance(p);
  // Broad blue color bands make the lake read as a game surface at any viewing angle.
  float shallow = 1.0 - smoothstep(0.0, 4.5, d);
  shallow = floor(shallow * 3.0 + 0.5) / 3.0;
  vec2 tile = floor(p * 0.65);
  float variation = (hash(tile) - 0.5) * 0.035;
  vec3 color = mix(deepColor, shallowColor, shallow * 0.78);
  color *= 0.97 + variation + step(0.35, vWave) * storm * 0.06;
  // Short painted ripple strokes, never reflections or a photographic sun path.
  vec2 strokes = vec2(p.x * 0.8 + p.y * 0.22, p.y * 1.15 - p.x * 0.12);
  float phase = strokes.y - t * 0.12;
  vec2 cell = floor(vec2(strokes.x, phase));
  float line = step(0.91, fract(phase)) * step(0.16, fract(strokes.x)) * step(fract(strokes.x), 0.7);
  line *= step(0.68, hash(cell)) * (1.0 - smoothstep(35.0, 80.0, eye));
  color = mix(color, shallowColor, line * 0.22 * (1.0 - storm * 0.4));
  // Broken cream-colored foam at the bank and around active hulls.
  float lap = sin(t * 0.85 - d * 3.5) * 0.5 + 0.5;
  float edge = 1.0 - smoothstep(0.0, 0.2 + lap * 0.2, d);
  float grain = hash(floor(p * 2.2 + vec2(t * 0.06, 0.0)));
  float foam = edge * step(0.32, grain + edge * 0.2) * 0.6;
#ifndef LOW
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (float(i) >= rippleCount || lowDetail > 0.5) break;
    float rd = length(p - ripples[i].xy) - ripples[i].z;
    if (rd > 0.0 && rd < 1.8)
      foam += ripples[i].w * step(0.92, fract(rd * 1.25 - t * 0.32)) * (1.0 - rd / 1.8) * 0.28;
  }
#endif
  float crest = step(0.35, vWave) * line;
  foam += crest * storm * 0.65;
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
    this.mesh = CreateGround(
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
    this.applyEnvironment(undefined, false);
    this.setStorm(options.storm ? 1 : 0);
    this.tick(0, true);
  }
  /** Shares the stage's distance fog and output color space. */
  applyEnvironment(profile: EnvironmentProfile | undefined, linearOutput: boolean): void {
    this.profile = profile;
    const m = this.material;
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
      Color3.Lerp(Color3.FromHexString('#346c95'), Color3.FromHexString('#2e475b'), this.storm),
    );
    m.setColor3(
      'shallowColor',
      Color3.Lerp(Color3.FromHexString('#5c9ca8'), Color3.FromHexString('#537782'), this.storm),
    );
    m.setColor3(
      'foamColor',
      Color3.Lerp(Color3.FromHexString('#d4e0cd'), Color3.FromHexString('#b9c9ca'), this.storm),
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
    if (low === this.low) return;
    this.low = low;
    this.material.setFloat('lowDetail', low ? 1 : 0);
    // Low drops cosmetic rings around moving hulls and wading people.
    this.material.options.defines = low ? ['#define LOW'] : [];
  }
  tick(time: number, reduced: boolean): void {
    this.material.setFloat('time', reduced ? 0 : time);
    this.material.setFloat('still', reduced ? 1 : 0);
    this.material.setFloat('strength', this.low ? this.storm * 0.12 : 0.008 + this.storm * 0.2);
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
