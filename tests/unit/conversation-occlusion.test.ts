import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Ray } from '@babylonjs/core/Culling/ray';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { World } from '../../src/scene/world';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';
import { ScenerySightline } from '../../src/scene/environment/occlusion';
import { stylePlugin, WIND_SHAPES } from '../../src/scene/environment/matte';
import { newGame } from '../../src/game/types';
import { workTarget, type WorkTarget } from '../../src/content/exploration/work';
import { preparedHarbor } from '../helpers/harbor';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    // Keep the actual importer, packed actors and scenery; replace only network transport.
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

let engine: NullEngine,
  scene: Scene,
  library: AssetLibrary,
  serial = 0;
beforeAll(async () => {
  engine = new NullEngine();
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['olive', 'traveler', 'miriam'], () => {});
}, 60_000);
afterAll(() => {
  vi.unstubAllGlobals();
  library.dispose();
  scene.dispose();
  engine.dispose();
});

const panel = { left: 300, right: 1100, top: 550, bottom: 880 };
function fixture(reduced: boolean) {
  vi.stubGlobal('document', { hidden: false });
  const nav = new TransformNode('dialogue-navigation-' + serial++, scene),
    listener = new Actor(library.instantiate('traveler', 'dialogue-listener-' + serial++)),
    speaker = new Actor(library.instantiate('miriam', 'dialogue-speaker-' + serial++));
  listener.root.parent = nav;
  nav.position.set(4.4, 0, 10);
  speaker.root.position.set(0, 0, 10);
  const camera = new ArcRotateCamera(
    'dialogue-sightline-' + serial++,
    -Math.PI / 2,
    Math.PI / 2,
    10,
    Vector3.Zero(),
    scene,
  );
  camera.setPosition(new Vector3(0, 1.3, -10));
  camera.getViewMatrix();
  const canvas = { clientWidth: 1440, clientHeight: 900, dataset: {} } as HTMLCanvasElement,
    view = new ConversationPresentation(camera, canvas),
    state = newGame();
  state.position = { x: nav.position.x, z: nav.position.z };
  const world = Object.assign(Object.create(World.prototype), {
    scene,
    library,
    camera,
    canvas,
    state,
    position: { ...state.position },
    player: nav,
    actorPlayer: listener,
    actors: new Map([['miriam', speaker]]),
    boats: [],
    occluders: [],
    scenerySightline: new ScenerySightline(),
    conversationView: view,
    reducedMotion: reduced,
    paused: true,
    path: [
      { x: 4.4, z: 10 },
      { x: 4.4, z: 11 },
    ],
    keys: new Set(['w']),
    stop: vi.fn(),
  });
  const tree = world.place({ asset: 'olive', x: 0, z: 7, scale: 1.3 }) as TransformNode,
    other = world.place({ asset: 'olive', x: 20, z: 7, scale: 1.3 }) as TransformNode;
  const meshes = tree.getChildMeshes().filter((mesh) => mesh.getTotalVertices()),
    untouched = other.getChildMeshes().filter((mesh) => mesh.getTotalVertices());
  const update = () => {
    camera.getViewMatrix();
    if (reduced) world.updateOcclusion(0);
    else for (let frame = 0; frame < 40; frame++) world.updateOcclusion(0.05);
  };
  const fade = (amount: number) => {
    update();
    for (const mesh of meshes) expect(stylePlugin(mesh.material!).fade).toBeCloseTo(amount, 5);
    for (const mesh of untouched) expect(stylePlugin(mesh.material!).fade).toBe(1);
  };
  return {
    world,
    view,
    listener,
    speaker,
    nav,
    camera,
    canvas,
    tree,
    meshes,
    untouched,
    update,
    fade,
    dispose: () => {
      view.dispose();
      for (const actor of [listener, speaker]) if (!actor.root.isDisposed()) actor.dispose();
      for (const node of [nav, tree, other, camera]) if (!node.isDisposed()) node.dispose();
    },
  };
}

/** Independent finite mesh rays, without the production bounds rejection or focus selection. */
function blocked(meshes: readonly AbstractMesh[], camera: Vector3, root: TransformNode): boolean {
  const position = root.getAbsolutePosition();
  return [0.9, 1.6].some((height) => {
    const target = position.add(new Vector3(0, height, 0)),
      ray = new Ray(camera, target.subtract(camera).normalize(), Vector3.Distance(camera, target));
    return meshes.some((mesh) => {
      mesh.computeWorldMatrix(true);
      const hit = ray.intersectsMesh(mesh, true);
      return hit.hit && hit.distance < ray.length - 0.05;
    });
  });
}

function invariants(f: ReturnType<typeof fixture>) {
  const geometry = [...f.meshes, ...f.untouched].map((mesh) => {
    mesh.computeWorldMatrix(true);
    return {
      mesh,
      geometry: (mesh as Mesh).geometry,
      positions: Array.from(mesh.getVerticesData('position')!),
      indices: Array.from(mesh.getIndices()!),
      matrix: Array.from(mesh.getWorldMatrix().m),
      material: mesh.material,
      metadata: mesh.metadata,
      pickable: mesh.isPickable,
      shadows: mesh.receiveShadows,
    };
  });
  const state = JSON.stringify(f.world.state),
    position = { ...f.world.position },
    path = f.world.path,
    pathPoints = structuredClone(path),
    keys = f.world.keys,
    nav = Array.from(f.nav.computeWorldMatrix(true).m),
    actors = [f.listener, f.speaker].map((actor) => ({
      actor,
      pose: actor.snapshotPose(),
      root: Array.from(actor.root.computeWorldMatrix(true).m),
    })),
    camera = {
      position: f.camera.position.clone(),
      target: f.camera.target.clone(),
      orbit: [f.camera.alpha, f.camera.beta, f.camera.radius],
    };
  return () => {
    for (const saved of geometry) {
      const mesh = saved.mesh;
      expect((mesh as Mesh).geometry).toBe(saved.geometry);
      expect(Array.from(mesh.getVerticesData('position')!)).toEqual(saved.positions);
      expect(Array.from(mesh.getIndices()!)).toEqual(saved.indices);
      expect(Array.from(mesh.computeWorldMatrix(true).m)).toEqual(saved.matrix);
      expect(mesh.material).toBe(saved.material);
      expect(mesh.metadata).toBe(saved.metadata);
      expect(mesh.isPickable).toBe(saved.pickable);
      expect(mesh.receiveShadows).toBe(saved.shadows);
      expect(stylePlugin(mesh.material!).wind).toEqual(WIND_SHAPES.olive);
    }
    for (const saved of actors) {
      expect(saved.actor.snapshotPose()).toEqual(saved.pose);
      expect(Array.from(saved.actor.root.computeWorldMatrix(true).m)).toEqual(saved.root);
    }
    expect(JSON.stringify(f.world.state)).toBe(state);
    expect(f.world.position).toEqual(position);
    expect(f.world.path).toBe(path);
    expect(f.world.path).toEqual(pathPoints);
    expect(f.world.keys).toBe(keys);
    expect([...keys]).toEqual(['w']);
    expect(Array.from(f.nav.computeWorldMatrix(true).m)).toEqual(nav);
    expect(f.camera.position).toEqual(camera.position);
    expect(f.camera.target).toEqual(camera.target);
    expect([f.camera.alpha, f.camera.beta, f.camera.radius]).toEqual(camera.orbit);
  };
}

function rangeSnapshot(f: ReturnType<typeof fixture>) {
  return {
    state: JSON.stringify(f.world.state),
    position: { ...f.world.position },
    path: f.world.path,
    pathPoints: structuredClone(f.world.path),
    keys: f.world.keys,
    pressed: [...f.world.keys],
    nav: Array.from(f.nav.computeWorldMatrix(true).m),
    listenerLocal: [
      ...f.listener.root.position.asArray(),
      ...f.listener.root.rotation.asArray(),
      ...f.listener.root.scaling.asArray(),
    ],
    poses: [f.listener.snapshotPose(), f.speaker.snapshotPose()],
    simulation: [f.world.time, f.world.strideTime],
    renderId: scene.getRenderId(),
    frameId: scene.getFrameId(),
    conversationTime: f.canvas.dataset.conversationTime,
    camera: {
      orbit: [f.camera.alpha, f.camera.beta, f.camera.radius],
      target: f.camera.target.asArray(),
      limits: [
        f.camera.lowerRadiusLimit,
        f.camera.upperRadiusLimit,
        f.camera.lowerBetaLimit,
        f.camera.upperBetaLimit,
      ],
    },
  };
}

function rangeUnchanged(f: ReturnType<typeof fixture>, before: ReturnType<typeof rangeSnapshot>) {
  expect(JSON.stringify(f.world.state)).toBe(before.state);
  expect(f.world.position).toEqual(before.position);
  expect(f.world.path).toBe(before.path);
  expect(f.world.path).toEqual(before.pathPoints);
  expect(f.world.keys).toBe(before.keys);
  expect([...f.world.keys]).toEqual(before.pressed);
  expect(Array.from(f.nav.computeWorldMatrix(true).m)).toEqual(before.nav);
  expect([
    ...f.listener.root.position.asArray(),
    ...f.listener.root.rotation.asArray(),
    ...f.listener.root.scaling.asArray(),
  ]).toEqual(before.listenerLocal);
  expect([f.listener.snapshotPose(), f.speaker.snapshotPose()]).toEqual(before.poses);
  expect([f.world.time, f.world.strideTime]).toEqual(before.simulation);
  expect(scene.getRenderId()).toBe(before.renderId);
  expect(scene.getFrameId()).toBe(before.frameId);
  expect(f.canvas.dataset.conversationTime).toBe(before.conversationTime);
  expect([f.camera.alpha, f.camera.beta, f.camera.radius]).toEqual(before.camera.orbit);
  expect(f.camera.target.asArray()).toEqual(before.camera.target);
  expect([
    f.camera.lowerRadiusLimit,
    f.camera.upperRadiusLimit,
    f.camera.lowerBetaLimit,
    f.camera.upperBetaLimit,
  ]).toEqual(before.camera.limits);
}

for (const reduced of [false, true]) {
  it.each([
    ['speaker only', 4.4, 0, false, true, 0.12],
    ['listener only', 0, 4.4, true, false, 0.12],
    ['both people', 0, 0.1, true, true, 0.12],
    ['neither person', 4.4, 4.3, false, false, 1],
  ] as const)(
    `uses the packed olive's finite sightlines for %s; reduced motion ${reduced}`,
    (_name, listenerX, speakerX, listenerHit, speakerHit, amount) => {
      const f = fixture(reduced);
      try {
        f.nav.position.x = listenerX;
        f.world.position.x = listenerX;
        f.speaker.root.position.x = speakerX;
        expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(listenerHit);
        expect(blocked(f.meshes, f.camera.position, f.speaker.root)).toBe(speakerHit);
        f.world.setConversation('miriam', panel);
        expect(f.view.active).toBe(true);
        const unchanged = invariants(f),
          read = vi.spyOn(f.view, 'occlusionAnchors', 'get');
        f.world.updateOcclusion(reduced ? 0 : 0.05);
        expect(read).toHaveBeenCalledOnce();
        for (const mesh of f.meshes) {
          const fade = stylePlugin(mesh.material!).fade;
          if (amount === 1 || reduced) expect(fade).toBe(amount);
          else {
            expect(fade).toBeGreaterThan(0.12);
            expect(fade).toBeLessThan(1);
          }
        }
        f.fade(amount);
        unchanged();
        expect(f.meshes[0]!.material).not.toBe(f.untouched[0]!.material);
        expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(listenerHit);
        expect(blocked(f.meshes, f.camera.position, f.speaker.root)).toBe(speakerHit);
        read.mockRestore();
      } finally {
        f.dispose();
      }
    },
  );

  it(`keeps paused dialogue covered and restores the player focus on clear; reduced motion ${reduced}`, () => {
    const f = fixture(reduced);
    try {
      f.world.setConversation('miriam', panel, true);
      const anchors = f.view.occlusionAnchors,
        coordinates = anchors!.map((point) => point.asArray());
      expect(anchors).toEqual([
        f.speaker.root.getAbsolutePosition(),
        f.listener.root.getAbsolutePosition(),
      ]);
      expect(f.view.animated).toBe(false);
      const unchanged = invariants(f);
      f.fade(0.12);
      unchanged();
      f.world.setConversation('miriam', { ...panel, top: 430 }, true);
      expect(f.view.occlusionAnchors!.map((point) => point.asArray())).toEqual(coordinates);
      f.view.tick(0.1, reduced);
      f.camera.getViewMatrix();
      expect(f.view.occlusionAnchors!.map((point) => point.asArray())).toEqual(coordinates);
      f.fade(
        blocked(f.meshes, f.camera.position, f.listener.root) ||
          blocked(f.meshes, f.camera.position, f.speaker.root)
          ? 0.12
          : 1,
      );
      f.world.setConversation();
      f.camera.getViewMatrix();
      expect(f.view.occlusionAnchors).toBeUndefined();
      const physicalFocus = vi.spyOn(f.world.scenerySightline, 'blocks');
      f.world.updateOcclusion(0);
      for (const [, , point] of physicalFocus.mock.calls) expect(point).toBe(f.nav.position);
      physicalFocus.mockRestore();
      f.fade(blocked(f.meshes, f.camera.position, f.listener.root) ? 0.3 : 1);
      f.world.setConversation('miriam', panel);
      f.fade(
        blocked(f.meshes, f.camera.position, f.listener.root) ||
          blocked(f.meshes, f.camera.position, f.speaker.root)
          ? 0.12
          : 1,
      );
      f.world.setConversation('missing', panel);
      f.camera.getViewMatrix();
      expect(f.view.occlusionAnchors).toBeUndefined();
      f.fade(blocked(f.meshes, f.camera.position, f.listener.root) ? 0.3 : 1);
    } finally {
      f.dispose();
    }
  });

  it(`releases invalid dialogue and disabled, hidden or beyond scenery; reduced motion ${reduced}`, () => {
    const f = fixture(reduced);
    try {
      f.world.setConversation('miriam', panel);
      f.fade(0.12);
      f.speaker.root.setEnabled(false);
      expect(f.view.occlusionAnchors).toBeUndefined();
      f.fade(1);
      f.speaker.root.setEnabled(true);
      f.fade(0.12);
      f.nav.setEnabled(false);
      expect(f.view.occlusionAnchors).toBeUndefined();
      f.fade(1);
      f.nav.setEnabled(true);
      f.fade(0.12);
      f.tree.setEnabled(false);
      f.fade(1);
      f.tree.setEnabled(true);
      f.fade(0.12);
      for (const mesh of f.meshes) mesh.isVisible = false;
      f.fade(1);
      for (const mesh of f.meshes) mesh.isVisible = true;
      f.fade(0.12);
      f.camera.alpha += Math.PI;
      f.camera.getViewMatrix();
      expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(false);
      expect(blocked(f.meshes, f.camera.position, f.speaker.root)).toBe(false);
      f.fade(1);
      f.camera.setPosition(new Vector3(0, 1.3, -10));
      f.camera.getViewMatrix();
      f.fade(0.12);
      const firstSceneryZ = Math.min(
        ...f.meshes.map((mesh) => {
          mesh.computeWorldMatrix(true);
          const near = mesh.getBoundingInfo().boundingBox.minimumWorld.z;
          expect(Number.isFinite(near)).toBe(true);
          return near;
        }),
      );
      const beforeScenery = firstSceneryZ - 0.1;
      expect(beforeScenery).toBeGreaterThan(f.camera.position.z);
      f.nav.position.z = f.speaker.root.position.z = beforeScenery;
      f.world.position.z = beforeScenery;
      const current = f.view.occlusionAnchors;
      expect(current).toBeDefined();
      for (const point of current!) expect(point.z).toBeLessThan(firstSceneryZ - 0.05);
      expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(false);
      expect(blocked(f.meshes, f.camera.position, f.speaker.root)).toBe(false);
      f.fade(1);
      f.nav.position.z = f.speaker.root.position.z = 10;
      f.world.position.z = 10;
      f.fade(0.12);
      f.speaker.root.position.x = -8;
      // World must reject the moved actor before any public anchor getter refreshes its cache.
      f.world.setConversation('miriam', panel);
      expect(f.view.occlusionAnchors).toBeUndefined();
      f.fade(1);
    } finally {
      f.dispose();
    }
  });

  it(`keeps solid scenery at the existing dialogue fade; reduced motion ${reduced}`, () => {
    const f = fixture(reduced);
    const root = new TransformNode('dialogue-wall-' + serial++, scene),
      wall = CreateBox(
        'dialogue-wall-mesh-' + serial++,
        { width: 1, height: 3, depth: 0.3 },
        scene,
      );
    wall.parent = root;
    wall.position.y = 1.5;
    root.position.z = 7;
    wall.material = new StandardMaterial('dialogue-wall-material-' + serial++, scene);
    f.world.registerOccluder('house', root);
    try {
      expect(blocked([wall], f.camera.position, f.listener.root)).toBe(false);
      expect(blocked([wall], f.camera.position, f.speaker.root)).toBe(true);
      f.world.setConversation('miriam', panel);
      f.update();
      expect(stylePlugin(wall.material).fade).toBeCloseTo(0.18, 5);
      f.world.setConversation();
      f.update();
      expect(stylePlugin(wall.material).fade).toBeCloseTo(1, 5);
    } finally {
      root.dispose();
      f.dispose();
    }
  });
}

it('uses current absolute roots while leaving dialogue, pose, navigation and camera state untouched', () => {
  const f = fixture(true);
  try {
    f.world.setConversation('miriam', panel);
    const unchanged = invariants(f),
      clock = f.canvas.dataset.conversationTime;
    expect(f.view.occlusionAnchors).toEqual([
      f.speaker.root.getAbsolutePosition(),
      f.listener.root.getAbsolutePosition(),
    ]);
    vi.stubGlobal('document', { hidden: true });
    f.view.tick(9, false);
    expect(f.canvas.dataset.conversationTime).toBe(clock);
    expect(f.view.occlusionAnchors).toBeDefined();
    unchanged();
    vi.stubGlobal('document', { hidden: false });
    const renderId = scene.getRenderId(),
      frameId = scene.getFrameId(),
      state = JSON.stringify(f.world.state),
      poses = [f.listener.snapshotPose(), f.speaker.snapshotPose()];
    f.nav.position.y = 2;
    f.listener.root.position.set(0.2, 0.3, 0.4);
    for (const [index, coordinate] of [4.6, 2.3, 10.4].entries())
      expect(f.view.occlusionAnchors![1].asArray()[index]).toBeCloseTo(coordinate, 6);
    f.speaker.root.position.z = 4;
    expect(f.view.occlusionAnchors![0].z).toBe(4);
    expect(scene.getRenderId()).toBe(renderId);
    expect(scene.getFrameId()).toBe(frameId);
    expect(JSON.stringify(f.world.state)).toBe(state);
    expect([f.listener.snapshotPose(), f.speaker.snapshotPose()]).toEqual(poses);
  } finally {
    f.dispose();
  }
});

for (const reduced of [false, true]) {
  it.each(['local root', 'parent root'] as const)(
    `rechecks real same-render moved-out and moved-in %s before public anchors; reduced motion ${reduced}`,
    (kind) => {
      const f = fixture(reduced),
        parent = new TransformNode('range-parent-' + serial++, scene);
      try {
        if (kind === 'parent root') f.speaker.root.parent = parent;
        f.world.time = 17;
        f.world.strideTime = 3;
        const before = rangeSnapshot(f),
          anchors = vi.spyOn(f.view, 'occlusionAnchors', 'get');
        f.world.setConversation('miriam', panel);
        expect(f.view.active).toBe(true);
        expect(f.view.id).toBe('miriam');
        expect(anchors).not.toHaveBeenCalled();
        const selectedLimits = [
          f.camera.lowerRadiusLimit,
          f.camera.upperRadiusLimit,
          f.camera.lowerBetaLimit,
          f.camera.upperBetaLimit,
        ];
        const moved = kind === 'parent root' ? parent : f.speaker.root;
        moved.position.x = -8;
        // No frame advance, world-matrix primer or public getter follows this genuine edit.
        f.world.setConversation('miriam', panel);
        expect(f.view.active).toBe(false);
        expect(f.view.id).toBeUndefined();
        expect(anchors).not.toHaveBeenCalled();
        expect(moved.position.x).toBe(-8);
        rangeUnchanged(f, before);

        moved.position.x = 0;
        // The rejected root still has its out-of-range matrix until this real World call.
        f.world.setConversation('miriam', panel);
        expect(f.view.active).toBe(true);
        expect(f.view.id).toBe('miriam');
        expect(anchors).not.toHaveBeenCalled();
        expect(moved.position.x).toBe(0);
        rangeUnchanged(f, {
          ...before,
          camera: { ...before.camera, limits: selectedLimits },
        });
        expect(f.view.occlusionAnchors![0].x).toBe(0);
        expect(anchors).toHaveBeenCalledOnce();
        anchors.mockRestore();
      } finally {
        f.dispose();
        if (!parent.isDisposed()) parent.dispose();
      }
    },
  );
}

it.each(['disabled', 'disposed', 'nonfinite'] as const)(
  'rejects a same-render %s World candidate before querying public anchors',
  (kind) => {
    const f = fixture(true);
    try {
      f.world.time = 17;
      f.world.strideTime = 3;
      const before = rangeSnapshot(f),
        anchors = vi.spyOn(f.view, 'occlusionAnchors', 'get');
      f.world.setConversation('miriam', panel);
      expect(f.view.active).toBe(true);
      expect(anchors).not.toHaveBeenCalled();
      if (kind === 'disabled') f.speaker.root.setEnabled(false);
      else if (kind === 'disposed') f.speaker.dispose();
      else f.speaker.root.position.x = Infinity;
      const position = vi.spyOn(f.speaker.root, 'getAbsolutePosition'),
        matrix = vi.spyOn(f.speaker.root, 'computeWorldMatrix');
      // The finite position from the earlier selection must not admit this changed candidate.
      f.world.setConversation('miriam', panel);
      expect(f.view.active).toBe(false);
      expect(f.view.id).toBeUndefined();
      expect(anchors).not.toHaveBeenCalled();
      if (kind === 'nonfinite') {
        expect(position).toHaveBeenCalled();
        for (const result of position.mock.results) {
          expect(result.type).toBe('return');
          const at = result.value as Vector3;
          expect([at.x, at.y, at.z].every(Number.isFinite)).toBe(false);
        }
        expect(f.speaker.root.position.x).toBe(Infinity);
      } else {
        expect(position).not.toHaveBeenCalled();
        expect(matrix).not.toHaveBeenCalled();
      }
      rangeUnchanged(f, before);
      expect(f.view.occlusionAnchors).toBeUndefined();
      position.mockRestore();
      matrix.mockRestore();
      anchors.mockRestore();
    } finally {
      f.dispose();
    }
  },
);

it('rejects nonfinite or disposed participants without querying their stale geometry', () => {
  const f = fixture(true);
  try {
    f.world.setConversation('miriam', panel);
    f.fade(0.12);
    const camera = [f.camera.alpha, f.camera.beta, f.camera.radius, ...f.camera.target.asArray()],
      clock = f.canvas.dataset.conversationTime;
    f.speaker.root.position.x = Infinity;
    expect(f.view.occlusionAnchors).toBeUndefined();
    f.view.tick(0.1, false);
    expect([f.camera.alpha, f.camera.beta, f.camera.radius, ...f.camera.target.asArray()]).toEqual(
      camera,
    );
    expect(f.canvas.dataset.conversationTime).toBe(clock);
    f.fade(1);
    f.speaker.root.position.x = 0;
    f.fade(0.12);
    f.speaker.dispose();
    const stalePosition = vi.spyOn(f.speaker.root, 'getAbsolutePosition'),
      restoreSpeaker = vi.spyOn(f.speaker, 'restorePose'),
      restoreListener = vi.spyOn(f.listener, 'restorePose');
    expect(f.view.occlusionAnchors).toBeUndefined();
    f.view.tick(0.1, false);
    f.fade(1);
    expect(stalePosition).not.toHaveBeenCalled();
    f.view.dispose();
    expect(f.view.occlusionAnchors).toBeUndefined();
    expect(f.view.active).toBe(false);
    expect(restoreSpeaker).not.toHaveBeenCalled();
    expect(restoreListener).toHaveBeenCalledOnce();
    restoreSpeaker.mockRestore();
    restoreListener.mockRestore();
    stalePosition.mockRestore();
  } finally {
    f.dispose();
  }
});

it('returns to the physical player for work and boat focus, and bounds dialogue to two participants', () => {
  const f = fixture(true);
  try {
    f.world.setConversation('miriam', panel);
    f.fade(0.12);
    f.world.workView = { active: true };
    const read = vi.spyOn(f.view, 'occlusionAnchors', 'get');
    f.fade(1);
    expect(read).not.toHaveBeenCalled();
    f.world.workView.active = false;
    f.fade(0.12);
    f.world.state = {
      ...preparedHarbor(f.world.state),
      // Keep this controlled sightline studio at its current physical traveler location.
      position: { ...f.world.position },
    };
    const target = workTarget(f.world.state, 'harbor-entrance'),
      work = {
        active: false,
        select: vi.fn((value?: WorkTarget) => {
          work.active = !!value;
        }),
      };
    expect(target).toBeDefined();
    expect(target!.family).toBe('harbor');
    expect(f.world.state.harbor.stage).toBe('working');
    expect(target!.actions.some((action) => action.motion)).toBe(true);
    f.world.workView = work;
    f.world.setWorkFocus(target);
    expect(f.view.occlusionAnchors).toBeUndefined();
    expect(work.select).toHaveBeenCalledWith(target, f.world.state, undefined);
    f.fade(1);
    f.world.setWorkFocus();
    f.world.setConversation('miriam', panel);
    f.fade(0.12);
    f.world.travelerBoat = {};
    read.mockClear();
    f.fade(1);
    expect(read).not.toHaveBeenCalled();
    f.world.setConversation('miriam', panel);
    expect(f.view.occlusionAnchors).toBeUndefined();
    f.world.travelerBoat = undefined;
    f.world.setConversation('miriam', panel);
    const probe = vi.spyOn(f.world.scenerySightline, 'blocks');
    f.world.updateOcclusion(0);
    expect(read).toHaveBeenCalled();
    expect(probe.mock.calls.length).toBeLessThanOrEqual(f.world.occluders.length * 2);
    const anchors = f.view.occlusionAnchors!;
    for (const [, camera, focus] of probe.mock.calls) {
      expect(camera).toBe(f.camera.position);
      expect(anchors).toContain(focus);
    }
    probe.mockRestore();
    read.mockRestore();
  } finally {
    f.dispose();
  }
});

it('rejects invalid finite-ray inputs and ignores disposed scenery', () => {
  const wall = CreateBox('invalid-dialogue-ray-' + serial++, { size: 2 }, scene);
  wall.position.y = 1;
  const sightline = new ScenerySightline(),
    camera = new Vector3(0, 1, -10),
    focus = new Vector3(0, 0, 10);
  try {
    expect(sightline.blocks([wall], camera, focus)).toBe(true);
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(sightline.blocks([wall], new Vector3(invalid, 1, -10), focus)).toBe(false);
      expect(sightline.blocks([wall], camera, new Vector3(0, invalid, 10))).toBe(false);
    }
    wall.dispose();
    expect(sightline.blocks([wall], camera, focus)).toBe(false);
  } finally {
    if (!wall.isDisposed()) wall.dispose();
  }
});

for (const reduced of [false, true]) {
  it(`uses the conversation target only until clear, preserving player recovery; reduced motion ${reduced}`, () => {
    const f = fixture(reduced);
    try {
      f.nav.position.x = f.world.position.x = 0;
      f.speaker.root.position.x = 0.1;
      expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(true);
      expect(blocked(f.meshes, f.camera.position, f.speaker.root)).toBe(true);
      // The same real packed geometry first receives the ordinary player policy.
      f.fade(0.3);
      const ordinary = stylePlugin(f.meshes[0]!.material!).fade;
      f.world.setConversation('miriam', panel, true);
      const unchanged = invariants(f);
      expect(f.view.active).toBe(true);
      expect(f.view.animated).toBe(false);
      f.world.updateOcclusion(0);
      const entering = stylePlugin(f.meshes[0]!.material!).fade;
      if (reduced) expect(entering).toBe(0.12);
      else expect(entering).toBe(ordinary);
      f.world.updateOcclusion(1 / 60);
      const next = stylePlugin(f.meshes[0]!.material!).fade;
      if (reduced) expect(next).toBe(0.12);
      else {
        expect(next).toBeGreaterThan(0.12);
        expect(next).toBeLessThan(entering);
      }
      f.fade(0.12);
      unchanged();
      f.world.setConversation();
      expect(f.view.active).toBe(false);
      const clearedUnchanged = invariants(f),
        previous = stylePlugin(f.meshes[0]!.material!).fade;
      f.world.updateOcclusion(0);
      const cleared = stylePlugin(f.meshes[0]!.material!).fade;
      if (reduced) expect(cleared).toBe(0.3);
      else expect(cleared).toBe(previous);
      f.world.updateOcclusion(1 / 60);
      const recovering = stylePlugin(f.meshes[0]!.material!).fade;
      if (reduced) expect(recovering).toBe(0.3);
      else {
        // Clearing does not clamp the genuine .12 -> .3 interpolation from below.
        expect(recovering).toBeGreaterThan(cleared);
        expect(recovering).toBeLessThan(0.3);
      }
      f.fade(0.3);
      clearedUnchanged();
      expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(true);
    } finally {
      f.dispose();
    }
  });
}

it.each([
  'disabled speaker',
  'disabled listener',
  'missing selection',
  'moved-out selection',
  'nonfinite speaker',
  'disposed speaker',
  'active work',
  'aboard boat',
] as const)('restores the blocked physical player target for %s', (kind) => {
  const f = fixture(true);
  try {
    f.nav.position.x = f.world.position.x = 0;
    f.speaker.root.position.x = 0.1;
    expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(true);
    expect(blocked(f.meshes, f.camera.position, f.speaker.root)).toBe(true);
    f.fade(0.3);
    f.world.setConversation('miriam', panel);
    f.fade(0.12);
    if (kind === 'disabled speaker') f.speaker.root.setEnabled(false);
    else if (kind === 'disabled listener') f.nav.setEnabled(false);
    else if (kind === 'missing selection') f.world.setConversation('missing', panel);
    else if (kind === 'moved-out selection') {
      f.speaker.root.position.x = -8;
      f.world.setConversation('miriam', panel);
      expect(f.view.active).toBe(false);
    } else if (kind === 'nonfinite speaker') f.speaker.root.position.x = Infinity;
    else if (kind === 'disposed speaker') f.speaker.dispose();
    else if (kind === 'active work') f.world.workView = { active: true };
    else f.world.travelerBoat = {};
    const read = vi.spyOn(f.view, 'occlusionAnchors', 'get');
    f.world.updateOcclusion(0);
    for (const mesh of f.meshes) expect(stylePlugin(mesh.material!).fade).toBe(0.3);
    for (const mesh of f.untouched) expect(stylePlugin(mesh.material!).fade).toBe(1);
    if (kind === 'active work' || kind === 'aboard boat') expect(read).not.toHaveBeenCalled();
    else expect(read).toHaveBeenCalledOnce();
    // This remains a real blocked-player control even when the participant pair is ineligible.
    expect(blocked(f.meshes, f.camera.position, f.listener.root)).toBe(true);
    read.mockRestore();
  } finally {
    f.dispose();
  }
});
