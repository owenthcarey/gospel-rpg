import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { transition } from '../../src/game/quest';
import { examineText } from '../../src/content/examine';
import { dismiss, exported, settled } from '../helpers/connection-browser';
import {
  wellFixture,
  well,
  activateWellControl,
  animationCallbacks,
  approachLaneWell,
  visibleLaneWell,
  openWellOptions,
  nativeWellInput,
} from '../helpers/lane-well-browser';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('the lane well model exposes native Inspect, Examine and cancellation without changing earned state', async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const setup = await approachLaneWell(page, isMobile, info),
    menu = page.getByRole('menu', { name: 'Choose Option', exact: true });
  const cancelledContact = await openWellOptions(
    page,
    isMobile,
    info,
    'cancel-options',
    setup.approached.position,
  );
  await activateWellControl(menu.getByRole('menuitem', { name: 'Cancel', exact: true }), isMobile);
  await expect(menu).toBeHidden();
  const cancelled = await exported(page);
  expect(cancelled).toEqual({ ...setup.approached, playTime: cancelled.playTime });
  await dismiss(page);

  const examineContact = await openWellOptions(
      page,
      isMobile,
      info,
      'examine-options',
      cancelled.position,
    ),
    examine = menu.getByRole('menuitem', { name: 'Examine ' + well.name, exact: true }),
    hasExamine = (await examine.count()) === 1;
  if (hasExamine) {
    await activateWellControl(examine, isMobile);
    await expect(menu).toBeHidden();
    await expect(page.locator('#toast')).toContainText(examineText(well));
    await page.screenshot({ path: info.outputPath('native-well-examined.png'), scale: 'css' });
  } else {
    // Preserve an honest before-code result; missing Examine cannot be activated.
    await activateWellControl(
      menu.getByRole('menuitem', { name: 'Cancel', exact: true }),
      isMobile,
    );
  }
  await expect(page.getByRole('dialog')).toBeHidden();
  const examinedOrUnavailable = await exported(page);
  expect(examinedOrUnavailable).toEqual({ ...cancelled, playTime: examinedOrUnavailable.playTime });
  expect(hash(await readFile(wellFixture))).toBe(hash(setup.bytes));
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('well-options-full-state.json'),
    JSON.stringify(
      {
        original: setup.original,
        approached: setup.approached,
        cancelledContact,
        cancelled,
        examineContact,
        hasExamine,
        examinedOrUnavailable,
        errors,
      },
      null,
      2,
    ),
  );
  expect.soft(cancelledContact.options).toContain('Inspect ' + well.name);
  expect.soft(hasExamine, 'actual model menu must offer read-only Examine').toBe(true);
});

test('the lane well default native model contact opens its authored reading without a ground walk', async ({
  page,
  isMobile,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const setup = await approachLaneWell(page, isMobile, info),
    calibration = await visibleLaneWell(
      page,
      setup.approached.position,
      isMobile,
      info,
      'default-inspect',
    );
  const observation = await page.evaluateHandle(() => {
    const sample = () => {
      const flag = document.querySelector<SVGElement>('.minimap-destination');
      return {
        time: performance.now(),
        standing: document.querySelector('#minimap-player')?.getAttribute('transform'),
        flagVisible: !!flag && getComputedStyle(flag).display !== 'none',
        status: document.querySelector('#travel-status')?.textContent?.trim(),
        heading: document.querySelector('#overlay h2')?.textContent,
        pending: document.querySelector<HTMLElement>('#ui')?.dataset.actionPending,
      };
    };
    const samples = [sample()];
    const observer = new MutationObserver(() => samples.push(sample()));
    observer.observe(document.querySelector('#ui')!, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'transform', 'data-action-pending'],
    });
    return { samples, cleanup: () => observer.disconnect() };
  });
  let samples: Awaited<ReturnType<typeof observation.jsonValue>>['samples'];
  let contact: Awaited<ReturnType<typeof nativeWellInput>>;
  let actualReading: boolean;
  try {
    contact = await nativeWellInput(
      page,
      calibration.point,
      isMobile,
      false,
      0,
      info,
      'default-inspect',
      async () => {
        if (isMobile) await page.touchscreen.tap(calibration.point.x, calibration.point.y);
        else await page.mouse.click(calibration.point.x, calibration.point.y);
      },
    );
    await settled(page);
    await animationCallbacks(page);
    await page.waitForTimeout(400);
    actualReading = await page.getByRole('heading', { name: well.name, exact: true }).isVisible();
    await page.screenshot({
      path: info.outputPath('default-well-actual-result.png'),
      scale: 'css',
    });
    // A native Journal handoff stops an anonymous ground path, if the old model fell through.
    // It does not require a saved-route Cancel or a driver-observed flag.
    if (!actualReading)
      await activateWellControl(page.locator('.toolbar [data-action="journal"]'), isMobile);
    samples = await observation.evaluate((value) => value.samples);
  } finally {
    try {
      await observation.evaluate((value) => value.cleanup());
    } finally {
      await observation.dispose();
    }
  }
  const after = await exported(page);
  const expected = transition(
    transition(setup.approached, { type: 'route-select', target: well.id }),
    { type: 'route-arrive', target: well.id },
  );
  expect(hash(await readFile(wellFixture))).toBe(hash(setup.bytes));
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('well-default-full-state.json'),
    JSON.stringify(
      {
        original: setup.original,
        approached: setup.approached,
        calibration,
        contact,
        samples,
        actualReading,
        after,
        expected,
        errors,
      },
      null,
      2,
    ),
  );
  expect.soft(actualReading, 'actual bare-model input opens the authored water point').toBe(true);
  expect.soft(after).toEqual({ ...expected, playTime: after.playTime });
});
