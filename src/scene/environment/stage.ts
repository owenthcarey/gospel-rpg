import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { RenderingGroup } from '@babylonjs/core/Rendering/renderingGroup';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { blendProfiles, type EnvironmentProfile } from '../../content/environment';
import type { Settings } from '../../game/types';
import { SkyDome } from './sky';
import { horizonRings, type HorizonOptions } from './horizon';
import { ContactShadows } from './contact';
import { Atmosphere } from './atmosphere';
import { matte, StylePlugin } from './matte';
import type { WaterPresentation } from '../presentation/water';

export interface StageOptions {
  /** Sky dome radius; omit for enclosed rooms. */
  sky?: number;
  horizon?: Omit<HorizonOptions, 'colors'>;
  ground?: (x: number, z: number) => number;
  /** Fixed shadow extent for presentations whose subject never moves far. */
  shadowCenter?: Vector3;
}

export function sunDirection(profile: EnvironmentProfile): Vector3 {
  const { azimuth, elevation } = profile.sun;
  return new Vector3(
    -Math.cos(elevation) * Math.sin(azimuth),
    -Math.sin(elevation),
    -Math.cos(elevation) * Math.cos(azimuth),
  ).normalize();
}

/**
 * One scene-owned look: matte light, sky, horizon, distance fog and ground contact.
 * Every region and the title view use it, so a
 * lighting feature is one change. Disposed with its scene; never saved.
 */
export class StageEnvironment {
  readonly sun: DirectionalLight;
  readonly fill: HemisphericLight;
  readonly shadow: ShadowGenerator;
  readonly contact: ContactShadows;
  readonly atmosphere: Atmosphere;
  private sky?: SkyDome;
  private horizon?: Mesh;
  private pipeline?: DefaultRenderingPipeline;
  private base: EnvironmentProfile;
  private current: EnvironmentProfile;
  private high = true;
  private reduced = false;
  private time = 0;
  private focus = new Vector3();
  private waters: WaterPresentation[] = [];
  constructor(
    readonly scene: Scene,
    private camera: Camera,
    profile: EnvironmentProfile,
    private options: StageOptions = {},
  ) {
    this.base = this.current = profile;
    scene.fogMode = Scene.FOGMODE_EXP2;
    this.fill = new HemisphericLight('stage-fill', new Vector3(0, 1, 0), scene);
    this.sun = new DirectionalLight('stage-sun', sunDirection(profile), scene);
    this.sun.shadowMinZ = 0;
    this.sun.shadowMaxZ = 160;
    this.sun.autoUpdateExtends = false;
    this.sun.autoCalcShadowZBounds = false;
    this.shadow = new ShadowGenerator(this.software ? 1024 : 2048, this.sun);
    this.shadow.usePercentageCloserFiltering = true;
    this.shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
    this.shadow.bias = 0.0015;
    this.shadow.normalBias = 0.03;
    this.shadow.transparencyShadow = false;
    if (options.sky && !profile.interior) {
      const sky = (this.sky = new SkyDome(scene, options.sky));
      // Opaque meshes draw in material order, which would put the early sky first and shade
      // every pixel. Drawn last, the far-plane dome fills only what nothing else covers.
      scene.setRenderingOrder(
        0,
        (a, b) =>
          Number(a.getMesh() === sky.mesh) - Number(b.getMesh() === sky.mesh) ||
          RenderingGroup.PainterSortCompare(a, b),
      );
    }
    if (options.horizon && profile.horizon)
      this.horizon = horizonRings(scene, { ...options.horizon, colors: profile.horizon });
    this.contact = new ContactShadows(scene, options.ground ?? (() => 0));
    this.atmosphere = new Atmosphere(scene, profile);
    const config = scene.imageProcessingConfiguration;
    // Classic material colors and polygon planes stay readable all the way to the frame edge.
    config.exposure = 1;
    config.contrast = 1;
    config.toneMappingEnabled = false;
    config.colorCurvesEnabled = false;
    config.vignetteEnabled = false;
    if (options.shadowCenter) this.focus.copyFrom(options.shadowCenter);
    this.apply(profile);
  }
  get profile(): EnvironmentProfile {
    return this.current;
  }
  get label(): string {
    return this.current.label;
  }
  material(name: string, hex: string, alpha = 1): StandardMaterial {
    return matte(this.scene, name, hex, alpha);
  }
  /** Blend toward a variant (for example the storm) without rebuilding the stage. */
  blend(variant: EnvironmentProfile | undefined, amount: number): void {
    const next = variant ? blendProfiles(this.base, variant, amount) : this.base;
    if (next !== this.current) this.apply(next);
  }
  setProfile(profile: EnvironmentProfile): void {
    this.base = profile;
    this.apply(profile);
  }
  private apply(p: EnvironmentProfile): void {
    this.current = p;
    const scene = this.scene;
    const fog = Color3.FromHexString(p.fog.color);
    scene.fogColor = fog;
    scene.fogDensity = p.fog.density;
    scene.clearColor = Color4.FromColor3(fog, 1);
    const direction = sunDirection(p);
    this.sun.direction = direction;
    this.sun.diffuse = Color3.FromHexString(p.sun.color);
    this.sun.specular = Color3.Black();
    this.sun.intensity = p.sun.intensity;
    this.fill.diffuse = Color3.FromHexString(p.fill.sky);
    this.fill.groundColor = Color3.FromHexString(p.fill.ground);
    this.fill.specular = Color3.Black();
    this.fill.intensity = p.fill.intensity;
    this.shadow.darkness = 1 - p.shadow.darkness;
    this.sun.shadowFrustumSize = p.shadow.extent * 2;
    this.sky?.apply(p, direction, Boolean(this.pipeline));
    for (const water of this.waters) water.applyEnvironment(p, Boolean(this.pipeline));
    this.atmosphere?.setProfile(p);
    this.placeSun();
  }
  /**
   * A soft, slow brightening of the sky light (0–1), for distant storm lightning. It is never a
   * rapid flash; the caller keeps it off under reduced motion.
   */
  illuminate(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    this.fill.intensity = this.current.fill.intensity * (1 + a * 0.9);
    this.fill.diffuse = Color3.Lerp(
      Color3.FromHexString(this.current.fill.sky),
      new Color3(0.86, 0.9, 1),
      a * 0.6,
    );
  }
  /** Water shares the stage's distance fog and output color space. */
  attachWater(water: WaterPresentation): void {
    this.waters.push(water);
    water.applyEnvironment(this.current, Boolean(this.pipeline));
  }
  /** Keep the sharp shadow volume centered on what the player is looking at. */
  setFocus(point: Vector3): void {
    if (this.options.shadowCenter) return;
    this.focus.copyFrom(point);
    this.placeSun();
  }
  /** Ambient particles and birds follow the view even where the shadow volume is fixed. */
  setView(point: Vector3): void {
    this.atmosphere.setFocus(point);
    this.setFocus(point);
  }
  private placeSun(): void {
    const direction = this.sun.direction.normalizeToNew();
    // Snap to shadow texels along the light's own axes so edges do not shimmer while following.
    const texel = (this.current.shadow.extent * 2) / this.shadow.getShadowMap()!.getSize().width;
    const right = Vector3.Cross(Vector3.Up(), direction).normalize();
    const up = Vector3.Cross(direction, right).normalize();
    const u = Math.round(Vector3.Dot(this.focus, right) / texel) * texel;
    const v = Math.round(Vector3.Dot(this.focus, up) / texel) * texel;
    const w = Vector3.Dot(this.focus, direction);
    const snapped = right.scale(u).add(up.scale(v)).add(direction.scale(w));
    this.sun.position.copyFrom(snapped.subtract(direction.scale(80)));
  }
  castShadow(mesh: Mesh | TransformNode, contact?: { radius: number; length?: number }): void {
    if ('getTotalVertices' in mesh) this.shadow.addShadowCaster(mesh as Mesh);
    if (contact) this.contact.add(mesh, contact.radius, contact.length ?? 1);
  }
  /** Advance cosmetic time: clouds and wind. Frozen by reduced motion or pause. */
  tick(dt: number, running: boolean): void {
    if (running && !this.reduced) this.time += dt;
    this.sky?.setTime(this.time);
    StylePlugin.setWind(this.time, this.reduced ? 0 : this.current.wind);
    this.contact.update();
    this.atmosphere.tick(dt, running);
  }
  applySettings(settings: Pick<Settings, 'quality' | 'reducedMotion'>): void {
    this.reduced = settings.reducedMotion;
    const high = settings.quality !== 'low';
    this.scene.shadowsEnabled = high;
    this.contact.setStrength(high ? 0.55 : 1);
    this.atmosphere.applySettings(!high, this.reduced);
    this.sky?.quality(!high);
    if (high && !this.pipeline) {
      this.pipeline = new DefaultRenderingPipeline(
        'stage-antialias',
        true,
        this.scene,
        [this.camera],
        true,
      );
      const software = this.software;
      this.pipeline.samples = software ? 1 : 4;
      this.pipeline.fxaaEnabled = false;
      this.pipeline.imageProcessingEnabled = true;
      this.pipeline.bloomEnabled = false;
    } else if (!high && this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = undefined;
    }
    this.high = high;
    this.apply(this.current);
  }
  /** True on CPU rasterizers (for example SwiftShader), where fill rate is scarce. */
  get software(): boolean {
    const engine = this.scene.getEngine() as { getGlInfo?: () => { renderer: string } };
    return /swiftshader|llvmpipe|software/i.test(engine.getGlInfo?.().renderer ?? '');
  }
  get quality(): 'high' | 'low' {
    return this.high ? 'high' : 'low';
  }
  dispose(): void {
    this.pipeline?.dispose();
    this.sky?.dispose();
    this.horizon?.material?.dispose();
    this.horizon?.dispose();
    this.contact.dispose();
    this.atmosphere.dispose();
    this.shadow.dispose();
    StylePlugin.setWind(0, 0);
  }
}
