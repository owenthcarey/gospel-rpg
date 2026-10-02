import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSave } from '../../src/persistence/schema';
import { transition } from '../../src/game/quest';
import { distance } from '../../src/game/pathfinding';
import { LANDINGS, normalizeHeading } from '../../src/game/lake/navigation';
import { lakeGateways } from '../../src/content/lake/places';
import { examineText } from '../../src/content/examine';
import type { GameState, Point } from '../../src/game/types';
import type { Berth } from '../../src/game/lake/types';
import { dismiss, exported, settled } from '../helpers/connection-browser';
import { observeRadarWalk } from '../helpers/navigation-walk-browser';
import {
  hullFaces,
  fourAnimationFrames,
  nativeHullInput,
  observeHullProjection,
} from '../helpers/moored-boat-browser';

const earned = (state: GameState) =>
  Object.fromEntries(
    Object.entries(state).filter(([key]) => key !== 'position' && key !== 'playTime'),
  );
const activate = (target: Locator, touch: boolean) => (touch ? target.tap() : target.click());

async function tapRadar(
  page: Page,
  target: Point,
  bounds: { min: number; max: number },
  touch: boolean,
) {
  const screen = await page.locator('.minimap svg').evaluate(
    (node, { target, bounds }) => {
      const svg = node as SVGSVGElement,
        point = svg.createSVGPoint(),
        scale = 192 / (bounds.max - bounds.min);
      point.x = (target.x - bounds.min) * scale;
      point.y = (bounds.max - target.z) * scale;
      const result = point.matrixTransform(svg.getScreenCTM()!);
      return { x: result.x, y: result.y };
    },
    { target, bounds },
  );
  if (touch) await page.touchscreen.tap(screen.x, screen.y);
  else await page.mouse.click(screen.x, screen.y);
}

/** Compare every field with the real reducers, using only observed sailing position/heading/time. */
async function dockNative(page: Page, before: GameState, berth: Berth, touch: boolean) {
  const id = 'dock-' + berth,
    radarPoint = async (): Promise<Point> => {
      const transform = (await page.locator('#minimap-player').getAttribute('transform'))!,
        [, x, y] = transform.match(/translate\(([^,]+),([^)]*)\)/)!;
      return { x: Number(x) / 3.84 - 25, z: 25 - Number(y) / 3.84 };
    },
    start = await radarPoint(),
    needsRoute = distance(start, LANDINGS[berth].water) >= 2.35;
  expect(distance(start, before.position)).toBeLessThan(0.05);
  // An already-reached landing opens its context immediately; only a genuine route has a flag.
  const walk = needsRoute ? await observeRadarWalk(page, { min: -25, max: 25 }) : undefined;
  await activate(page.locator('.toolbar [data-action="map"]'), touch);
  await activate(page.locator(`.map-destinations [data-value="${id}"]`), touch);
  const sailed = walk ? await walk.completed : undefined;
  await expect(
    page.getByRole('heading', { name: LANDINGS[berth].title, exact: true }),
  ).toBeVisible();
  await settled(page);
  await expect(page.locator('.minimap-destination')).toBeHidden();
  const arrived = await radarPoint();
  if (sailed) expect(distance(arrived, sailed.arrived)).toBeLessThan(0.05);
  else {
    expect(arrived).toEqual(start);
    await fourAnimationFrames(page);
    expect(await radarPoint()).toEqual(start);
    await expect(page.locator('.minimap-destination')).toBeHidden();
  }
  // Animation callbacks can precede a throttled paused render. Observe the settled facing.
  const settledHeading = normalizeHeading(
    Math.atan2(LANDINGS[berth].water.x - arrived.x, LANDINGS[berth].water.z - arrived.z),
  );
  await expect
    .poll(async () => {
      const text = await page.locator('#game-canvas').getAttribute('data-boat-heading'),
        actual = text === null || text === '' ? NaN : Number(text);
      return Math.abs(
        Math.atan2(Math.sin(actual - settledHeading), Math.cos(actual - settledHeading)),
      );
    })
    .toBeLessThan(0.000001);
  const dock = page.locator(`#overlay [data-action="journey"][data-value="${id}"]`),
    headingText = await page.locator('#game-canvas').getAttribute('data-boat-heading');
  expect(headingText).not.toBeNull();
  expect(headingText).not.toBe('');
  const observedHeading = Number(headingText);
  expect(Number.isFinite(observedHeading)).toBe(true);
  await expect(dock).toBeEnabled();
  await activate(dock, touch);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', berth);
  await settled(page);
  const after = await exported(page);
  let expected = transition(before, { type: 'route-select', target: id });
  expected.position = { ...arrived };
  expected.lake.boat.position = { ...arrived };
  expected.lake.boat.heading = observedHeading;
  expected.lake.visited['galilee-water'] = { ...arrived };
  expected = transition(expected, { type: 'route-arrive', target: id });
  expected = transition(expected, { type: 'journey', gateway: id });
  expected.playTime = after.playTime;
  expect(after).toEqual(expected);
  return {
    mode: needsRoute ? 'routed' : 'already-in-reach',
    start,
    sailed,
    arrived,
    settledHeading,
    observedHeading,
    after,
    expected,
  };
}

async function pressCameraButton(page: Page, name: string, touch: boolean) {
  const measured = await page.evaluate((name) => {
    const matches = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')].filter(
      (button) => button.getAttribute('aria-label') === name,
    );
    if (matches.length !== 1)
      throw new Error(`Expected one camera button named ${name}; found ${matches.length}`);
    const button = matches[0]!;
    const rect = button.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const surface = document.elementFromPoint(point.x, point.y);
    return {
      name: button.getAttribute('aria-label'),
      enabled: !button.disabled && !button.closest('[inert]'),
      rendered: rect.width > 0 && rect.height > 0,
      exposed: surface === button || button.contains(surface),
      inViewport: point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      point,
    };
  }, name);
  // Read actual named, enabled, exposed controls once, then send trusted native input.
  // Model contacts still require the independent finite-face/camera convergence below.
  expect(measured).toMatchObject({
    name,
    enabled: true,
    rendered: true,
    exposed: true,
    inViewport: true,
  });
  if (touch) await page.touchscreen.tap(measured.point.x, measured.point.y);
  else await page.mouse.click(measured.point.x, measured.point.y);
}

async function visibleHull(page: Page, berth: Berth, standing: Point, touch: boolean) {
  await expect(page.locator('#toast')).toBeHidden();
  await pressCameraButton(page, 'Reset camera', touch);
  await pressCameraButton(page, 'Face north', touch);
  await expect
    .poll(() =>
      page
        .locator('.minimap-wrap')
        .evaluate((node) =>
          Math.abs(parseFloat((node as HTMLElement).style.getPropertyValue('--map-bearing'))),
        ),
    )
    .toBeLessThan(0.04); // The CSS bearing contract is degrees.
  const zoomClicks = 3;
  for (let i = 0; i < zoomClicks; i++) await pressCameraButton(page, 'Zoom in', touch);
  // High quality follows movement smoothly; use actual rendered label stability before projection.
  const label = page.locator(`.world-label[data-value="board-${berth}"]`);
  await expect(label).toBeVisible();
  // Wrappers overriding expect.timeout must declare the same numeric budget in project metadata.
  const declaredBudget = test.info().project.metadata.hullObservationExpectTimeoutMs;
  const observationBudgetMs = declaredBudget ?? (process.env.CI ? 60_000 : 20_000);
  if (typeof observationBudgetMs !== 'number')
    throw new Error('Hull observation expect budget must be explicitly numeric');
  const observation = await observeHullProjection(page, berth, observationBudgetMs);
  const { rect, bearing } = observation;
  const geometry = await hullFaces(berth, standing, rect.width, rect.height, bearing, zoomClicks);
  for (const chosen of geometry.candidates) {
    const point = { x: chosen.x + rect.x, y: chosen.y + rect.y };
    if (
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.id === 'game-canvas',
        point,
      )
    )
      return { chosen, point, geometry, observation };
  }
  throw new Error(
    'No finite first-hit boat face has a bare-canvas contact: ' + JSON.stringify(geometry),
  );
}

for (const data of [
  {
    berth: 'capernaum',
    fixture: 'v9-across-the-lake-complete.json',
    quality: 'high',
    reducedMotion: false,
  },
  { berth: 'sheltered-cove', fixture: 'v9-cove-berthed.json', quality: 'low', reducedMotion: true },
  {
    berth: 'reed-landing',
    fixture: 'v9-crossing-evidence.json',
    quality: 'low',
    reducedMotion: true,
  },
] as const) {
  test(`the ${data.berth} moored hull supports native Visit, Examine, boarding and docking (${data.quality})`, async ({
    page,
    isMobile,
  }, info) => {
    const path = 'tests/fixtures/saves/' + data.fixture,
      bytes = await readFile(path),
      original = parseSave(JSON.parse(bytes.toString())).state,
      gate = 'board-' + data.berth,
      boatName = lakeGateways.find((place) => place.id === gate)!.name,
      errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let cleanup: (() => Promise<void>) | undefined;
    const touch = isMobile ? await page.context().newCDPSession(page) : undefined;
    try {
      if (touch)
        await touch.send('Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: 5,
        });
      await page.goto('/');
      await activate(page.getByRole('button', { name: 'Saves & settings', exact: true }), isMobile);
      await page.locator('[data-setting="quality"]').selectOption(data.quality);
      await page.locator('[data-setting="reducedMotion"]').setChecked(data.reducedMotion);
      await page.locator('#import-save').setInputFiles(path);
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', original.region);
      await settled(page);
      const imported = await exported(page);
      expect(earned(imported)).toEqual(earned(original));
      expect(imported.position).toEqual(original.position);
      await dismiss(page);
      const initialDock =
        data.berth === 'reed-landing'
          ? await dockNative(page, imported, data.berth, isMobile)
          : undefined;
      let baseline = initialDock?.after ?? imported;
      await dismiss(page);
      if (data.berth === 'capernaum') {
        // Bring the real hull into the portrait camera using a legal native shore walk.
        const walk = await observeRadarWalk(page, { min: -24, max: 24 });
        await tapRadar(page, { x: 7, z: -4 }, { min: -24, max: 24 }, isMobile);
        const approach = await walk.completed;
        expect(distance(approach.arrived, { x: 7, z: -4 })).toBeLessThan(0.05);
        const approached = await exported(page);
        expect(earned(approached)).toEqual(earned(baseline));
        baseline = approached;
        await dismiss(page);
      }
      expect(baseline.lake.boat).toMatchObject({ mode: 'ashore', berth: data.berth });
      const audit = await page.evaluateHandle(() => {
        const events: {
          type: string;
          trusted: boolean;
          target: string;
          id: string;
          pointerType: string;
          action: string | null;
        }[] = [];
        const listener = (event: Event) => {
          const pointer = event as PointerEvent,
            target = event.target as Element;
          events.push({
            type: event.type,
            trusted: event.isTrusted,
            target: target.tagName,
            id: target.id,
            pointerType: pointer.pointerType,
            action: target.closest('[data-action]')?.getAttribute('data-action') ?? null,
          });
        };
        for (const type of ['pointerdown', 'pointerup', 'click'])
          document.addEventListener(type, listener, true);
        return {
          events,
          cleanup: () => {
            for (const type of ['pointerdown', 'pointerup', 'click'])
              document.removeEventListener(type, listener, true);
          },
        };
      });
      cleanup = async () => {
        await audit.evaluate((value) => value.cleanup());
        await audit.dispose();
      };
      const calibration = await visibleHull(page, data.berth, baseline.position, isMobile);
      await page.screenshot({
        path: info.outputPath('moored-hull-before-contact.png'),
        scale: 'css',
      });
      const menu = page.getByRole('menu', { name: 'Choose Option' }),
        hullContacts: Awaited<ReturnType<typeof nativeHullInput>>[] = [];
      const openHullOptions = async (name: string, point: { x: number; y: number }) => {
        expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, point)).toBe(
          'game-canvas',
        );
        const standing = await page.locator('#minimap-player').getAttribute('transform');
        hullContacts.push(
          await nativeHullInput(page, point, isMobile, isMobile, info, name, async () => {
            if (touch) {
              await touch.send('Input.dispatchTouchEvent', {
                type: 'touchStart',
                touchPoints: [{ id: 1, ...point }],
              });
              try {
                await expect(menu).toBeVisible();
              } finally {
                await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              }
              await fourAnimationFrames(page);
              await expect(menu).toBeVisible();
              await expect(page.getByRole('dialog')).toBeHidden();
              await expect(page.locator('.minimap-destination')).toBeHidden();
              await expect(page.locator('#minimap-player')).toHaveAttribute('transform', standing!);
            } else await page.mouse.click(point.x, point.y, { button: 'right' });
          }),
        );
        await expect(
          menu.getByRole('menuitem', { name: 'Visit ' + boatName, exact: true }),
        ).toBeVisible();
        await expect(
          menu.getByRole('menuitem', { name: 'Examine ' + boatName, exact: true }),
        ).toBeVisible();
      };
      if (!isMobile) {
        await page.mouse.move(calibration.point.x, calibration.point.y);
        await expect(page.locator('.world-action-hint')).toContainText('Visit ' + boatName);
      }
      await openHullOptions('examine-options', calibration.point);
      await page.screenshot({
        path: info.outputPath('moored-hull-visit-examine-options.png'),
        scale: 'css',
      });
      await activate(
        menu.getByRole('menuitem', { name: 'Examine ' + boatName, exact: true }),
        isMobile,
      );
      await expect(menu).toBeHidden();
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.locator('#toast')).toContainText(
        examineText(lakeGateways.find((p) => p.id === gate)!),
      );
      const examined = await exported(page);
      expect(examined).toEqual({ ...baseline, playTime: examined.playTime });
      await dismiss(page);
      const defaultContact = await visibleHull(page, data.berth, examined.position, isMobile);
      hullContacts.push(
        await nativeHullInput(
          page,
          defaultContact.point,
          isMobile,
          false,
          info,
          'default-visit',
          async () => {
            if (isMobile)
              await page.touchscreen.tap(defaultContact.point.x, defaultContact.point.y);
            else await page.mouse.click(defaultContact.point.x, defaultContact.point.y);
          },
        ),
      );
      await expect(
        page.getByRole('heading', { name: 'An ordinary crossing', exact: true }),
      ).toBeVisible();
      await settled(page);
      const defaultVisit = await exported(page);
      let expected = transition(examined, { type: 'route-select', target: gate });
      expected.position = { ...defaultVisit.position };
      expected = transition(expected, { type: 'route-arrive', target: gate });
      expected.playTime = defaultVisit.playTime;
      expect(defaultVisit).toEqual(expected);
      expect(defaultVisit.lake.boat.mode).toBe('ashore');
      await dismiss(page);
      const visitContact = await visibleHull(page, data.berth, defaultVisit.position, isMobile);
      await openHullOptions('visit-options', visitContact.point);
      await activate(
        menu.getByRole('menuitem', { name: 'Visit ' + boatName, exact: true }),
        isMobile,
      );
      await expect(
        page.getByRole('heading', { name: 'An ordinary crossing', exact: true }),
      ).toBeVisible();
      await settled(page);
      const visited = await exported(page);
      expected = transition(defaultVisit, { type: 'route-select', target: gate });
      expected.position = { ...visited.position };
      expected = transition(expected, { type: 'route-arrive', target: gate });
      expected.playTime = visited.playTime;
      expect(visited).toEqual(expected);
      expect(visited.lake.boat.mode).toBe('ashore');
      // Export opens settings; return through the same actual model before explicitly boarding.
      await dismiss(page);
      const boardContact = await visibleHull(page, data.berth, visited.position, isMobile);
      hullContacts.push(
        await nativeHullInput(
          page,
          boardContact.point,
          isMobile,
          false,
          info,
          'board-context',
          async () => {
            if (isMobile) await page.touchscreen.tap(boardContact.point.x, boardContact.point.y);
            else await page.mouse.click(boardContact.point.x, boardContact.point.y);
          },
        ),
      );
      await expect(
        page.getByRole('heading', { name: 'An ordinary crossing', exact: true }),
      ).toBeVisible();
      await settled(page);
      const beforeBoard = transition(transition(visited, { type: 'route-select', target: gate }), {
        type: 'route-arrive',
        target: gate,
      });
      await activate(
        page.locator(`#overlay [data-action="journey"][data-value="${gate}"]`),
        isMobile,
      );
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilee-water');
      await settled(page);
      const boarded = await exported(page),
        expectedBoarded = transition(beforeBoard, { type: 'journey', gateway: gate });
      expectedBoarded.playTime = boarded.playTime;
      expect(boarded).toEqual(expectedBoarded);
      expect(boarded.lake.boat.mode).toBe('afloat');
      expect(boarded.position).toEqual(LANDINGS[data.berth].water);
      await dismiss(page);
      const returned = await dockNative(page, boarded, data.berth, isMobile);
      expect(returned.after.lake.boat).toMatchObject({ mode: 'ashore', berth: data.berth });
      const controls = await audit.evaluate((value) => value.events);
      expect(hullContacts.map((contact) => contact.name)).toEqual([
        'examine-options',
        'default-visit',
        'visit-options',
        'board-context',
      ]);
      expect(errors).toEqual([]);
      expect(
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      ).toBe(createHash('sha256').update(bytes).digest('hex'));
      await writeFile(
        info.outputPath('moored-hull-state.json'),
        JSON.stringify(
          {
            data,
            fixture: path,
            fixtureSha256: createHash('sha256').update(bytes).digest('hex'),
            original,
            imported,
            initialDock,
            baseline,
            calibration,
            examined,
            defaultContact,
            defaultVisit,
            visitContact,
            visited,
            boardContact,
            beforeBoard,
            boarded,
            expectedBoarded,
            returned,
            hullContacts,
            controls,
            errors,
          },
          null,
          2,
        ),
      );
    } finally {
      await cleanup?.().catch(() => {});
      await touch?.detach().catch(() => {});
    }
  });
}
