import { test, expect } from '@playwright/test';
import { SCENE_IDS } from '../../src/game/episode/types';
import { ROOF_SCENES } from '../../src/game/campaign/types';
import { NAIN_SCENES } from '../../src/game/road/types';
import { STORM_SCENES } from '../../src/game/lake/types';
import {
  ready,
  settled,
  dismiss,
  visit,
  choice,
  act,
  passage,
  exported,
  readAccount,
} from '../helpers/connection-browser';

test('one fresh traveler completes all four chapters without replacing or importing campaign state', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'mobile-chromium',
    'One continuous desktop journey complements the complete phone chapter and interruption tests.',
  );
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await visit(page, 'simon');
  await choice(page, 'Of course');
  await choice(page, 'I’ll bring the net');
  await visit(page, 'nets');
  await choice(page, 'Take the mended net');
  await visit(page, 'miriam');
  await choice(page, 'Take the bread for Simon');
  await visit(page, 'simon');
  await choice(page, 'Give Simon');
  await visit(page, 'jesus');
  await choice(page, 'Stay a moment and listen');
  await visit(page, 'simon');
  await choice(page, 'I’ll help make room');
  for (const [place, label] of [
    ['supply-basket', 'Carry the empty basket'],
    ['landing', 'Set the basket at the landing'],
    ['mooring', 'Coil the loose mooring rope'],
    ['gathering', 'Make room in the gathering'],
  ]) {
    await visit(page, place!);
    await choice(page, label!);
  }
  await visit(page, 'viewpoint');
  await choice(page, 'Witness the account on the lake');
  await readAccount(page, SCENE_IDS);
  for (const [place, label] of [
    ['landing', 'Set a filled basket'],
    ['miriam', 'Thank Miriam'],
    ['ezra', 'Carry Ezra’s question'],
  ]) {
    await visit(page, place!);
    await choice(page, label!);
  }
  await visit(page, 'viewpoint');
  await choice(page, 'The other boat');
  await choice(page, 'Carry this memory with me');
  const chapterOne = await exported(page);
  expect(chapterOne.episode.stage).toBe('complete');
  await dismiss(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  await settled(page);
  await passage(page, 'to-lanes', 'capernaum-lanes');
  await passage(page, 'to-house', 'gathering-house');
  await visit(page, 'house-viewpoint');
  await act(page, 'campaign-action', 'roof-enter');
  await readAccount(page, ROOF_SCENES);
  await visit(page, 'house-viewpoint');
  await act(page, 'campaign-action', 'after-house');
  await passage(page, 'house-exit', 'capernaum-lanes');
  await visit(page, 'ruth');
  await act(page, 'campaign-action', 'after-ruth');
  await passage(page, 'to-bakehouse', 'bakehouse');
  await visit(page, 'hannah');
  await act(page, 'campaign-action', 'after-hannah');
  await passage(page, 'bakehouse-exit', 'capernaum-lanes');
  await passage(page, 'to-house', 'gathering-house');
  await visit(page, 'house-viewpoint');
  await act(page, 'roof-reflect', 'welcome');
  const chapterTwo = await exported(page);
  expect(chapterTwo.episode).toEqual(chapterOne.episode);
  expect(chapterTwo.campaign.roof.stage).toBe('complete');
  await passage(page, 'house-exit', 'capernaum-lanes');
  await passage(page, 'to-road', 'galilean-road');
  await passage(page, 'to-nain', 'nain-gate');
  await visit(page, 'nain-viewpoint');
  await act(page, 'road-action', 'nain-enter');
  await readAccount(page, NAIN_SCENES);
  for (const [place, id] of [
    ['nain-viewpoint', 'nain-after-gate'],
    ['nain-courtyard', 'nain-after-courtyard'],
    ['adina', 'nain-after-neighbor'],
  ]) {
    await visit(page, place!);
    await act(page, 'road-action', id);
  }
  await visit(page, 'nain-viewpoint');
  await act(page, 'nain-reflect', 'restoration');
  const chapterThree = await exported(page);
  expect(chapterThree.campaign.roof).toEqual(chapterTwo.campaign.roof);
  expect(chapterThree.road.chapter.stage).toBe('complete');
  await passage(page, 'nain-exit', 'galilean-road');
  await passage(page, 'road-to-lanes', 'capernaum-lanes');
  await passage(page, 'to-shore', 'capernaum');
  await passage(page, 'board-capernaum', 'galilee-water');
  await passage(page, 'dock-sheltered-cove', 'sheltered-cove');
  await visit(page, 'storm-viewpoint');
  await act(page, 'lake-action', 'enter');
  await readAccount(page, STORM_SCENES);
  for (const [place, id] of [
    ['cove-shore', 'after-landing'],
    ['cove-lookout', 'after-lookout'],
    ['dalia', 'after-neighbor'],
  ]) {
    await visit(page, place!);
    await act(page, 'lake-action', id);
  }
  await visit(page, 'storm-viewpoint');
  await act(page, 'storm-reflect', 'wonder');
  const final = await exported(page);
  expect(final.episode).toEqual(chapterOne.episode);
  expect(final.campaign.roof).toEqual(chapterTwo.campaign.roof);
  expect(final.road.chapter).toEqual(chapterThree.road.chapter);
  expect(final.lake.chapter.stage).toBe('complete');
  expect(
    final.journal.filter((id) => /^(scene-|roof-scene-|nain-scene-|storm-scene-)/.test(id)),
  ).toHaveLength(31);
  expect(final.life.thread.stage).toBe('not-started');
  expect(final.galilee.shelter.stage).toBe('not-started');
  expect(final.connection.home.visits).toEqual({});
  await dismiss(page);
  await page.locator('.toolbar [data-action="journal"]').click();
  await expect(page.locator('.home-summary')).toContainText('Return to Leah, Hannah and Miriam');
  await page.screenshot({ path: info.outputPath('four-chapters-complete.png') });
  expect(errors).toEqual([]);
});
