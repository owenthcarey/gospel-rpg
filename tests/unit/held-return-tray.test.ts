import { describe, expect, it } from 'vitest';
import { nearbyActions } from '../../src/ui/views/actions';
import { practicalActions } from '../../src/content/practical';
import { galileeContext } from '../../src/ui/views/galilee';
import { transition } from '../../src/game/quest';
import { at } from '../helpers/campaign';
import { roadStart } from '../helpers/road';
import { arrangedShelter, chosenShelter, galileeAction } from '../helpers/galilee';

function inspectedSpring() {
  let s = roadStart();
  for (const id of ['spring-start', 'spring-note-source', 'spring-note-basins'])
    s = galileeAction(s, id);
  return s;
}

const commands = (html: string) =>
  [...html.matchAll(/<button[^>]*data-action="quick-action"[^>]*>/g)].map(([button]) => ({
    id: button.match(/data-value="([^"]+)"/)![1],
    disabled: button.includes('disabled'),
  }));

describe('nearby return guidance for an actually held object', () => {
  it('offers the scoop return without repeating its impossible borrow and keeps saved work intact', () => {
    const s = galileeAction(inspectedSpring(), 'spring-borrow');
    expect(s.campaign.carrying).toBe('channel-scoop');
    const before = structuredClone(s);
    const view = nearbyActions(s);
    expect(commands(view)).toContainEqual({ id: 'galilee:spring-return', disabled: false });
    expect(view).not.toContain('galilee:spring-borrow');
    expect(view).not.toContain('Your hands are occupied');
    expect(s).toEqual(before);

    // The full inspection and authoritative action contract retain the explanation.
    expect(practicalActions(s).find((a) => a.id === 'galilee:spring-borrow')?.blocker).toContain(
      'Your hands are occupied',
    );
    expect(galileeContext('spring-tools', s)!.body).toContain('data-value="spring-borrow"');
    expect(transition(s, { type: 'galilee-action', id: 'spring-borrow' })).toBe(s);
  });

  it('restores Borrow when the scoop is returned before the unfinished work is done', () => {
    const held = galileeAction(inspectedSpring(), 'spring-borrow');
    const returned = galileeAction(held, 'spring-return');
    expect(returned.campaign.carrying).toBeNull();
    expect(commands(nearbyActions(returned))).toContainEqual({
      id: 'galilee:spring-borrow',
      disabled: false,
    });
    expect(nearbyActions(returned)).not.toContain('galilee:spring-return');
    expect(galileeAction(returned, 'spring-borrow').campaign.carrying).toBe('channel-scoop');
  });

  it('keeps occupied-hands guidance when a different carried item cannot be returned at the rack', () => {
    const mat = galileeAction(chosenShelter(inspectedSpring()), 'shelter-take-mat');
    const s = at(mat, 'spring-tools');
    expect(s.campaign.carrying).toBe('rest-mat');
    const view = nearbyActions(s);
    expect(commands(view)).toContainEqual({ id: 'galilee:spring-borrow', disabled: true });
    expect(view).toContain('Your hands are occupied');
    expect(view).not.toContain('galilee:spring-return');
  });

  it.each(['mat', 'water', 'screen'] as const)(
    'omits only the held %s pickup at the farm and retains both alternate-supply requirements',
    (supply) => {
      const s = galileeAction(chosenShelter(), 'shelter-take-' + supply);
      expect(s.campaign.carrying).toBe('rest-' + supply);
      const before = structuredClone(s);
      const view = nearbyActions(s);
      const visible = commands(view);
      expect(visible).toContainEqual({
        id: 'galilee:shelter-return-' + supply,
        disabled: false,
      });
      expect(view).not.toContain('galilee:shelter-take-' + supply);
      for (const other of ['mat', 'water', 'screen'].filter((id) => id !== supply)) {
        expect(visible).toContainEqual({ id: 'galilee:shelter-take-' + other, disabled: true });
        expect(view).toContain('id="block-galilee:shelter-take-' + other + '"');
      }
      expect(visible).toHaveLength(3);
      expect(view).not.toContain('More actions');
      expect(s).toEqual(before);
      const returned = galileeAction(s, 'shelter-return-' + supply);
      expect(commands(nearbyActions(returned))).toContainEqual({
        id: 'galilee:shelter-take-' + supply,
        disabled: false,
      });
    },
  );

  it('keeps blocked recovery and inspection reachable through More actions at the resting site', () => {
    const s = galileeAction(arrangedShelter(), 'shelter-recover-shade-mat');
    expect(s.campaign.carrying).toBe('rest-mat');
    const view = nearbyActions(s);
    expect(commands(view)).toEqual([
      { id: 'galilee:shelter-place-shade-mat', disabled: false },
      { id: 'galilee:shelter-recover-shade-water', disabled: true },
      { id: 'galilee:shelter-recover-shade-screen', disabled: true },
    ]);
    expect(view).toContain('More actions at The olive shade');
    expect(view).toContain('data-value="rest-shade" data-target="rest-shade"');
    expect(galileeContext('rest-shade', s)!.body).toContain(
      'data-value="shelter-check-shade" disabled',
    );
  });

  it('retains a useful tool requirement when the player has empty hands and has not inspected the channel', () => {
    const s = at(galileeAction(roadStart(), 'spring-start'), 'spring-source');
    const view = nearbyActions(s);
    expect(commands(view)).toContainEqual({ id: 'galilee:spring-clear-inlet', disabled: true });
    expect(view).toContain('Bring the wooden scoop from the rack after inspecting both ends.');
  });
});
