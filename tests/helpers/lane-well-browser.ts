import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
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
import { neighborhoodPlaces } from '../../src/content/campaign/places';
import { parseSave } from '../../src/persistence/schema';
import { transition } from '../../src/game/quest';
import { distance } from '../../src/game/pathfinding';
import type { Point } from '../../src/game/types';
import { dismiss, exported, settled } from './connection-browser';
import { wellLabelError } from './well-label-placement';
import { revealCameraControls } from './camera-browser';

export const wellFixture = 'tests/fixtures/saves/v7-beyond-capernaum.json';
export const well = neighborhoodPlaces['capernaum-lanes'].find((p) => p.id === 'water-point')!;
export const activateWellControl = (control: Locator, touch: boolean) =>
  touch ? control.tap() : control.click();
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Browser callback turns settle DOM input; they are not a count of 3D scene renders.
export async function animationCallbacks(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function nativeVisit(page: Page, id: string, touch: boolean) {
  await dismiss(page);
  await activateWellControl(page.locator('.toolbar [data-action="map"]'), touch);
  await activateWellControl(page.locator(`.map-destinations [data-value="${id}"]`), touch);
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 });
  await settled(page);
}

async function radarPoint(page: Page, min: number, max: number): Promise<Point> {
  const transform = (await page.locator('#minimap-player').getAttribute('transform'))!;
  const [, x, y] = transform.match(/translate\(([^,]+),([^)]*)\)/)!;
  const scale = 192 / (max - min);
  return { x: Number(x) / scale + min, z: max - Number(y) / scale };
}

export async function approachLaneWell(page: Page, touch: boolean, info: TestInfo) {
  const bytes = await readFile(wellFixture),
    original = parseSave(JSON.parse(bytes.toString('utf8'))).state;
  // The native phone model contacts were proved at this narrow canonical size.
  if (touch) await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await activateWellControl(
    page.getByRole('button', { name: 'Saves & settings', exact: true }),
    touch,
  );
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('#import-save').setInputFiles(wellFixture);
  await settled(page);
  const imported = await exported(page);
  expect(imported).toEqual({ ...original, playTime: imported.playTime });
  await dismiss(page);

  // Setup uses real Map/door controls, never claims those are model contacts.
  await nativeVisit(page, 'house-exit', touch);
  const houseStanding = await radarPoint(page, -8, 8);
  expect(distance(houseStanding, { x: 0, z: -6 })).toBeLessThan(2.35);
  let expected = transition(imported, { type: 'route-select', target: 'house-exit' });
  expected.position = { ...houseStanding };
  expected = transition(expected, { type: 'route-arrive', target: 'house-exit' });
  await activateWellControl(
    page.locator('[data-action="journey"][data-value="house-exit"]'),
    touch,
  );
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'capernaum-lanes');
  await settled(page);
  expected = transition(expected, { type: 'journey', gateway: 'house-exit' });
  const entered = await exported(page);
  expect(entered).toEqual({ ...expected, playTime: entered.playTime });
  await dismiss(page);

  await nativeVisit(page, well.id, touch);
  await expect(page.getByRole('heading', { name: well.name, exact: true })).toBeVisible();
  const wellReading = await page.locator('.panel-body').innerText();
  const standing = await radarPoint(page, -16, 16);
  expect(distance(standing, well)).toBeLessThan(2.35);
  expected = transition(entered, { type: 'route-select', target: well.id });
  expected.position = { ...standing };
  expected = transition(expected, { type: 'route-arrive', target: well.id });
  const approached = await exported(page);
  expect(approached).toEqual({ ...expected, playTime: approached.playTime });
  await dismiss(page);
  await writeFile(
    info.outputPath('legal-well-approach.json'),
    JSON.stringify(
      {
        fixture: wellFixture,
        fixtureSha256: hash(bytes),
        original,
        imported,
        houseStanding,
        entered,
        standing,
        approached,
        expected,
        wellReading,
        setupUsesModelInput: false,
        served: await page.evaluate(() => ({
          scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(
            (n) => n.src,
          ),
          styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
            (n) => n.href,
          ),
        })),
      },
      null,
      2,
    ),
  );
  return { bytes, original, approached };
}

export async function visibleLaneWell(
  page: Page,
  standing: Point,
  touch: boolean,
  info: TestInfo,
  name: string,
) {
  await expect(page.locator('#toast')).toBeHidden();
  await revealCameraControls(page, touch);
  await activateWellControl(page.getByRole('button', { name: 'Reset camera', exact: true }), touch);
  await activateWellControl(page.getByRole('button', { name: 'Face north', exact: true }), touch);
  await expect
    .poll(() =>
      page
        .locator('.minimap-wrap')
        .evaluate((node) =>
          Math.abs(parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing'))),
        ),
    )
    .toBeLessThan(0.04);
  // The original north/5-zoom phone view left every centroid behind labels.
  // Real right rotation exposes a different side; no HUD/label styling is changed.
  const rightClicks = touch ? 3 : 0;
  for (let i = 0; i < rightClicks; i++)
    await activateWellControl(
      page.getByRole('button', { name: 'Rotate camera right', exact: true }),
      touch,
    );
  if (touch)
    await expect
      .poll(() =>
        page
          .locator('.minimap-wrap')
          .evaluate((node) =>
            parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing')),
          ),
      )
      .toBeCloseTo((-0.9 * 0.3 * rightClicks * 180) / Math.PI, 2);
  const zoomClicks = touch ? 7 : 5;
  for (let i = 0; i < zoomClicks; i++)
    await activateWellControl(page.getByRole('button', { name: 'Zoom in', exact: true }), touch);
  const rect = (await page.locator('#game-canvas').boundingBox())!,
    bearing = await page
      .locator('.minimap-wrap')
      .evaluate((node) =>
        parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing')),
      ),
    geometry = await wellFaces(standing, rect.width, rect.height, bearing, zoomClicks, touch);
  const label = page.locator(`.world-label[data-value="${well.id}"]`);
  let previous: string | undefined;
  let labelReading:
    | {
        transform: string;
        hidden: boolean;
        width: number;
        x: number;
        y: number;
        error: number;
        stable: boolean;
        placement: ReturnType<typeof wellLabelError>;
      }
    | undefined;
  await expect
    .poll(
      async () => {
        const observed = await label.evaluate((node) => {
          const element = node as HTMLElement;
          const [, x, y] = element.style.transform.match(/translate\(([^,]+)px,([^)]*)px\)/) ?? [];
          const box = (value: Element) => {
            const r = value.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          };
          const ui = document.querySelector<HTMLElement>('#ui');
          const hud = document.querySelector<HTMLElement>('#hud');
          const canvas = document.querySelector('#game-canvas');
          const notice = document.querySelector<HTMLElement>('#toast');
          const nearest = document.querySelector<HTMLElement>('#nearby-action');
          const uiRect = ui?.getBoundingClientRect();
          const canvasRect = canvas?.getBoundingClientRect();
          return {
            transform: element.style.transform,
            hidden: Boolean(element.hidden),
            width: element.offsetWidth,
            height: element.offsetHeight,
            x: Number(x),
            y: Number(y),
            basis: {
              labels: [...document.querySelectorAll<HTMLElement>('#world-labels .world-label')].map(
                (label) => ({
                  id: label.dataset.value ?? null,
                  person: label.classList.contains('person'),
                  place: label.classList.contains('place'),
                  object: label.classList.contains('object'),
                  selected: label.classList.contains('selected-destination'),
                  target: label.classList.contains('quest-target'),
                  hovered: label.matches(':hover'),
                  focused: label === document.activeElement,
                }),
              ),
              nearest: nearest
                ? {
                    text: [...nearest.childNodes]
                      .filter((child) => child.nodeType === Node.TEXT_NODE)
                      .map((child) => child.textContent ?? '')
                      .join('')
                      .trim(),
                    action: nearest.dataset.action ?? null,
                    hidden: Boolean(nearest.hidden),
                  }
                : null,
              ui:
                ui && uiRect
                  ? { x: uiRect.x, y: uiRect.y, width: ui.clientWidth, height: ui.clientHeight }
                  : null,
              canvas: canvasRect
                ? {
                    x: canvasRect.x,
                    y: canvasRect.y,
                    width: canvasRect.width,
                    height: canvasRect.height,
                  }
                : null,
              reserved:
                hud && notice
                  ? [
                      ...[
                        ...hud.querySelectorAll<HTMLElement>(
                          '.topbar,.quest-card,.minimap-wrap,.minimap-compass,.minimap-open,.bottom-center,.traveler-card',
                        ),
                      ]
                        .filter((node) => node.offsetHeight > 0)
                        .map(box),
                      ...(!notice.hidden && notice.offsetHeight > 0 ? [box(notice)] : []),
                    ]
                  : null,
            },
          };
        });
        const placement = wellLabelError(observed, geometry.projectedLabel, rect);
        const error = placement.error;
        const stable = previous === observed.transform;
        labelReading = { ...observed, error, stable, placement };
        previous = observed.transform;
        return { converged: error < 0.2, stable };
      },
      { message: 'Post-scene label projection must converge to the selected native camera' },
    )
    .toEqual({ converged: true, stable: true });
  const surfaces = await page.evaluate(
    (points) =>
      points.map((point) => {
        const element = document.elementFromPoint(point.x, point.y);
        return {
          point,
          tag: element?.tagName ?? null,
          id: element?.id ?? null,
          className: element?.getAttribute('class') ?? null,
          label: element?.closest<HTMLElement>('.world-label')?.dataset.value ?? null,
          action: element?.closest<HTMLElement>('[data-action]')?.dataset.action ?? null,
        };
      }),
    geometry.candidates.map((chosen) => ({ x: chosen.x + rect.x, y: chosen.y + rect.y })),
  );
  await writeFile(
    info.outputPath(name + '-native-surface-probes.json'),
    JSON.stringify(
      {
        cameraControls: {
          reset: 1,
          faceNorth: 1,
          rotateRight: rightClicks,
          zoomIn: zoomClicks,
          input: touch ? 'native touch' : 'native mouse',
        },
        surfaces,
        labelReading,
      },
      null,
      2,
    ),
  );
  for (const [index, chosen] of geometry.candidates.entries()) {
    const point = { x: chosen.x + rect.x, y: chosen.y + rect.y };
    if (surfaces[index]!.id === 'game-canvas') {
      await writeFile(
        info.outputPath(name + '-finite-face.json'),
        JSON.stringify(
          { point, chosen, geometry, rect, labelReading, labelOffsets: [0, -28, 28, -56, 56] },
          null,
          2,
        ),
      );
      await page.screenshot({ path: info.outputPath(name + '-before-contact.png'), scale: 'css' });
      return { point, chosen, geometry, rect, labelReading };
    }
  }
  await writeFile(info.outputPath(name + '-no-face.json'), JSON.stringify(geometry, null, 2));
  throw new Error('No finite first-hit well face has a bare-canvas contact');
}

export async function openWellOptions(
  page: Page,
  touch: boolean,
  info: TestInfo,
  name: string,
  standing: Point,
) {
  const calibration = await visibleLaneWell(page, standing, touch, info, name),
    menu = page.getByRole('menu', { name: 'Choose Option', exact: true }),
    session = touch ? await page.context().newCDPSession(page) : undefined;
  try {
    const input = await nativeWellInput(
      page,
      calibration.point,
      touch,
      touch,
      touch ? 0 : 2,
      info,
      name,
      async () => {
        if (session) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ id: 1, ...calibration.point }],
          });
          try {
            await expect(menu).toBeVisible();
          } finally {
            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          }
        } else
          await page.mouse.click(calibration.point.x, calibration.point.y, { button: 'right' });
      },
    );
    await animationCallbacks(page);
    await expect(menu).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('.minimap-destination')).toBeHidden();
    expect(distance(await radarPoint(page, -16, 16), standing)).toBeLessThan(0.01);
    const options = await menu.getByRole('menuitem').allTextContents();
    await page.screenshot({ path: info.outputPath(name + '-settled-options.png'), scale: 'css' });
    return { calibration, input, options };
  } finally {
    await session?.detach();
  }
}

/** Observe one named native model contact, independently of later normal menu actions. */
export async function nativeWellInput(
  page: Page,
  point: { x: number; y: number },
  touch: boolean,
  hold: boolean,
  expectedButton: 0 | 2,
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
      button: number;
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
        button: event.button,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        target: describe(event.target),
      });
    window.addEventListener('pointerdown', record, { capture: true, passive: true });
    window.addEventListener('pointerup', record, { capture: true, passive: true });
    return {
      preContact: describe(document.elementFromPoint(point.x, point.y)),
      events,
      cleanup: () => {
        window.removeEventListener('pointerdown', record, true);
        window.removeEventListener('pointerup', record, true);
      },
    };
  }, point);
  let result: {
    preContact: Awaited<ReturnType<typeof audit.jsonValue>>['preContact'];
    events: Awaited<ReturnType<typeof audit.jsonValue>>['events'];
  };
  try {
    await input();
  } finally {
    try {
      result = await audit.evaluate((value) => ({
        preContact: value.preContact,
        events: value.events,
      }));
      await writeFile(
        info.outputPath(name + '-native-pointer.json'),
        JSON.stringify({ name, point, touch, hold, ...result }, null, 2),
      );
    } finally {
      try {
        await audit.evaluate((value) => value.cleanup());
      } finally {
        await audit.dispose();
      }
    }
  }
  expect(result.preContact.id, name + ' begins on bare canvas').toBe('game-canvas');
  const down = result.events.filter((event) => event.type === 'pointerdown'),
    up = result.events.filter((event) => event.type === 'pointerup');
  expect(down, name + ' has exactly one native press').toHaveLength(1);
  expect(up, name + ' has exactly one native release').toHaveLength(1);
  for (const event of result.events) {
    expect(event.trusted, name + ' is trusted').toBe(true);
    expect(event.pointerType).toBe(touch ? 'touch' : 'mouse');
    expect(event.button).toBe(expectedButton);
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

/** Finite interior well-face samples; projection and ray checks remain outside the app. */
async function wellFaces(
  standing: Point,
  width: number,
  height: number,
  bearingDegrees: number,
  zoomClicks: number,
  dense: boolean,
) {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const bytes = await readFile('public/assets/models/well.glb');
    const container = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
      pluginExtension: '.glb',
      pluginOptions: { gltf: { skipMaterials: true } },
    });
    const instance = container.instantiateModelsToScene(
      (name) => 'lane-well-before:' + name,
      false,
      {
        doNotInstantiate: true,
      },
    );
    const root = new TransformNode('lane-well-before', scene);
    for (const node of instance.rootNodes) node.parent = root;
    const placement = {
      x: -11,
      y: 0,
      z: -3,
      scale: 0.85,
    };
    root.position.set(placement.x, placement.y, placement.z);
    root.scaling.setAll(placement.scale);
    root.computeWorldMatrix(true);
    for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
    const material = new StandardMaterial('lane-well-before:finite-triangles', scene);
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
    const layout = campaignLayout('capernaum-lanes'),
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
        const interiorWeights = dense
          ? [
              [1 / 3, 1 / 3, 1 / 3],
              [0.6, 0.2, 0.2],
              [0.2, 0.6, 0.2],
              [0.2, 0.2, 0.6],
              [0.2, 0.4, 0.4],
              [0.4, 0.2, 0.4],
              [0.4, 0.4, 0.2],
            ]
          : [[1 / 3, 1 / 3, 1 / 3]];
        return interiorWeights.flatMap((weights) => {
          const center = dense
              ? triangle.vertices[0]!.scale(weights[0]!)
                  .add(triangle.vertices[1]!.scale(weights[1]!))
                  .add(triangle.vertices[2]!.scale(weights[2]!))
              : triangle.vertices[0]!.add(triangle.vertices[1]!)
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
                (v[1]!.x - v[0]!.x) * (v[2]!.y - v[0]!.y) -
                  (v[2]!.x - v[0]!.x) * (v[1]!.y - v[0]!.y),
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
                  barycentricWeights: weights,
                  firstPickedPoint: first.pickedPoint.asArray(),
                  firstFace: first.faceId,
                },
              ]
            : [];
        });
      })
      .sort((a, b) => b.area - a.area)
      .slice(0, dense ? 180 : 18);
    return {
      assetSha256: hash(bytes),
      placement,
      triangleCount: triangles.length,
      projectedLabel: (() => {
        const at = project(new Vector3(placement.x, 1.9, placement.z));
        return { x: Math.max(95, Math.min(width - 95, at.x)), y: at.y, z: at.z };
      })(),
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
