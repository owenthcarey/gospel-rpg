import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseSave } from '../../src/persistence/schema';
import type { GameState } from '../../src/game/types';
import { dismiss, exported, ready, settled, visit } from '../helpers/connection-browser';

async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function prepare(page: Page) {
  const fixture = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v1-arrival.json', 'utf8')),
  ).state;
  // A legal authored position within Simon's normal interaction radius avoids
  // walking or progression becoming a side effect of this focus regression.
  const nearby = { ...fixture, position: { x: 4, z: 0 } };
  await ready(page, nearby);
  const before = await exported(page);
  await dismiss(page);
  expect(before.position).toEqual(nearby.position);
  expect(before.connection.route).toBeNull();
  return before;
}

function portable(state: GameState) {
  return { ...state, playTime: 0 };
}

async function finish(page: Page, info: TestInfo, before: GameState, name: string) {
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#game-canvas')).toBeFocused();
  const after = await exported(page);
  expect(portable(after)).toEqual(portable(before));
  expect(after.playTime).toBeGreaterThanOrEqual(before.playTime);
  await writeFile(
    info.outputPath(`${name}-state.json`),
    JSON.stringify({ before, after }, null, 2),
  );
  await dismiss(page);
}

async function recordFocus(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), scale: 'css' });
  await writeFile(
    info.outputPath(`${name}-focus.json`),
    JSON.stringify(
      await page.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        return {
          action: active.dataset.action,
          value: active.dataset.value,
          name: active.getAttribute('aria-label') ?? active.textContent,
          dialogText: document.querySelector('.dialogue-box')?.textContent,
        };
      }),
      null,
      2,
    ),
  );
}

test('ordinary conversation initialization focuses the first answer and keeps native Tab and Escape usable', async ({
  page,
}, info) => {
  const before = await prepare(page);
  await visit(page, 'simon');
  await frames(page);
  const choices = page.locator('.dialogue-box [data-action="choice"]');
  await expect(choices.first()).toBeEnabled();
  await expect(choices.first()).toBeFocused();
  await recordFocus(page, info, 'ordinary-first-answer');
  await page.keyboard.press('Tab');
  await expect(choices.nth(1)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(choices.first()).toBeFocused();
  await finish(page, info, before, 'ordinary-first-answer');
});

for (const selected of ['leave', 'alternate'] as const) {
  test(`deferred conversation initialization preserves the later ${selected} control selection`, async ({
    page,
  }, info) => {
    const before = await prepare(page);
    await page.evaluate((selectedControl) => {
      const overlay = document.querySelector('#overlay')!;
      const checkpoint = document.documentElement;
      delete checkpoint.dataset.dialogueFocusSelected;
      const observer = new MutationObserver(() => {
        const target = overlay.querySelector<HTMLButtonElement>(
          selectedControl === 'leave'
            ? '.dialogue-box [data-action="close"]'
            : '.dialogue-box [data-action="choice"][data-value="1"]',
        );
        if (!target) return;
        // Deterministically choose an existing control after insertion but before
        // paint, as native keyboard or assistive focus can do on a slow frame.
        target.focus();
        checkpoint.dataset.dialogueFocusSelected = String(document.activeElement === target);
        observer.disconnect();
      });
      observer.observe(overlay, { childList: true });
    }, selected);
    await visit(page, 'simon');
    await expect(page.locator('html')).toHaveAttribute('data-dialogue-focus-selected', 'true');
    await frames(page);
    const target =
      selected === 'leave'
        ? page.getByRole('button', { name: 'Leave conversation', exact: true })
        : page.locator('.dialogue-box [data-action="choice"][data-value="1"]');
    await expect(target).toBeFocused();
    await recordFocus(page, info, `later-${selected}`);
    await page.keyboard.press('Tab');
    if (selected === 'leave') {
      await expect(page.getByRole('button', { name: 'Pause motion', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('.dialogue-box [data-action="choice"]').first()).toBeFocused();
    } else {
      await expect(
        page.locator('.dialogue-box [data-action="choice"][data-value="2"]'),
      ).toBeFocused();
    }
    await finish(page, info, before, `later-${selected}`);
  });
}

test('queued conversation initialization respects a replaced surface and its later selected control', async ({
  page,
}, info) => {
  const before = await prepare(page);
  await page.evaluate(() => {
    const overlay = document.querySelector('#overlay')!;
    const checkpoint = document.documentElement;
    delete checkpoint.dataset.dialogueReplacementSelected;
    let oldSurface: Element | undefined;
    const observer = new MutationObserver(() => {
      const surface = overlay.querySelector('.dialogue-box');
      if (!surface) return;
      if (!oldSurface) {
        oldSurface = surface;
        // This real, enabled authored answer only changes the conversation node.
        // Its action enters the same queue as pointer/keyboard activation.
        surface.querySelector<HTMLButtonElement>('[data-action="choice"][data-value="0"]')!.click();
        return;
      }
      if (surface === oldSurface) return;
      const leave = surface.querySelector<HTMLButtonElement>('[data-action="close"]')!;
      leave.focus();
      checkpoint.dataset.dialogueReplacementSelected = String(
        !oldSurface.isConnected && document.activeElement === leave,
      );
      observer.disconnect();
    });
    observer.observe(overlay, { childList: true });
  });
  await visit(page, 'simon');
  await expect(page.getByRole('dialog')).toContainText('A place by the water');
  await expect(page.locator('html')).toHaveAttribute('data-dialogue-replacement-selected', 'true');
  await frames(page);
  await expect(page.getByRole('button', { name: 'Leave conversation', exact: true })).toBeFocused();
  await recordFocus(page, info, 'replacement-leave');
  await finish(page, info, before, 'replacement-leave');
});
