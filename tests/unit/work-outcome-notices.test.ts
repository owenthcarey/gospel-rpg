import { describe, expect, it } from 'vitest';
import { noticeFor } from '../../src/content/notices';
import { transition } from '../../src/game/quest';
import type { Direction, RestSite } from '../../src/game/galilee/types';
import { at } from '../helpers/campaign';
import { arrangedShelter, chosenShelter, preparedSpring } from '../helpers/galilee';

describe('accepted work outcomes remain available as session messages', () => {
  it.each([
    ['entry', 'Entry channel turned. Open ends: east / west.'],
    ['turn', 'Turn channel turned. Open ends: east / south.'],
    ['north', 'North channel turned. Open ends: east / south.'],
    ['south', 'South channel turned. Open ends: west / north.'],
  ] as const)('records the actual open ends after turning the %s channel', (id, text) => {
    const before = at(preparedSpring(), 'channel-' + id);
    const event = { type: 'galilee-turn', id, expected: before.galilee.spring.turns[id] } as const;
    const after = transition(before, event);
    expect(after).not.toBe(before);
    const saved = structuredClone(after);
    expect(noticeFor(event, before, after)).toBe(text);
    expect(after).toEqual(saved);
    const rejected = transition(after, event);
    expect(rejected).toBe(after);
    expect(noticeFor(event, after, rejected)).toBeUndefined();
  });

  it.each([
    ['shade', 'The olive shade'],
    ['breeze', 'The open resting place'],
  ] as const)(
    'names the actual resting site after a clockwise screen move at %s',
    (site, title) => {
      const before = arrangedShelter(chosenShelter(undefined, site), 2);
      const event = { type: 'galilee-screen', expected: 2 } as const;
      const after = transition(before, event);
      expect(after).not.toBe(before);
      expect(after.galilee.shelter.screen).toBe(3);
      const saved = structuredClone(after);
      expect(noticeFor(event, before, after)).toBe(`${title} · Screen moved to the west side.`);
      expect(after).toEqual(saved);
      const rejected = transition(after, event);
      expect(rejected).toBe(after);
      expect(noticeFor(event, after, rejected)).toBeUndefined();
    },
  );

  it.each([
    ['shade', 0, 'north', 'The olive shade'],
    ['breeze', 1, 'east', 'The open resting place'],
  ] as const)(
    'records an applied proposal’s resulting direction at %s',
    (site: RestSite, direction: Direction, name, title) => {
      const before = arrangedShelter(chosenShelter(undefined, site), 2);
      const event = { type: 'galilee-screen', expected: 2, direction } as const;
      const after = transition(before, event);
      expect(after).not.toBe(before);
      expect(after.galilee.shelter.screen).toBe(direction);
      expect(noticeFor(event, before, after)).toBe(`${title} · Screen moved to the ${name} side.`);
      const rejected = transition(after, event);
      expect(rejected).toBe(after);
      expect(noticeFor(event, after, rejected)).toBeUndefined();
    },
  );
});
