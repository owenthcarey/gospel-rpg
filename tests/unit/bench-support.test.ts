import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { LifeActivity } from '../../src/scene/actors/life';
import { campaignLayout } from '../../src/content/campaign/layouts';
import { heldAssets } from '../../src/content/life/presentation';
import { DEFAULT_SETTINGS, newGame } from '../../src/game/types';
import {
  BENCH_FRONT_CLEARANCE,
  BENCH_WALK_SPEED,
  benchMotion,
  benchRoutePose,
  benchSeatAmount,
} from '../../src/scene/bench-motion';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    // Exercise the real packed files and production importer, replacing only network transport.
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

type Triangle = readonly [Vector3, Vector3, Vector3];
interface Bounds {
  min: Vector3;
  max: Vector3;
}
interface Surface {
  vertices: Vector3[];
  footVertices: Vector3[];
  clothVertices: Vector3[];
  triangles: Triangle[];
  bounds: Bounds;
}
interface PreparedTriangle {
  triangle: Triangle;
  bounds: Bounds;
}
interface ClosedPiece {
  faces: PreparedTriangle[];
  bounds: Bounds;
}
const EPSILON = 1e-6;
const SOLE_TOLERANCE = 0.002;
const BENCH_STARTS = [
  { label: 'authored south', position: { x: 3, z: 5.4 } },
  { label: 'west', position: { x: 1, z: 7 } },
  { label: 'east', position: { x: 5, z: 7 } },
  { label: 'north', position: { x: 3, z: 9 } },
  { label: 'northeast', position: { x: 5, z: 8.4 } },
  { label: 'north diagonal', position: { x: 4.4, z: 9 } },
  { label: 'southeast', position: { x: 4.5, z: 6.5 } },
  { label: 'southwest', position: { x: 1.5, z: 5.4 } },
];

function bounds(points: readonly Vector3[]): Bounds {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const point of points) {
    min.minimizeInPlace(point);
    max.maximizeInPlace(point);
  }
  return { min, max };
}

function overlap(a: Bounds, b: Bounds): boolean {
  return (
    a.min.x <= b.max.x + EPSILON &&
    a.max.x >= b.min.x - EPSILON &&
    a.min.y <= b.max.y + EPSILON &&
    a.max.y >= b.min.y - EPSILON &&
    a.min.z <= b.max.z + EPSILON &&
    a.max.z >= b.min.z - EPSILON
  );
}

/** Actual deformed triangles, including the actor's cloth, hands, belt and satchel. */
function surface(root: TransformNode, deform = true): Surface {
  root.computeWorldMatrix(true);
  for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
  const vertices: Vector3[] = [];
  const footVertices: Vector3[] = [];
  const clothVertices: Vector3[] = [];
  const triangles: Triangle[] = [];
  for (const mesh of root.getChildMeshes()) {
    mesh.skeleton?.prepare(true);
    const positions = mesh.getPositionData(deform && Boolean(mesh.skeleton)) ?? [];
    const joints = mesh.getVerticesData('matricesIndices');
    const world = mesh.computeWorldMatrix(true);
    const points = Array.from({ length: positions.length / 3 }, (_, index) => {
      const point = Vector3.TransformCoordinates(Vector3.FromArray(positions, index * 3), world);
      const joint = joints && mesh.skeleton?.bones[joints[index * 4]!]!.name;
      const bone =
        joint &&
        joint
          .split(':')
          .at(-1)!
          .replace(/\.\d+$/, '');
      if (bone && /^leg_(left|right)$/.test(bone)) footVertices.push(point);
      if (bone === 'robe' || bone === 'seat_hem') clothVertices.push(point);
      return point;
    });
    vertices.push(...points);
    const indices = mesh.getIndices() ?? [];
    for (let index = 0; index < indices.length; index += 3)
      triangles.push([
        points[indices[index]!]!,
        points[indices[index + 1]!]!,
        points[indices[index + 2]!]!,
      ]);
  }
  return { vertices, footVertices, clothVertices, triangles, bounds: bounds(vertices) };
}

function prepare(triangles: readonly Triangle[]): PreparedTriangle[] {
  return triangles.map((triangle) => ({ triangle, bounds: bounds(triangle) }));
}

/** Möller–Trumbore intersection with a finite exported face, independent of winding. */
function rayDistance(origin: Vector3, direction: Vector3, [a, b, c]: Triangle): number | undefined {
  const edge1 = b.subtract(a);
  const edge2 = c.subtract(a);
  const cross = Vector3.Cross(direction, edge2);
  const determinant = Vector3.Dot(edge1, cross);
  if (Math.abs(determinant) < 1e-10) return undefined;
  const inverse = 1 / determinant;
  const offset = origin.subtract(a);
  const u = inverse * Vector3.Dot(offset, cross);
  if (u < -EPSILON || u > 1 + EPSILON) return undefined;
  const q = Vector3.Cross(offset, edge1);
  const v = inverse * Vector3.Dot(direction, q);
  if (v < -EPSILON || u + v > 1 + EPSILON) return undefined;
  const distance = inverse * Vector3.Dot(edge2, q);
  return distance > EPSILON ? distance : undefined;
}

/** Check both directions: a bench edge can pierce a skin face without a skin vertex entering it. */
function edgeWitness(source: readonly PreparedTriangle[], target: readonly PreparedTriangle[]) {
  const targetBounds = bounds(target.flatMap(({ triangle }) => triangle));
  for (const { triangle, bounds: triangleBounds } of source) {
    if (!overlap(triangleBounds, targetBounds)) continue;
    for (let edge = 0; edge < 3; edge++) {
      const from = triangle[edge]!;
      const delta = triangle[(edge + 1) % 3]!.subtract(from);
      const length = delta.length();
      if (length < EPSILON) continue;
      const direction = delta.scale(1 / length);
      const edgeBounds = bounds([from, triangle[(edge + 1) % 3]!]);
      for (const candidate of target) {
        if (!overlap(edgeBounds, candidate.bounds)) continue;
        const distance = rayDistance(from, direction, candidate.triangle);
        if (distance !== undefined && distance < length - EPSILON)
          return from.add(direction.scale(distance)).asArray();
      }
    }
  }
  return undefined;
}

const pointKey = (point: Vector3) =>
  point
    .asArray()
    .map((value) => value.toFixed(6))
    .join(',');

/** Recover the bench's real closed pieces, welding exported flat-shading duplicates. */
function closedPieces(triangles: readonly Triangle[]): ClosedPiece[] {
  const touching = new Map<string, number[]>();
  triangles.forEach((triangle, index) => {
    for (const point of triangle) {
      const key = pointKey(point);
      const indices = touching.get(key) ?? [];
      indices.push(index);
      touching.set(key, indices);
    }
  });
  const visited = new Set<number>();
  const result: ClosedPiece[] = [];
  triangles.forEach((_, index) => {
    if (visited.has(index)) return;
    const pending = [index];
    const piece: Triangle[] = [];
    const edges = new Map<string, number>();
    visited.add(index);
    while (pending.length) {
      const current = triangles[pending.pop()!]!;
      piece.push(current);
      for (let edge = 0; edge < 3; edge++) {
        const keys = [pointKey(current[edge]!), pointKey(current[(edge + 1) % 3]!)].sort();
        const key = keys.join('/');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      for (const point of current)
        for (const next of touching.get(pointKey(point))!)
          if (!visited.has(next)) {
            visited.add(next);
            pending.push(next);
          }
    }
    if ([...edges.values()].every((count) => count === 2))
      result.push({ faces: prepare(piece), bounds: bounds(piece.flat()) });
  });
  return result;
}

function inside(point: Vector3, piece: ClosedPiece): boolean {
  const box = piece.bounds;
  // Points on a support surface are contact, rather than penetration.
  if (
    point.x <= box.min.x + EPSILON ||
    point.x >= box.max.x - EPSILON ||
    point.y <= box.min.y + EPSILON ||
    point.y >= box.max.y - EPSILON ||
    point.z <= box.min.z + EPSILON ||
    point.z >= box.max.z - EPSILON
  )
    return false;
  const direction = new Vector3(1, 0.314, 0.137).normalize();
  const hits = piece.faces
    .map(({ triangle }) => rayDistance(point, direction, triangle))
    .filter((distance): distance is number => distance !== undefined)
    .sort((a, b) => a - b);
  // Two triangles meeting at an edge represent one crossing of the closed surface.
  const crossings = hits.filter(
    (distance, index) => !index || distance - hits[index - 1]! > EPSILON,
  );
  return crossings.length % 2 === 1;
}

function contactWitness(a: Surface, b: Surface, bPieces: readonly ClosedPiece[]) {
  if (!overlap(a.bounds, b.bounds)) return undefined;
  for (const piece of bPieces)
    for (const point of a.vertices)
      if (inside(point, piece)) return { kind: 'contained skin vertex', point: point.asArray() };
  const aFaces = prepare(a.triangles);
  const bFaces = prepare(b.triangles);
  const forward = edgeWitness(aFaces, bFaces);
  if (forward) return { kind: 'skin edge crosses surface', point: forward };
  const reverse = edgeWitness(bFaces, aFaces);
  if (reverse) return { kind: 'support edge crosses skin', point: reverse };
  return undefined;
}

function clothSupportGap(skin: Surface, support: ClosedPiece): number {
  let gap = Infinity;
  for (const point of skin.clothVertices) {
    if (point.y < support.bounds.max.y - EPSILON) continue;
    for (const { triangle } of support.faces) {
      const distance = rayDistance(point, Vector3.Down(), triangle);
      if (distance !== undefined) gap = Math.min(gap, distance);
    }
  }
  return gap;
}

let engine: NullEngine;
let scene: Scene;
let library: AssetLibrary;
let bench: Surface;
let benchPieces: ClosedPiece[];
let seat: ClosedPiece;
beforeAll(async () => {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(
    [
      'traveler',
      'villager',
      'bench_lashed',
      'bench',
      'worktable',
      ...Object.values(heldAssets),
      'thread_clue',
      'mending_cloth',
    ],
    () => {},
  );
  bench = surface(library.instantiate('bench_lashed', 'seat-support').root);
  benchPieces = closedPieces(bench.triangles);
  seat = benchPieces.find((piece) => Math.abs(piece.bounds.max.y - 0.56) < 0.001)!;
}, 60_000);
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

function seatedActor(id: 'traveler' | 'villager', x: number) {
  const actor = new Actor(library.instantiate(id, 'bench-support-' + id));
  actor.root.rotation.y = Math.PI;
  actor.root.position.set(x, 0.14, 0);
  return actor;
}

it('checks the original finite plank, legs and lashings rather than an infinite seat plane', () => {
  expect(seat).toBeDefined();
  const seatBounds = seat.bounds;
  expect(seatBounds.min.y).toBeCloseTo(0.44, 3);
  expect(seatBounds.max.y).toBeCloseTo(0.56, 3);
  expect(seatBounds.min.x).toBeCloseTo(-1.05, 3);
  expect(seatBounds.max.x).toBeCloseTo(1.05, 3);
  expect(seatBounds.min.z).toBeCloseTo(-0.3, 3);
  expect(seatBounds.max.z).toBeCloseTo(0.3, 3);
  expect(bench.triangles.length).toBeGreaterThan(seat.faces.length);
});

it('detects the known folded garment crossing when legacy Sit is placed on this bench', () => {
  const actor = seatedActor('traveler', -0.45);
  try {
    actor.sampleAt('Sit', 0.5);
    expect(contactWitness(surface(actor.root), bench, benchPieces)).toBeDefined();
  } finally {
    actor.dispose();
  }
});

it.each(['traveler', 'villager'] as const)(
  'grounds %s BenchSit feet and keeps the complete skin outside the actual bench',
  (id) => {
    const actor = seatedActor(id, id === 'traveler' ? -0.45 : 0.45);
    try {
      for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
        actor.sampleAt('BenchSit', phase);
        const skin = surface(actor.root);
        expect(skin.footVertices.length).toBeGreaterThan(0);
        const floor = Math.min(...skin.footVertices.map((point) => point.y));
        expect(Math.abs(floor), `sole height at phase ${phase}`).toBeLessThanOrEqual(
          SOLE_TOLERANCE,
        );
        expect(
          contactWitness(skin, bench, benchPieces),
          `bench contact at phase ${phase}`,
        ).toBeUndefined();
        expect(clothSupportGap(skin, seat), `cloth support at phase ${phase}`).toBeLessThan(0.025);
      }
    } finally {
      actor.dispose();
    }
  },
);

it('grounds the full SitDown transition while clearing the finite bench and its seated neighbor', () => {
  const actor = seatedActor('traveler', -0.45);
  const neighbor = seatedActor('villager', 0.45);
  try {
    actor.root.position.y = 0;
    const standingSoleHeight = Math.min(
      ...surface(actor.root, false).footVertices.map((point) => point.y),
    );
    neighbor.sampleAt('BenchSit', 0.5);
    const neighborSkin = surface(neighbor.root);
    const neighborPieces = closedPieces(neighborSkin.triangles);
    let lowestSole = Infinity;
    let highestSole = -Infinity;
    const failures: unknown[] = [];
    // Dense fractional phases catch crossings between the exported animation keys.
    for (let step = 0; step <= 240; step++) {
      const phase = step / 240;
      actor.root.position.set(-0.45, 0, BENCH_FRONT_CLEARANCE * (1 - benchSeatAmount(phase)));
      actor.sampleAt('SitDown', phase);
      const skin = surface(actor.root);
      const floor = Math.min(...skin.footVertices.map((point) => point.y));
      lowestSole = Math.min(lowestSole, floor);
      highestSole = Math.max(highestSole, floor);
      const benchContact = contactWitness(skin, bench, benchPieces);
      const neighborContact = contactWitness(skin, neighborSkin, neighborPieces);
      if (benchContact || neighborContact) failures.push({ phase, benchContact, neighborContact });
    }
    expect(failures.slice(0, 12), `${failures.length} intersecting phases`).toEqual([]);
    expect(lowestSole).toBeGreaterThanOrEqual(-SOLE_TOLERANCE);
    // The unchanged standing pose already has a small authored sandal gap.
    expect(highestSole).toBeLessThanOrEqual(standingSoleHeight + SOLE_TOLERANCE);
  } finally {
    actor.dispose();
    neighbor.dispose();
  }
}, 30_000);

it.each(BENCH_STARTS)(
  'clears the bench and neighbor from $label on approach and retreat with accurate cached grounding',
  ({ position }) => {
    const actor = seatedActor('traveler', -0.45);
    const neighbor = seatedActor('villager', 0.45);
    try {
      neighbor.sampleAt('BenchSit', 0.5);
      const neighborSkin = surface(neighbor.root);
      const neighborPieces = closedPieces(neighborSkin.triangles);
      const motion = benchMotion(position, { x: 3, z: 7 }, 0);
      const walk = actor.model.animations.find((group) => group.name.split(':').at(-1) === 'Walk')!;
      const duration = (walk.to - walk.from) / walk.targetedAnimations[0]!.animation.framePerSecond;
      const distances = new Set(
        Array.from({ length: 121 }, (_, step) => (motion.length * step) / 120),
      );
      // Include each exact corner as well as evenly spaced fractional poses between corners.
      let corner = 0;
      for (let index = 1; index < motion.route.length; index++) {
        const from = motion.route[index - 1]!;
        const to = motion.route[index]!;
        corner += Math.hypot(to.x - from.x, to.z - from.z);
        distances.add(corner);
        distances.add(motion.length - corner);
      }
      const failures: unknown[] = [];
      let largestCacheError = 0;
      let largestGroundingError = 0;
      let lowestSole = Infinity;
      let highestSole = -Infinity;
      let highestAuthoredSole = -Infinity;
      for (const retreat of [false, true])
        for (const traveled of [...distances].sort((a, b) => a - b)) {
          const pose = benchRoutePose(motion, traveled, retreat);
          actor.root.position.set(pose.x - motion.bench.x, 0, pose.z - motion.bench.z);
          actor.root.rotation.y = pose.heading;
          actor.sampleAt('Walk', (traveled / BENCH_WALK_SPEED / duration) % 1);
          const skinBeforeLift = surface(actor.root);
          const measured = Math.min(...skinBeforeLift.footVertices.map((point) => point.y));
          highestAuthoredSole = Math.max(highestAuthoredSole, measured);
          const cached = actor.soleHeight();
          largestCacheError = Math.max(largestCacheError, Math.abs(cached - measured));
          actor.root.position.y = Math.max(0, -cached);
          const skin = surface(actor.root);
          const floor = Math.min(...skin.footVertices.map((point) => point.y));
          largestGroundingError = Math.max(
            largestGroundingError,
            Math.abs(floor - Math.max(0, measured)),
          );
          largestCacheError = Math.max(largestCacheError, Math.abs(actor.soleHeight() - floor));
          lowestSole = Math.min(lowestSole, floor);
          highestSole = Math.max(highestSole, floor);
          const benchContact = contactWitness(skin, bench, benchPieces);
          const neighborContact = contactWitness(skin, neighborSkin, neighborPieces);
          if (benchContact || neighborContact)
            failures.push({ retreat, traveled, pose, benchContact, neighborContact });
        }
      expect(failures.slice(0, 12), `${failures.length} intersecting route poses`).toEqual([]);
      expect(largestCacheError).toBeLessThan(EPSILON);
      expect(largestGroundingError).toBeLessThan(EPSILON);
      expect(lowestSole).toBeGreaterThanOrEqual(-SOLE_TOLERANCE);
      expect(highestSole).toBeLessThanOrEqual(highestAuthoredSole + SOLE_TOLERANCE);
    } finally {
      actor.dispose();
      neighbor.dispose();
    }
  },
  30_000,
);

it.each(['capernaum-lanes', 'bakehouse'] as const)(
  'supports actual %s Life table guests without piercing a finite bench or worktable',
  (region) => {
    const originalNodes = new Set(scene.transformNodes);
    try {
      const layout = campaignLayout(region)!;
      const furnishings = layout.decor
        .filter((item) => item.asset === 'bench' || item.asset === 'worktable')
        .map((item) => {
          const model = library.instantiate(item.asset, region + '-support-' + item.asset);
          model.root.position.set(item.x, item.y ?? 0, item.z);
          model.root.rotation.y = item.rotation ?? 0;
          model.root.scaling.setAll(item.scale ?? 1);
          model.root.scaling.x *= item.scaleX ?? 1;
          const skin = surface(model.root);
          return { item, skin, pieces: closedPieces(skin.triangles) };
        });
      const table = furnishings.find(({ item }) => item.asset === 'worktable')!;
      const guestBench = furnishings.find(
        ({ item }) => item.asset === 'bench' && item.z < table.item.z,
      )!;
      const support = guestBench.pieces.reduce((highest, piece) =>
        piece.bounds.max.y > highest.bounds.max.y ? piece : highest,
      );
      expect(support.bounds.max.y).toBeCloseTo(0.56, 3);
      const player = new Actor(library.instantiate('traveler', region + '-support-player'));
      const activity = new LifeActivity(library, player, region);
      const state = newGame();
      state.region = region;
      state.episode.stage = 'complete';
      state.campaign.table.stage = 'complete';
      state.campaign.table.location = region === 'capernaum-lanes' ? 'courtyard' : 'bakehouse';
      activity.update(state);
      activity.settings(DEFAULT_SETTINGS);
      const { company } = activity as unknown as { company: Actor[] };
      expect(company).toHaveLength(2);
      for (const guest of company) {
        expect(guest.root.isEnabled()).toBe(true);
        expect(guest.root.position.y).toBeCloseTo(0.14, 6);
        expect(guest.playback.clip).toBe('BenchSit');
        for (const phase of [undefined, 0, 0.25, 0.5, 0.75, 1]) {
          // Also inspect the constructor's first visible pose before any simulation tick.
          if (phase !== undefined) guest.sampleAt('BenchSit', phase);
          const skin = surface(guest.root);
          const floor = Math.min(...skin.footVertices.map((point) => point.y));
          expect(Math.abs(floor), `${guest.root.name} soles at phase ${phase}`).toBeLessThanOrEqual(
            SOLE_TOLERANCE,
          );
          for (const furnishing of furnishings)
            expect(
              contactWitness(skin, furnishing.skin, furnishing.pieces),
              `${guest.root.name} contacts ${furnishing.item.asset} at phase ${phase}`,
            ).toBeUndefined();
          expect(
            clothSupportGap(skin, support),
            `${guest.root.name} finite cloth support`,
          ).toBeLessThan(0.025);
        }
      }
    } finally {
      for (const node of [...scene.transformNodes])
        if (!originalNodes.has(node) && !node.parent) node.dispose();
    }
  },
);

it.each(BENCH_STARTS)(
  'clears the bench and neighbor while turning at $label route corners',
  ({ position }) => {
    const actor = seatedActor('traveler', -0.45);
    const neighbor = seatedActor('villager', 0.45);
    try {
      neighbor.sampleAt('BenchSit', 0.5);
      const neighborSkin = surface(neighbor.root);
      const neighborPieces = closedPieces(neighborSkin.triangles);
      const motion = benchMotion(position, { x: 3, z: 7 }, 0);
      const failures: unknown[] = [];
      const poses = [
        { clip: 'Idle' as const, phase: 0 },
        ...[0, 0.25, 0.5, 0.75].map((phase) => ({ clip: 'Walk' as const, phase })),
      ];
      let largestCacheError = 0;
      for (const [index, point] of motion.route.entries())
        for (let turn = 0; turn < 24; turn++)
          // The front point has an explicit stationary turn before sitting and after standing.
          for (const { clip, phase } of index === motion.route.length - 1
            ? poses.slice(0, 1)
            : poses) {
            const heading = (turn * Math.PI * 2) / 24;
            actor.root.position.set(point.x - motion.bench.x, 0, point.z - motion.bench.z);
            actor.root.rotation.y = heading;
            actor.sampleAt(clip, phase);
            const before = surface(actor.root);
            const measured = Math.min(...before.footVertices.map((vertex) => vertex.y));
            const cached = actor.soleHeight();
            largestCacheError = Math.max(largestCacheError, Math.abs(cached - measured));
            actor.root.position.y = Math.max(0, -cached);
            const skin = surface(actor.root);
            const benchContact = contactWitness(skin, bench, benchPieces);
            const neighborContact = contactWitness(skin, neighborSkin, neighborPieces);
            if (benchContact || neighborContact)
              failures.push({ point, heading, clip, phase, benchContact, neighborContact });
          }
      expect(failures.slice(0, 12), `${failures.length} intersecting turn poses`).toEqual([]);
      expect(largestCacheError).toBeLessThan(EPSILON);
    } finally {
      actor.dispose();
      neighbor.dispose();
    }
  },
  30_000,
);
