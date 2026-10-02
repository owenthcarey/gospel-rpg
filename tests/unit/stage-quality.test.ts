import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import {
  InternalTexture,
  InternalTextureSource,
} from '@babylonjs/core/Materials/Textures/internalTexture';
import { StageEnvironment } from '../../src/scene/environment/stage';
import { WaterPresentation } from '../../src/scene/presentation/water';
import { environmentFor } from '../../src/content/environment';

function studio(
  software: boolean,
  quality: 'high' | 'low' = 'high',
  hdr: boolean | 'float' = false,
  sky = false,
  depthTextures?: boolean,
) {
  const engine = new NullEngine();
  if (depthTextures !== undefined) engine._features.supportDepthStencilTexture = depthTextures;
  if (depthTextures) {
    // NullEngine has no WebGL depth allocator; retain real target ownership and caster operations.
    vi.spyOn(engine, 'createDepthStencilTexture').mockImplementation(
      () => new InternalTexture(engine, InternalTextureSource.DepthStencil),
    );
  }
  if (hdr === 'float')
    Object.assign(engine.getCaps(), {
      textureHalfFloatRender: false,
      textureFloat: true,
      textureFloatRender: true,
      textureFloatLinearFiltering: true,
    });
  else if (hdr)
    Object.assign(engine.getCaps(), {
      textureHalfFloat: true,
      textureHalfFloatRender: true,
      textureHalfFloatLinearFiltering: true,
    });
  Object.assign(engine, { getGlInfo: () => ({ renderer: software ? 'SwiftShader' : 'Metal' }) });
  const targets = vi.spyOn(engine, 'createRenderTargetTexture');
  const processors = vi.spyOn(engine.postProcesses, 'push');
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('stage-test', 0, 0.78, 33, Vector3.Zero(), scene);
  const stage = new StageEnvironment(scene, camera, environmentFor('capernaum'), {
    quality,
    sky: sky ? 180 : undefined,
  });
  return { engine, scene, stage, targets, processors };
}

describe.each([false, true])('stage quality with software rendering %s', (software) => {
  it.each([false, true, 'float'] as const)(
    'builds only the needed processing for final quality settings with HDR support %s',
    (hdr) => {
      const { engine, scene, stage, processors } = studio(software, 'low', hdr);
      const created = () =>
        processors.mock.calls.flat().filter((processor) => processor.name === 'imageProcessing');
      const retained = () => engine.postProcesses;
      let disposed = false;
      try {
        expect(created()).toHaveLength(0);
        expect(scene.autoClear).toBe(true);
        stage.applySettings({ quality: 'high', reducedMotion: true });
        expect(created()).toHaveLength(hdr ? 1 : 0);
        expect(retained().map((processor) => processor.name)).toEqual(
          hdr ? ['imageProcessing'] : [],
        );
        expect(scene.imageProcessingConfiguration.applyByPostProcess).toBe(Boolean(hdr));
        expect(scene.autoClear).toBe(!hdr);
        stage.applySettings({ quality: 'high', reducedMotion: false });
        expect(created()).toHaveLength(hdr ? 1 : 0);
        stage.applySettings({ quality: 'low', reducedMotion: false });
        expect(retained()).toHaveLength(0);
        expect(scene.imageProcessingConfiguration.applyByPostProcess).toBe(false);
        expect(scene.autoClear).toBe(true);
        stage.applySettings({ quality: 'high', reducedMotion: false });
        expect(created()).toHaveLength(hdr ? 2 : 0);
        expect(retained().map((processor) => processor.name)).toEqual(
          hdr ? ['imageProcessing'] : [],
        );
        expect(scene.imageProcessingConfiguration.applyByPostProcess).toBe(Boolean(hdr));
        expect(scene.autoClear).toBe(!hdr);
        stage.dispose();
        disposed = true;
        expect(retained()).toHaveLength(0);
        expect(scene.imageProcessingConfiguration.applyByPostProcess).toBe(false);
        expect(scene.autoClear).toBe(true);
      } finally {
        if (!disposed) stage.dispose();
        engine.dispose();
      }
    },
  );

  it.each([false, true])(
    'keeps depth-compatible shadow storage and casters through quality changes with depth textures %s',
    (depthTextures) => {
      const { engine, scene, stage, targets } = studio(
        software,
        'high',
        false,
        false,
        depthTextures,
      );
      try {
        const caster = CreateBox('storage-caster', {}, scene);
        stage.castShadow(caster);
        for (const quality of ['high', 'low', 'high'] as const) {
          stage.applySettings({ quality, reducedMotion: true });
          const map = stage.shadow.getShadowMap()!;
          expect(map.getSize().width).toBe(quality === 'low' ? 1 : software ? 1024 : 2048);
          expect(Array.from(map.renderList!)).toEqual([caster]);
          expect(scene.shadowsEnabled).toBe(quality === 'high');
          // NullEngine does not implement texture formats; observe the actual allocator request.
          const options = targets.mock.calls.at(-1)![1];
          expect(typeof options).toBe('object');
          if (typeof options !== 'object') throw new Error('Missing shadow target options');
          expect(options.format).toBe(
            depthTextures ? Constants.TEXTUREFORMAT_RED : Constants.TEXTUREFORMAT_RGBA,
          );
        }
      } finally {
        stage.dispose();
        engine.dispose();
      }
    },
  );

  it.each([false, true])(
    'keeps the sky and existing/later water in the material output space with HDR support %s',
    (hdr) => {
      const output = vi.spyOn(ShaderMaterial.prototype, 'setFloat');
      const { engine, scene, stage } = studio(software, 'high', hdr, true);
      try {
        const water = new WaterPresentation(scene, {
          name: 'processing-water',
          width: 20,
          depth: 20,
        });
        stage.attachWater(water);
        const check = (names: string[]) => {
          const expected = Number(scene.imageProcessingConfiguration.applyByPostProcess);
          const values = new Map<string, number>();
          output.mock.calls.forEach(([name, value], index) => {
            if (name === 'linearOutput')
              values.set((output.mock.contexts[index] as ShaderMaterial).name, value);
          });
          expect(names.map((name) => values.get(name))).toEqual(names.map(() => expected));
        };
        check(['sky-gradient', 'processing-water-surface']);
        for (const quality of ['low', 'high', 'low', 'high'] as const) {
          stage.applySettings({ quality, reducedMotion: true });
          expect(scene.imageProcessingConfiguration.applyByPostProcess).toBe(
            quality === 'high' && hdr,
          );
          check(['sky-gradient', 'processing-water-surface']);
        }
        const later = new WaterPresentation(scene, {
          name: 'later-water',
          width: 20,
          depth: 20,
        });
        stage.attachWater(later);
        check(['sky-gradient', 'processing-water-surface', 'later-water-surface']);
      } finally {
        stage.dispose();
        engine.dispose();
        output.mockRestore();
      }
    },
  );

  it.each(['high', 'low'] as const)(
    'sets the %s processing mode before imported materials can compile',
    (quality) => {
      // NullEngine defaults to the non-HDR fallback; native hardware and software
      // traces use the supported floating-point pipeline whose initial mode matters.
      const { engine, scene, stage } = studio(software, quality, true);
      try {
        const material = new StandardMaterial('first-imported-matte', scene);
        expect(material.imageProcessingConfiguration).toBe(scene.imageProcessingConfiguration);
        expect(material.imageProcessingConfiguration.applyByPostProcess).toBe(quality === 'high');
        expect(scene.shadowsEnabled).toBe(quality === 'high');
      } finally {
        stage.dispose();
        engine.dispose();
      }
    },
  );

  it('starts Low without allocating a temporary full-size shadow target and restores High casters', () => {
    const { engine, scene, stage, targets } = studio(software, 'low');
    try {
      expect(targets.mock.calls.length).toBeGreaterThan(0);
      for (const [size] of targets.mock.calls)
        expect(
          typeof size === 'number' ? size : Math.max(size.width, size.height),
        ).toBeLessThanOrEqual(16);
      expect(stage.quality).toBe('low');
      expect(scene.shadowsEnabled).toBe(false);
      const map = stage.shadow.getShadowMap();
      const caster = CreateBox('initial-low-caster', {}, scene);
      stage.castShadow(caster);
      stage.applySettings({ quality: 'low', reducedMotion: false });
      expect(stage.shadow.getShadowMap()).toBe(map);
      stage.applySettings({ quality: 'high', reducedMotion: false });
      expect(stage.shadow.getShadowMap()!.getSize().width).toBe(software ? 1024 : 2048);
      expect(Array.from(stage.shadow.getShadowMap()!.renderList!)).toEqual([caster]);
      expect(stage.quality).toBe('high');
      expect(scene.shadowsEnabled).toBe(true);
    } finally {
      stage.dispose();
      engine.dispose();
    }
  });

  it('releases unused full-size shadow storage at Low and restores the original High resolution', () => {
    const { engine, scene, stage } = studio(software);
    try {
      const original = stage.shadow.getShadowMap()!;
      const size = original.getSize();
      expect(size.width).toBe(software ? 1024 : 2048);
      const direction = stage.sun.direction.clone();
      const color = scene.clearColor.clone();
      stage.applySettings({ quality: 'low', reducedMotion: false });
      expect(scene.shadowsEnabled).toBe(false);
      expect(stage.shadow.getShadowMap()!.getSize().width).toBeLessThanOrEqual(16);
      expect(stage.shadow.getShadowMap()).not.toBe(original);
      expect(scene.textures).not.toContain(original);
      stage.applySettings({ quality: 'high', reducedMotion: false });
      expect(scene.shadowsEnabled).toBe(true);
      expect(stage.shadow.getShadowMap()!.getSize()).toEqual(size);
      expect(stage.sun.direction).toEqual(direction);
      expect(scene.clearColor).toEqual(color);
    } finally {
      stage.dispose();
      engine.dispose();
    }
  });

  it('keeps existing and newly loaded casters through repeated quality changes', () => {
    const { engine, scene, stage } = studio(software);
    try {
      const first = CreateBox('first-caster', {}, scene);
      stage.castShadow(first);
      stage.applySettings({ quality: 'low', reducedMotion: false });
      const second = CreateBox('loaded-at-low', {}, scene);
      // Asset loading uses this same public generator while Low has shadows disabled.
      stage.shadow.addShadowCaster(second);
      for (const quality of ['high', 'low', 'high', 'low', 'high'] as const) {
        stage.applySettings({ quality, reducedMotion: false });
        expect(Array.from(stage.shadow.getShadowMap()!.renderList!)).toEqual([first, second]);
      }
    } finally {
      stage.dispose();
      engine.dispose();
    }
  });

  it('retains the current map when quality is unchanged, including motion preference changes', () => {
    const { engine, stage } = studio(software);
    try {
      for (const quality of ['low', 'high'] as const) {
        stage.applySettings({ quality, reducedMotion: false });
        const map = stage.shadow.getShadowMap();
        for (const reducedMotion of [false, true, false, true]) {
          stage.applySettings({ quality, reducedMotion });
          expect(stage.shadow.getShadowMap()).toBe(map);
        }
      }
    } finally {
      stage.dispose();
      engine.dispose();
    }
  });

  it('keeps identical light focus still while ambient focus continues, and honors a tiny real move', () => {
    const { engine, stage } = studio(software);
    const focus = new Vector3(13.125, 1.25, -8.375);
    stage.setView(focus);
    const originalPosition = stage.sun.position.clone();
    const positioned = vi.spyOn(stage.sun.position, 'copyFrom');
    const ambient = vi.spyOn(stage.atmosphere, 'setFocus');
    try {
      stage.setView(focus.clone());
      stage.setView(focus.clone());
      expect(stage.sun.position).toEqual(originalPosition);
      expect(positioned).not.toHaveBeenCalled();
      expect(ambient).toHaveBeenCalledTimes(2);
      // The guard must be exact: motion smaller than a shadow texel still changes depth focus.
      const moved = focus.add(new Vector3(0.000001, 0, 0));
      stage.setView(moved);
      expect(positioned).toHaveBeenCalledTimes(1);
      expect(stage.sun.position).not.toEqual(originalPosition);
      expect(ambient).toHaveBeenLastCalledWith(moved);
    } finally {
      positioned.mockRestore();
      ambient.mockRestore();
      stage.dispose();
      engine.dispose();
    }
  });

  it('refreshes the unchanged focus for profile and shadow-map changes as a fresh fixed-focus stage would', () => {
    const { engine, stage } = studio(software);
    const focus = new Vector3(13.125, 1.25, -8.375);
    try {
      stage.setFocus(focus);
      for (const profile of [environmentFor('capernaum'), environmentFor('capernaum-lanes')]) {
        stage.setProfile(profile);
        for (const quality of ['high', 'low', 'high'] as const) {
          stage.applySettings({ quality, reducedMotion: true });
          const referenceEngine = new NullEngine();
          Object.assign(referenceEngine, {
            getGlInfo: () => ({ renderer: software ? 'SwiftShader' : 'Metal' }),
          });
          const referenceScene = new Scene(referenceEngine);
          const referenceCamera = new ArcRotateCamera(
            'fixed-focus-reference',
            0,
            0.78,
            33,
            Vector3.Zero(),
            referenceScene,
          );
          let reference: StageEnvironment | undefined;
          try {
            reference = new StageEnvironment(referenceScene, referenceCamera, profile, {
              quality,
              shadowCenter: focus,
            });
            // Constructor framing cannot use the repeated moving-focus guard under test.
            expect(stage.sun.position).toEqual(reference.sun.position);
            expect(stage.sun.direction).toEqual(reference.sun.direction);
            expect(stage.shadow.getShadowMap()!.getSize()).toEqual(
              reference.shadow.getShadowMap()!.getSize(),
            );
            const appliedPosition = stage.sun.position.clone();
            stage.setFocus(focus.clone());
            expect(stage.sun.position).toEqual(appliedPosition);
          } finally {
            reference?.dispose();
            referenceEngine.dispose();
          }
        }
      }
    } finally {
      stage.dispose();
      engine.dispose();
    }
  });
});
