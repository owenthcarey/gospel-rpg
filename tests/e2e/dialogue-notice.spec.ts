import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { dismiss, visit } from '../helpers/connection-browser';
import {
  captureDialogueNotice,
  checkDialogueNoticeLifecycle,
  openDialogueNotice,
  readyDialogueNotice,
} from '../helpers/dialogue-notice-browser';

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

  // The final state export above creates fresh actual feedback. Reopen Simon
  // before a real resize, so both narrow boundaries are observed while the
  // notice is visible without extending or mocking its 4.8-second lease.
  await dismiss(page);
  await visit(page, 'simon');
  const from = await captureDialogueNotice(page, info, 'before-resize');
  await page.setViewportSize({ width: 390, height: 320 });
  const resized = await checkDialogueNoticeLifecycle(page, info, 'below480', first.after);
  expect(resized.held.viewport).toEqual({ width: 390, height: 320 });
  await writeFile(
    info.outputPath('native-dialogue-resize.json'),
    JSON.stringify(
      {
        from: from.viewport,
        to: resized.held.viewport,
        nativeViewportResize: true,
        freshActualExport: true,
        focusedAnswerAfterResize: resized.held.focusedValue,
      },
      null,
      2,
    ),
  );
});
