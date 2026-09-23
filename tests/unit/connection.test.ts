import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { newGame, type GameEvent } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { accounts, displayRegion, presentationState } from '../../src/game/connection/accounts';
import {
  ACCOUNTS,
  HOME_CHOICES,
  HOME_REFLECTIONS,
  HOME_VISITS,
  newConnection,
} from '../../src/game/connection/types';
import { routeDestination, routePlan } from '../../src/game/connection/routes';
import { homeAvailable, homeConversation, homePlaces } from '../../src/content/connection/home';
import { makeSave, parseSave } from '../../src/persistence/schema';
import { activeInteractables } from '../../src/content/region';
import { chapters, storyStatus } from '../../src/content/campaign/chapters';
import { recap, statusStories, homeContext } from '../../src/ui/views/connection';
import { completedJourney, homeAt } from '../helpers/connection';
import { sail, dock, lakeStart } from '../helpers/lake';

const roundTrip = (s: ReturnType<typeof newGame>) =>
  parseSave(JSON.parse(JSON.stringify(makeSave(s)))).state;
describe('persistent travel intent', () => {
  it('retains the final destination across boarding, docking, menus and multiple land regions', () => {
    let s = completedJourney();
    s = transition(s, { type: 'route-select', target: 'home-table' });
    expect(routePlan(s)?.steps).toEqual([
      'board-sheltered-cove',
      'dock-capernaum',
      'to-lanes',
      'to-bakehouse',
      'home-table',
    ]);
    s = roundTrip(sail(s));
    expect(routePlan(s)?.leg).toBe('dock-capernaum');
    s = roundTrip(dock(s, 'capernaum'));
    expect(routePlan(s)?.steps).toEqual(['to-lanes', 'to-bakehouse', 'home-table']);
    expect(transition(s, { type: 'route-arrive', target: 'home-table' })).toBe(s);
    s = homeAt(s, 'table');
    expect(s.connection.route?.target).toBe('home-table');
    s = transition(s, { type: 'route-arrive', target: 'home-table' });
    expect(roundTrip(s).connection.route).toBeNull();
  });
  it('replaces and explicitly cancels a destination without changing progress or possessions', () => {
    const before = completedJourney();
    let s = transition(before, { type: 'route-select', target: 'home-farm' });
    s = transition(s, { type: 'route-select', target: 'home-shore' });
    expect(s.connection.route?.target).toBe('home-shore');
    expect(transition(s, { type: 'route-select', target: 'invented' })).toBe(s);
    s = transition(s, { type: 'route-cancel' });
    expect(s).toEqual(before);
    expect(transition(s, { type: 'route-cancel' })).toBe(s);
  });
  it('rejects locked destinations and explains an old destination that has disappeared', () => {
    const s = newGame();
    for (const target of ['to-house', 'neri', 'cove-shore', 'home-shore'])
      expect(transition(s, { type: 'route-select', target })).toBe(s);
    const saved = completedJourney();
    saved.connection.route = { target: 'simon' };
    expect(routePlan(roundTrip(saved))).toMatchObject({ available: false, title: 'Simon' });
  });
  it('finds companions at their actual persisted positions', () => {
    const s = parseSave(
      JSON.parse(readFileSync('tests/fixtures/saves/v7-companion-waiting.json', 'utf8')),
    ).state;
    expect(routeDestination(s, 'neri')).toMatchObject({
      ...s.road.company.position,
      region: s.road.company.region,
    });
    expect(routeDestination(s, 'amos')).toMatchObject(s.campaign.walk.position);
  });
});

describe('completed-account replay', () => {
  for (const account of ACCOUNTS) {
    it(`visits every ${account} checkpoint with an independent, reloadable presentation cursor`, () => {
      const original = completedJourney();
      original.connection.route = { target: 'home-farm' };
      for (const [index, scene] of accounts[account].scenes.entries()) {
        const replay = transition(original, { type: 'replay-open', account, checkpoint: scene.id });
        expect(roundTrip(replay)).toEqual(replay);
        expect(replay.region).toBe(original.region);
        expect(displayRegion(replay)).toBe(accounts[account].region);
        const view = presentationState(replay);
        expect(view.region).toBe(accounts[account].region);
        expect(replay).toEqual({
          ...original,
          connection: { ...original.connection, replay: { account, checkpoint: scene.id } },
        });
        const next = transition(replay, { type: 'replay-next', account, checkpoint: scene.id });
        if (index === accounts[account].scenes.length - 1) expect(next).toEqual(original);
        else
          expect(next.connection.replay?.checkpoint).toBe(accounts[account].scenes[index + 1]!.id);
        const previous = transition(replay, {
          type: 'replay-previous',
          account,
          checkpoint: scene.id,
        });
        expect(previous.connection.replay?.checkpoint).toBe(
          accounts[account].scenes[Math.max(0, index - 1)]!.id,
        );
        expect(transition(replay, { type: 'replay-close' })).toEqual(original);
      }
    });
  }
  it('ignores stale cursor events and every ordinary gameplay event while replaying', () => {
    const s = transition(completedJourney(), {
      type: 'replay-open',
      account: 'lake',
      checkpoint: 'teaching',
    });
    const events: GameEvent[] = [
      { type: 'replay-next', account: 'lake', checkpoint: 'gathering' },
      { type: 'replay-previous', account: 'storm', checkpoint: 'teaching' },
      { type: 'advance-scene', checkpoint: 'teaching' },
      { type: 'route-cancel' },
      { type: 'home-remember', visit: 'shore', choice: 'attention' },
      { type: 'journey', gateway: 'board-sheltered-cove' },
      { type: 'track-story', story: 'main' },
    ];
    for (const event of events) expect(transition(s, event)).toBe(s);
  });
  it('rejects unavailable accounts, foreign scene IDs and unfinished-presentation entry', () => {
    for (const account of ACCOUNTS)
      expect(
        transition(newGame(), {
          type: 'replay-open',
          account,
          checkpoint: accounts[account].scenes[0]!.id,
        }),
      ).toEqual(newGame());
    const before = completedJourney();
    expect(
      transition(before, { type: 'replay-open', account: 'roof', checkpoint: 'teaching' }),
    ).toBe(before);
    before.region = 'storm-account';
    expect(
      transition(before, { type: 'replay-open', account: 'lake', checkpoint: 'teaching' }),
    ).toBe(before);
  });
  it('retains cargo, a fractional boat position and both waiting companions', () => {
    const s = parseSave(
      JSON.parse(readFileSync('tests/fixtures/saves/v9-afloat-with-supply.json', 'utf8')),
    ).state;
    s.position = { x: -10.25, z: -8.125 };
    s.lake.boat.position = { ...s.position };
    s.lake.boat.heading = 1.125;
    const replay = roundTrip(
      transition(s, { type: 'replay-open', account: 'nain', checkpoint: 'command' }),
    );
    expect(transition(replay, { type: 'replay-close' })).toEqual(s);
  });
});

describe('The way home', () => {
  const orders = [
    ['farm', 'table', 'shore'],
    ['farm', 'shore', 'table'],
    ['table', 'farm', 'shore'],
    ['table', 'shore', 'farm'],
    ['shore', 'farm', 'table'],
    ['shore', 'table', 'farm'],
  ] as const;
  for (const order of orders)
    for (const reflection of HOME_REFLECTIONS)
      it(`remembers ${order.join(', ')} then ${reflection}, without requiring optional work`, () => {
        const before = completedJourney();
        expect(homeAvailable(before)).toBe(true);
        let s = before;
        for (const [i, visit] of order.entries()) {
          s = homeAt(s, visit);
          const choice = HOME_CHOICES[visit][reflection === 'remain' ? 1 : 0];
          const event = { type: 'home-remember', visit, choice } as const;
          s = roundTrip(transition(s, event));
          expect(Object.keys(s.connection.home.visits)).toHaveLength(i + 1);
          expect(transition(s, event)).toBe(s);
          if (i < 2) expect(transition(s, { type: 'home-reflect', choice: reflection })).toBe(s);
        }
        s = homeAt(s, 'shore');
        s = roundTrip(transition(s, { type: 'home-reflect', choice: reflection }));
        expect(s.connection.home.reflection).toBe(reflection);
        expect(transition(s, { type: 'home-reflect', choice: reflection })).toBe(s);
        expect(s.journal.filter((id) => id.startsWith('home-'))).toHaveLength(4);
        for (const key of ['episode', 'life', 'galilee'] as const)
          expect(s[key]).toEqual(before[key]);
        expect(s.campaign.table).toEqual(before.campaign.table);
        expect(s.road.company).toEqual(before.road.company);
        expect(chapters.home.complete(s)).toBe(true);
      });
  it('guards location, distance, choices and chapter availability', () => {
    for (const visit of HOME_VISITS) {
      const event = { type: 'home-remember', visit, choice: HOME_CHOICES[visit][0] } as const;
      const locked = lakeStart();
      expect(transition(locked, event)).toBe(locked);
      const far = completedJourney();
      expect(transition(far, event)).toBe(far);
      const near = homeAt(far, visit);
      expect(activeInteractables(near).map((p) => p.id)).toContain(
        homePlaces.find((p) => p.visit === visit)!.id,
      );
      expect(transition(near, { ...event, choice: 'invented' })).toBe(near);
    }
  });
  it('acknowledges only earned optional memories and preserves equal alternatives', () => {
    const s = completedJourney();
    expect(homeConversation(s, 'farm').paragraphs.join(' ')).toContain(
      'does not ask you to finish',
    );
    expect(homeConversation(s, 'table').paragraphs.join(' ')).not.toContain('Ruth has her pouch');
    const earned = structuredClone(s);
    earned.galilee.shelter.stage = 'complete';
    earned.galilee.shelter.site = 'breeze';
    earned.campaign.table.stage = 'complete';
    earned.campaign.table.location = 'courtyard';
    earned.life.thread.stage = 'complete';
    earned.life.bench.stage = 'complete';
    earned.life.bench.method = 'brace';
    expect(homeConversation(earned, 'farm').paragraphs.join(' ')).toContain('open breeze');
    expect(homeConversation(earned, 'table').paragraphs.join(' ')).toContain('courtyard table');
    expect(homeConversation(earned, 'table').paragraphs.join(' ')).toContain('Ruth has her pouch');
    expect(homeConversation(earned, 'shore').paragraphs.join(' ')).toContain('brace');
    expect(homeContext('home-farm', homeAt(s, 'farm'))!.body).toContain('Original dialogue');
  });
});

describe('v10 validation and journey surfaces', () => {
  it('migrates all historical fixtures with no invented new progress', () => {
    for (const name of readdirSync('tests/fixtures/saves').filter((n) => /^v[1-9]-/.test(n))) {
      const save = parseSave(JSON.parse(readFileSync('tests/fixtures/saves/' + name, 'utf8')));
      expect(save.version, name).toBe(11);
      expect(save.state.connection, name).toEqual(newConnection());
      expect(roundTrip(save.state), name).toEqual(save.state);
    }
  });
  it('rejects forged destinations, replay membership, premature endings and contradictory journals', () => {
    const forged = [
      { route: { target: 'invented' } },
      { replay: { account: 'storm', checkpoint: 'teaching' } },
      { home: { visits: { farm: 'sharing' }, reflection: null } },
      { home: { visits: { farm: 'room' }, reflection: 'remain' } },
      { home: { visits: { extra: 'room' }, reflection: null } },
      { home: { visits: { farm: 'room' }, reflection: null } },
    ];
    for (const fields of forged) {
      const save = makeSave(completedJourney());
      Object.assign(save.state.connection, fields);
      expect(() => parseSave(save)).toThrow();
    }
    const old = { ...makeSave(completedJourney()), version: 9 };
    old.state.connection.replay = { account: 'lake', checkpoint: 'teaching' };
    expect(() => parseSave(old)).toThrow();
    const premature = makeSave(newGame());
    premature.state.connection.replay = { account: 'lake', checkpoint: 'teaching' };
    expect(() => parseSave(premature)).toThrow();
  });
  it('keeps status views and recaps accurate for new, interrupted and finished journeys', () => {
    expect(statusStories(newGame(), 'active', 'all')).toContain('No stories are in progress');
    const s = completedJourney();
    expect(storyStatus(s, 'home')).toBe('available');
    expect(statusStories(s, 'available', 'home')).toContain('The way home');
    s.connection.route = { target: 'home-farm' };
    expect(recap(s)).toContain('Room on the road');
    expect(recap(s, true)).not.toContain('data-action=');
  });
});
