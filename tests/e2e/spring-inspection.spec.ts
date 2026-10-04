import { test, expect } from '@playwright/test';
import { roadStart } from '../helpers/road';
import { ready, visit, act, dismiss, exported } from '../helpers/connection-browser';

test('full spring inspections remember each clearance and the carried or returned scoop', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const first = info.project.name === 'mobile-chromium' ? 'silt' : 'inlet';
  const second = first === 'inlet' ? 'silt' : 'inlet';
  await ready(page, roadStart());
  await page.getByRole('button', { name: 'Settings and saves' }).click();
  await page.locator('[data-setting="textSize"]').selectOption('large');
  await page.locator('[data-setting="reducedMotion"]').check();
  await dismiss(page);
  const narration = page.locator('.galilee-work > .panel-lead');
  await visit(page, 'spring-source');
  await act(page, 'galilee-action', 'spring-start');
  await act(page, 'galilee-action', 'spring-note-source');
  await visit(page, 'spring-basins');
  await act(page, 'galilee-action', 'spring-note-basins');
  await visit(page, 'spring-tools');
  await act(page, 'galilee-action', 'spring-borrow');
  await act(page, 'work-inspect');
  await expect(narration).toContainText('rack is empty while you carry the wooden scoop');
  await expect(narration).not.toContainText('scoop lies on a low rack');
  await act(page, 'work-open', 'spring-tools');
  await expect(page.locator('.work-panel')).toBeVisible();

  await visit(page, first === 'inlet' ? 'spring-source' : 'channel-entry');
  await act(page, 'galilee-action', 'spring-clear-' + first);
  await visit(page, 'spring-source');
  await act(page, 'work-inspect');
  if (first === 'inlet') {
    await expect(narration).toContainText('inlet stones lie beside the source');
    await expect(narration).toContainText('Silt still fills the entry trough');
  } else {
    await expect(narration).toContainText('Loose stones still interrupt the inlet');
    await expect(narration).toContainText('entry trough is clear of silt');
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.work-panel')).toBeVisible();

  await visit(page, second === 'inlet' ? 'spring-source' : 'channel-entry');
  await act(page, 'galilee-action', 'spring-clear-' + second);
  await visit(page, 'spring-source');
  await act(page, 'work-inspect');
  await expect(narration).toContainText('inlet stones lie beside the source');
  await expect(narration).toContainText('entry trough is clear of silt');
  await expect(narration).not.toContainText('interrupt');
  await expect(narration).not.toContainText('fills the entry trough');
  await expect(page.locator('.panel')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('cleared-spring-inspection.png') });
  await page.keyboard.press('Escape');

  await visit(page, 'spring-tools');
  await act(page, 'work-inspect');
  await expect(narration).toContainText('rack is empty while you carry');
  await expect(narration).toContainText('inlet and entry trough are clear');
  await expect(narration).toContainText('Put the scoop back before turning');
  await act(page, 'work-open', 'spring-tools');
  await act(page, 'galilee-action', 'spring-return');
  await act(page, 'work-inspect');
  await expect(narration).toContainText('scoop lies on a low rack');
  await expect(narration).toContainText('Turn the channel sections with free hands');
  await expect(narration).not.toContainText('rack is empty');
  await expect(narration).not.toContainText('Put the scoop back');
  await page.keyboard.press('Escape');
  await expect(page.locator('.work-panel')).toHaveAttribute('aria-modal', 'false');
  const saved = await exported(page);
  expect(saved.galilee.spring).toMatchObject({
    stage: 'working',
    cleared: [first, second],
    notes: ['source', 'basins'],
  });
  expect(saved.campaign.carrying).toBeNull();

  const north = info.project.name !== 'mobile-chromium';
  for (const [channel, turns] of [
    ['entry', 1],
    ['turn', north ? 3 : 2],
    [north ? 'north' : 'south', north ? 1 : 2],
  ] as const) {
    await visit(page, 'channel-' + channel);
    for (let expected = 0; expected < turns; expected++) {
      const value = channel === 'south' ? expected + 2 : expected;
      await act(page, 'galilee-turn', channel + ':' + value);
    }
  }
  await visit(page, 'spring-source');
  await act(page, 'galilee-action', 'spring-test');
  await expect(page.locator('.work-result')).toContainText(north ? 'north basin' : 'south basin');
  await act(page, 'galilee-action', 'spring-finish-' + (north ? 'patience' : 'sharing'));
  await act(page, 'work-inspect');
  await expect(narration).toContainText('A narrow ribbon of water follows the connected channel');
  await page.keyboard.press('Escape');
  await visit(page, 'spring-tools');
  await act(page, 'work-inspect');
  await expect(narration).toContainText('wooden scoop rests on its low rack');
  await expect(narration).toContainText('entry trough is clear of silt');
  await expect(narration).toContainText('Water follows the channel to a roadside basin');
  await expect(narration).not.toContainText('Use it to');
  await expect(narration).not.toContainText('Put it back');
  const completed = await exported(page);
  expect(completed.galilee.spring).toMatchObject({
    stage: 'complete',
    cleared: [first, second],
    notes: ['source', 'basins'],
    ending: north ? 'patience' : 'sharing',
  });
  expect(completed.campaign.carrying).toBeNull();
});
