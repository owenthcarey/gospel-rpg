import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3, Vector2 } from '@babylonjs/core/Maths/math';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

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
  float wave = sin(w.x * .56 + w.z * .31 - time * 1.2) * .62
    + sin(w.z * .85 - w.x * .17 + time * .72) * .24
    + sin(w.x * 1.6 + w.z * .8 - time * 1.9) * .14;
  p.y += wave * strength;
  vWater = w;
  vWave = wave;
  gl_Position = worldViewProjection * vec4(p, 1.0);
}`;
const fragmentSource = `
precision highp float;
uniform vec3 baseColor;
uniform vec3 shallowColor;
uniform vec3 foamColor;
uniform float time;
uniform float strength;
uniform vec2 shore;
varying vec3 vWater;
varying float vWave;
void main(void) {
  vec2 p = vWater.xz;
  float broad = sin(p.x * .17 + p.y * .09) * .5 + .5;
  float bank = 1.0 - smoothstep(0.0, shore.y, p.x - shore.x);
  vec3 water = mix(baseColor, shallowColor, clamp(bank * .7 + broad * .16, 0.0, .8));
  float wave = sin(p.x * .56 + p.y * .31 - time * 1.2);
  float broken = sin(p.x * 1.7 - p.y * .64 + time * .21) * .5 + .5;
  float fine = sin(p.x * 2.1 + p.y * .74 - time * .7);
  float crest = smoothstep(.92, .99, wave) * smoothstep(.46, .85, broken);
  float glint = smoothstep(.992, 1.0, fine) * smoothstep(.76, .95, broken) * .2;
  float swell = clamp(strength * 2.0, .04, .5);
  water *= .92 + vWave * swell * .14 + broad * .12;
  water = mix(water, foamColor, crest * (.10 + swell * .5) + glint);
  gl_FragColor = vec4(water, 1.0);
}`;

/** One draw call for a coherent surface. Navigation and boat positions stay on their own plane. */
export class WaterPresentation {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  private storm = 0;
  private low = false;
  constructor(
    scene: Scene,
    options: {
      name: string;
      width: number;
      depth: number;
      x?: number;
      z?: number;
      y?: number;
      shore?: number;
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
          'time',
          'strength',
          'baseColor',
          'shallowColor',
          'foamColor',
          'shore',
        ],
      },
    );
    this.material.setVector2('shore', new Vector2(options.shore ?? -1000, 18));
    this.mesh.material = this.material;
    this.setStorm(options.storm ? 1 : 0);
    this.tick(0, true);
  }
  setStorm(value: number): void {
    this.storm = Math.max(0, Math.min(1, value));
    this.material.setColor3(
      'baseColor',
      Color3.Lerp(Color3.FromHexString('#326b79'), Color3.FromHexString('#1c3543'), this.storm),
    );
    this.material.setColor3(
      'shallowColor',
      Color3.Lerp(Color3.FromHexString('#76afa1'), Color3.FromHexString('#416875'), this.storm),
    );
    this.material.setColor3(
      'foamColor',
      Color3.Lerp(Color3.FromHexString('#c7dfcd'), Color3.FromHexString('#b6d0cf'), this.storm),
    );
  }
  quality(low: boolean): void {
    this.low = low;
  }
  tick(time: number, reduced: boolean): void {
    this.material.setFloat('time', reduced ? 0 : time);
    this.material.setFloat('strength', this.low ? this.storm * 0.12 : 0.018 + this.storm * 0.2);
  }
  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}
