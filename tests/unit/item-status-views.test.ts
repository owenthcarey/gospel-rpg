import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSave } from '../../src/persistence/schema';
import { carriedView } from '../../src/ui/views/campaign';
import { recap } from '../../src/ui/views/connection';
import { journeyOverview, workSurface } from '../../src/ui/views/exploration';
import { galileeContext } from '../../src/ui/views/galilee';
import type { RestSite, RestSupply } from '../../src/game/galilee/types';

const fixture = (file: string) =>
  parseSave(JSON.parse(readFileSync(`tests/fixtures/saves/${file}`, 'utf8'))).state;
const returnTarget = (html: string) =>
  html.match(
    /<button[^>]*data-action="travel"[^>]*data-value="([^"]+)"[^>]*>Find the return point[ <]/,
  )![1];
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
