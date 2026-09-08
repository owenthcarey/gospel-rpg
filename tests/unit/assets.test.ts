import { readFileSync, readdirSync } from 'node:fs';
import { expect, it, describe } from 'vitest';
import { assets, ANIMATION_CLIPS } from '../../src/content/assets';

interface Gltf {
  scene: number;
  scenes: { nodes: number[] }[];
  nodes: {
    name: string;
    children?: number[];
    mesh?: number;
    skin?: number;
    translation?: number[];
    scale?: number[];
  }[];
  meshes: { primitives: { indices: number; attributes: Record<string, number> }[] }[];
  accessors: {
    count: number;
    min?: number[];
    max?: number[];
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    type: string;
  }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  buffers: { uri?: string; byteLength: number }[];
  images?: { uri?: string; bufferView?: number }[];
  skins?: { joints: number[]; inverseBindMatrices: number }[];
  animations?: {
    name: string;
    channels: { sampler: number; target: { node: number; path: string } }[];
    samplers: { input: number; output: number }[];
  }[];
}
function model(id: string): { bytes: Buffer; gltf: Gltf; binaryOffset: number } {
  const bytes = readFileSync(new URL('../../public/assets/models/' + id + '.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  return {
    bytes,
    gltf: JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)),
    binaryOffset: 28 + jsonLength,
  };
}

describe('the complete original asset manifest', () => {
  it('matches the shipped files and stays within the download budget', () => {
    const files = readdirSync(new URL('../../public/assets/models/', import.meta.url))
      .filter((name) => name.endsWith('.glb'))
      .map((name) => name.slice(0, -4));
    expect(files.sort()).toEqual(assets.map((asset) => asset.id).sort());
    expect(assets.reduce((total, asset) => total + model(asset.id).bytes.length, 0)).toBeLessThan(
      5 * 1024 * 1024,
    );
  });
  it.each(assets)('$id is self-contained, bounded and contains the required structure', (asset) => {
    const { bytes, gltf } = model(asset.id);
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(gltf.scenes).toHaveLength(1);
    expect(gltf.scenes[gltf.scene]!.nodes).toHaveLength(1);
    for (const buffer of gltf.buffers) expect(buffer.uri).toBeUndefined();
    for (const image of gltf.images ?? []) expect(image.uri).toBeUndefined();
    const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
    const triangles = primitives.reduce(
      (count, primitive) => count + gltf.accessors[primitive.indices]!.count / 3,
      0,
    );
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThan(asset.maxTriangles);
    for (const primitive of primitives) {
      const position = gltf.accessors[primitive.attributes.POSITION!]!;
      expect(position.min).toHaveLength(3);
      expect(position.max).toHaveLength(3);
      for (const value of [...position.min!, ...position.max!]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThan(8);
      }
    }
    const names = gltf.nodes.map((node) => node.name.replace(/\.\d+$/, ''));
    for (const socket of asset.attachments) expect(names, asset.id).toContain(socket);
    if (asset.kind === 'actor') {
      expect(gltf.skins).toHaveLength(1);
      expect(gltf.skins![0]!.joints.length).toBeGreaterThanOrEqual(10);
      expect(gltf.animations!.map((clip) => clip.name).sort()).toEqual([...ANIMATION_CLIPS].sort());
      expect(gltf.meshes).toHaveLength(1);
      for (const primitive of primitives) {
        expect(primitive.attributes.JOINTS_0).toBeDefined();
        expect(primitive.attributes.WEIGHTS_0).toBeDefined();
      }
      for (const clip of gltf.animations!) {
        expect(clip.channels.length).toBeGreaterThan(8);
        for (const channel of clip.channels) {
          expect(channel.target.node).toBeLessThan(gltf.nodes.length);
          expect(gltf.accessors[clip.samplers[channel.sampler]!.input]!.count).toBeGreaterThan(1);
        }
      }
    } else {
      expect(gltf.skins ?? []).toHaveLength(0);
      const root = gltf.nodes[gltf.scenes[gltf.scene]!.nodes[0]!]!;
      expect(root.name.replace(/\.\d+$/, '')).toBe(asset.id);
    }
  });
  it('exports different motion in Walk and Carry rather than identical named clips', () => {
    const { bytes, gltf, binaryOffset } = model('traveler');
    const values = (name: string) => {
      const animation = gltf.animations!.find((clip) => clip.name === name)!;
      const channel = animation.channels.find(
        (channel) =>
          gltf.nodes[channel.target.node]!.name === 'arm_left' &&
          channel.target.path === 'rotation',
      )!;
      const accessor = gltf.accessors[animation.samplers[channel.sampler]!.output]!;
      const view = gltf.bufferViews[accessor.bufferView!]!;
      const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      return Array.from({ length: accessor.count * 4 }, (_, i) =>
        bytes.readFloatLE(offset + i * 4),
      );
    };
    expect(values('Carry')).not.toEqual(values('Walk'));
    const walk = values('Walk');
    expect(new Set(walk.map((value) => value.toFixed(3))).size).toBeGreaterThan(6);
  });
});
