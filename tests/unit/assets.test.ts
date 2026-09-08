import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('ships a self-contained traveler with four animated limbs and no workshop geometry', () => {
  const bytes = readFileSync(new URL('../../public/assets/models/traveler.glb', import.meta.url));
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  expect(gltf.scenes[gltf.scene].nodes).toHaveLength(1);
  expect(gltf.nodes).toHaveLength(6);
  for (const node of gltf.nodes) expect(node.name).toMatch(/^traveler_/);
  const walk = gltf.animations.find((clip: { name: string }) => clip.name === 'Walk');
  expect(walk.channels).toHaveLength(4);
  const animatedNodes = walk.channels.map((channel: { target: { node: number; path: string } }) => {
    expect(channel.target.path).toBe('rotation');
    return gltf.nodes[channel.target.node].name.replace(/\.\d+$/, '');
  });
  expect(animatedNodes.sort()).toEqual([
    'traveler_arm_left',
    'traveler_arm_right',
    'traveler_leg_left',
    'traveler_leg_right',
  ]);
  for (const buffer of gltf.buffers) expect(buffer.uri).toBeUndefined();
});
