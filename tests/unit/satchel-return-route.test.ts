import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSave } from '../../src/persistence/schema';
import { campaignGoal, localTarget } from '../../src/game/campaign/objectives';
import { routePlan } from '../../src/game/connection/routes';
import { transition } from '../../src/game/quest';
import { carriedView } from '../../src/ui/views/campaign';
import type { GameState } from '../../src/game/types';
import { action, district, gateway } from '../helpers/campaign';
import { galileeAction } from '../helpers/galilee';
import { roadStart } from '../helpers/road';

const destinations = (html: string) =>
  [...html.matchAll(/<button[^>]*data-action="travel"[^>]*data-value="([^"]+)"/g)].map(
    (match) => match[1],
  );
const fixture = (file: string) =>
  parseSave(JSON.parse(readFileSync(`tests/fixtures/saves/${file}`, 'utf8'))).state;

function borrowedScoop(): GameState {
  let state = roadStart();
  for (const id of ['spring-start', 'spring-note-source', 'spring-note-basins', 'spring-borrow'])
    state = galileeAction(state, id);
  expect(state.campaign.carrying).toBe('channel-scoop');
  expect(state.galilee.spring.cleared).toEqual([]);
  return state;
}

function clearedScoop(): GameState {
  let state = borrowedScoop();
  for (const id of ['spring-clear-inlet', 'spring-clear-silt']) state = galileeAction(state, id);
  expect(state.galilee.spring.cleared).toEqual(['inlet', 'silt']);
  return state;
}

function unchangedView(state: GameState): string {
  const before = structuredClone(state);
  const html = carriedView(state);
  expect(state).toEqual(before);
  return html;
}

describe('Satchel return and task destinations', () => {
  it.each(['inlet', 'silt'] as const)(
    'keeps the next clearance distinct until both sections are cleared, %s first',
    (first) => {
      const borrowed = borrowedScoop();
      const initial = unchangedView(borrowed);
      expect(destinations(initial)).toEqual(['spring-tools', 'spring-source']);
      expect(initial).toContain('Use the scoop to clear the inlet and entry silt in either order.');

      const once = galileeAction(borrowed, 'spring-clear-' + first);
      const remaining = first === 'inlet' ? 'channel-entry' : 'spring-source';
      expect(destinations(unchangedView(once))).toEqual(['spring-tools', remaining]);

      const twice = galileeAction(once, 'spring-clear-' + (first === 'inlet' ? 'silt' : 'inlet'));
      const completedClearing = unchangedView(twice);
      expect(twice.campaign.carrying).toBe('channel-scoop');
      expect(twice.galilee.spring.cleared).toHaveLength(2);
      expect(destinations(completedClearing)).toEqual(['spring-tools']);
      expect(completedClearing).toContain('Find the return point');
      expect(completedClearing).not.toContain('Find the next stop');
      expect(completedClearing).toContain('A spring for travelers');
      expect(completedClearing).toContain(
        'Return the scoop, then turn the channel sections with free hands.',
      );
      expect(completedClearing).toContain('IN YOUR HANDS');
      expect(completedClearing).toContain('<h3>wooden scoop</h3>');
      expect(completedClearing).toContain(
        'return the wooden scoop to the scoop rack on the Galilean road.',
      );

      const returned = galileeAction(twice, 'spring-return');
      expect(returned.campaign.carrying).toBeNull();
      expect(returned.galilee.spring.cleared).toEqual(twice.galilee.spring.cleared);
      expect(unchangedView(returned)).toBe('');
      expect(campaignGoal(returned)?.destination).toBe('spring-source');
    },
  );

  it('retains a distinct unfinished task after an early return and legal reborrow', () => {
    const once = galileeAction(borrowedScoop(), 'spring-clear-inlet');
    const returned = galileeAction(once, 'spring-return');
    expect(unchangedView(returned)).toBe('');
    expect(campaignGoal(returned)?.destination).toBe('spring-tools');
    const again = galileeAction(returned, 'spring-borrow');
    expect(again.galilee.spring.cleared).toEqual(['inlet']);
    expect(destinations(unchangedView(again))).toEqual(['spring-tools', 'channel-entry']);
    expect(again.journal).toEqual(returned.journal);
  });

  it('uses the held item’s actual task while a different story is tracked', () => {
    const cleared = clearedScoop();
    const tracked = transition(cleared, { type: 'track-story', story: 'roof' });
    expect(tracked).not.toBe(cleared);
    expect(tracked.tracking).toBe('roof');
    const html = unchangedView(tracked);
    expect(destinations(html)).toEqual(['spring-tools']);
    expect(html).toContain('A spring for travelers');
    expect(html).toContain('Return the scoop, then turn the channel sections with free hands.');
    expect(tracked.tracking).toBe('roof');
  });

  it('merges the same full destination when the current region needs a doorway first', () => {
    const state = gateway(clearedScoop(), 'to-farm');
    expect(state.region).toBe('roadside-farm');
    expect(campaignGoal(state)).toMatchObject({ target: 'farm-exit', destination: 'spring-tools' });
    const html = unchangedView(state);
    expect(destinations(html)).toEqual(['spring-tools']);
    expect(html).not.toContain('data-value="farm-exit"');
    const routed = transition(state, { type: 'route-select', target: 'spring-tools' });
    expect(routed.connection.route?.target).toBe('spring-tools');
    expect(routePlan(routed)).toMatchObject({
      target: 'spring-tools',
      leg: 'farm-exit',
      available: true,
    });
  });

  it.each([
    ['v6-carrying-pouch.json', 'sewing-rest', 'ruth', 'Return the pouch to Ruth'],
    ['v5-carrying-water.json', 'jug-shelf', 'courtyard-table', 'Set what you carry'],
    ['v8-supply-on-the-road.json', 'rest-supplies', 'rest-shade', 'Place what you carry'],
  ])('keeps two useful destinations for %s', (file, returnPoint, nextStop, text) => {
    const state = transition(fixture(file!), { type: 'track-story', story: 'roof' });
    expect(state.tracking).toBe('roof');
    const html = unchangedView(state);
    expect(destinations(html)).toEqual([returnPoint, nextStop]);
    expect(html).toContain('Find the return point');
    expect(html).toContain('Find the next stop');
    expect(html).toContain(text);
  });

  it('preserves distinct final destinations that happen to share their first doorway', () => {
    let water = action(district(), 'table-accept');
    for (const id of ['table-courtyard', 'take-jug', 'fill-jug']) water = action(water, id);
    expect(water.campaign.carrying).toBe('water-jug');
    const shore = gateway(water, 'to-shore');
    expect(shore.region).toBe('capernaum');
    expect(localTarget(shore, 'jug-shelf')).toBe('to-lanes');
    expect(campaignGoal(shore)).toMatchObject({
      target: 'to-lanes',
      destination: 'courtyard-table',
    });
    const html = unchangedView(shore);
    expect(destinations(html)).toEqual(['jug-shelf', 'courtyard-table']);
    const returnRoute = transition(shore, { type: 'route-select', target: 'jug-shelf' });
    const taskRoute = transition(shore, { type: 'route-select', target: 'courtyard-table' });
    expect(routePlan(returnRoute)).toMatchObject({
      target: 'jug-shelf',
      leg: 'to-lanes',
      available: true,
    });
    expect(routePlan(taskRoute)).toMatchObject({
      target: 'courtyard-table',
      leg: 'to-lanes',
      available: true,
    });
  });

  it('keeps an earned empty-hand state free of carried-item routes', () => {
    const state = roadStart();
    expect(state.campaign.carrying).toBeNull();
    expect(unchangedView(state)).toBe('');
  });
});
