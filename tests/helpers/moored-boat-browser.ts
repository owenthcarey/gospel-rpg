import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Viewport } from '@babylonjs/core/Maths/math.viewport.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import { campaignLayout } from '../../src/content/campaign/layouts';
import type { Point } from '../../src/game/types';
import type { Berth } from '../../src/game/lake/types';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export interface NativeCameraControl {
  name: string;
  count: number;
  enabled: boolean;
  rendered: boolean;
  exposed: boolean;
  inViewport: boolean;
  point: { x: number; y: number };
}

interface NativeCameraDiagnostics {
  initial: NativeCameraControl[];
  startedAt: number;
  endedAt: number;
  pageTimeOrigin: number;
  frames: number[];
  longTasksSupported: boolean;
  longTasks: { startTime: number; duration: number; name: string }[];
  events: {
    type: string;
    trusted: boolean;
    pointerType: string;
    at: number;
    x: number;
    y: number;
    name: string | null;
    control: NativeCameraControl | null;
  }[];
}

declare global {
  interface Window {
    mooredCameraObservation?: { finish: () => NativeCameraDiagnostics };
  }
}

/** Observe real controls at native dispatch; cached coordinates alone never establish ownership. */
export function armNativeCameraControls(names: string[]): NativeCameraControl[] {
  if (window.mooredCameraObservation)
    throw new Error('A native camera observation is already active');
  const measure = (name: string, contact?: { x: number; y: number }): NativeCameraControl => {
    const matches = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')].filter(
      (button) => button.getAttribute('aria-label') === name,
    );
    const button = matches.length === 1 ? matches[0] : undefined;
    const rect = button?.getBoundingClientRect();
    const point = contact ?? {
      x: rect ? rect.left + rect.width / 2 : NaN,
      y: rect ? rect.top + rect.height / 2 : NaN,
    };
    const surface = [point.x, point.y].every(Number.isFinite)
      ? document.elementFromPoint(point.x, point.y)
      : null;
    const style = button && getComputedStyle(button);
    return {
      name,
      count: matches.length,
      enabled: !!button && !button.disabled && !button.closest('[inert]'),
      rendered:
        !!button?.isConnected &&
        !!rect &&
        [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) &&
        rect.width > 0 &&
        rect.height > 0 &&
        style?.display !== 'none' &&
        style?.visibility === 'visible',
      exposed: !!button && (surface === button || (!!surface && button.contains(surface))),
      inViewport: point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight,
      point,
    };
  };
  const initial = names.map((name) => measure(name));
  const startedAt = performance.now();
  const events: NativeCameraDiagnostics['events'] = [];
  const frames: number[] = [];
  const longTasks: NativeCameraDiagnostics['longTasks'] = [];
  const longTasksSupported =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes.includes('longtask');
  const tasks = longTasksSupported
    ? new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (entry.startTime >= startedAt)
            longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              name: entry.name,
            });
      })
    : undefined;
  tasks?.observe({ type: 'longtask' });
  let frame = 0;
  let running = true;
  const painted = () => {
    frames.push(performance.now());
    if (running) frame = requestAnimationFrame(painted);
  };
  frame = requestAnimationFrame(painted);
  const record = (event: PointerEvent) => {
    const button =
      event.target instanceof Element ? event.target.closest('button[aria-label]') : null;
    const name = button?.getAttribute('aria-label') ?? null;
    events.push({
      type: event.type,
      trusted: event.isTrusted,
      pointerType: event.pointerType,
      at: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
      name,
      control: name ? measure(name, { x: event.clientX, y: event.clientY }) : null,
    });
  };
  for (const type of ['pointerdown', 'pointerup', 'click'] as const)
    window.addEventListener(type, record, { capture: true, passive: true });
  window.mooredCameraObservation = {
    finish: () => {
      running = false;
      cancelAnimationFrame(frame);
      for (const type of ['pointerdown', 'pointerup', 'click'] as const)
        window.removeEventListener(type, record, true);
      for (const entry of tasks?.takeRecords() ?? [])
        if (entry.startTime >= startedAt)
          longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          });
      tasks?.disconnect();
      delete window.mooredCameraObservation;
      return {
        initial,
        startedAt,
        endedAt: performance.now(),
        pageTimeOrigin: performance.timeOrigin,
        frames,
        longTasksSupported,
        longTasks,
        events,
      };
    },
  };
  return initial;
}

/** Preserve all five driver-native commands while avoiding a separate read before each press. */
export async function nativeHullCamera(
  page: Page,
  touch: boolean,
  info: TestInfo,
  name: string,
  input: (press: (name: string) => Promise<void>) => Promise<void>,
) {
  const initial = await page.evaluate(armNativeCameraControls, [
    'Reset camera',
    'Face north',
    'Zoom in',
  ]);
  const driver: {
    name: string;
    point: { x: number; y: number };
    requestedAt: number;
    completedAt?: number;
  }[] = [];
  let result: NativeCameraDiagnostics | undefined;
  let failure: unknown;
  let failed = false;
  try {
    for (const control of initial)
      expect(control, name + ' initial ' + control.name).toMatchObject({
        count: 1,
        enabled: true,
        rendered: true,
        exposed: true,
        inViewport: true,
      });
    await input(async (name) => {
      const control = initial.find((control) => control.name === name);
      if (!control) throw new Error('Unobserved native camera command: ' + name);
      const dispatch = {
        name,
        point: control.point,
        requestedAt: Date.now(),
        completedAt: undefined as number | undefined,
      };
      driver.push(dispatch);
      if (touch) await page.touchscreen.tap(control.point.x, control.point.y);
      else await page.mouse.click(control.point.x, control.point.y);
      dispatch.completedAt = Date.now();
    });
  } catch (error) {
    failed = true;
    failure = error;
  }
  let diagnosticError: unknown;
  try {
    result = await page.evaluate(() => {
      if (!window.mooredCameraObservation) throw new Error('Missing native camera observation');
      return window.mooredCameraObservation.finish();
    });
  } catch (error) {
    diagnosticError = error;
  }
  let deliveryError: unknown;
  try {
    await writeFile(
      info.outputPath(name + '-native-camera.json'),
      JSON.stringify(
        {
          name,
          touch,
          driverWallClock: 'Unix milliseconds; separate from browser monotonic timestamps',
          driver,
          ...result,
          inputFailure: failed ? String(failure) : null,
          diagnosticFailure: diagnosticError ? String(diagnosticError) : null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    deliveryError = error;
  }
  if (failed) throw failure;
  if (diagnosticError) throw diagnosticError;
  if (deliveryError) throw deliveryError;
  if (!result) throw new Error(name + ' has no native camera evidence');
  const commands = ['Reset camera', 'Face north', 'Zoom in', 'Zoom in', 'Zoom in'];
  expect(driver.map((dispatch) => dispatch.name)).toEqual(commands);
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    const events = result.events.filter((event) => event.type === type);
    expect(
      events.map((event) => event.name),
      name + ' native ' + type + ' sequence',
    ).toEqual(commands);
    for (const [index, event] of events.entries()) {
      expect(event.trusted, name + ' trusted ' + type).toBe(true);
      expect(event.pointerType).toBe(touch ? 'touch' : 'mouse');
      expect(event.control, name + ' live ' + commands[index]).toMatchObject({
        name: commands[index],
        count: 1,
        enabled: true,
        rendered: true,
        exposed: true,
        inViewport: true,
      });
      expect(Math.abs(event.x - driver[index]!.point.x)).toBeLessThan(1);
      expect(Math.abs(event.y - driver[index]!.point.y)).toBeLessThan(1);
    }
  }
  return { ...result, driver };
}

/** Observe one named native model contact, independently of later normal menu actions. */
export async function nativeHullInput(
  page: Page,
  point: { x: number; y: number },
  touch: boolean,
  hold: boolean,
  info: TestInfo,
  name: string,
  input: () => Promise<void>,
) {
  const audit = await page.evaluateHandle((point) => {
    const describe = (target: EventTarget | null) => {
      const node = target instanceof Element ? target : null,
        menu = node?.closest<HTMLElement>('[role="menu"][aria-label="Choose Option"]');
      return {
        tag: node?.tagName ?? null,
        id: node?.id ?? null,
        labelValue: node?.closest<HTMLElement>('.world-label')?.dataset.value ?? null,
        optionMenuName: menu?.getAttribute('aria-label') ?? null,
        optionMenuVisible: !!menu && !menu.hidden && menu.getClientRects().length > 0,
      };
    };
    const events: {
      type: string;
      trusted: boolean;
      pointerType: string;
      x: number;
      y: number;
      time: number;
      target: ReturnType<typeof describe>;
    }[] = [];
    const record = (event: PointerEvent) =>
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        target: describe(event.target),
      });
    window.addEventListener('pointerdown', record, { capture: true, passive: true });
    window.addEventListener('pointerup', record, { capture: true, passive: true });
    return {
      preContact: describe(document.elementFromPoint(point.x, point.y)),
      playerTransform: document.querySelector('#minimap-player')?.getAttribute('transform') ?? null,
      events,
      cleanup: () => {
        window.removeEventListener('pointerdown', record, true);
        window.removeEventListener('pointerup', record, true);
      },
    };
  }, point);
  let result:
    | {
        preContact: Awaited<ReturnType<typeof audit.jsonValue>>['preContact'];
        playerTransform: Awaited<ReturnType<typeof audit.jsonValue>>['playerTransform'];
        events: Awaited<ReturnType<typeof audit.jsonValue>>['events'];
      }
    | undefined;
  let inputFailed = false;
  let inputError: unknown;
  const diagnosticErrors: { phase: string; error: unknown }[] = [];
  const describeError = (error: unknown) =>
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: String(error) };
  try {
    await input();
  } catch (error) {
    inputFailed = true;
    inputError = error;
  }
  try {
    result = await audit.evaluate((value) => {
      try {
        return {
          preContact: value.preContact,
          playerTransform: value.playerTransform,
          events: value.events,
        };
      } finally {
        value.cleanup();
      }
    });
  } catch (error) {
    diagnosticErrors.push({ phase: 'audit-read-and-listener-cleanup', error });
  } finally {
    try {
      await audit.dispose();
    } catch (error) {
      diagnosticErrors.push({ phase: 'handle-disposal', error });
    }
  }
  try {
    await writeFile(
      info.outputPath(name + '-native-pointer.json'),
      JSON.stringify(
        {
          name,
          point,
          touch,
          hold,
          ...result,
          ...(inputFailed || diagnosticErrors.length
            ? {
                evidenceAvailable: result !== undefined,
                inputFailure: inputFailed ? describeError(inputError) : null,
                diagnosticErrors: diagnosticErrors.map(({ phase, error }) => ({
                  phase,
                  ...describeError(error),
                })),
              }
            : {}),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    diagnosticErrors.push({ phase: 'evidence-delivery', error });
  }
  if (inputFailed) throw inputError;
  const diagnosticError = diagnosticErrors[0];
  if (diagnosticError) throw diagnosticError.error;
  if (!result) throw new Error(name + ' has no native pointer evidence');
  expect(result.preContact.id, name + ' begins on bare canvas').toBe('game-canvas');
  const down = result.events.filter((event) => event.type === 'pointerdown'),
    up = result.events.filter((event) => event.type === 'pointerup');
  expect(down, name + ' has exactly one native press').toHaveLength(1);
  expect(up, name + ' has exactly one native release').toHaveLength(1);
  for (const event of result.events) {
    expect(event.trusted, name + ' is trusted').toBe(true);
    expect(event.pointerType).toBe(touch ? 'touch' : 'mouse');
    expect(Math.abs(event.x - point.x), name + ' actual X').toBeLessThan(1);
    expect(Math.abs(event.y - point.y), name + ' actual Y').toBeLessThan(1);
    expect(event.target.labelValue, name + ' never uses a world label').toBeNull();
  }
  expect(down[0]!.target).toMatchObject({ tag: 'CANVAS', id: 'game-canvas' });
  expect(
    up[0]!.target.id === 'game-canvas' ||
      (touch &&
        hold &&
        up[0]!.target.optionMenuName === 'Choose Option' &&
        up[0]!.target.optionMenuVisible),
    name + ' only a phone hold may release into the visible options menu',
  ).toBe(true);
  if (touch && hold) expect(up[0]!.time - down[0]!.time).toBeGreaterThan(500);
  return { name, point, touch, hold, ...result };
}

/** Actual imported first visible hull triangles, entirely outside the application page. */
export async function hullFaces(
  berth: Berth,
  standing: Point,
  width: number,
  height: number,
  bearingDegrees: number,
  zoomClicks: number,
) {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const bytes = await readFile('public/assets/models/boat.glb');
    const container = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
      pluginExtension: '.glb',
      pluginOptions: { gltf: { skipMaterials: true } },
    });
    const instance = container.instantiateModelsToScene((name) => 'moored-before:' + name, false, {
      doNotInstantiate: true,
    });
    const root = new TransformNode('moored-before', scene);
    for (const node of instance.rootNodes) node.parent = root;
    const placement = {
      x: berth === 'capernaum' ? 10 : 0,
      y: -0.03,
      z: berth === 'capernaum' ? -4 : -10,
    };
    root.position.set(placement.x, placement.y, placement.z);
    root.computeWorldMatrix(true);
    for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
    const material = new StandardMaterial('moored-before:finite-triangles', scene);
    material.backFaceCulling = false;
    const meshes = root.getChildMeshes().filter((mesh) => mesh.getTotalVertices());
    for (const mesh of meshes) {
      mesh.material = material;
      mesh.computeWorldMatrix(true);
    }
    const triangles = meshes.flatMap((mesh) => {
      const matrix = mesh.computeWorldMatrix(true),
        data = mesh.getPositionData(false)!,
        positions = Array.from({ length: data.length / 3 }, (_, i) =>
          Vector3.TransformCoordinates(Vector3.FromArray(data, i * 3), matrix),
        ),
        indices = mesh.getIndices()!;
      return Array.from({ length: indices.length / 3 }, (_, i) => ({
        face: i,
        mesh: mesh.name,
        vertices: [
          positions[indices[i * 3]!]!,
          positions[indices[i * 3 + 1]!]!,
          positions[indices[i * 3 + 2]!]!,
        ],
      }));
    });
    const layout = campaignLayout(berth),
      aspectScale = layout ? Math.max(1, 0.9 / (width / height)) : 1;
    const radius = Math.max(
        (layout?.camera.min ?? 16) * aspectScale,
        (layout?.camera.radius ?? 33) * aspectScale - zoomClicks * 3,
      ),
      beta = layout?.camera.beta ?? 0.78,
      alpha = -Math.PI / 2 + (bearingDegrees * Math.PI) / 180;
    const reach = layout ? layout.bounds.max - 9 : Infinity;
    const target = layout
      ? new Vector3(
          Math.max(-reach, Math.min(reach, standing.x)),
          0,
          Math.max(-reach + 1, Math.min(reach + 1, standing.z + layout.camera.targetOffset * 2)),
        )
      : new Vector3(standing.x, 0, standing.z + 2);
    const camera = target.add(
      new Vector3(
        Math.cos(alpha) * Math.sin(beta) * radius,
        Math.cos(beta) * radius,
        Math.sin(alpha) * Math.sin(beta) * radius,
      ),
    );
    const matrix = Matrix.LookAtLH(camera, target, Vector3.Up()).multiply(
      Matrix.PerspectiveFovLH(0.7, width / height, 0.2, 220),
    );
    const project = (point: Vector3) =>
      Vector3.Project(point, Matrix.Identity(), matrix, new Viewport(0, 0, width, height));
    const candidates = triangles
      .flatMap((triangle) => {
        const center = triangle.vertices[0]!.add(triangle.vertices[1]!)
            .add(triangle.vertices[2]!)
            .scale(1 / 3),
          length = Vector3.Distance(camera, center);
        const ray = new Ray(camera, center.subtract(camera).normalize(), length + 0.001),
          first = meshes
            .map((mesh) => ray.intersectsMesh(mesh, false))
            .filter((hit) => hit.hit && hit.pickedPoint && hit.faceId >= 0)
            .sort((a, b) => a.distance - b.distance)[0];
        if (!first?.pickedPoint || Vector3.Distance(first.pickedPoint, center) > 0.001) return [];
        const p = project(center),
          v = triangle.vertices.map(project),
          area =
            Math.abs(
              (v[1]!.x - v[0]!.x) * (v[2]!.y - v[0]!.y) - (v[2]!.x - v[0]!.x) * (v[1]!.y - v[0]!.y),
            ) / 2;
        return p.z > 0 &&
          p.z < 1 &&
          p.x > 8 &&
          p.x < width - 8 &&
          p.y > 8 &&
          p.y < height - 8 &&
          area >= 2
          ? [
              {
                x: p.x,
                y: p.y,
                area,
                face: triangle.face,
                mesh: triangle.mesh,
                world: center.asArray(),
                firstPickedPoint: first.pickedPoint.asArray(),
                firstFace: first.faceId,
              },
            ]
          : [];
      })
      .sort((a, b) => b.area - a.area)
      .slice(0, 18);
    return {
      assetSha256: hash(bytes),
      placement,
      triangleCount: triangles.length,
      camera: {
        target: target.asArray(),
        position: camera.asArray(),
        alpha,
        beta,
        radius,
        zoomClicks,
        bearingDegrees,
        aspectScale,
        width,
        height,
      },
      candidates,
    };
  } finally {
    engine.dispose();
  }
}
export async function fourAnimationFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const next = () => {
          if (++frames === 4) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
  );
}

/** Read all post-hold ownership predicates in one actual DOM sample. */
export function measureHullOptions({ boatName }: { boatName: string }) {
  const one = (selector: string) => {
    const nodes = document.querySelectorAll(selector);
    return nodes.length === 1 ? nodes[0] : undefined;
  };
  const visible = (node?: Element) => {
    if (!node?.isConnected) return false;
    const box = node.getBoundingClientRect();
    const visibility = getComputedStyle(node).visibility;
    return (
      [box.left, box.top, box.width, box.height].every(Number.isFinite) &&
      box.width > 0 &&
      box.height > 0 &&
      visibility !== 'hidden' &&
      visibility !== 'collapse'
    );
  };
  const menu = one('[role="menu"][aria-label="Choose Option"]');
  const player = one('#minimap-player');
  const destination = one('.minimap-destination');
  const namedOption = (name: string) => {
    const nodes = [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].filter(
      (node) => node.textContent?.trim() === name,
    );
    return nodes.length === 1 ? nodes[0] : undefined;
  };
  const visit = namedOption('Visit ' + boatName);
  const examine = namedOption('Examine ' + boatName);
  const exposed = (node?: Element) => {
    if (!(node instanceof HTMLButtonElement) || node.disabled || node.closest('[inert]'))
      return false;
    const box = node.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const topmost = document.elementFromPoint(x, y);
    return (
      visible(node) &&
      x > 0 &&
      x < innerWidth &&
      y > 0 &&
      y < innerHeight &&
      (topmost === node || (!!topmost && node.contains(topmost)))
    );
  };
  const playerTransform = player?.getAttribute('transform') ?? null;
  const coordinates = playerTransform?.match(/^translate\(([^,]+),([^)]*)\)$/);
  const validTransform =
    !!coordinates &&
    coordinates.slice(1).every((value) => value.trim() !== '' && Number.isFinite(Number(value)));
  return {
    valid: !!menu && !!player && !!destination && !!visit && !!examine && validTransform,
    menuVisible: visible(menu),
    dialogHidden: [...document.querySelectorAll('[role="dialog"]')].every((node) => !visible(node)),
    destinationHidden: !!destination && !visible(destination),
    playerTransform,
    visitVisible: visible(visit),
    examineVisible: visible(examine),
    menuOwnsFocus: !!menu && !!document.activeElement && menu.contains(document.activeElement),
    optionsExposed: exposed(visit) && exposed(examine),
  };
}

export async function observeHullOptions(
  page: Page,
  boatName: string,
  standing: string,
  budgetMs: number,
) {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0 || budgetMs > 60_000)
    throw new Error('Hull option observation requires the unchanged explicit expect budget');
  let observation: ReturnType<typeof measureHullOptions> | undefined;
  await expect
    .poll(
      async () => {
        observation = await page.evaluate(measureHullOptions, { boatName });
        return observation;
      },
      {
        timeout: budgetMs,
        message: 'native hull options retain their visible menu and shore ownership',
      },
    )
    .toEqual({
      valid: true,
      menuVisible: true,
      dialogHidden: true,
      destinationHidden: true,
      playerTransform: standing,
      visitVisible: true,
      examineVisible: true,
      menuOwnsFocus: true,
      optionsExposed: true,
    });
  return observation!;
}

/** Passive projection measurements after the original native camera and visibility checks. */
export async function observeHullProjection(page: Page, berth: Berth, budgetMs: number) {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0 || budgetMs > 60_000)
    throw new Error('Hull observation requires the unchanged explicit expect budget');
  return page.evaluate(
    ({ labelId, budgetMs }) =>
      new Promise<{
        rect: { x: number; y: number; width: number; height: number };
        bearing: number;
        labelSamples: {
          x: number;
          y: number;
          width: number;
          height: number;
          at: number;
          change: number | null;
        }[];
        frameCount: number;
        budgetMs: number;
        elapsedMs: number;
      }>((resolve, reject) => {
        const labelSamples: {
          x: number;
          y: number;
          width: number;
          height: number;
          at: number;
          change: number | null;
        }[] = [];
        const intervals = [100, 250, 500, 1000];
        const startedAt = performance.now();
        let previous: { x: number; y: number } | undefined;
        let intervalIndex = 0;
        let sampleTimer: number | undefined;
        let deadlineTimer: number | undefined;
        let frame: number | undefined;
        let frameCount = 0;
        let finished = false;
        const cleanup = () => {
          if (sampleTimer !== undefined) window.clearTimeout(sampleTimer);
          if (deadlineTimer !== undefined) window.clearTimeout(deadlineTimer);
          if (frame !== undefined) cancelAnimationFrame(frame);
          sampleTimer = deadlineTimer = frame = undefined;
        };
        const fail = (error: unknown) => {
          if (finished) return;
          finished = true;
          cleanup();
          reject(error);
        };
        const expired = () => {
          if (performance.now() - startedAt < budgetMs) return false;
          fail(new Error(`Hull label projection observation exceeded ${budgetMs}ms`));
          return true;
        };
        const unique = <T extends Element>(selector: string): T => {
          const matches = document.querySelectorAll<T>(selector);
          if (matches.length !== 1)
            throw new Error(
              `Expected one hull observation target ${selector}; found ${matches.length}`,
            );
          return matches[0]!;
        };
        const measureProjection = () => {
          if (finished || expired()) return;
          try {
            const canvas = unique<HTMLCanvasElement>('#game-canvas');
            const minimap = unique<HTMLElement>('.minimap-wrap');
            const box = canvas.getBoundingClientRect();
            const bearing = parseFloat(minimap.style.getPropertyValue('--map-bearing'));
            if (
              !canvas.isConnected ||
              ![box.left, box.top, box.width, box.height, bearing].every(Number.isFinite) ||
              box.width <= 0 ||
              box.height <= 0
            )
              throw new Error('Hull projection has no actual finite canvas geometry or bearing');
            finished = true;
            cleanup();
            resolve({
              rect: { x: box.left, y: box.top, width: box.width, height: box.height },
              bearing,
              labelSamples,
              frameCount,
              budgetMs,
              elapsedMs: performance.now() - startedAt,
            });
          } catch (error) {
            fail(error);
          }
        };
        const nextFrame = () => {
          frame = undefined;
          if (finished || expired()) return;
          try {
            if (++frameCount === 4) measureProjection();
            else frame = requestAnimationFrame(nextFrame);
          } catch (error) {
            fail(error);
          }
        };
        const sample = () => {
          sampleTimer = undefined;
          if (finished || expired()) return;
          try {
            const label = unique<HTMLElement>(`.world-label[data-value="${labelId}"]`);
            const box = label.getBoundingClientRect();
            const visibility = getComputedStyle(label).visibility;
            if (
              !label.isConnected ||
              ![box.left, box.top, box.width, box.height].every(Number.isFinite) ||
              box.width <= 0 ||
              box.height <= 0 ||
              visibility === 'hidden' ||
              visibility === 'collapse'
            )
              throw new Error(
                'Hull label has no actual visible geometry after its visibility assertion',
              );
            const point = { x: box.left, y: box.top };
            const change = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : null;
            labelSamples.push({
              ...point,
              width: box.width,
              height: box.height,
              at: performance.now(),
              change,
            });
            previous = point;
            if (change !== null && change < 0.05) {
              frame = requestAnimationFrame(nextFrame);
            } else {
              const interval = intervals[Math.min(intervalIndex++, intervals.length - 1)]!;
              sampleTimer = window.setTimeout(sample, interval);
            }
          } catch (error) {
            fail(error);
          }
        };
        deadlineTimer = window.setTimeout(
          () => fail(new Error(`Hull label projection observation exceeded ${budgetMs}ms`)),
          budgetMs,
        );
        sample();
      }),
    { labelId: 'board-' + berth, budgetMs },
  );
}
