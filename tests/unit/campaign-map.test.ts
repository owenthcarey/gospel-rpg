import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSave } from '../../src/persistence/schema';
import { neighborhoodMap } from '../../src/ui/views/campaign';
import * as region from '../../src/content/region';
import { journeyMap } from '../../src/ui/views/journey';
import { objectiveTarget, transition } from '../../src/game/quest';
import { trackedChapter } from '../../src/content/campaign/chapters';
import { action, completedEpisode, district, gateway } from '../helpers/campaign';
import { completedRoof } from '../helpers/road';

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

function returnedPouch() {
  return [
    'life-thread-accept',
    'life-clue-water',
    'life-clue-cloth',
    'life-identify',
    'life-take-pouch',
    'life-return-pouch',
  ].reduce((state, id) => action(state, id), district());
}
const destinationCommands = (html: string) =>
  [...html.matchAll(/<article class="journey-destination[^"]*">([\s\S]*?)<\/article>/g)].map(
    (match) => match[1]!.match(/data-action="travel" data-value="([^"]+)"/)![1]!,
  );
const passageCommand = (html: string, id: string) =>
  html.includes(
    `class="primary-button" data-action="travel" data-value="${id}">Approach the next passage`,
  );

describe('Journey map respects the tracked story completion boundary', () => {
  it.each(['route', 'welcome'] as const)(
    'stops directing the completed Ruth %s ending from the shore without cancelling another route',
    (ending) => {
      const ended = action(returnedPouch(), 'life-ending-' + ending);
      const shore = gateway(ended, 'to-shore');
      const state = transition(shore, { type: 'route-select', target: 'hannah' });
      expect(state.tracking).toBe('belonging');
      expect(state.life.thread).toMatchObject({ stage: 'complete', ending });
      expect(state.region).toBe('capernaum');
      expect(state.connection.route?.target).toBe('hannah');
      expect(objectiveTarget(state)).toBe('to-lanes');
      expect(trackedChapter(state).complete(state)).toBe(true);
      const before = structuredClone(state),
        html = journeyMap(state);
      expect(html).toContain('Your tracked story is complete. Choose any destination to explore.');
      expect(html).not.toContain('Next passage for your tracked story:');
      expect(html).not.toContain('Approach the next passage');
      expect(html).not.toContain('class="journey-map-route tracked"');
      expect(destinationCommands(html)).toEqual([
        'shore',
        'water-point',
        'house-viewpoint',
        'hannah',
      ]);
      expect(html).toContain('Explore here');
      expect(state).toEqual(before);
    },
  );

  it('does not imply a remaining local task when a completed story is viewed beside Ruth', () => {
    const state = action(returnedPouch(), 'life-ending-route');
    expect(state.region).toBe('capernaum-lanes');
    expect(objectiveTarget(state)).toBe('ruth');
    const before = structuredClone(state),
      html = journeyMap(state);
    expect(html).toContain('Your tracked story is complete. Choose any destination to explore.');
    expect(html).not.toContain('Your tracked destination is within this region.');
    expect(destinationCommands(html)).toContain('water-point');
    expect(html).toContain('Explore here');
    expect(state).toEqual(before);
  });

  it('keeps the real return passage after pouch return until an ending is chosen', () => {
    const state = gateway(returnedPouch(), 'to-shore');
    expect(state.life.thread.stage).toBe('returned');
    expect(state.tracking).toBe('belonging');
    expect(trackedChapter(state).complete(state)).toBe(false);
    expect(objectiveTarget(state)).toBe('to-lanes');
    const before = structuredClone(state),
      html = journeyMap(state);
    expect(passageCommand(html, 'to-lanes')).toBe(true);
    expect(html).toContain('Next passage for your tracked story: The road into Capernaum.');
    expect(html).toContain('class="journey-map-route tracked"');
    expect(html).not.toContain('Your tracked story is complete.');
    expect(state).toEqual(before);
  });

  it('keeps Main automatically directing the unfinished Roof chapter after the actual Chapter I reflection', () => {
    const state = completedEpisode();
    expect(state.tracking).toBe('main');
    expect(state.episode.stage).toBe('complete');
    expect(trackedChapter(state).id).toBe('roof');
    expect(trackedChapter(state).complete(state)).toBe(false);
    expect(objectiveTarget(state)).toBe('to-lanes');
    const before = structuredClone(state),
      html = journeyMap(state);
    expect(passageCommand(html, 'to-lanes')).toBe(true);
    expect(html).toContain('class="journey-map-route tracked"');
    expect(html).not.toContain('Your tracked story is complete.');
    expect(state).toEqual(before);
  });

  it('keeps Main automatically directing Nain after the actual Roof reflection and return to the shore', () => {
    const main = transition(completedRoof(), { type: 'track-story', story: 'main' });
    const state = gateway(gateway(main, 'house-exit'), 'to-shore');
    expect(state.tracking).toBe('main');
    expect(state.campaign.roof.stage).toBe('complete');
    expect(trackedChapter(state).id).toBe('nain');
    expect(trackedChapter(state).complete(state)).toBe(false);
    expect(objectiveTarget(state)).toBe('to-lanes');
    const before = structuredClone(state),
      html = journeyMap(state);
    expect(passageCommand(html, 'to-lanes')).toBe(true);
    expect(html).toContain('class="journey-map-route tracked"');
    expect(html).not.toContain('Your tracked story is complete.');
    expect(state).toEqual(before);
  });
});
