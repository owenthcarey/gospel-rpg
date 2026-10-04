import { expect, test, type Page, type TestInfo } from '@playwright/test';
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
import { settled } from '../helpers/connection-browser';
import { observeRadarWalk } from '../helpers/navigation-walk-browser';
import {
  hullFaces,
  fourAnimationFrames,
  nativeHullInput,
  nativeHullCamera,
  observeNativeNorthBearing,
  observeHullProjection,
  observeHullOptions,
  nativeMooredButtons,
  type NativeMooredButtons,
} from '../helpers/moored-boat-browser';

const earned = (state: GameState) =>
  Object.fromEntries(
    Object.entries(state).filter(([key]) => key !== 'position' && key !== 'playTime'),
  );
const dismiss = (buttons: NativeMooredButtons) =>
  buttons.press({
    selector: '#overlay button[aria-label="Close menu"]',
    aria: 'Close menu',
    optional: true,
    pointerType: 'mouse',
  });

/** The same genuine download and parser, with ordinary controls owned at native delivery. */
async function exported(page: Page, buttons: NativeMooredButtons) {
  await dismiss(buttons);
  await buttons.press({
    selector: '.toolbar button[data-action="settings"]',
    aria: 'Settings and saves',
    pointerType: 'mouse',
  });
  const download = page.waitForEvent('download');
  await buttons.press({
    selector: '#overlay button[data-action="export"]',
    text: 'Export',
    pointerType: 'mouse',
  });
  return parseSave(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).state;
}

function nativeActionBudget(info: TestInfo): number {
  const budget = info.project.use.actionTimeout ?? (process.env.CI ? 60_000 : 20_000);
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0 || budget > 60_000)
    throw new Error('Moored controls require the unchanged explicit native action budget');
  return budget;
}

async function tapRadar(
  page: Page,
  target: Point,
  bounds: { min: number; max: number },
  touch: boolean,
) {
  const screen = await page.evaluate(
    ({ target, bounds }) => {
      const maps = document.querySelectorAll('.minimap svg'),
        node = maps[0];
      if (maps.length !== 1 || !(node instanceof SVGSVGElement) || !node.isConnected)
        throw new Error('Expected one connected actual minimap SVG for native radar input');
      const svg = node,
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
async function dockNative(
  page: Page,
  before: GameState,
  berth: Berth,
  buttons: NativeMooredButtons,
) {
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
  await buttons.press({ selector: '.toolbar button[data-action="map"]' });
  await buttons.press({ selector: `.map-destinations button[data-value="${id}"]` });
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
  await buttons.press({ selector: `#overlay button[data-action="journey"][data-value="${id}"]` });
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', berth);
  await settled(page);
  const after = await exported(page, buttons);
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

function hullObservationBudget(): number {
  // Wrappers overriding expect.timeout must declare the same numeric budget in project metadata.
  const declaredBudget = test.info().project.metadata.hullObservationExpectTimeoutMs;
  const observationBudgetMs = declaredBudget ?? (process.env.CI ? 60_000 : 20_000);
  if (typeof observationBudgetMs !== 'number')
    throw new Error('Hull observation expect budget must be explicitly numeric');
  return observationBudgetMs;
}

async function visibleHull(
  page: Page,
  berth: Berth,
  standing: Point,
  touch: boolean,
  info: TestInfo,
  phase: string,
) {
  // Notice expiry and native camera setup are independent; both must finish before projection.
  // Starting the assertion here retains its original deadline instead of extending it after setup.
  const noticeClear = expect(page.locator('#toast')).toBeHidden();
  const zoomClicks = 3;
  const [, camera] = await Promise.all([
    noticeClear,
    nativeHullCamera(page, touch, info, phase, async (press) => {
      await press('Reset camera');
      await press('Face north');
      const north = await observeNativeNorthBearing(page, hullObservationBudget());
      expect(north.absoluteDegrees).toBeLessThan(0.04); // The CSS bearing contract is degrees.
      for (let i = 0; i < zoomClicks; i++) await press('Zoom in');
    }),
  ]);
  // The browser observation admits visibility, then preserves the separate projection budget.
  const observationBudgetMs = hullObservationBudget();
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
      return { chosen, point, geometry, observation, camera };
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
    let buttons: NativeMooredButtons | undefined;
    let buttonCleanupError: unknown;
    const touch = isMobile ? await page.context().newCDPSession(page) : undefined;
    try {
      if (touch)
        await touch.send('Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: 5,
        });
      await page.goto('/');
      buttons = await nativeMooredButtons(page, isMobile, info, nativeActionBudget(info));
      await buttons.press({
        selector: 'button.welcome-saves[data-action="settings"]',
        text: 'Saves & settings',
      });
      await page.locator('[data-setting="quality"]').selectOption(data.quality);
      await page.locator('[data-setting="reducedMotion"]').setChecked(data.reducedMotion);
      await page.locator('#import-save').setInputFiles(path);
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', original.region);
      await settled(page);
      const imported = await exported(page, buttons);
      expect(earned(imported)).toEqual(earned(original));
      expect(imported.position).toEqual(original.position);
      await dismiss(buttons);
      const initialDock =
        data.berth === 'reed-landing'
          ? await dockNative(page, imported, data.berth, buttons)
          : undefined;
      let baseline = initialDock?.after ?? imported;
      await dismiss(buttons);
      if (data.berth === 'capernaum') {
        // Bring the real hull into the portrait camera using a legal native shore walk.
        const walk = await observeRadarWalk(page, { min: -24, max: 24 });
        await tapRadar(page, { x: 7, z: -4 }, { min: -24, max: 24 }, isMobile);
        const approach = await walk.completed;
        expect(distance(approach.arrived, { x: 7, z: -4 })).toBeLessThan(0.05);
        const approached = await exported(page, buttons);
        expect(earned(approached)).toEqual(earned(baseline));
        baseline = approached;
        await dismiss(buttons);
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
      const calibration = await visibleHull(
        page,
        data.berth,
        baseline.position,
        isMobile,
        info,
        'examine-camera',
      );
      await page.screenshot({
        path: info.outputPath('moored-hull-before-contact.png'),
        scale: 'css',
      });
      const menu = page.getByRole('menu', { name: 'Choose Option' }),
        hullContacts: Awaited<ReturnType<typeof nativeHullInput>>[] = [];
      const openHullOptions = async (name: string, point: { x: number; y: number }) => {
        const contact = await nativeHullInput(
          page,
          point,
          isMobile,
          isMobile,
          info,
          name,
          async () => {
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
            } else await page.mouse.click(point.x, point.y, { button: 'right' });
          },
        );
        hullContacts.push(contact);
        // The contact observer reads standing and bare-canvas ownership together before input.
        expect(contact.preContact.id).toBe('game-canvas');
        expect(contact.playerTransform).not.toBeNull();
        const options = await observeHullOptions(
          page,
          boatName,
          contact.playerTransform!,
          hullObservationBudget(),
        );
        // Both desktop right-click and phone hold retain every named Choose Option predicate.
        expect(options.valid, 'one Choose Option menu with named Visit and Examine controls').toBe(
          true,
        );
        expect(options.menuVisible).toBe(true);
        expect(options.dialogHidden).toBe(true);
        expect(options.destinationHidden).toBe(true);
        expect(options.playerTransform).toBe(contact.playerTransform);
        expect(options.visitVisible, 'Visit ' + boatName).toBe(true);
        expect(options.examineVisible, 'Examine ' + boatName).toBe(true);
        expect(options.menuOwnsFocus, 'Choose Option owns focus').toBe(true);
        expect(options.optionsExposed).toBe(true);
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
      await buttons.press({
        selector: '[role="menu"][aria-label="Choose Option"] button[role="menuitem"]',
        text: 'Examine ' + boatName,
      });
      const examineNotice = examineText(lakeGateways.find((p) => p.id === gate)!);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const visible = (node: Element) => {
              const box = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return (
                box.width > 0 &&
                box.height > 0 &&
                style.visibility !== 'hidden' &&
                style.visibility !== 'collapse'
              );
            };
            const menus = [
              ...document.querySelectorAll('[role="menu"][aria-label="Choose Option"]'),
            ];
            const notices = document.querySelectorAll('#toast');
            return {
              menuHidden: menus.length <= 1 && menus.every((node) => !visible(node)),
              dialogHidden: [...document.querySelectorAll('[role="dialog"]')].every(
                (node) => !visible(node),
              ),
              noticeCount: notices.length,
              noticeText: notices[0]?.textContent,
            };
          }),
        )
        .toMatchObject({
          menuHidden: true,
          dialogHidden: true,
          noticeCount: 1,
          noticeText: expect.stringContaining(examineNotice),
        });
      const examined = await exported(page, buttons);
      expect(examined).toEqual({ ...baseline, playTime: examined.playTime });
      await dismiss(buttons);
      const defaultContact = await visibleHull(
        page,
        data.berth,
        examined.position,
        isMobile,
        info,
        'default-visit-camera',
      );
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
      const defaultVisit = await exported(page, buttons);
      let expected = transition(examined, { type: 'route-select', target: gate });
      expected.position = { ...defaultVisit.position };
      expected = transition(expected, { type: 'route-arrive', target: gate });
      expected.playTime = defaultVisit.playTime;
      expect(defaultVisit).toEqual(expected);
      expect(defaultVisit.lake.boat.mode).toBe('ashore');
      await dismiss(buttons);
      const visitContact = await visibleHull(
        page,
        data.berth,
        defaultVisit.position,
        isMobile,
        info,
        'visit-options-camera',
      );
      await openHullOptions('visit-options', visitContact.point);
      await buttons.press({
        selector: '[role="menu"][aria-label="Choose Option"] button[role="menuitem"]',
        text: 'Visit ' + boatName,
      });
      await expect(
        page.getByRole('heading', { name: 'An ordinary crossing', exact: true }),
      ).toBeVisible();
      await settled(page);
      const visited = await exported(page, buttons);
      expected = transition(defaultVisit, { type: 'route-select', target: gate });
      expected.position = { ...visited.position };
      expected = transition(expected, { type: 'route-arrive', target: gate });
      expected.playTime = visited.playTime;
      expect(visited).toEqual(expected);
      expect(visited.lake.boat.mode).toBe('ashore');
      // Export opens settings; return through the same actual model before explicitly boarding.
      await dismiss(buttons);
      const boardContact = await visibleHull(
        page,
        data.berth,
        visited.position,
        isMobile,
        info,
        'board-context-camera',
      );
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
      await buttons.press({
        selector: `#overlay button[data-action="journey"][data-value="${gate}"]`,
      });
      await expect(page.locator('#game-canvas')).toHaveAttribute('data-region', 'galilee-water');
      await settled(page);
      const boarded = await exported(page, buttons),
        expectedBoarded = transition(beforeBoard, { type: 'journey', gateway: gate });
      expectedBoarded.playTime = boarded.playTime;
      expect(boarded).toEqual(expectedBoarded);
      expect(boarded.lake.boat.mode).toBe('afloat');
      expect(boarded.position).toEqual(LANDINGS[data.berth].water);
      await dismiss(buttons);
      const returned = await dockNative(page, boarded, data.berth, buttons);
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
      try {
        await buttons?.finish();
      } catch (error) {
        buttonCleanupError = error;
      }
      await cleanup?.().catch(() => {});
      await touch?.detach().catch(() => {});
    }
    if (buttonCleanupError) throw buttonCleanupError;
  });
}
