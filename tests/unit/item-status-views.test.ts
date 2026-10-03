import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSave } from '../../src/persistence/schema';
import { carriedView, contextView } from '../../src/ui/views/campaign';
import { recap } from '../../src/ui/views/connection';
import { journeyOverview, workSurface } from '../../src/ui/views/exploration';
import { galileeContext } from '../../src/ui/views/galilee';
import type { RestSite, RestSupply } from '../../src/game/galilee/types';
import { actionAllowed } from '../../src/content/campaign/actions';
import { action, at, district } from '../helpers/campaign';

const heldName = (html: string) =>
  html.match(/<p class="held-notice">In your hands: ([^<]+)<\/p>/)?.[1];
const fixture = (file: string) =>
  parseSave(JSON.parse(readFileSync(`tests/fixtures/saves/${file}`, 'utf8'))).state;
const returnTarget = (html: string) =>
  html.match(
    /<button[^>]*data-action="travel"[^>]*data-value="([^"]+)"[^>]*>Find the return point[ <]/,
  )![1];
const nextTarget = (html: string) =>
  html.match(
    /<button[^>]*data-action="travel"[^>]*data-value="([^"]+)"[^>]*>Find the next stop[ <]/,
  )?.[1];
const inspectionStatus = (html: string, supply: RestSupply) =>
  html.match(new RegExp(`<strong>${supply}</strong><small>([^<]+)`))![1];
const workStatus = (html: string, supply: RestSupply) =>
  html.match(new RegExp(`<strong>${supply}</strong> ([^<]+)`))![1];
const commands = (html: string) =>
  [...html.matchAll(/<button[^>]*data-action="galilee-action"[^>]*>/g)].map(([button]) => ({
    id: button.match(/data-value="([^"]+)"/)![1],
    disabled: button.includes('disabled'),
  }));

describe('earned supplies stay consistent across reading views', () => {
  it.each([
    ['v6-carrying-pouch.json', 'ruth', 'Return the pouch to Ruth'],
    ['v5-carrying-water.json', 'courtyard-table', 'Set what you carry'],
    ['v8-supply-on-the-road.json', 'rest-shade', 'Place what you carry'],
  ])(
    'keeps the carried item’s next stop when tracking another story for %s',
    (file, target, text) => {
      const state = fixture(file!);
      state.tracking = 'roof';
      const before = structuredClone(state);
      const satchel = carriedView(state);
      expect(nextTarget(satchel)).toBe(target);
      expect(satchel).toContain(text);
      expect(state).toEqual(before);
    },
  );

  it('offers only the return point when the carried item’s story is complete', () => {
    const state = fixture('v8-supply-on-the-road.json');
    state.galilee.shelter.stage = 'complete';
    const satchel = carriedView(state);
    expect(returnTarget(satchel)).toBe('rest-supplies');
    expect(nextTarget(satchel)).toBeUndefined();
  });

  it.each([
    ['v8-supply-on-the-road.json', 'galilean-road', 'In your hands'],
    ['v9-afloat-with-supply.json', 'galilee-water', 'Stowed aboard'],
  ])(
    'keeps the same carried screen and return route across views for %s',
    (file, region, status) => {
      const state = fixture(file!);
      const before = structuredClone(state);
      expect(state.region).toBe(region);
      expect(state.campaign.carrying).toBe('rest-screen');
      const satchel = carriedView(state);
      const overview = journeyOverview(state);
      const journey = recap(state);
      const headings = [
        satchel.match(/<span class="eyebrow">([^<]+)<\/span>/)![1]!.toLowerCase(),
        overview.match(/<aside class="overview-notice"><h4>([^<]+)<\/h4>/)![1]!.toLowerCase(),
        journey.match(/<article><h4>([^<]+)<\/h4><p>To free your hands,/)![1]!.toLowerCase(),
      ];
      expect(headings).toEqual(Array(3).fill(status!.toLowerCase()));
      expect(satchel).toContain('<h3>folding reed screen</h3>');
      for (const view of [satchel, overview, journey]) {
        expect(view).toContain('return the folding reed screen to the farm supplies rack.');
        expect(returnTarget(view)).toBe('rest-supplies');
      }
      expect(state).toEqual(before);
    },
  );

  it('locates the placed mat at its authored site while the alternative keeps relocation blocked', () => {
    const state = fixture('v8-resting-place-unfinished.json');
    const before = structuredClone(state);
    expect(state.galilee.shelter).toMatchObject({ site: 'shade', placed: ['mat'] });
    const shade = galileeContext('rest-shade', state)!.body;
    const selectedTitle = shade.match(/<section class="rest-plan"[^>]*><h3>([^<]+)<\/h3>/)![1]!;
    for (const site of ['shade', 'breeze'] as RestSite[]) {
      const inspection = galileeContext('rest-' + site, state)!.body;
      const work = workSurface(state, 'rest-' + site);
      expect(commands(work)).toEqual(commands(inspection));
      for (const supply of ['mat', 'water', 'screen'] as RestSupply[])
        expect(workStatus(work, supply)).toBe(inspectionStatus(inspection, supply));
      if (site === 'shade') expect(inspectionStatus(inspection, 'mat')).toBe('Placed here');
      else {
        expect(inspectionStatus(inspection, 'mat')).toContain(selectedTitle);
        expect(inspectionStatus(inspection, 'mat')).not.toBe('At the rack');
        expect(
          commands(work).some(({ id, disabled }) => id === 'shelter-choose-breeze' && !disabled),
        ).toBe(false);
      }
      expect(inspectionStatus(inspection, 'water')).toBe('At the rack');
      expect(inspectionStatus(inspection, 'screen')).toBe('At the rack');
    }
    expect(state).toEqual(before);
  });

  it('keeps carried supply guidance while local work controls await returning to the farm', () => {
    const state = fixture('v8-supply-on-the-road.json');
    const before = structuredClone(state);
    expect(state.campaign.carrying).toBe('rest-screen');
    expect(state.galilee.shelter.placed).toEqual([]);
    const satchelStatus = carriedView(state)
      .match(/<span class="eyebrow">([^<]+)<\/span>/)![1]!
      .toLowerCase();
    for (const site of ['shade', 'breeze'] as RestSite[]) {
      const inspection = galileeContext('rest-' + site, state)!.body;
      const work = workSurface(state, 'rest-' + site);
      expect(inspectionStatus(inspection, 'screen')!.toLowerCase()).toBe(satchelStatus);
      expect(work).toBe('');
      expect(returnTarget(inspection)).toBe(returnTarget(carriedView(state)));
      for (const supply of ['mat', 'water'] as RestSupply[]) {
        expect(inspectionStatus(inspection, supply)).toBe('At the rack');
      }
    }
    expect(state).toEqual(before);
  });
});

describe('context held names follow earned item state', () => {
  it.each(['courtyard', 'bakehouse'] as const)(
    'distinguishes an empty and filled jug through the real %s table flow',
    (location) => {
      const preparing = action(action(district(), 'table-accept'), 'table-' + location);
      const empty = action(preparing, 'take-jug');
      expect(empty.campaign.carrying).toBe('empty-jug');
      const emptyLocal = at(empty, 'water-point');
      const emptyBefore = structuredClone(emptyLocal);
      const emptyBody = contextView('water-point', emptyLocal)!.body;
      expect(heldName(emptyBody)).toBe('empty jug');
      expect(emptyBody).toContain('data-action="campaign-action" data-value="fill-jug"');
      expect(actionAllowed(emptyLocal, 'fill-jug')).toBe(true);
      expect(emptyLocal).toEqual(emptyBefore);

      const filled = action(empty, 'fill-jug');
      expect(filled.campaign.carrying).toBe('water-jug');
      expect(filled.campaign.table).toEqual(preparing.campaign.table);
      const filledBefore = structuredClone(filled);
      const filledBody = contextView('water-point', filled)!.body;
      expect(heldName(filledBody)).toBe('filled jug');
      expect(filledBody).not.toContain('data-action="campaign-action" data-value="fill-jug"');
      expect(actionAllowed(filled, 'fill-jug')).toBe(false);
      expect(carriedView(filled)).toContain('<h3>filled jug</h3>');
      expect(nextTarget(carriedView(filled))).toBe(location + '-table');
      expect(filled).toEqual(filledBefore);

      const tableLocal = at(filled, location + '-table');
      const tableBefore = structuredClone(tableLocal);
      const tableBody = contextView(location + '-table', tableLocal)!.body;
      expect(heldName(tableBody)).toBe('filled jug');
      expect(tableBody).toContain(
        'data-action="campaign-action" data-value="place-water-' + location + '"',
      );
      expect(tableBody).toContain('Set the filled jug on the table');
      expect(actionAllowed(tableLocal, 'place-water-' + location)).toBe(true);
      expect(tableLocal).toEqual(tableBefore);

      const other = location === 'courtyard' ? 'bakehouse' : 'courtyard';
      const wrongLocal = at(filled, other + '-table');
      const wrongBefore = structuredClone(wrongLocal);
      expect(actionAllowed(wrongLocal, 'place-water-' + other)).toBe(false);
      expect(contextView(other + '-table', wrongLocal)!.body).not.toContain(
        'data-action="campaign-action" data-value="place-water-' + other + '"',
      );
      expect(wrongLocal).toEqual(wrongBefore);

      const placed = action(filled, 'place-water-' + location);
      expect(placed.campaign.carrying).toBeNull();
      expect(placed.campaign.table.delivered).toEqual(['water']);
      const placedBefore = structuredClone(placed);
      expect(heldName(contextView(location + '-table', placed)!.body)).toBeUndefined();
      expect(carriedView(placed)).toBe('');
      expect(placed).toEqual(placedBefore);

      const returned = action(filled, 'return-jug');
      expect(returned.campaign.carrying).toBeNull();
      expect(returned.campaign.table).toEqual(preparing.campaign.table);
      const returnedBefore = structuredClone(returned);
      expect(heldName(contextView('jug-shelf', returned)!.body)).toBeUndefined();
      expect(carriedView(returned)).toBe('');
      expect(actionAllowed(returned, 'take-jug')).toBe(true);
      expect(returned).toEqual(returnedBefore);
      const borrowedAgain = action(returned, 'take-jug');
      expect(borrowedAgain.campaign.carrying).toBe('empty-jug');
      expect(heldName(contextView('jug-shelf', borrowedAgain)!.body)).toBe('empty jug');
    },
  );

  it('keeps Ruth’s identified pouch name and real set-back/return boundaries', () => {
    let identified = district();
    for (const id of ['life-thread-accept', 'life-clue-water', 'life-clue-cloth', 'life-identify'])
      identified = action(identified, id);
    expect(identified.life.thread.stage).toBe('identified');
    expect(identified.life.thread.clues).toEqual(['water', 'cloth']);
    expect(identified.campaign.carrying).toBeNull();
    expect(heldName(contextView('sewing-rest', identified)!.body)).toBeUndefined();

    const held = action(identified, 'life-take-pouch');
    expect(held.campaign.carrying).toBe('sewing-pouch');
    expect(held.life.thread).toEqual(identified.life.thread);
    const local = at(held, 'ruth');
    const before = structuredClone(local);
    const body = contextView('ruth', local)!.body;
    expect(heldName(body)).toBe('Ruth’s sewing pouch');
    expect(body).toContain('data-action="campaign-action" data-value="life-return-pouch"');
    expect(actionAllowed(local, 'life-return-pouch')).toBe(true);
    expect(carriedView(local)).toContain('<h3>Ruth’s sewing pouch</h3>');
    expect(nextTarget(carriedView(local))).toBe('ruth');
    expect(local).toEqual(before);

    const setBack = action(held, 'life-set-pouch');
    expect(setBack.campaign.carrying).toBeNull();
    expect(setBack.life.thread).toEqual(identified.life.thread);
    const setBackBefore = structuredClone(setBack);
    expect(heldName(contextView('sewing-rest', setBack)!.body)).toBeUndefined();
    expect(actionAllowed(setBack, 'life-take-pouch')).toBe(true);
    expect(setBack).toEqual(setBackBefore);

    const recovered = action(setBack, 'life-take-pouch');
    expect(recovered.campaign.carrying).toBe('sewing-pouch');
    expect(heldName(contextView('sewing-rest', recovered)!.body)).toBe('Ruth’s sewing pouch');
    const returned = action(recovered, 'life-return-pouch');
    expect(returned.campaign.carrying).toBeNull();
    expect(returned.life.thread).toEqual({ ...identified.life.thread, stage: 'returned' });
    const returnedBefore = structuredClone(returned);
    const returnedBody = contextView('ruth', returned)!.body;
    expect(heldName(returnedBody)).toBeUndefined();
    expect(carriedView(returned)).toBe('');
    expect(returnedBody).not.toContain(
      'data-action="campaign-action" data-value="life-return-pouch"',
    );
    for (const ending of ['route', 'welcome'])
      expect(returnedBody).toContain(
        'data-action="campaign-action" data-value="life-ending-' + ending + '"',
      );
    expect(returned).toEqual(returnedBefore);
  });
});
