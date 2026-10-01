import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { dismiss, exported, ready, settled } from '../helpers/connection-browser';
import { parseSave } from '../../src/persistence/schema';

const warning = 'Progress could not be saved. Export your journey from Settings to keep it.';

async function exportOpenMenu(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await settled(page);
  return parseSave(JSON.parse(await readFile((await (await download).path())!, 'utf8'))).state;
}

/** Fail only actual journey writes through the public IndexedDB API in this isolated context. */
async function storageProbe(page: Page) {
  return page.evaluateHandle(() => {
    const put = IDBObjectStore.prototype.put;
    let fail = false;
    let attempted = 0;
    let failed = 0;
    let succeeded = 0;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name !== 'saves') return put.apply(this, args);
      attempted++;
      if (fail) {
        failed++;
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      const request = put.apply(this, args);
      request.addEventListener('success', () => succeeded++);
      return request;
    };
    return {
      fail(value: boolean) {
        fail = value;
      },
      counts() {
        return { attempted, failed, succeeded };
      },
      async saved() {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('the-way-journeys');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<unknown>((resolve, reject) => {
            const request = db.transaction('saves', 'readonly').objectStore('saves').get('auto');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        } finally {
          db.close();
        }
      },
      dispose() {
        IDBObjectStore.prototype.put = put;
      },
    };
  });
}

test('autosave warns again after recovery without flooding messages or losing portable backups', async ({
  page,
}, info) => {
  const pageErrors: string[] = [];
  const consoleReads: Promise<{
    formatted: string;
    arguments: (string | { name: string; message: string })[];
  }>[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error')
      consoleReads.push(
        Promise.all(
          message
            .args()
            .map((argument) =>
              argument.evaluate((value: unknown) =>
                value instanceof Error || value instanceof DOMException
                  ? { name: value.name, message: value.message }
                  : String(value),
              ),
            ),
        ).then((values) => ({ formatted: message.text(), arguments: values })),
      );
  });
  await ready(page);
  await expect(page.locator('.chapter-card')).toHaveCount(0);
  const before = await exported(page);
  const probe = await storageProbe(page);
  const auto = async () => parseSave(await probe.evaluate((value) => value.saved())).state;
  const counts = () => probe.evaluate((value) => value.counts());
  const settings = () =>
    page.getByRole('button', { name: 'Settings and saves', exact: true }).click();
  const messages = () =>
    page.getByRole('button', { name: 'Recent game messages', exact: true }).click();
  const warnings = page.locator('.message-list li[data-kind="warning"]');
  const toast = page.locator('#toast');
  try {
    await probe.evaluate((value) => value.fail(true));
    await dismiss(page);
    const player = page.locator('#minimap-player');
    const position = await player.getAttribute('transform');
    await page.locator('#game-canvas').focus();
    await page.keyboard.down('d');
    try {
      await expect(player).not.toHaveAttribute('transform', position!);
    } finally {
      await page.keyboard.up('d');
    }
    await settings();
    await expect.poll(async () => (await counts()).failed).toBe(1);
    await expect(toast).toContainText(warning);
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('data-kind', 'warning');
    const retained = await auto();
    expect({ ...retained, playTime: before.playTime }).toEqual(before);
    const backup = await exportOpenMenu(page);
    expect(backup.position).not.toEqual(before.position);
    const continuousFailure = await counts();
    await dismiss(page);
    await messages();
    await expect
      .poll(async () => (await counts()).failed)
      .toBeGreaterThan(continuousFailure.failed);
    await expect(warnings).toHaveCount(1);
    await expect(warnings).toContainText(warning);
    await expect(warnings.locator('.message-repeat')).toHaveCount(0);
    await expect(toast).toBeHidden();

    await probe.evaluate((value) => value.fail(false));
    await dismiss(page);
    await settings();
    await expect.poll(async () => (await counts()).succeeded).toBe(1);
    const recovered = await auto();
    expect({ ...recovered, playTime: backup.playTime }).toEqual(backup);
    const recoveryBackup = await exportOpenMenu(page);
    expect({ ...recoveryBackup, playTime: recovered.playTime }).toEqual(recovered);
    const successfulWrites = await counts();

    // A later outage must raise fresh feedback after the earlier warning was acknowledged.
    await probe.evaluate((value) => value.fail(true));
    await dismiss(page);
    await settings();
    await expect.poll(async () => (await counts()).failed).toBeGreaterThan(successfulWrites.failed);
    await expect(toast).toContainText(warning);
    await expect(toast).toBeVisible();
    await expect(toast).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
    expect(await auto()).toEqual(recovered);
    await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('renewed-save-warning.png'), scale: 'css' });
    const noticeBounds = (await toast.boundingBox())!;
    const bodyBounds = (await page.locator('.panel-body').boundingBox())!;
    const footerBounds = (await page.locator('.panel-footer').boundingBox())!;
    expect(
      noticeBounds.y,
      'a menu notice must leave reading content unobscured',
    ).toBeGreaterThanOrEqual(bodyBounds.y + bodyBounds.height);
    expect(
      noticeBounds.y + noticeBounds.height,
      'a menu notice must leave footer controls clear',
    ).toBeLessThanOrEqual(footerBounds.y - 8);
    const latestBackup = await exportOpenMenu(page);
    expect({ ...latestBackup, playTime: recovered.playTime }).toEqual(recovered);
    await probe.evaluate((value) => value.fail(false));
    await dismiss(page);
    await messages();
    await expect(warnings).toHaveCount(2);
    await expect(warnings.locator('.message-repeat')).toHaveCount(0);
    await expect
      .poll(async () => (await counts()).succeeded)
      .toBeGreaterThan(successfulWrites.succeeded);
    const consoleErrors = await Promise.all(consoleReads);
    await writeFile(
      info.outputPath('save-recovery.json'),
      JSON.stringify(
        {
          before,
          retained,
          backup,
          recovered,
          latestBackup,
          counts: await counts(),
          consoleErrors,
        },
        null,
        2,
      ),
    );
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toHaveLength((await counts()).failed);
    for (const error of consoleErrors) {
      expect(error.arguments).toEqual([
        'Save failed',
        { name: 'QuotaExceededError', message: 'Storage is full' },
      ]);
    }
  } finally {
    await probe.evaluate((value) => value.dispose());
    await probe.dispose();
  }
});
