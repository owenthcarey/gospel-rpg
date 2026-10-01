import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { AssetLibrary } from '../../src/scene/assets';
import { assets } from '../../src/content/assets';
import { StylePlugin, WIND_SHAPES } from '../../src/scene/environment/matte';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    // Keep the real importer and production options; replace only network transport.
    LoadAssetContainerAsync: (
      source: string,
      scene: Scene,
      options?: import('@babylonjs/core/Loading/sceneLoader').LoadAssetContainerOptions,
    ) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { ...options, pluginExtension: '.glb' },
      ),
  };
});

let engine: NullEngine;
afterEach(() => engine?.dispose());

function studio() {
  engine = new NullEngine();
  const scene = new Scene(engine);
  return { scene, library: new AssetLibrary(scene) };
}

describe('matte model imports', () => {
  it('loads the complete catalog without constructing a PBR lookup texture', async () => {
    const { scene, library } = studio();
    const progress = vi.fn();
    await library.load(
      assets.map((asset) => asset.id),
      progress,
    );
    expect(progress).toHaveBeenCalledTimes(assets.length);
    expect(progress).toHaveBeenLastCalledWith(assets.length, assets.length);
    expect(new Set(scene.metadata.assetInventory)).toEqual(
      new Set(assets.map((asset) => asset.id)),
    );
    expect(scene.environmentBRDFTexture).toBeFalsy();
    expect(scene.textures).toHaveLength(0);
    expect(scene.materials).toHaveLength(assets.length);
    expect(scene.materials.every((material) => material instanceof StandardMaterial)).toBe(true);
    library.dispose();
    expect(scene.materials).toHaveLength(0);
    expect(scene.geometries).toHaveLength(0);
  });

  it('shares the matte and converted colors while preserving foliage styling', async () => {
    const { scene, library } = studio();
    await library.load(['olive'], () => {});
    const first = library.instantiate('olive', 'first');
    const second = library.instantiate('olive', 'second');
    const mesh = first.root.getChildMeshes().find((child) => child.getTotalVertices())!;
    const clone = second.root.getChildMeshes().find((child) => child.getTotalVertices())!;
    expect(mesh.material).toBe(clone.material);
    expect(mesh.getVerticesData(VertexBuffer.ColorKind)).toEqual(
      clone.getVerticesData(VertexBuffer.ColorKind),
    );
    const material = mesh.material as StandardMaterial;
    expect(material).toBeInstanceOf(StandardMaterial);
    expect(material.backFaceCulling).toBe(false);
    expect(material.diffuseColor.asArray()).toEqual([1, 1, 1]);
    expect(material.specularColor.asArray()).toEqual([0, 0, 0]);
    expect(material.alpha).toBe(1);
    expect(material.metadata).toEqual({ assetId: 'olive' });
    const plugin = material.pluginManager?.getPlugin('WayStyle') as StylePlugin;
    expect(plugin).toBeInstanceOf(StylePlugin);
    expect(plugin.wind).toEqual(WIND_SHAPES.olive);

    // Check the actual exported color stream, rather than comparing two copies
    // of the same implementation. The source is linear; the shared matte is display-space.
    const bytes = readFileSync('public/assets/models/olive.glb');
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
    const accessor = gltf.accessors[gltf.meshes[0].primitives[0].attributes.COLOR_0];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const offset = 28 + jsonLength + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const colors = mesh.getVerticesData(VertexBuffer.ColorKind)!;
    const stride = accessor.type === 'VEC4' ? 4 : 3;
    expect([5121, 5123, 5126]).toContain(accessor.componentType);
    const componentBytes =
      accessor.componentType === 5121 ? 1 : accessor.componentType === 5123 ? 2 : 4;
    if (componentBytes !== 4) expect(accessor.normalized).toBe(true);
    expect(colors).toHaveLength(accessor.count * stride);
    for (let i = 0; i < colors.length; i++) {
      const component = i % stride;
      const vertexOffset =
        Math.floor(i / stride) * (bufferView.byteStride ?? stride * componentBytes);
      const valueOffset = offset + vertexOffset + component * componentBytes;
      const linear =
        componentBytes === 1
          ? bytes.readUInt8(valueOffset) / 255
          : componentBytes === 2
            ? bytes.readUInt16LE(valueOffset) / 65535
            : bytes.readFloatLE(valueOffset);
      expect(colors[i]).toBeCloseTo(
        component === 3 ? linear : Math.pow(Math.max(0, linear), 1 / 2.2),
        6,
      );
    }
    first.root.dispose();
    second.root.dispose();
    library.dispose();
    expect(scene.materials).toHaveLength(0);
  });
});
