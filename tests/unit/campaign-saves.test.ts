import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { makeSave, parseSave, importSave } from '../../src/persistence/schema';
import { district, action, witnessed } from '../helpers/campaign';
import { transition } from '../../src/game/quest';
import { newGame } from '../../src/game/types';
import { newCampaign } from '../../src/game/campaign/types';

describe('v5 migration and state safety', () => {
  for (const file of readdirSync('tests/fixtures/saves').filter((f) => f.endsWith('.json')))
    it('preserves ' + file, () => {
      const raw = JSON.parse(readFileSync('tests/fixtures/saves/' + file, 'utf8'));
      const save = parseSave(raw);
      expect(save.version).toBe(5);
      expect(save.state.journal).toEqual(raw.state.journal);
      expect(save.state.quest).toBe(raw.state.quest);
      if (raw.version === 4) {
        expect(save.state.episode).toEqual(raw.state.episode);
        expect(save.state.villageMemory).toBe(raw.state.villageMemory);
      }
      if (raw.version < 5) expect(save.state.campaign).toEqual(newCampaign());
      expect(importSave(JSON.stringify(save))).toEqual(save);
    });
  it('rejects impossible progress, forged journal, coordinates and unknown IDs', () => {
    const base = makeSave(district());
    const edits = [
      (s: typeof base) => {
        s.state.campaign.roof.stage = 'complete';
      },
      (s: typeof base) => {
        s.state.campaign.roof.checkpoint = 'house';
      },
      (s: typeof base) => {
        s.state.campaign.walk.gateOpen = true;
      },
      (s: typeof base) => {
        s.state.campaign.walk.step = 99;
      },
      (s: typeof base) => {
        s.state.campaign.carrying = 'water-jug';
      },
      (s: typeof base) => {
        s.state.campaign.table.delivered = ['bread'];
      },
      (s: typeof base) => {
        s.state.campaign.notes = ['water', 'water'];
      },
      (s: typeof base) => {
        s.state.campaign.walk.position.x = Infinity;
      },
      (s: typeof base) => {
        s.state.position.x = 17;
      },
      (s: typeof base) => {
        s.state.campaign.visited.bakehouse = { x: 15, z: 0 };
      },
      (s: typeof base) => {
        s.state.journal.push('roof-complete');
      },
      (s: typeof base) => {
        s.state.journal = s.state.journal.filter((id) => id !== 'roof-invitation');
      },
    ];
    for (const edit of edits) {
      const s = structuredClone(base);
      edit(s);
      expect(() => parseSave(s)).toThrow();
    }
  });
  it('restores a walking companion and a held object across travel and presentation', () => {
    let s = action(action(action(district(), 'walk-accept'), 'walk-outer'), 'walk-start');
    s.campaign.walk.position = { x: -7, z: -6 };
    s = action(action(s, 'table-accept'), 'table-courtyard');
    s = action(s, 'take-bread');
    s = action(s, 'roof-enter');
    s = transition(s, { type: 'roof-next', checkpoint: 'house' });
    const restored = importSave(JSON.stringify(makeSave(s))).state;
    expect(restored.campaign.walk.position).toEqual({ x: -7, z: -6 });
    expect(restored.campaign.carrying).toBe('bread-basket');
    expect(restored.campaign.roof.checkpoint).toBe('bearers');
  });
  it('rejects a moved companion before walking and a locked tracked chapter', () => {
    const invited = makeSave(action(district(), 'walk-accept'));
    invited.state.campaign.walk.position = { x: 4, z: 5 };
    expect(() => parseSave(invited)).toThrow();
    const early = makeSave(newGame());
    early.state.tracking = 'roof';
    expect(() => parseSave(early)).toThrow();
  });
  it('rejects a claimed completed route without arrival and a duplicated delivery', () => {
    let s = action(action(witnessed(), 'walk-accept'), 'walk-outer');
    s = action(s, 'walk-start');
    const save = makeSave(s);
    save.state.campaign.walk.stage = 'arrived';
    expect(() => parseSave(save)).toThrow();
    const t = makeSave(action(action(district(), 'table-accept'), 'table-courtyard'));
    t.state.campaign.table.delivered = ['bread', 'bread'];
    expect(() => parseSave(t)).toThrow();
  });
});
