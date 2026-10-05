import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { World } from '../../src/scene/world';
import { WorkPresentation } from '../../src/scene/work';
import { workTarget } from '../../src/content/exploration/work';
import { groundHeight } from '../../src/content/campaign/layouts';
import { at } from '../helpers/campaign';
import { preparedSpring } from '../helpers/galilee';
import { bindExplorationInput } from '../../src/scene/input';
import { PausedCadence } from '../../src/scene/presentation/cadence';
import { newGame } from '../../src/game/types';
import { installClassicCameraInput } from '../../src/scene/classic-camera-input';
import { PointerInfo, PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { IPointerEvent } from '@babylonjs/core/Events/deviceInputEvents';
import { PointerInput } from '@babylonjs/core/DeviceInput/InputDevices/deviceEnums';

const engines: NullEngine[] = [];
const bindings: (() => void)[] = [];
afterEach(() => {
  bindings.splice(0).forEach((dispose) => dispose());
  vi.unstubAllGlobals();
  engines.splice(0).forEach((engine) => engine.dispose());
});

class ElementStub extends EventTarget {
  closest() {
    return null;
  }
}
class InputStub extends ElementStub {}
class SelectStub extends ElementStub {}
class TextareaStub extends ElementStub {}

function studio() {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera(
    'Q handoff',
    -Math.PI / 2 - 0.45,
    0.8,
    24,
    new Vector3(0, 0, 2),
    scene,
  );
  camera.inertia = 0.72;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = 1.3;
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 54;
  const events = new EventTarget();
  const canvas = Object.assign(new ElementStub(), { dataset: {} });
  let now = 1000;
  vi.stubGlobal('window', events);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('HTMLElement', ElementStub);
  vi.stubGlobal('HTMLInputElement', InputStub);
  vi.stubGlobal('HTMLSelectElement', SelectStub);
  vi.stubGlobal('HTMLTextAreaElement', TextareaStub);
  const keys = new Set<string>();
  const fixture = Object.assign(Object.create(World.prototype), {
    engine,
    scene,
    camera,
    canvas,
    state: newGame(),
    position: { x: 0, z: 0 },
    player: new TransformNode('traveler', scene),
    actors: new Map(),
    actorPlayer: { setStrideSpeed() {}, playback: { clip: 'Idle', frame: 0, action: '' } },
    keys,
    path: [],
    routeDots: [],
    marker: { setEnabled() {} },
    boats: [],
    cutaways: [],
    occluders: [],
    destinations: [],
    dataCache: new Map(),
    stage: { setView() {}, tick() {} },
    cadence: new PausedCadence(),
    callbacks: { frame() {} },
    active: true,
    paused: false,
    reducedMotion: false,
    pendingRotation: 0,
    time: 0,
    lastRender: now,
    lastFrame: Infinity,
  });
  const world = fixture as World;
  const binding = bindExplorationInput({
    scene,
    canvas: canvas as unknown as HTMLCanvasElement,
    keys,
    paused: () => fixture.paused,
    navigate() {},
    walk() {},
    nearest: () => undefined,
    resetCamera: () => world.resetCamera(),
    notice() {},
  });
  fixture.explorationInput = binding;
  bindings.push(() => {
    vi.stubGlobal('window', events);
    binding.dispose();
  });
  const key = (type: 'keydown' | 'keyup') =>
    events.dispatchEvent(
      Object.assign(new Event(type), {
        key: 'q',
        repeat: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    );
  const render = (milliseconds = 100) => {
    now += milliseconds;
    world.renderFrame();
  };
  const returning = () => {
    const to = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone(),
    };
    const from = { ...to, alpha: -0.2, target: new Vector3(-2, 2, 4) };
    camera.alpha = from.alpha;
    camera.target.copyFrom(from.target);
    fixture.cameraReturn = { from, to, t: 0 };
  };
  const pose = () => ({ alpha: camera.alpha, beta: camera.beta, radius: camera.radius });
  const context = () => ({
    target: camera.target.clone(),
    limits: [
      camera.lowerBetaLimit,
      camera.upperBetaLimit,
      camera.lowerRadiusLimit,
      camera.upperRadiusLimit,
    ],
    inertia: camera.inertia,
  });
  return { camera, fixture, world, keys, key, render, returning, pose, context };
}

function nativeGestures(camera: ArcRotateCamera, enabled: () => boolean) {
  const scene = camera.getScene();
  installClassicCameraInput(camera, { enabled });
  camera.attachControl(true);
  const pointer = (
    type: number,
    id: number,
    x: number,
    y: number,
    button: number,
    pointerType = 'mouse',
  ) => {
    const event: IPointerEvent = {
      type: 'pointer',
      inputIndex: PointerInput.Move,
      pointerId: id,
      pointerType,
      button,
      buttons: type === PointerEventTypes.POINTERUP ? 0 : button === 2 ? 2 : 1,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
      offsetX: x,
      offsetY: y,
      x,
      y,
      movementX: 0,
      movementY: 0,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault() {},
    };
    scene.onPointerObservable.notifyObservers(new PointerInfo(type, event, null), type);
  };
  return {
    orbit: () => {
      pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 2);
      pointer(PointerEventTypes.POINTERMOVE, 1, 160, 130, 2);
      pointer(PointerEventTypes.POINTERUP, 1, 160, 130, 2);
    },
    pinch: () => {
      pointer(PointerEventTypes.POINTERDOWN, 1, 100, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERDOWN, 2, 200, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERMOVE, 1, 100, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERMOVE, 1, 90, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERMOVE, 2, 210, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERUP, 1, 90, 100, 0, 'touch');
      pointer(PointerEventTypes.POINTERUP, 2, 210, 100, 0, 'touch');
    },
  };
}

function workHandoffStudio() {
  const s = studio(),
    state = at(preparedSpring(), 'channel-entry'),
    target = workTarget(state, 'channel-entry')!;
  Object.assign(s.fixture.canvas, { clientWidth: 1440, clientHeight: 900 });
  s.fixture.state = state;
  s.fixture.position = { ...state.position };
  s.fixture.player.position.set(
    state.position.x,
    groundHeight(state.region, state.position),
    state.position.z,
  );
  const work = new WorkPresentation(
    s.camera.getScene(),
    s.camera,
    s.fixture.canvas as unknown as HTMLCanvasElement,
  );
  work.setBounds({ left: 1050, right: 1440, top: 80, bottom: 900 });
  s.fixture.workView = work;
  expect(target.near).toBe(true);
  const framed = () => ({
    ...s.pose(),
    target: s.camera.target.asArray(),
    limits: s.context().limits,
    viewport: [
      s.camera.viewport.x,
      s.camera.viewport.y,
      s.camera.viewport.width,
      s.camera.viewport.height,
    ],
  });
  return { ...s, work, target, framed };
}

describe('command camera timing', () => {
  it.each([0, 300])(
    'hands an unfinished dialogue return to actual Work after %s ms without losing its fit or bookmark',
    (delay) => {
      // A direct opening supplies the actual Work frame and close bookmark. This
      // retains the same camera-return fixture used by the original timing cases.
      const control = workHandoffStudio(),
        ordinary = control.framed(),
        expected: ReturnType<typeof control.framed>[] = [];
      control.world.setWorkFocus(control.target);
      for (const dt of [0, 100, 600, 100]) {
        control.render(dt);
        expected.push(control.framed());
      }
      control.world.setWorkFocus();
      expect(control.framed()).toEqual(ordinary);

      const actual = workHandoffStudio(),
        saved = structuredClone(actual.fixture.state),
        nav = { ...actual.fixture.position },
        player = actual.fixture.player.position.clone();
      try {
        actual.returning();
        if (delay) actual.render(delay);
        expect(actual.fixture.cameraReturn).toBeDefined();
        actual.world.setWorkFocus(actual.target);
        for (const [i, dt] of [0, 100, 600, 100].entries()) {
          actual.render(dt);
          expect(actual.framed()).toEqual(expected[i]);
          expect(actual.fixture.cameraReturn).toBeUndefined();
        }
        actual.world.setWorkFocus();
        expect(actual.framed()).toEqual(ordinary);
        expect(actual.fixture.state).toEqual(saved);
        expect(actual.fixture.position).toEqual(nav);
        expect(actual.fixture.player.position.equals(player)).toBe(true);
      } finally {
        actual.work.dispose();
        control.work.dispose();
      }
    },
  );

  it('preserves an ordinary return on an empty Work publication and retains reduced Work ownership', () => {
    const actual = workHandoffStudio();
    try {
      actual.returning();
      const pending = actual.fixture.cameraReturn,
        pose = actual.framed();
      actual.world.setWorkFocus();
      expect(actual.fixture.cameraReturn).toBe(pending);
      expect(actual.framed()).toEqual(pose);
      actual.world.zoom(0);
      const ordinary = actual.framed();
      expect(actual.fixture.cameraReturn).toBeUndefined();
      actual.fixture.reducedMotion = true;
      actual.world.setWorkFocus(actual.target);
      actual.render(0);
      const reduced = actual.framed();
      expect(reduced.target).toEqual(actual.work.focusPoint!.asArray());
      actual.render(100);
      expect(actual.framed()).toEqual(reduced);
      actual.world.setWorkFocus();
      expect(actual.framed()).toEqual(ordinary);
    } finally {
      actual.work.dispose();
    }
  });

  it('settles Face north on a slow visible frame while keeping simulation catch-up capped', () => {
    const { camera, fixture, world, render } = studio();
    world.faceNorth();
    render(700);
    const bearing = Math.abs(((camera.alpha + Math.PI / 2) * 180) / Math.PI);
    expect(bearing).toBeLessThan(0.04);
    expect(fixture.time).toBeCloseTo(0.25, 12);
  });

  it('gives a button turn the same progress across one slow frame or normal frames', () => {
    const slow = studio();
    slow.world.rotate(1);
    slow.render(500);
    const alpha = slow.camera.alpha,
      pending = slow.fixture.pendingRotation;

    const normal = studio();
    normal.world.rotate(1);
    for (let i = 0; i < 5; i++) normal.render();
    expect(normal.camera.alpha).toBeCloseTo(alpha, 12);
    expect(normal.fixture.pendingRotation).toBeCloseTo(pending, 12);
  });

  it('finishes a conversation camera return after its visible 700ms duration', () => {
    const { camera, fixture, render, returning } = studio();
    returning();
    const to = fixture.cameraReturn.to;
    render(700);
    expect(fixture.cameraReturn).toBeUndefined();
    expect(camera.alpha).toBe(to.alpha);
    expect(camera.beta).toBe(to.beta);
    expect(camera.radius).toBe(to.radius);
    expect(camera.target).toEqual(to.target);
  });

  it('gives a camera return the same progress across one slow frame or normal frames', () => {
    const slow = studio();
    slow.returning();
    slow.render(500);
    const pose = slow.pose(),
      progress = slow.fixture.cameraReturn.t;

    const normal = studio();
    normal.returning();
    for (let i = 0; i < 5; i++) normal.render();
    expect(normal.camera.alpha).toBeCloseTo(pose.alpha, 12);
    expect(normal.camera.beta).toBeCloseTo(pose.beta, 12);
    expect(normal.camera.radius).toBeCloseTo(pose.radius, 12);
    expect(normal.fixture.cameraReturn.t).toBeCloseTo(progress, 12);
  });

  it('discards suspension time before continuing a queued compass turn', () => {
    const { camera, fixture, world, render } = studio();
    world.faceNorth();
    const alpha = camera.alpha,
      pending = fixture.pendingRotation;
    world.refreshFrame();
    render(60_000);
    expect(camera.alpha).toBe(alpha);
    expect(fixture.pendingRotation).toBe(pending);
    expect(fixture.time).toBe(0);
    render(700);
    expect(Math.abs(((camera.alpha + Math.PI / 2) * 180) / Math.PI)).toBeLessThan(0.04);
  });

  it('discards suspension time before continuing a conversation camera return', () => {
    const { fixture, world, render, returning, pose } = studio();
    returning();
    const held = pose(),
      bookmark = fixture.cameraReturn;
    world.refreshFrame();
    render(60_000);
    expect(pose()).toEqual(held);
    expect(fixture.cameraReturn).toBe(bookmark);
    expect(bookmark.t).toBe(0);
    expect(fixture.time).toBe(0);
    render(700);
    expect(fixture.cameraReturn).toBeUndefined();
  });
});

describe('Work camera motion ownership', () => {
  for (const gesture of ['orbit', 'pinch', 'button'] as const)
    for (const phase of ['queued', 'coasting'] as const)
      it('retires old ' + phase + ' ' + gesture + ' motion when actual Work frames', () => {
        const control = workHandoffStudio();
        let actualWork: WorkPresentation | undefined;
        try {
          // studio installs one global clock: finish this reference before constructing actual.
          if (phase === 'coasting') control.render();
          control.world.setWorkFocus(control.target);
          const expected: ReturnType<typeof control.framed>[] = [];
          for (const dt of [0, 100, 300, 600]) {
            control.render(dt);
            expected.push(control.framed());
          }
          const actual = workHandoffStudio();
          actualWork = actual.work;
          const gestures = nativeGestures(actual.camera, () => !actual.fixture.paused),
            initial = actual.framed();
          if (gesture === 'button') {
            actual.world.rotate(0.9);
            expect(actual.fixture.pendingRotation).toBeGreaterThan(0);
          } else {
            gestures[gesture]();
            expect(
              gesture === 'orbit'
                ? actual.camera.movement.rotationAccumulatedPixels.lengthSquared()
                : actual.camera.movement.zoomAccumulatedPixels,
            ).toBeGreaterThan(0);
          }
          if (phase === 'coasting') {
            actual.render();
            expect(actual.framed()).not.toEqual(initial);
          }
          const ordinary = actual.framed(),
            state = structuredClone(actual.fixture.state),
            position = { ...actual.fixture.position },
            player = actual.fixture.player.position.clone(),
            time = actual.fixture.time;

          // Runtime.cancelNavigation delegates to this actual World stop before Work selection.
          actual.world.stop();
          actual.world.setWorkFocus(actual.target);
          expect(actual.fixture.time).toBe(time);
          for (const [i, dt] of [0, 100, 300, 600].entries()) {
            actual.render(dt);
            expect(actual.framed()).toEqual(expected[i]);
            expect(actual.fixture.pendingRotation).toBe(0);
            expect(actual.fixture.state).toEqual(state);
            expect(actual.fixture.position).toEqual(position);
            expect(actual.fixture.player.position.equals(player)).toBe(true);
          }
          actual.world.setWorkFocus();
          expect(actual.framed()).toEqual(ordinary);
        } finally {
          actualWork?.dispose();
          control.work.dispose();
        }
      });

  it('retains fresh Work camera input on same-target refresh and reduced re-entry', () => {
    const actual = workHandoffStudio();
    try {
      const ordinary = actual.framed();
      actual.world.setWorkFocus(actual.target);
      actual.render(0);
      const framed = actual.framed();
      actual.world.rotate(0.9);
      const pending = actual.fixture.pendingRotation;
      actual.world.setWorkFocus(actual.target);
      expect(actual.fixture.pendingRotation).toBe(pending);
      actual.render(100);
      expect(actual.camera.alpha).toBeGreaterThan(framed.alpha);
      expect(actual.camera.beta).toBe(framed.beta);
      expect(actual.camera.radius).toBe(framed.radius);
      expect(actual.framed().viewport).toEqual(framed.viewport);
      const held = actual.framed(),
        remaining = actual.fixture.pendingRotation;
      actual.world.setWorkFocus(actual.target);
      expect(actual.framed()).toEqual(held);
      expect(actual.fixture.pendingRotation).toBe(remaining);
      actual.world.setWorkFocus();
      expect(actual.fixture.pendingRotation).toBe(0);
      expect(actual.framed()).toEqual(ordinary);

      actual.fixture.reducedMotion = true;
      actual.world.setWorkFocus(actual.target);
      actual.render(0);
      expect(actual.fixture.pendingRotation).toBe(0);
      const reduced = actual.framed();
      actual.world.rotate(0.9);
      const direct = actual.framed();
      expect(direct.alpha).toBeGreaterThan(reduced.alpha);
      actual.world.setWorkFocus(actual.target);
      actual.render(100);
      expect(actual.framed()).toEqual(direct);
    } finally {
      actual.work.dispose();
    }
  });
});

describe('explicit Work camera framing', () => {
  for (const command of ['frameWork', 'resetCamera'] as const)
    for (const gesture of ['orbit', 'pinch', 'button'] as const)
      for (const phase of ['queued', 'coasting'] as const)
        it(
          command + ' retires ' + phase + ' ' + gesture + ' motion for the actual Work frame',
          () => {
            const control = workHandoffStudio();
            let actualWork: WorkPresentation | undefined;
            try {
              // Reference completes before actual takes ownership of studio's global clock.
              control.world.setWorkFocus(control.target);
              control.render(0);
              if (phase === 'coasting') control.render();
              control.world[command]();
              const expected: ReturnType<typeof control.framed>[] = [];
              for (const dt of [0, 100, 300, 600]) {
                control.render(dt);
                expected.push(control.framed());
              }

              const actual = workHandoffStudio();
              actualWork = actual.work;
              const ordinary = actual.framed(),
                state = structuredClone(actual.fixture.state),
                nav = { ...actual.fixture.position },
                player = actual.fixture.player.position.clone();
              actual.world.setWorkFocus(actual.target);
              actual.render(0);
              const gestures = nativeGestures(actual.camera, () => !actual.fixture.paused),
                initial = actual.pose();
              if (gesture === 'button') {
                actual.world.rotate(0.9);
                expect(actual.fixture.pendingRotation).toBeGreaterThan(0);
              } else {
                gestures[gesture]();
                expect(
                  gesture === 'orbit'
                    ? actual.camera.movement.rotationAccumulatedPixels.lengthSquared()
                    : actual.camera.movement.zoomAccumulatedPixels,
                ).toBeGreaterThan(0);
              }
              if (phase === 'coasting') {
                actual.render();
                expect(actual.pose()).not.toEqual(initial);
              }
              const before = actual.framed(),
                time = actual.fixture.time;
              actual.world[command]();
              expect(actual.framed()).toEqual(before);
              expect(actual.fixture.time).toBe(time);
              for (const [i, dt] of [0, 100, 300, 600].entries()) {
                actual.render(dt);
                expect(actual.framed()).toEqual(expected[i]);
                expect(actual.fixture.state).toEqual(state);
                expect(actual.fixture.position).toEqual(nav);
                expect(actual.fixture.player.position.equals(player)).toBe(true);
              }
              expect(actual.fixture.pendingRotation).toBe(0);
              actual.world.setWorkFocus();
              expect(actual.framed()).toEqual(ordinary);
            } finally {
              actualWork?.dispose();
              control.work.dispose();
            }
          },
        );

  it.each(['frameWork', 'resetCamera'] as const)(
    '%s keeps fresh Work input and same-target refresh usable after framing',
    (command) => {
      const actual = workHandoffStudio();
      try {
        actual.world.setWorkFocus(actual.target);
        actual.render(0);
        actual.world[command]();
        actual.render(0);
        const framed = actual.framed();
        actual.world.rotate(0.9);
        const pending = actual.fixture.pendingRotation;
        actual.world.setWorkFocus(actual.target);
        expect(actual.fixture.pendingRotation).toBe(pending);
        actual.render(100);
        expect(actual.camera.alpha).toBeGreaterThan(framed.alpha);
        expect(actual.camera.beta).toBe(framed.beta);
        expect(actual.camera.radius).toBe(framed.radius);
        expect(actual.framed().viewport).toEqual(framed.viewport);

        actual.fixture.reducedMotion = true;
        actual.world[command]();
        actual.render(0);
        expect(actual.fixture.pendingRotation).toBe(0);
        const reduced = actual.framed();
        actual.world.rotate(0.9);
        const direct = actual.framed();
        expect(direct.alpha).toBeGreaterThan(reduced.alpha);
        actual.world.setWorkFocus(actual.target);
        actual.render(100);
        expect(actual.framed()).toEqual(direct);
      } finally {
        actual.work.dispose();
      }
    },
  );

  it('leaves an ordinary return and turn untouched when Frame Work has no active target', () => {
    const actual = workHandoffStudio();
    try {
      actual.world.rotate(0.9);
      actual.returning();
      const pending = actual.fixture.pendingRotation,
        returning = actual.fixture.cameraReturn,
        pose = actual.framed();
      actual.world.frameWork();
      expect(actual.framed()).toEqual(pose);
      expect(actual.fixture.pendingRotation).toBe(pending);
      expect(actual.fixture.cameraReturn).toBe(returning);
      actual.render(100);
      expect(actual.fixture.pendingRotation).toBeGreaterThan(0);
      expect(actual.fixture.pendingRotation).toBeLessThan(pending);
      expect(actual.fixture.cameraReturn).toBe(returning);
      expect(returning.t).toBeGreaterThan(0);
      actual.fixture.workView = undefined;
      const withoutWork = actual.framed(),
        remaining = actual.fixture.pendingRotation;
      actual.world.frameWork();
      expect(actual.framed()).toEqual(withoutWork);
      expect(actual.fixture.pendingRotation).toBe(remaining);
      expect(actual.fixture.cameraReturn).toBe(returning);
    } finally {
      actual.work.dispose();
    }
  });
});

describe('Work close camera motion ownership', () => {
  for (const gesture of ['orbit', 'pinch', 'button'] as const)
    for (const phase of ['queued', 'coasting'] as const)
      it('restores the Work close bookmark after ' + phase + ' ' + gesture + ' motion', () => {
        const control = workHandoffStudio();
        let actualWork: WorkPresentation | undefined;
        try {
          // Finish the reference before actual replaces studio's global performance clock.
          control.world.setWorkFocus(control.target);
          control.render(0);
          if (phase === 'coasting') control.render();
          control.world.setWorkFocus();
          const expected: ReturnType<typeof control.framed>[] = [];
          for (const dt of [0, 100, 300, 600]) {
            control.render(dt);
            expected.push(control.framed());
          }

          const actual = workHandoffStudio();
          actualWork = actual.work;
          const ordinary = actual.framed(),
            state = structuredClone(actual.fixture.state),
            nav = { ...actual.fixture.position },
            player = actual.fixture.player.position.clone();
          actual.world.setWorkFocus(actual.target);
          actual.render(0);
          const gestures = nativeGestures(actual.camera, () => !actual.fixture.paused),
            initial = actual.pose();
          if (gesture === 'button') {
            actual.world.rotate(0.9);
            expect(actual.fixture.pendingRotation).toBeGreaterThan(0);
          } else {
            gestures[gesture]();
            expect(
              gesture === 'orbit'
                ? actual.camera.movement.rotationAccumulatedPixels.lengthSquared()
                : actual.camera.movement.zoomAccumulatedPixels,
            ).toBeGreaterThan(0);
          }
          if (phase === 'coasting') {
            actual.render();
            expect(actual.pose()).not.toEqual(initial);
          }
          const time = actual.fixture.time;
          actual.world.setWorkFocus();
          expect(actual.framed()).toEqual(ordinary);
          expect(actual.fixture.time).toBe(time);
          for (const [i, dt] of [0, 100, 300, 600].entries()) {
            actual.render(dt);
            expect(actual.framed()).toEqual(expected[i]);
            expect(actual.fixture.state).toEqual(state);
            expect(actual.fixture.position).toEqual(nav);
            expect(actual.fixture.player.position.equals(player)).toBe(true);
          }
          expect(actual.fixture.pendingRotation).toBe(0);
        } finally {
          actualWork?.dispose();
          control.work.dispose();
        }
      });

  it.each([false, true])(
    'accepts a fresh ordinary camera step after Work closes with reduced motion %s',
    (reduced) => {
      const control = workHandoffStudio();
      let actualWork: WorkPresentation | undefined;
      try {
        control.fixture.reducedMotion = reduced;
        control.world.rotate(0.9);
        control.render(100);
        const expected = control.framed();

        const actual = workHandoffStudio();
        actualWork = actual.work;
        actual.fixture.reducedMotion = reduced;
        actual.world.setWorkFocus(actual.target);
        actual.render(0);
        actual.world.rotate(0.9);
        actual.world.setWorkFocus(actual.target);
        actual.world.setWorkFocus();
        actual.world.rotate(0.9);
        actual.render(100);
        expect(actual.framed()).toEqual(expected);
      } finally {
        actualWork?.dispose();
        control.work.dispose();
      }
    },
  );

  it.each(['inactive', 'absent'] as const)(
    'preserves an ordinary return and turn on an empty %s Work publication',
    (kind) => {
      const actual = workHandoffStudio();
      try {
        if (kind === 'absent') actual.fixture.workView = undefined;
        actual.world.rotate(0.9);
        actual.returning();
        const before = actual.framed(),
          pending = actual.fixture.pendingRotation,
          returning = actual.fixture.cameraReturn;
        actual.world.setWorkFocus();
        expect(actual.framed()).toEqual(before);
        expect(actual.fixture.pendingRotation).toBe(pending);
        expect(actual.fixture.cameraReturn).toBe(returning);
        actual.render(100);
        expect(actual.fixture.pendingRotation).toBeGreaterThan(0);
        expect(actual.fixture.pendingRotation).toBeLessThan(pending);
        expect(actual.fixture.cameraReturn).toBe(returning);
        expect(returning.t).toBeGreaterThan(0);
      } finally {
        actual.work.dispose();
      }
    },
  );
});

describe('keyboard camera ownership', () => {
  it('keeps active motion through resize but discards suspension time on foreground return', () => {
    const { camera, world, key, render } = studio();
    const initial = camera.alpha;
    key('keydown');
    render();
    world.refreshFrame(false);
    render();
    expect(camera.alpha).toBeCloseTo(initial + 0.16, 12);
    world.refreshFrame();
    const held = camera.alpha;
    render(60_000);
    expect(camera.alpha).toBe(held);
    render();
    expect(camera.alpha).toBeCloseTo(held + 0.08, 12);
  });

  it('keeps the Q rotation rate and stops rotating after keyup', () => {
    const { camera, key, render, context } = studio();
    const initial = camera.alpha;
    const originalContext = context();
    key('keydown');
    for (let frame = 0; frame < 10; frame++) {
      render();
      expect(context()).toEqual(originalContext);
    }
    expect(camera.alpha).toBeCloseTo(initial + 0.8, 12);
    key('keyup');
    const released = camera.alpha;
    for (let frame = 0; frame < 4; frame++) {
      render();
      expect(camera.alpha).toBe(released);
      expect(context()).toEqual(originalContext);
    }
  });

  it('rejects paused Q and accepts a fresh press after resume', () => {
    const { camera, world, keys, key, render, context } = studio();
    const originalContext = context();
    world.setPaused(true);
    const paused = camera.alpha;
    key('keydown');
    render(250);
    expect(keys.has('q')).toBe(false);
    expect(camera.alpha).toBe(paused);
    expect(context()).toEqual(originalContext);
    key('keyup');
    world.setPaused(false);
    key('keydown');
    render();
    expect(camera.alpha).toBeGreaterThan(paused);
    expect(context()).toEqual(originalContext);
  });

  it('takes over a returning camera like the existing public camera controls', () => {
    const actual = studio();
    const originalContext = actual.context();
    actual.returning();
    actual.key('keydown');
    actual.render();
    const actualFirst = actual.pose();
    expect(actual.fixture.cameraReturn).toBeUndefined();
    expect(actual.context()).toEqual(originalContext);
    actual.render();
    const actualSecond = actual.pose();
    actual.key('keyup');
    actual.render();
    expect(actual.pose()).toEqual(actualSecond);
    expect(actual.context()).toEqual(originalContext);

    // The shipped rotate button already invokes the actual transition finisher.
    // Compare identical Q events/render frames, without duplicating the easing formula.
    const control = studio();
    control.returning();
    control.world.rotate(0);
    control.key('keydown');
    control.render();
    const controlFirst = control.pose();
    control.render();
    expect(actualFirst).toEqual(controlFirst);
    expect(actualSecond).toEqual(control.pose());
    expect(control.context()).toEqual(originalContext);
  });

  it('cancels an unfinished button rotation before the first Q frame', () => {
    const actual = studio();
    const originalContext = actual.context();
    actual.world.rotate(1);
    actual.key('keydown');
    actual.render();
    const actualFirst = actual.pose();
    expect(actual.fixture.pendingRotation).toBe(0);
    expect(actual.context()).toEqual(originalContext);
    actual.key('keyup');
    actual.render();
    expect(actual.pose()).toEqual(actualFirst);

    const control = studio();
    control.key('keydown');
    control.render();
    expect(actualFirst).toEqual(control.pose());
    expect(control.context()).toEqual(originalContext);
  });

  it('waits for an elapsed simulation frame before Q claims a return', () => {
    const { fixture, key, render, returning } = studio();
    returning();
    const bookmark = fixture.cameraReturn;
    key('keydown');
    render(0);
    expect(fixture.cameraReturn).toBe(bookmark);
    render();
    expect(fixture.cameraReturn).toBeUndefined();
  });

  it('lets a return and button rotation continue without held Q', () => {
    const { fixture, world, render, returning, camera } = studio();
    returning();
    const bookmark = fixture.cameraReturn;
    const initial = camera.alpha;
    world.rotate(1);
    // Start a fresh return while the existing button step remains queued.
    returning();
    render();
    expect(fixture.cameraReturn).not.toBeUndefined();
    expect(fixture.cameraReturn).not.toBe(bookmark);
    expect(fixture.cameraReturn.t).toBeGreaterThan(0);
    expect(fixture.pendingRotation).toBeGreaterThan(0);
    expect(fixture.pendingRotation).toBeLessThan(0.3);
    expect(camera.alpha).not.toBe(initial);
  });
});

describe('reading camera ownership', () => {
  for (const gesture of ['orbit', 'pinch', 'button'] as const)
    for (const phase of ['queued', 'coasting'] as const)
      it(
        'stops ' + phase + ' ' + gesture + ' motion at the current pose when reading begins',
        () => {
          const { camera, fixture, world, render, pose, context } = studio();
          const gestures = nativeGestures(camera, () => !fixture.paused);
          const initial = pose();
          if (gesture === 'button') {
            world.rotate(1);
            expect(fixture.pendingRotation).toBeGreaterThan(0);
          } else {
            gestures[gesture]();
            expect(
              gesture === 'orbit'
                ? camera.movement.rotationAccumulatedPixels.lengthSquared()
                : camera.movement.zoomAccumulatedPixels,
            ).toBeGreaterThan(0);
          }
          if (phase === 'coasting') {
            render();
            expect(pose()).not.toEqual(initial);
          }
          const before = pose();
          const originalContext = context();
          world.setPaused(true);
          expect(pose()).toEqual(before);
          for (let frame = 0; frame < 12; frame++) {
            render(250);
            expect(pose()).toEqual(before);
            expect(context()).toEqual(originalContext);
          }
          world.setPaused(false);
          for (let frame = 0; frame < 4; frame++) {
            render();
            expect(pose()).toEqual(before);
            expect(context()).toEqual(originalContext);
          }
        },
      );

  for (const gesture of ['orbit', 'pinch'] as const)
    it('accepts a fresh native ' + gesture + ' after reading without resuming old input', () => {
      const { camera, fixture, world, render, pose, context } = studio();
      const gestures = nativeGestures(camera, () => !fixture.paused);
      gestures[gesture]();
      render();
      const before = pose();
      const originalContext = context();
      world.setPaused(true);
      gestures[gesture]();
      render(250);
      expect(pose()).toEqual(before);
      world.setPaused(false);
      render();
      expect(pose()).toEqual(before);
      gestures[gesture]();
      render();
      if (gesture === 'orbit') {
        expect(camera.alpha).not.toBe(before.alpha);
        expect(camera.beta).not.toBe(before.beta);
        expect(camera.radius).toBe(before.radius);
      } else {
        expect(camera.radius).toBeLessThan(before.radius);
        expect(camera.alpha).toBe(before.alpha);
        expect(camera.beta).toBe(before.beta);
      }
      expect(context()).toEqual(originalContext);
    });
});
