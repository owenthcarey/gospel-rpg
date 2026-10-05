import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Viewport } from '@babylonjs/core/Maths/math.viewport.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import {
  bakehouseLayout,
  campaignLayout,
  layoutObstacles,
} from '../../src/content/campaign/layouts';
import { WalkGrid } from '../../src/game/pathfinding';
import { dismiss, exported, settled, visit, act, passage } from './connection-browser';

// These are the three functional shelf placements in NeighborhoodActivity, not label anchors.
export const bakehouseProps = [
  {
    asset: 'bread_basket',
    target: 'bread-shelf',
    name: 'Bread for the table',
    x: -4.7,
    y: 1.53,
    z: 0,
    take: 'take-bread',
    return: 'return-bread',
    held: 'bread-basket',
    fixture: 'v6-interrupted-repair.json',
  },
  {
    asset: 'jug',
    target: 'jug-shelf',
    name: 'An empty jug',
    x: 4.7,
    y: 1.53,
    z: 1,
    take: 'take-jug',
    return: 'return-jug',
    held: 'empty-jug',
    fixture: 'v6-interrupted-repair.json',
  },
  {
    asset: 'cart_handle',
    target: 'tool-shelf',
    name: 'The handcart handle',
    x: 4,
    y: 0.12,
    z: -2,
    take: 'borrow-handle',
    return: 'return-handle',
    held: 'cart-handle',
    fixture: 'v7-beyond-capernaum.json',
  },
] as const;
type ShelfProp = (typeof bakehouseProps)[number];

type Glb = {
  nodes: {
    mesh?: number;
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes: { primitives: { attributes: { POSITION: number }; indices: number; mode?: number }[] }[];
  accessors: {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
};

/** Read the shipped triangles and Babylon's documented glTF AUTO handedness transform.
 * No application engine access, screen labels, mesh flags, renderer changes or hit-test overrides.
 */
async function projectedGeometry(
  prop: ShelfProp,
  width: number,
  height: number,
  zoomClicks: number,
  rotationSteps: number,
) {
  const bytes = await readFile(`public/assets/models/${prop.asset}.glb`);
  const jsonLength = bytes.readUInt32LE(12);
  const glb = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as Glb;
  const binary = bytes.subarray(20 + jsonLength + 8);
  expect(glb.nodes).toHaveLength(1);
  const node = glb.nodes[0]!;
  expect(node.matrix ?? node.translation ?? node.rotation ?? node.scale).toBeUndefined();
  const componentBytes: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
  function accessor(index: number, components: number) {
    const a = glb.accessors[index]!,
      view = glb.bufferViews[a.bufferView]!;
    const size = componentBytes[a.componentType]!;
    const stride = view.byteStride ?? size * components;
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: components }, (_, j) => {
        const offset = start + i * stride + j * size;
        if (a.componentType === 5126) return binary.readFloatLE(offset);
        if (a.componentType === 5125) return binary.readUInt32LE(offset);
        if (a.componentType === 5123) return binary.readUInt16LE(offset);
        if (a.componentType === 5121) return binary.readUInt8(offset);
        throw new Error(`Unsupported actual GLB component type ${a.componentType}`);
      }),
    );
  }
  const handed = Matrix.Compose(new Vector3(1, 1, -1), new Quaternion(0, 1, 0, 0), Vector3.Zero());
  const placement = Matrix.Compose(
    new Vector3(0.72, 0.72, 0.72),
    Quaternion.Identity(),
    new Vector3(prop.x, prop.y, prop.z),
  );
  const transform = handed.multiply(placement);
  const triangles: Vector3[][] = [];
  for (const primitive of glb.meshes[node.mesh!]!.primitives) {
    expect(primitive.mode ?? 4).toBe(4);
    const vertices = accessor(primitive.attributes.POSITION, 3).map((v) =>
      Vector3.TransformCoordinates(new Vector3(v[0]!, v[1]!, v[2]!), transform),
    );
    const indices = accessor(primitive.indices, 1).flat();
    for (let i = 0; i < indices.length; i += 3)
      triangles.push([
        vertices[indices[i]!]!,
        vertices[indices[i + 1]!]!,
        vertices[indices[i + 2]!]!,
      ]);
  }
  // Match the ordinary indoor camera after actual Reset, Zoom and Rotate controls.
  // Phone fitting scales both the initial radius and limits before three-metre zoom steps.
  const aspectScale = Math.max(1, 0.9 / (width / Math.max(1, height)));
  const alpha = -Math.PI / 2 - 0.45 + rotationSteps * 0.27,
    beta = bakehouseLayout.camera.beta;
  const min = bakehouseLayout.camera.min * aspectScale,
    max = bakehouseLayout.camera.max * aspectScale;
  const radius = Math.max(
    min,
    Math.min(max, bakehouseLayout.camera.radius * aspectScale - zoomClicks * 3),
  );
  const camera = new Vector3(
    Math.cos(alpha) * Math.sin(beta) * radius,
    Math.cos(beta) * radius,
    Math.sin(alpha) * Math.sin(beta) * radius,
  );
  const matrix = Matrix.LookAtLH(camera, Vector3.Zero(), Vector3.Up()).multiply(
    Matrix.PerspectiveFovLH(0.7, width / height, 0.2, 220),
  );
  const project = (p: Vector3) =>
    Vector3.Project(p, Matrix.Identity(), matrix, new Viewport(0, 0, width, height));
  const candidates = triangles
    .flatMap((triangle, face) => {
      const center = triangle[0]!
        .add(triangle[1]!)
        .add(triangle[2]!)
        .scale(1 / 3);
      const direction = center.subtract(camera),
        length = direction.length();
      const ray = new Ray(camera, direction.normalize(), length + 0.001);
      const first = triangles.reduce(
        (nearest, other) =>
          Math.min(
            nearest,
            ray.intersectsTriangle(other[0]!, other[1]!, other[2]!)?.distance ?? Infinity,
          ),
        Infinity,
      );
      if (Math.abs(first - length) > 0.001) return [];
      const projected = triangle.map(project),
        point = project(center);
      const area =
        Math.abs(
          (projected[1]!.x - projected[0]!.x) * (projected[2]!.y - projected[0]!.y) -
            (projected[2]!.x - projected[0]!.x) * (projected[1]!.y - projected[0]!.y),
        ) / 2;
      return [{ x: point.x, y: point.y, area, face, world: center.asArray() }];
    })
    .filter((p) => p.area >= 1 && p.x > 8 && p.x < width - 8 && p.y > 8 && p.y < height - 8)
    .sort((a, b) => b.area - a.area)
    .slice(0, 12);
  const projectedVertices = triangles.flat().map(project);
  return {
    asset: prop.asset,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    triangleCount: triangles.length,
    placement: { x: prop.x, y: prop.y, z: prop.z, scale: 0.72 },
    camera: {
      alpha,
      beta,
      radius,
      aspectScale,
      limits: [min, max],
      zoomClicks,
      rotationSteps,
      target: [0, 0, 0],
      fov: 0.7,
      minZ: 0.2,
      maxZ: 220,
    },
    bounds: {
      left: Math.min(...projectedVertices.map((p) => p.x)),
      right: Math.max(...projectedVertices.map((p) => p.x)),
      top: Math.min(...projectedVertices.map((p) => p.y)),
      bottom: Math.max(...projectedVertices.map((p) => p.y)),
    },
    candidates,
  };
}

/** Compare the entire journey, allowing only explicitly named spatial bookkeeping and the clock.
 * Validate each accepted spatial replacement against real terrain; no story/status arrays omitted.
 */
function expectWholeState(actual: GameState, expected: GameState, travelled: string[]) {
  const spatial = (region: string, point: { x: number; z: number }) => {
    const state = { ...expected, region } as GameState,
      layout = campaignLayout(region)!;
    expect(
      new WalkGrid(
        layoutObstacles(state),
        layout.terrain,
        layout.bounds.min,
        layout.bounds.max,
      ).walkable(point),
    ).toBe(true);
  };
  const visited = { ...expected.campaign.visited };
  for (const region of travelled) {
    const point = actual.campaign.visited[region as keyof typeof visited];
    if (point) {
      spatial(region, point);
      visited[region as keyof typeof visited] = point;
    }
  }
  spatial(actual.region, actual.position);
  expect(actual).toEqual({
    ...expected,
    position: actual.position,
    playTime: actual.playTime,
    campaign: { ...expected.campaign, visited },
  });
}
const addJournal = (state: GameState, ...ids: string[]) => {
  for (const id of ids) if (!state.journal.includes(id)) state.journal.push(id);
};

async function originalImport(page: Page, fixture: string, info: TestInfo) {
  const bytes = await readFile(`tests/fixtures/saves/${fixture}`);
  const original = parseSave(JSON.parse(bytes.toString('utf8'))).state;
  await page.goto('/');
  await page.getByRole('button', { name: 'Saves & settings', exact: true }).click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('#import-save').setInputFiles(`tests/fixtures/saves/${fixture}`);
  await settled(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const served = await page.evaluate(() => ({
    scripts: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(
      (node) => node.src,
    ),
    styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
      (node) => node.href,
    ),
  }));
  const imported = await exported(page);
  expect({ ...imported, playTime: original.playTime }).toEqual(original);
  await dismiss(page);
  await writeFile(
    info.outputPath('fixture-import.json'),
    JSON.stringify(
      {
        fixture,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        served,
        original,
        imported,
      },
      null,
      2,
    ),
  );
  return original;
}

async function unlock(page: Page, prop: ShelfProp, original: GameState) {
  const expected = structuredClone(original),
    milestones: { label: string; state: GameState }[] = [];
  if (prop.asset === 'cart_handle') {
    await passage(page, 'house-exit', 'capernaum-lanes');
    expected.region = 'capernaum-lanes';
    await visit(page, 'amos');
    await act(page, 'campaign-action', 'walk-accept');
    await act(page, 'campaign-action', 'walk-passage');
    expected.campaign.walk.stage = 'invited';
    expected.campaign.walk.route = 'passage';
    expected.tracking = 'neighbors';
    addJournal(expected, 'walk-invitation', 'walk-passage');
    const invited = await exported(page);
    expectWholeState(invited, expected, ['gathering-house', 'capernaum-lanes']);
    milestones.push({ label: 'Native Amos passage choice', state: invited });
    await dismiss(page);
    await passage(page, 'to-bakehouse', 'bakehouse');
    expected.region = 'bakehouse';
  } else {
    // Untouched repair save genuinely owns a brace. Return it through its authored action.
    await visit(page, 'brace-shelf');
    await act(page, 'campaign-action', 'life-return-brace');
    expected.campaign.carrying = null;
    const returned = await exported(page);
    expectWholeState(returned, expected, ['bakehouse']);
    milestones.push({ label: 'Native brace return; repair preserved', state: returned });
    await dismiss(page);
    await visit(page, 'hannah');
    await act(page, 'campaign-action', 'table-accept');
    await act(page, 'campaign-action', 'table-courtyard');
    expected.campaign.table.stage = 'preparing';
    expected.campaign.table.location = 'courtyard';
    expected.tracking = 'table';
    addJournal(expected, 'table-invitation', 'table-courtyard');
  }
  const unlocked = await exported(page);
  expectWholeState(
    unlocked,
    expected,
    prop.asset === 'cart_handle'
      ? ['gathering-house', 'capernaum-lanes', 'bakehouse']
      : ['bakehouse'],
  );
  milestones.push({
    label: 'Authored pickup unlocked without using its own world label',
    state: unlocked,
  });
  await dismiss(page);
  return { expected, milestones };
}

async function nativeTap(page: Page, point: { x: number; y: number }, touch: boolean) {
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function nativeCampaignAction(page: Page, id: string, touch: boolean) {
  const control = page.locator(`#overlay [data-action="campaign-action"][data-value="${id}"]`);
  await expect(control).toBeEnabled();
  if (touch) await control.tap();
  else await control.click();
  await settled(page);
}

async function nativeOption(page: Page, name: string, touch: boolean) {
  const item = page.getByRole('menu', { name: 'Choose Option' }).getByRole('menuitem', {
    name,
    exact: true,
  });
  await expect(item).toBeVisible();
  const box = (await item.boundingBox())!;
  await nativeTap(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, touch);
}

type NativePointer = {
  type: string;
  pointerType: string;
  trusted: boolean;
  x: number;
  y: number;
  time: number;
  target: {
    tag: string | null;
    id: string | null;
    className: string | null;
    labelValue: string | null;
    optionMenuName: string | null;
    optionMenuVisible: boolean;
  };
};
type ObservedWindow = Window & {
  bakehousePointerObserver?: { events: NativePointer[]; release: () => void };
};

async function nativeModelInput(
  page: Page,
  point: { x: number; y: number },
  touch: boolean,
  info: TestInfo,
  label: string,
  hold: boolean,
  input: () => Promise<void>,
) {
  const preContact = await page.evaluate((p) => {
    const observed = window as ObservedWindow;
    observed.bakehousePointerObserver?.release();
    const events: NativePointer[] = [];
    const describe = (target: EventTarget | null) => {
      const node = target instanceof Element ? target : null;
      const optionMenu = node?.closest<HTMLElement>('[role="menu"][aria-label="Choose Option"]');
      return {
        tag: node?.tagName ?? null,
        id: node?.id ?? null,
        className: node?.getAttribute('class') ?? null,
        labelValue: node?.closest<HTMLElement>('.world-label')?.dataset.value ?? null,
        optionMenuName: optionMenu?.getAttribute('aria-label') ?? null,
        optionMenuVisible:
          !!optionMenu && !optionMenu.hidden && optionMenu.getClientRects().length > 0,
      };
    };
    const record = (event: PointerEvent) => {
      if (Math.abs(event.clientX - p.x) < 1 && Math.abs(event.clientY - p.y) < 1)
        events.push({
          type: event.type,
          pointerType: event.pointerType,
          trusted: event.isTrusted,
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
          target: describe(event.target),
        });
    };
    window.addEventListener('pointerdown', record, { capture: true, passive: true });
    window.addEventListener('pointerup', record, { capture: true, passive: true });
    observed.bakehousePointerObserver = {
      events,
      release: () => {
        window.removeEventListener('pointerdown', record, true);
        window.removeEventListener('pointerup', record, true);
      },
    };
    const nearby = [
      ...document.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,summary'),
    ]
      .filter((node) => node.getClientRects().length && !node.closest('[inert]'))
      .map((node) => {
        const bounds = node.getBoundingClientRect();
        const distance = Math.hypot(
          Math.max(bounds.left - p.x, 0, p.x - bounds.right),
          Math.max(bounds.top - p.y, 0, p.y - bounds.bottom),
        );
        return {
          ...describe(node),
          name: node.getAttribute('aria-label') ?? node.textContent?.trim(),
          rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          distance,
        };
      })
      .filter((node) => node.distance < 48);
    return {
      time: performance.now(),
      target: describe(document.elementFromPoint(p.x, p.y)),
      nearby,
    };
  }, point);
  try {
    await input();
  } finally {
    const events = await page.evaluate(() => {
      const observed = window as ObservedWindow;
      const events = observed.bakehousePointerObserver?.events ?? [];
      observed.bakehousePointerObserver?.release();
      delete observed.bakehousePointerObserver;
      return events;
    });
    const duration =
      (events.find((event) => event.type === 'pointerup')?.time ?? 0) -
      (events.find((event) => event.type === 'pointerdown')?.time ?? 0);
    await writeFile(
      info.outputPath(`${label}-native-pointer.json`),
      JSON.stringify({ point, touch, preContact, events, stationaryDurationMs: duration }, null, 2),
    );
    expect(events.some((event) => event.type === 'pointerdown')).toBe(true);
    expect(events.some((event) => event.type === 'pointerup')).toBe(true);
    expect(
      events.every((event) => event.trusted && event.pointerType === (touch ? 'touch' : 'mouse')),
    ).toBe(true);
    const canvasTarget = (event: NativePointer) =>
      event.target.tag === 'CANVAS' && event.target.id === 'game-canvas';
    expect(
      events.filter((event) => event.type === 'pointerdown').every(canvasTarget),
      'Native model contact must start on canvas',
    ).toBe(true);
    expect(events.every((event) => event.target.labelValue === null)).toBe(true);
    expect(
      events
        .filter((event) => event.type === 'pointerup')
        .every(
          (event) =>
            canvasTarget(event) ||
            (touch &&
              hold &&
              event.target.optionMenuName === 'Choose Option' &&
              event.target.optionMenuVisible),
        ),
      'Only a native touch hold can release into its visible Choose Option overlay',
    ).toBe(true);
    if (touch && hold) expect(duration).toBeGreaterThan(500);
  }
}

async function nativeOptions(
  page: Page,
  point: { x: number; y: number },
  touch: boolean,
  info: TestInfo,
  label: string,
) {
  const menu = page.getByRole('menu', { name: 'Choose Option' });
  await nativeModelInput(page, point, touch, info, label, true, async () => {
    if (!touch) await page.mouse.click(point.x, point.y, { button: 'right' });
    else {
      // Chromium's protocol produces trusted native touch contacts, as in classic-interface.spec.
      // Keep stationary beyond the app's ordinary 500 ms hold; its clocks and picking stay intact.
      const session = await page.context().newCDPSession(page);
      let contact = false;
      try {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ id: 1, x: point.x, y: point.y }],
        });
        contact = true;
        await page.waitForTimeout(650);
        await expect(menu).toBeVisible();
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        contact = false;
      } finally {
        try {
          if (contact)
            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally {
          await session.detach();
        }
      }
    }
    await expect(menu).toBeVisible();
  });
  return menu.getByRole('menuitem').allTextContents();
}

async function nativeModelTap(
  page: Page,
  point: { x: number; y: number },
  touch: boolean,
  info: TestInfo,
  label: string,
) {
  await nativeModelInput(page, point, touch, info, label, false, () =>
    nativeTap(page, point, touch),
  );
}

async function actualModelPoint(
  page: Page,
  prop: ShelfProp,
  info: TestInfo,
  label: string,
  touch: boolean,
) {
  await dismiss(page);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-work-target', '');
  await expect(page.locator('#game-canvas')).not.toHaveAttribute('data-conversation');
  const canvas = (await page.locator('#game-canvas').boundingBox())!;
  expect(canvas.x).toBe(0);
  expect(canvas.y).toBe(0);
  const aspectScale = Math.max(1, 0.9 / (canvas.width / Math.max(1, canvas.height)));
  const nearestZoom = Math.ceil(
    ((bakehouseLayout.camera.radius - bakehouseLayout.camera.min) * aspectScale) / 3,
  );
  const attempts: Awaited<ReturnType<typeof projectedGeometry>>[] = [];
  // Calibration uses only visible native controls. Preserve failed poses for review rather
  // than hiding labels, forcing pointer hits or changing renderer/mesh/application flags.
  for (const zoomClicks of [...new Set([2, nearestZoom])]) {
    for (const rotationSteps of [0, 1, -1, 2, -2, 3, -3]) {
      await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
      for (let i = 0; i < zoomClicks; i++)
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      // Main passes ±0.9 to World.rotate(), whose reduced-motion step multiplies by 0.3.
      const rotate = rotationSteps < 0 ? 'Rotate camera right' : 'Rotate camera left';
      for (let i = 0; i < Math.abs(rotationSteps); i++)
        await page.getByRole('button', { name: rotate, exact: true }).click();
      // Read the rendered frame following the real native camera actions.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const geometry = await projectedGeometry(
        prop,
        canvas.width,
        canvas.height,
        zoomClicks,
        rotationSteps,
      );
      attempts.push(geometry);
      for (const point of geometry.candidates.filter((candidate) => candidate.area >= 3)) {
        if (
          await page.evaluate(
            ({ p, touch }) => {
              if (document.elementFromPoint(p.x, p.y) !== document.querySelector('#game-canvas'))
                return false;
              if (!touch) return true;
              // A native touch covers an area and can choose a nearby clickable control
              // even when its centre is just outside that control. Keep the model contact clear.
              return [
                ...document.querySelectorAll<HTMLElement>(
                  'button,a[href],input,select,textarea,summary',
                ),
              ]
                .filter(
                  (node) =>
                    node.getClientRects().length &&
                    !node.closest('[inert]') &&
                    getComputedStyle(node).visibility !== 'hidden',
                )
                .every((node) => {
                  const bounds = node.getBoundingClientRect();
                  return (
                    Math.hypot(
                      Math.max(bounds.left - p.x, 0, p.x - bounds.right),
                      Math.max(bounds.top - p.y, 0, p.y - bounds.bottom),
                    ) >= 2
                  );
                });
            },
            { p: point, touch },
          )
        ) {
          await writeFile(
            info.outputPath(`${label}-geometry.json`),
            JSON.stringify({ attempts, point }, null, 2),
          );
          await page.screenshot({ path: info.outputPath(`${label}-model.png`), scale: 'css' });
          return { point, geometry };
        }
      }
      await page.screenshot({
        path: info.outputPath(`${label}-calibration-${zoomClicks}-${rotationSteps}.png`),
        scale: 'css',
      });
    }
  }
  await writeFile(
    info.outputPath(`${label}-geometry.json`),
    JSON.stringify({ attempts, point: null }, null, 2),
  );
  throw new Error(
    'No adequately sized actual model triangle remains clear of HUD/labels after ordinary camera controls; review retained calibration captures.',
  );
}

/** Native functional shelf picking, menu/examination, ownership and return lifecycle. */
export async function bakehouseProp(page: Page, info: TestInfo, prop: ShelfProp, touch: boolean) {
  const original = await originalImport(page, prop.fixture, info);
  const { expected, milestones } = await unlock(page, prop, original);
  const travelled =
    prop.asset === 'cart_handle'
      ? ['gathering-house', 'capernaum-lanes', 'bakehouse']
      : ['bakehouse'];
  const unlocked = milestones[milestones.length - 1]!.state;
  const before = await actualModelPoint(page, prop, info, 'before', touch);
  const hint = page.locator('.world-action-hint');
  if (!touch) {
    await page.mouse.move(before.point.x, before.point.y);
    await expect(hint).toHaveText(`Inspect ${prop.name}`);
    await expect(hint).toBeVisible();
    await page.screenshot({ path: info.outputPath('native-hover.png'), scale: 'css' });
  }
  const options = await nativeOptions(page, before.point, touch, info, 'before');
  await page.screenshot({ path: info.outputPath('native-options.png'), scale: 'css' });
  expect(options).toContain(`Inspect ${prop.name}`);
  expect(options).toContain(`Examine ${prop.name}`);
  // Examination gives the real object's observation without approaching it or changing story.
  await nativeOption(page, `Examine ${prop.name}`, touch);
  await expect(page.locator('#toast')).toContainText(prop.name + ':');
  await page.screenshot({ path: info.outputPath('native-examine.png'), scale: 'css' });
  const examined = await exported(page);
  expect({ ...examined, playTime: unlocked.playTime }).toEqual(unlocked);
  await dismiss(page);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 10_000 });
  await nativeModelTap(page, before.point, touch, info, 'inspection-tap');
  await expect(page.locator('#overlay h2').first()).toHaveText(prop.name);
  await settled(page);
  const take = page.locator(`#overlay [data-action="campaign-action"][data-value="${prop.take}"]`);
  await expect(take).toBeVisible();
  await expect(take).toBeEnabled();
  await page.screenshot({ path: info.outputPath('native-inspection.png'), scale: 'css' });
  const inspected = await exported(page);
  expectWholeState(inspected, expected, travelled);
  const pickupPose = await actualModelPoint(page, prop, info, 'pickup', touch);
  await nativeModelTap(page, pickupPose.point, touch, info, 'pickup-tap');
  await expect(page.locator('#overlay h2').first()).toHaveText(prop.name);
  await nativeCampaignAction(page, prop.take, touch);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-carrying', prop.held);
  const pickup = await exported(page);
  const held = structuredClone(expected);
  held.campaign.carrying = prop.held;
  expectWholeState(pickup, held, travelled);
  // The picked shelf model leaves the scene while held; the same native point must no
  // longer offer its object options. This also checks actual enabled/picking lifecycle.
  const heldPose = await actualModelPoint(page, prop, info, 'held', touch);
  const removedOptions = await nativeOptions(page, heldPose.point, touch, info, 'held');
  expect(removedOptions).not.toContain(`Inspect ${prop.name}`);
  expect(removedOptions).not.toContain(`Examine ${prop.name}`);
  await nativeOption(page, 'Cancel', touch);
  await page.screenshot({ path: info.outputPath('native-held.png'), scale: 'css' });
  // The authored return remains available through its normal navigation; no fabricated action.
  await visit(page, prop.target);
  await nativeCampaignAction(page, prop.return, touch);
  const returned = await exported(page);
  expectWholeState(returned, expected, travelled);
  const restored = await actualModelPoint(page, prop, info, 'restored', touch);
  const restoredOptions = await nativeOptions(page, restored.point, touch, info, 'restored');
  expect(restoredOptions).toContain(`Inspect ${prop.name}`);
  expect(restoredOptions).toContain(`Examine ${prop.name}`);
  await nativeOption(page, 'Cancel', touch);
  await nativeModelTap(page, restored.point, touch, info, 'restored-tap');
  await expect(page.locator('#overlay h2').first()).toHaveText(prop.name);
  await expect(
    page.locator(`#overlay [data-action="campaign-action"][data-value="${prop.take}"]`),
  ).toBeEnabled();
  await page.screenshot({ path: info.outputPath('native-restored-inspection.png'), scale: 'css' });
  const final = await exported(page);
  expectWholeState(final, expected, travelled);
  await writeFile(
    info.outputPath('native-prop-state.json'),
    JSON.stringify(
      {
        prop,
        original,
        milestones,
        expected,
        before,
        options,
        examined,
        inspected,
        pickupPose,
        pickup,
        heldPose,
        removedOptions,
        returned,
        restored,
        restoredOptions,
        final,
      },
      null,
      2,
    ),
  );
}
