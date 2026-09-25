import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';

/** Height-weighted sway for foliage, reeds and cloth. Wind never moves collision or picking. */
export interface WindShape {
  /** Local height where sway begins. */
  start: number;
  /** Height over which sway reaches full amplitude. */
  range: number;
  /** Displacement at full height and strength, in meters. */
  amplitude: number;
}
export const WIND_SHAPES: Partial<Record<string, WindShape>> = {
  olive: { start: 1.1, range: 2.6, amplitude: 0.07 },
  split_olive: { start: 1.1, range: 2.6, amplitude: 0.06 },
  palm: { start: 2.2, range: 3.6, amplitude: 0.13 },
  cypress: { start: 0.6, range: 4.2, amplitude: 0.05 },
  reeds: { start: 0.05, range: 1.2, amplitude: 0.1 },
  reed_bank: { start: 0.05, range: 1.3, amplitude: 0.09 },
  reed_screen: { start: 0.3, range: 1.4, amplitude: 0.025 },
  door_awning: { start: 1.6, range: 0.8, amplitude: 0.035 },
  market: { start: 2.1, range: 0.7, amplitude: 0.03 },
  grass_tuft: { start: 0.02, range: 0.5, amplitude: 0.07 },
  shrub: { start: 0.15, range: 0.8, amplitude: 0.04 },
  flowers: { start: 0.05, range: 0.45, amplitude: 0.06 },
};

/** Shared stylization: wind sway in the vertex stage, ordered-dither fading in the fragment stage. */
export class StylePlugin extends MaterialPluginBase {
  wind?: WindShape;
  fade = 1;
  private static clock = { time: 0, strength: 0.4 };
  static setWind(time: number, strength: number): void {
    StylePlugin.clock.time = time;
    StylePlugin.clock.strength = strength;
  }
  constructor(material: Material) {
    super(material, 'WayStyle', 180, { WAY_WIND: false, WAY_FADE: false }, true, true);
  }
  /** Changing either feature recompiles only this material's effect. */
  configure(wind: WindShape | undefined, fading: boolean): void {
    const changed = Boolean(wind) !== Boolean(this.wind) || fading !== this.fading;
    this.wind = wind;
    this.fading = fading;
    if (changed) this.markAllDefinesAsDirty();
  }
  private fading = false;
  override prepareDefines(defines: MaterialDefines): void {
    defines['WAY_WIND'] = Boolean(this.wind);
    defines['WAY_FADE'] = this.fading;
  }
  override getClassName(): string {
    return 'WayStylePlugin';
  }
  override getUniforms() {
    return {
      ubo: [
        { name: 'wayWind', size: 4, type: 'vec4' },
        { name: 'wayFade', size: 1, type: 'float' },
      ],
      vertex: `uniform vec4 wayWind;`,
      fragment: `uniform float wayFade;`,
    };
  }
  override bindForSubMesh(ubo: UniformBuffer): void {
    const shape = this.wind ?? { start: 0, range: 1, amplitude: 0 };
    ubo.updateFloat4(
      'wayWind',
      shape.start,
      Math.max(0.01, shape.range),
      shape.amplitude * StylePlugin.clock.strength,
      StylePlugin.clock.time,
    );
    ubo.updateFloat('wayFade', this.fade);
  }
  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType === 'vertex')
      return {
        CUSTOM_VERTEX_UPDATE_WORLDPOS: `
#ifdef WAY_WIND
  float wayH = clamp((positionUpdated.y - wayWind.x) / wayWind.y, 0.0, 1.0);
  float wayPhase = worldPos.x * 0.31 + worldPos.z * 0.23;
  float wayGust = 0.6 + 0.4 * sin(wayWind.w * 0.37 + worldPos.x * 0.05);
  vec2 waySway = vec2(sin(wayWind.w * 1.3 + wayPhase), cos(wayWind.w * 1.05 + wayPhase * 1.3) * 0.6);
  worldPos.xz += waySway * wayWind.z * wayGust * wayH * wayH;
#endif`,
      };
    if (shaderType === 'fragment')
      return {
        CUSTOM_FRAGMENT_MAIN_BEGIN: `
#ifdef WAY_FADE
  {
    const float wayBayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    ivec2 wayCell = ivec2(mod(floor(gl_FragCoord.xy), 4.0));
    if (wayFade < 0.999 && (wayBayer[wayCell.x + wayCell.y * 4] + 0.5) / 16.0 >= wayFade) discard;
  }
#endif`,
      };
    return null;
  }
}

export function stylePlugin(material: Material): StylePlugin {
  return (
    (material.pluginManager?.getPlugin('WayStyle') as StylePlugin | null) ??
    new StylePlugin(material)
  );
}

/** Matte convention for procedural surfaces. Colors stay in the established linear-input convention. */
export function matte(scene: Scene, name: string, hex: string, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex).toLinearSpace();
  m.specularColor = Color3.Black();
  m.alpha = alpha;
  return m;
}

/**
 * Replace a container's glTF materials with one vertex-color matte material so imported and
 * procedural surfaces share a lighting and color-space path. glTF colors are linear; the Standard
 * material shades in display space, so each shared geometry is converted once.
 */
export function convertContainer(container: AssetContainer, scene: Scene, id: string): void {
  const converted = new Map<Material, StandardMaterial>();
  for (const mesh of container.meshes) {
    const source = mesh.material;
    if (!source) continue;
    let material = converted.get(source);
    if (!material) {
      material = new StandardMaterial(id + ':matte', scene);
      material.diffuseColor = Color3.White();
      material.specularColor = Color3.Black();
      material.backFaceCulling = source.backFaceCulling;
      material.metadata = { assetId: id };
      const plugin = new StylePlugin(material);
      plugin.configure(WIND_SHAPES[id], false);
      converted.set(source, material);
      container.materials.push(material);
    }
    mesh.material = material;
    displayColors(mesh);
  }
  for (const source of converted.keys()) {
    container.materials.splice(container.materials.indexOf(source), 1);
    source.dispose(true, true);
  }
}

function displayColors(mesh: AbstractMesh): void {
  const geometry = (mesh as AbstractMesh & { geometry?: { metadata?: unknown } }).geometry;
  if (!geometry || (geometry.metadata as { display?: boolean } | undefined)?.display) return;
  const colors = mesh.getVerticesData(VertexBuffer.ColorKind);
  if (!colors) return;
  const stride = colors.length / Math.max(1, mesh.getTotalVertices());
  const out = new Float32Array(colors.length);
  for (let i = 0; i < colors.length; i++)
    out[i] = i % stride === 3 ? colors[i]! : Math.pow(Math.max(0, colors[i]!), 1 / 2.2);
  mesh.setVerticesData(VertexBuffer.ColorKind, out, false, stride);
  geometry.metadata = { display: true };
}
