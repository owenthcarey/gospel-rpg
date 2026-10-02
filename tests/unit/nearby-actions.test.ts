import { describe, expect, it } from 'vitest';
import { chosenShelter, galileeAction, arrangedShelter } from '../helpers/galilee';
import { nearbyActions } from '../../src/ui/views/actions';

describe('nearby action overflow', () => {
  for (const site of ['shade', 'breeze'] as const) {
    it(`keeps the ${site} inspection reachable after all three supplies are placed`, () => {
      let s = chosenShelter(undefined, site);
      for (const supply of ['mat', 'water', 'screen']) {
        s = galileeAction(s, 'shelter-take-' + supply);
        s = galileeAction(s, 'shelter-place-' + site + '-' + supply);
      }
      const view = nearbyActions(s);
      expect(view.match(/data-action="quick-action"/g)).toHaveLength(3);
      expect(view).not.toContain(`data-value="galilee:shelter-check-${site}"`);
      expect(view.match(/data-action="navigate"/g)).toHaveLength(1);
      expect(view).toContain(`data-value="rest-${site}" data-target="rest-${site}"`);
      expect(view).toContain('More actions at ');
    });

    it(`avoids an extra ${site} path when every action fits in the quick slots`, () => {
      const s = arrangedShelter(chosenShelter(undefined, site));
      expect(s.galilee.shelter.stage).toBe('ready');
      const view = nearbyActions(s);
      expect(view.match(/data-action="quick-action"/g)).toHaveLength(3);
      expect(view).not.toContain('More actions');
      expect(view).not.toContain('data-action="navigate"');
    });
  }
});
