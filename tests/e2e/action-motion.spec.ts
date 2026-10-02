import { test, expect } from '@playwright/test';
import { ready, settled, exported } from '../helpers/connection-browser';
import { action, completedEpisode } from '../helpers/campaign';

test('a completed practical action yields to the first real walking frame', async ({ page }) => {
  const state = action(action(completedEpisode(), 'life-bench-inspect'), 'life-method-lashing');
  await ready(page, state);
  await page.getByRole('button', { name: 'Face north', exact: true }).click();
  await settled(page);
  const clear = page.locator('#action-tray [data-value="life-clear-bench"]');
  await expect(clear).toBeEnabled();
  // Observe and move at the actual animation checkpoint. Separate browser commands
  // can outlast a work gesture on software WebGL and miss the former sliding pose.
  const walking = await clear.evaluate(
    (button) =>
      new Promise<{ action: string; pose: string; moved: boolean }>((resolve, reject) => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
        const minimap = document.querySelector('.minimap')!;
        // Progress refreshes replace the SVG; the button owns the stable lifetime.
        const position = () => document.querySelector('#minimap-player')!.getAttribute('transform');
        let origin = position();
        let working = false;
        const send = (type: string) =>
          canvas.dispatchEvent(
            new KeyboardEvent(type, { bubbles: true, cancelable: true, key: 's', code: 'KeyS' }),
          );
        const finish = () => {
          clearTimeout(timeout);
          observer.disconnect();
          send('keyup');
        };
        const timeout = setTimeout(() => {
          finish();
          reject(new Error('The accepted repair and its first walking frame must be observed'));
        }, 15_000);
        const observer = new MutationObserver(() => {
          if (!working && canvas.dataset.actionMotion === 'Repair') {
            working = true;
            origin = position();
            send('keydown');
          }
          if (!working || position() === origin) return;
          const result = {
            action: canvas.dataset.actionMotion!,
            pose: canvas.dataset.actorPose!,
            moved: true,
          };
          finish();
          resolve(result);
        });
        observer.observe(canvas, {
          attributes: true,
          attributeFilter: ['data-action-motion', 'data-actor-pose'],
        });
        observer.observe(minimap, {
          attributes: true,
          attributeFilter: ['transform'],
          childList: true,
          subtree: true,
        });
        (button as HTMLButtonElement).click();
      }),
  );
  expect(walking).toEqual({ action: '', pose: 'Walk', moved: true });
  const saved = await exported(page);
  expect(saved.life.bench.cleared).toBe(true);
  expect(saved.life.bench.stage).toBe('working');
  expect(saved.campaign.carrying).toBeNull();
});
