import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSave } from '../../src/persistence/schema';
import { neighborhoodMap } from '../../src/ui/views/campaign';
import * as region from '../../src/content/region';

const fixture = (name: string) =>
  parseSave(JSON.parse(readFileSync(`tests/fixtures/saves/${name}`, 'utf8'))).state;
const marker = (svg: string, id: string) =>
  svg.match(new RegExp(`<circle data-map-place="${id}"[^>]+/>`))![0];

describe('campaign map markers', () => {
  it.each([false, true])(
    'renders the unfinished tracked passage immediately (large=%s)',
    (large) => {
      const state = fixture('v7-road-investigation.json');
      state.tracking = 'nain';
      const before = structuredClone(state);
      const svg = neighborhoodMap(state, large)!;
      const passage = marker(svg, 'to-nain');
      expect(passage).toContain('map-target');
      expect(passage).toContain('cx="96" cy="24"');
      expect(passage).toContain(`r="${large ? 3 : 2}"`);
      expect(svg.match(/map-target/g)).toHaveLength(1);
      expect(svg.match(/data-map-place=/g)).toHaveLength(region.activeInteractables(state).length);
      expect(marker(svg, 'road-spring')).not.toContain('map-target');
      expect(state).toEqual(before);
    },
  );

  it('highlights the return passage for an unfinished story inside the bakehouse', () => {
    const state = fixture('v6-interrupted-repair.json');
    const passage = marker(neighborhoodMap(state, true)!, 'bakehouse-exit');
    expect(passage).toContain('map-target');
    expect(passage).toContain('cx="96" cy="168"');
    expect(passage).toContain('data-map-kind="place"');
  });

  it('keeps completed tracking from highlighting its remaining return destination', () => {
    const state = fixture('v7-road-complete.json');
    state.tracking = 'trail';
    const svg = neighborhoodMap(state, true)!;
    expect(marker(svg, 'nain-viewpoint')).toContain('r="3"');
    expect(svg).not.toContain('map-target');
    expect(svg.match(/data-map-place=/g)).toHaveLength(region.activeInteractables(state).length);
  });

  it('follows the next tracked chapter after the completed Nain account', () => {
    const state = fixture('v7-road-complete.json');
    expect(marker(neighborhoodMap(state, true)!, 'nain-exit')).toContain('map-target');
  });
});
