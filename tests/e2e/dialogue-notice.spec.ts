import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import {
  captureDialogueNotice,
  checkDialogueNoticeLifecycle,
  openDialogueNotice,
  readyDialogueNotice,
  disposeDialogueNotice,
} from '../helpers/dialogue-notice-browser';

test.afterEach(async ({ page }, info) => {
  await disposeDialogueNotice(page, info);
});

test('export feedback stays naturally sized above dialogue and remains in Messages after expiry', async ({
  page,
  isMobile,
}, info) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const imported = await readyDialogueNotice(page, info);
  const before = await openDialogueNotice(page);
  expect({ ...before, playTime: imported.playTime }).toEqual(imported);
  await checkDialogueNoticeLifecycle(page, info, 'standard', before);
});

test('short dialogue feedback clears the toolbar and answers through narrow landscape resizing', async ({
  page,
  isMobile,
}, info) => {
  await page.setViewportSize(isMobile ? { width: 568, height: 320 } : { width: 844, height: 390 });
  const imported = await readyDialogueNotice(page, info);
  const before = await openDialogueNotice(page);
  expect({ ...before, playTime: imported.playTime }).toEqual(imported);
  const first = await checkDialogueNoticeLifecycle(page, info, 'short', before);
  if (!isMobile) return;

  // A fresh actual native Export starts one ordinary lease for both resize boundaries.
  // Arm before that export, rather than depending on the preceding state-check export
  // still being visible after its driver/file work.
  const beforeResize = await openDialogueNotice(page);
  expect({ ...beforeResize, playTime: first.after.playTime }).toEqual(first.after);
  // Retain both real viewport captures before host JSON/PNG delivery can spend
  // the remaining lease. A truthful earlier-viewport PNG cannot be taken after
  // resizing; retain its timestamped geometry rather than relabel the later image.
  const from = await captureDialogueNotice(page, info, 'before-resize', false);
  await page.setViewportSize({ width: 390, height: 320 });
  const below480 = await captureDialogueNotice(page, info, 'below480', false);
  await writeFile(info.outputPath('before-resize-visible.json'), JSON.stringify(from, null, 2));
  await writeFile(info.outputPath('below480-visible.json'), JSON.stringify(below480, null, 2));
  await page.screenshot({ path: info.outputPath('below480-support.png'), scale: 'css' });
  const resized = await checkDialogueNoticeLifecycle(
    page,
    info,
    'below480',
    beforeResize,
    below480,
  );
  expect(resized.held.viewport).toEqual({ width: 390, height: 320 });
  await writeFile(
    info.outputPath('native-dialogue-resize.json'),
    JSON.stringify(
      {
        from: from.viewport,
        to: resized.held.viewport,
        nativeViewportResize: true,
        freshActualExport: true,
        bothViewportCapturesBeforeHostReporting: true,
        beforeResizePngOmitted:
          'Actual resize precedes reporting; retained geometry preserves its original viewport.',
        focusedAnswerAfterResize: resized.held.focusedValue,
      },
      null,
      2,
    ),
  );
});
