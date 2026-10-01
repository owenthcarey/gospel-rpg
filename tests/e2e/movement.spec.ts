import { test, expect } from '@playwright/test';
import { district } from '../helpers/campaign';
import { ready, exported } from '../helpers/connection-browser';

test('diagonal keyboard movement follows a room wall without clipping through it', async ({
  page,
}) => {
  const state = district();
  state.region = 'gathering-house';
  state.position = { x: 5.4, z: -3 };
  await ready(page, state);
  await page.locator('#game-canvas').focus();
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(1400);
  await page.keyboard.up('d');
  await page.keyboard.up('w');
  const saved = await exported(page);
  expect(saved.position.x).toBeGreaterThan(5.4);
  expect(saved.position.x).toBeLessThan(5.5);
  expect(saved.position.z).toBeGreaterThan(-2.5);
  expect(saved.quest).toBe(state.quest);
  expect(saved.campaign.roof.stage).toBe(state.campaign.roof.stage);
});
