import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { ConversationPresentation } from '../../src/scene/presentation/conversation';
import { frameSubject } from '../../src/scene/presentation/framing';
import { posedVertices } from '../helpers/posed-geometry';

// Intended canonical destination: tests/unit/conversation-opening-framing.test.ts.
// Only transport is replaced: the genuine importer and packed model bytes remain.
vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
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
  engine = new NullEngine({
    renderWidth: 320,
    renderHeight: 568,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  engine.getCaps().maxVertexUniformVectors = 1024;
  scene = new Scene(engine);
  library = new AssetLibrary(scene);
  await library.load(['miriam', 'traveler'], () => {});
}, 60_000);
afterEach(() => vi.unstubAllGlobals());
afterAll(() => {
  library.dispose();
  scene.dispose();
  engine.dispose();
});

// Genuine stable Home/Large320x568 DOM rectangle from rejected native08 last frame.
// The opacity-only entrance candidate must publish these final bounds at first paint.
const panel = { left: 10, right: 310, top: 168, bottom: 558 };
type Rect = typeof panel;
function fixture(observedCamera = false) {
  vi.stubGlobal('document', { hidden: false });
  const nav = new TransformNode('opening-nav-' + serial++, scene),
    speaker = new Actor(library.instantiate('miriam', 'opening-miriam-' + serial++)),
    listener = new Actor(library.instantiate('traveler', 'opening-traveler-' + serial++));
  speaker.root.position.set(-6, 0, 0);
  nav.position.set(-5, 0, -1);
  listener.root.parent = nav;
  const camera = new ArcRotateCamera(
    'opening-camera-' + serial++,
    -Math.PI / 2 - 0.45,
    observedCamera ? 1.015546121742352 : 0.78,
    observedCamera ? 30.13190656086474 : 33,
    observedCamera
      ? new Vector3(-6.136387532232347, -3.0941002916774467, -1.6745904671654996)
      : new Vector3(0, 0, 2),
    scene,
  );
  camera.fov = 0.7;
  camera.lowerRadiusLimit = 16;
  camera.upperRadiusLimit = 46;
  camera.lowerBetaLimit = 0.42;
  camera.upperBetaLimit = 1.32;
  scene.activeCamera = camera;
  const canvas = { clientWidth: 320, clientHeight: 568, dataset: {} } as HTMLCanvasElement,
    view = new ConversationPresentation(camera, canvas);
  // No getAbsolutePosition, getViewMatrix, posedVertices, prepare or forced world
  // matrix calls before the genuine first presentation tick and Scene.render.
  return {
    nav,
    speaker,
    listener,
    camera,
    canvas,
    view,
    dispose: () => {
      view.dispose();
      for (const actor of [speaker, listener]) if (!actor.root.isDisposed()) actor.dispose();
      if (!nav.isDisposed()) nav.dispose();
      if (!camera.isDisposed()) camera.dispose();
    },
  };
}
type Fixture = ReturnType<typeof fixture>;
function cameraState(f: Fixture) {
  return {
    alpha: f.camera.alpha,
    beta: f.camera.beta,
    radius: f.camera.radius,
    target: f.camera.target.asArray(),
    min: f.camera.lowerRadiusLimit,
    max: f.camera.upperRadiusLimit,
    betaMin: f.camera.lowerBetaLimit,
    betaMax: f.camera.upperBetaLimit,
  };
}
function navigation(f: Fixture) {
  return [f.nav, f.speaker.root, f.listener.root].map((root) => ({
    root,
    parent: root.parent,
    position: root.position.asArray(),
    scaling: root.scaling.asArray(),
    // Actor headings legitimately turn; the navigation parent's complete local pose stays fixed.
    rotation: root === f.nav ? root.rotation.asArray() : null,
  }));
}
function clock(f: Fixture) {
  return (f.view as unknown as { clock: { elapsed: number } }).clock.elapsed;
}
function render(f: Fixture, dt: number, reduced = false) {
  f.view.tick(dt, reduced);
  scene.render();
}
function wholeBodies(f: Fixture, bounds: Rect) {
  // Unit oracle ONLY, after the real tick/render. This helper force-prepares skin
  // and cannot serve as native cached-submission evidence or a pre-tick cache primer.
  for (const [actor, asset, expectedCount] of [
    [f.speaker, 'miriam', 3236],
    [f.listener, 'traveler', 2980],
  ] as const) {
    const meshes = actor.model.root.getChildMeshes().filter((mesh) => mesh.getTotalVertices());
    expect(meshes.length).toBeGreaterThan(0);
    expect(
      meshes.every((mesh) => mesh.metadata?.assetId === asset && mesh.skeleton && mesh.isEnabled()),
    ).toBe(true);
    expect(meshes.reduce((count, mesh) => count + mesh.getTotalVertices(), 0)).toBe(expectedCount);
    const vertices = posedVertices(actor.model.root);
    expect(vertices).toHaveLength(expectedCount);
    const failures = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, outsidePanel: 0 };
    let checkedVertices = 0;
    for (const vertex of vertices) {
      const p = Vector3.Project(
        vertex,
        Matrix.Identity(),
        scene.getTransformMatrix(),
        f.camera.viewport.toGlobal(320, 568),
      );
      checkedVertices++;
      // The exact original five inclusive predicates, for EVERY genuine skin vertex.
      failures.xMin += Number(!(typeof p.x === 'number' && p.x >= 0));
      failures.xMax += Number(!(typeof p.x === 'number' && p.x <= 320));
      failures.yMin += Number(!(typeof p.y === 'number' && p.y >= 0));
      failures.yMax += Number(!(typeof p.y === 'number' && p.y <= 568));
      failures.outsidePanel += Number(
        !(p.x <= bounds.left || p.x >= bounds.right || p.y <= bounds.top || p.y >= bounds.bottom),
      );
    }
    expect(checkedVertices).toBe(expectedCount);
    expect(failures, asset + ' complete original five predicates').toEqual({
      xMin: 0,
      xMax: 0,
      yMin: 0,
      yMax: 0,
      outsidePanel: 0,
    });
  }
}

it.each([
  [0, false],
  [1 / 60, false],
  [0, true],
  [1 / 60, true],
] as const)(
  'fits both complete normal-opening skins on the first tick dt=%s, retained camera=%s',
  (dt, observedCamera) => {
    const f = fixture(observedCamera);
    try {
      const before = navigation(f);
      f.view.select('miriam', f.speaker, f.listener, panel);
      render(f, dt);
      wholeBodies(f, panel);
      expect(navigation(f)).toEqual(before);
      expect(clock(f)).toBe(dt);
    } finally {
      f.dispose();
    }
  },
);

it('fits a changed live panel immediately and keeps ordinary easing on subsequent anchor movement', () => {
  const f = fixture();
  try {
    f.view.select('miriam', f.speaker, f.listener, panel);
    render(f, 0);
    const before = navigation(f),
      changed = { ...panel, top: 240 },
      firstCamera = cameraState(f);
    f.view.select('miriam', f.speaker, f.listener, changed);
    render(f, 1 / 60);
    wholeBodies(f, changed);
    expect(cameraState(f)).not.toEqual(firstCamera);
    expect(navigation(f)).toEqual(before);
    const from = f.camera.target.clone();
    f.nav.position.z += 0.1; // Genuine controlled relocation, with no layout publication or cache priming.
    render(f, 1 / 60);
    const a = f.speaker.root.getAbsolutePosition(),
      b = f.listener.root.getAbsolutePosition();
    const desired = frameSubject(
      f.camera,
      320,
      568,
      a
        .add(b)
        .scale(0.5)
        .add(new Vector3(0, 0.95, 0)),
      Math.max(1.4, Vector3.Distance(a, b) * 0.5 + 0.8),
      f.camera.alpha,
      1.12,
      changed,
    );
    // A behavioral between-poses control, without mirroring the exponential implementation.
    expect(Vector3.Distance(f.camera.target, from)).toBeGreaterThan(0);
    expect(Vector3.Distance(f.camera.target, desired.target)).toBeGreaterThan(0);
    expect(Vector3.Distance(f.camera.target, desired.target)).toBeLessThan(
      Vector3.Distance(from, desired.target),
    );
    wholeBodies(f, changed);
  } finally {
    f.dispose();
  }
});

it('freezes an unchanged paused view and fits changed paused layout without advancing either actor', () => {
  const f = fixture();
  try {
    f.view.select('miriam', f.speaker, f.listener, panel);
    render(f, 1 / 60);
    f.view.setPaused(true);
    const before = {
      camera: cameraState(f),
      clock: clock(f),
      poses: [f.speaker.snapshotPose(), f.listener.snapshotPose()],
      nav: navigation(f),
    };
    render(f, 0.1);
    expect({
      camera: cameraState(f),
      clock: clock(f),
      poses: [f.speaker.snapshotPose(), f.listener.snapshotPose()],
      nav: navigation(f),
    }).toEqual(before);
    const changed = { ...panel, top: 240 };
    f.view.select('miriam', f.speaker, f.listener, changed);
    render(f, 0);
    wholeBodies(f, changed);
    expect(cameraState(f)).not.toEqual(before.camera);
    expect(clock(f)).toBe(before.clock);
    expect([f.speaker.snapshotPose(), f.listener.snapshotPose()]).toEqual(before.poses);
    expect(navigation(f)).toEqual(before.nav);
  } finally {
    f.dispose();
  }
});

it.each([0, 1 / 60])(
  'retains immediate reduced opening and zero presentation clock at dt=%s',
  (dt) => {
    const f = fixture();
    try {
      const before = navigation(f);
      f.view.select('miriam', f.speaker, f.listener, panel);
      render(f, dt, true);
      wholeBodies(f, panel);
      expect(clock(f)).toBe(0);
      expect(f.canvas.dataset.conversationTime).toBe('0.00');
      expect(navigation(f)).toEqual(before);
    } finally {
      f.dispose();
    }
  },
);

it('does not fit or advance while hidden and fits the first visible zero-time tick', () => {
  const f = fixture();
  try {
    f.view.select('miriam', f.speaker, f.listener, panel);
    const before = {
      camera: cameraState(f),
      clock: clock(f),
      poses: [f.speaker.snapshotPose(), f.listener.snapshotPose()],
      nav: navigation(f),
    };
    vi.stubGlobal('document', { hidden: true });
    f.view.tick(9, false);
    expect({
      camera: cameraState(f),
      clock: clock(f),
      poses: [f.speaker.snapshotPose(), f.listener.snapshotPose()],
      nav: navigation(f),
    }).toEqual(before);
    vi.stubGlobal('document', { hidden: false });
    render(f, 0);
    wholeBodies(f, panel);
    expect(clock(f)).toBe(0);
    expect(navigation(f)).toEqual(before.nav);
  } finally {
    f.dispose();
  }
});

it.each(['disabled', 'disposed', 'nonfinite'] as const)(
  'does not fit an opening with a %s participant',
  (kind) => {
    const f = fixture();
    try {
      f.view.select('miriam', f.speaker, f.listener, panel);
      if (kind === 'disabled') f.speaker.root.setEnabled(false);
      if (kind === 'disposed') f.speaker.dispose();
      if (kind === 'nonfinite') f.speaker.root.position.x = Infinity;
      const before = cameraState(f);
      f.view.tick(1 / 60, false);
      expect(cameraState(f)).toEqual(before);
      expect(clock(f)).toBe(0);
      expect(f.canvas.dataset.conversation).toBeUndefined();
    } finally {
      f.dispose();
    }
  },
);

it('restores the exact camera limits, heading and pose bookmarks while keeping navigation roots fixed', () => {
  const f = fixture();
  try {
    const before = {
      camera: cameraState(f),
      nav: navigation(f),
      headings: [f.speaker.root.rotation.y, f.listener.root.rotation.y],
      poses: [f.speaker.snapshotPose(), f.listener.snapshotPose()],
    };
    f.view.select('miriam', f.speaker, f.listener, panel);
    render(f, 1 / 60);
    wholeBodies(f, panel);
    f.view.clear();
    expect(cameraState(f)).toEqual(before.camera);
    expect(navigation(f)).toEqual(before.nav);
    expect([f.speaker.root.rotation.y, f.listener.root.rotation.y]).toEqual(before.headings);
    expect([f.speaker.snapshotPose(), f.listener.snapshotPose()]).toEqual(before.poses);
    expect(f.view.active).toBe(false);
    expect(f.canvas.dataset.conversation).toBeUndefined();
  } finally {
    f.dispose();
  }
});
