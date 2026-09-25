import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';
import type { EnvironmentProfile } from '../../content/environment';

const vertexSource = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDirection;
void main(void) {
  vDirection = position;
  vec4 p = worldViewProjection * vec4(position, 1.0);
  // Always at the far plane: shaded only where nothing else covers it.
  gl_Position = p.xyww;
}`;
const fragmentSource = `
precision highp float;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 glow;
uniform vec3 fogColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform float disc;
uniform float clouds;
uniform float time;
uniform float linearOutput;
varying vec3 vDirection;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
void main(void) {
  vec3 d = normalize(vDirection);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 color = mix(horizon, zenith, pow(up, 0.5));
  float toward = max(dot(d, sunDirection), 0.0);
  color += glow * pow(toward, 6.0) * 0.5 * (1.0 - up * 0.7);
  // Painterly cloud banks, projected onto a distant ceiling and drifting slowly.
  vec2 uv = d.xz / max(d.y + 0.12, 0.06) * 0.55 + vec2(time * 0.006, time * 0.0025);
  float n = fbm(uv * 1.3);
  float cover = smoothstep(0.62 - clouds * 0.3, 0.86 - clouds * 0.18, n) * smoothstep(0.0, 0.16, d.y);
  vec3 cloud = mix(mix(horizon, vec3(1.0), 0.6), sunColor, 0.18 + pow(toward, 4.0) * 0.4);
  cloud *= 0.92 + 0.12 * smoothstep(0.5, 0.9, n);
  color = mix(color, cloud, cover * 0.85);
  float sun = smoothstep(0.99955 - disc * 0.00025, 0.99985, toward) * step(0.001, disc);
  color += sunColor * sun * (1.0 - cover * 0.8) * 2.2;
  // The horizon band and everything below it dissolve into the scene fog.
  color = mix(color, fogColor, smoothstep(0.1, -0.03, d.y));
  gl_FragColor = vec4(linearOutput > 0.5 ? pow(max(color, 0.0), vec3(2.2)) : min(color, 1.0), 1.0);
}`;

/** A camera-following gradient sky. One draw; never pickable; ignores scene fog itself. */
export class SkyDome {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  constructor(scene: Scene, radius: number) {
    this.mesh = MeshBuilder.CreateSphere(
      'sky-dome',
      { diameter: radius * 2, segments: 20, sideOrientation: Mesh.BACKSIDE },
      scene,
    );
    this.mesh.infiniteDistance = true;
    this.mesh.isPickable = false;
    this.mesh.applyFog = false;
    this.material = new ShaderMaterial(
      'sky-gradient',
      scene,
      { vertexSource, fragmentSource },
      {
        attributes: ['position'],
        uniforms: [
          'worldViewProjection',
          'zenith',
          'horizon',
          'glow',
          'fogColor',
          'sunColor',
          'sunDirection',
          'disc',
          'clouds',
          'time',
          'linearOutput',
        ],
      },
    );
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.material.depthFunction = Constants.LEQUAL;
    this.mesh.material = this.material;
    this.setTime(0);
  }
  apply(profile: EnvironmentProfile, sunDirection: Vector3, linearOutput: boolean): void {
    const m = this.material;
    m.setColor3('zenith', Color3.FromHexString(profile.sky.zenith));
    m.setColor3('horizon', Color3.FromHexString(profile.sky.horizon));
    m.setColor3('glow', Color3.FromHexString(profile.sky.glow));
    m.setColor3('fogColor', Color3.FromHexString(profile.fog.color));
    m.setColor3('sunColor', Color3.FromHexString(profile.sun.color));
    // The dome samples the direction toward the sun, opposite the light's travel.
    m.setVector3('sunDirection', sunDirection.scale(-1).normalize());
    m.setFloat('disc', profile.sun.disc);
    m.setFloat('clouds', profile.clouds);
    m.setFloat('linearOutput', linearOutput ? 1 : 0);
  }
  setTime(time: number): void {
    this.material.setFloat('time', time);
  }
  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}
