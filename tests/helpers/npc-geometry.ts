import assert from 'node:assert/strict';
import { authoredFootMembership } from './posed-geometry';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Actor } from '../../src/scene/actors/actor';

type Side = 'left' | 'right';
const label = (name: string) =>
  name
    .split(':')
    .at(-1)!
    .replace(/\.\d+$/, '');
interface Topology {
  nodes: TransformNode[];
  meshes: { mesh: AbstractMesh; offset: number }[];
  joints: string[];
  feet: Record<Side, number[]>;
  soles: Record<Side, number[]>;
  prop: number[];
  hands: Record<Side, number[]>;
  visual: number;
  head: number;
  bodyRoot: number;
}
export interface NpcSkin {
  topology: Topology;
  coordinates: Float64Array;
  locals: Float64Array;
  head: Float64Array;
  bodyRoot: Float64Array;
}
const topologies = new WeakMap<TransformNode, Topology>();
const point = Vector3.Zero();
function topology(actor: Actor): Topology {
  const cached = topologies.get(actor.root);
  if (cached) return cached;
  const joints: string[] = [],
    restY: number[] = [];
  const meshes = actor.root.getChildMeshes().map((mesh) => {
    const offset = joints.length * 3,
      rest = mesh.getPositionData(false) ?? [];
    const indices = mesh.getVerticesData('matricesIndices');
    for (let i = 0; i < rest.length / 3; i++) {
      joints.push(indices ? label(mesh.skeleton!.bones[indices[i * 4]!]!.name) : '');
      restY.push(rest[i * 3 + 1]!);
    }
    return { mesh, offset, membership: authoredFootMembership(mesh) };
  });
  const feet = { left: [] as number[], right: [] as number[] };
  const soles = { left: [] as number[], right: [] as number[] };
  const hands = { left: [] as number[], right: [] as number[] };
  const articulated = meshes.filter((value) => value.membership);
  assert.ok(articulated.length <= 1, 'one exact articulated actor skin');
  for (const side of ['left', 'right'] as const) {
    if (articulated.length) {
      const skin = articulated[0]!,
        base = skin.offset / 3;
      feet[side] = skin.membership!.lower[side].map((id) => base + id);
      soles[side] = skin.membership!.sole[side].map((id) => base + id);
      assert.deepEqual(
        feet[side],
        joints.flatMap((name, i) => (name === 'leg_' + side || name === 'foot_' + side ? [i] : [])),
      );
    } else {
      // Preserve the original 14-bone oracle for all unaffected actors.
      feet[side] = joints.flatMap((name, i) => (name === 'leg_' + side ? [i] : []));
      const bottom = Math.min(...feet[side].map((i) => restY[i]!));
      soles[side] = feet[side].filter((i) => restY[i]! < bottom + 0.0001);
    }
    const arm = joints.flatMap((name, i) => (name === 'forearm_' + side ? [i] : []));
    const wrist = Math.min(...arm.map((i) => restY[i]!));
    hands[side] = arm.filter((i) => restY[i]! < wrist + 0.13);
  }
  const nodes = [actor.root, ...actor.root.getChildTransformNodes()];
  const value = {
    nodes,
    meshes,
    joints,
    feet,
    soles,
    hands,
    prop: joints.flatMap((name, i) => (!name ? [i] : [])),
    visual: nodes.findIndex((node) => node.parent === actor.root && node.name.endsWith(':visual')),
    head: nodes.findIndex((node) => label(node.name) === 'head'),
    bodyRoot: nodes.findIndex((node) => label(node.name) === 'root'),
  };
  topologies.set(actor.root, value);
  return value;
}
export function npcSkin(actor: Actor, reuse?: NpcSkin): NpcSkin {
  const packed = topology(actor);
  const result = reuse ?? {
    topology: packed,
    coordinates: new Float64Array(packed.joints.length * 3),
    locals: new Float64Array(packed.nodes.length * 10),
    head: new Float64Array(3),
    bodyRoot: new Float64Array(3),
  };
  for (let i = 0; i < packed.nodes.length; i++) {
    const node = packed.nodes[i]!;
    node.computeWorldMatrix(true);
    const at = i * 10,
      p = node.position,
      s = node.scaling,
      r = node.rotationQuaternion ?? node.rotation;
    result.locals[at] = p.x;
    result.locals[at + 1] = p.y;
    result.locals[at + 2] = p.z;
    result.locals[at + 3] = s.x;
    result.locals[at + 4] = s.y;
    result.locals[at + 5] = s.z;
    result.locals[at + 6] = r.x;
    result.locals[at + 7] = r.y;
    result.locals[at + 8] = r.z;
    result.locals[at + 9] = node.rotationQuaternion?.w ?? 0;
  }
  for (const { mesh, offset } of packed.meshes) {
    mesh.skeleton?.prepare(true);
    const posed = mesh.getPositionData(Boolean(mesh.skeleton)) ?? [],
      world = mesh.computeWorldMatrix(true);
    for (let i = 0; i < posed.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(
        posed[i]!,
        posed[i + 1]!,
        posed[i + 2]!,
        world,
        point,
      );
      result.coordinates[offset + i] = point.x;
      result.coordinates[offset + i + 1] = point.y;
      result.coordinates[offset + i + 2] = point.z;
    }
  }
  for (let axis = 0; axis < 3; axis++) {
    result.head[axis] = packed.nodes[packed.head]!.getWorldMatrix().m[12 + axis]!;
    result.bodyRoot[axis] = packed.nodes[packed.bodyRoot]!.getWorldMatrix().m[12 + axis]!;
  }
  return result;
}
export function npcLift(actor: Actor): number {
  return topology(actor).nodes[topology(actor).visual]!.position.y;
}
export function npcGeometryError(
  raw: NpcSkin,
  displayed: NpcSkin,
  lift: number,
): { skin: number; local: number } {
  let skin = 0,
    local = 0;
  for (let i = 0; i < raw.coordinates.length; i++)
    skin = Math.max(
      skin,
      Math.abs(displayed.coordinates[i]! - raw.coordinates[i]! - (i % 3 === 1 ? lift : 0)),
    );
  for (let i = 0; i < raw.locals.length; i++) {
    if (i === raw.topology.visual * 10 + 1) continue;
    local = Math.max(local, Math.abs(raw.locals[i]! - displayed.locals[i]!));
  }
  return { skin, local };
}
export function npcFeet(skin: NpcSkin, height: (x: number, z: number) => number) {
  const result = {} as Record<
    Side,
    { minimum: number; soleMin: number; soleMax: number; count: number }
  >;
  for (const side of ['left', 'right'] as const) {
    let minimum = Infinity,
      soleMin = Infinity,
      soleMax = -Infinity;
    for (const i of skin.topology.feet[side]) {
      const at = i * 3;
      minimum = Math.min(
        minimum,
        skin.coordinates[at + 1]! - height(skin.coordinates[at]!, skin.coordinates[at + 2]!),
      );
    }
    for (const i of skin.topology.soles[side]) {
      const at = i * 3,
        gap = skin.coordinates[at + 1]! - height(skin.coordinates[at]!, skin.coordinates[at + 2]!);
      soleMin = Math.min(soleMin, gap);
      soleMax = Math.max(soleMax, gap);
    }
    result[side] = { minimum, soleMin, soleMax, count: skin.topology.soles[side].length };
  }
  return result;
}
export function npcGrip(skin: NpcSkin): number[] {
  return (['left', 'right'] as const).map((side) => {
    let square = Infinity;
    for (const a of skin.topology.hands[side])
      for (const b of skin.topology.prop) {
        const x = skin.coordinates[a * 3]! - skin.coordinates[b * 3]!;
        const y = skin.coordinates[a * 3 + 1]! - skin.coordinates[b * 3 + 1]!;
        const z = skin.coordinates[a * 3 + 2]! - skin.coordinates[b * 3 + 2]!;
        square = Math.min(square, x * x + y * y + z * z);
      }
    return Math.sqrt(square);
  });
}
export function npcWorldStep(before: NpcSkin, after: NpcSkin): number {
  let square = 0;
  for (let i = 0; i < before.coordinates.length; i += 3) {
    const x = after.coordinates[i]! - before.coordinates[i]!,
      y = after.coordinates[i + 1]! - before.coordinates[i + 1]!,
      z = after.coordinates[i + 2]! - before.coordinates[i + 2]!;
    square = Math.max(square, x * x + y * y + z * z);
  }
  return Math.sqrt(square);
}
