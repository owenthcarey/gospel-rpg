import { describe, expect, it } from 'vitest';
import { dialogueFor, journalEntries } from '../../src/content/story';
import { interactables } from '../../src/content/region';
import { hasSupplies, objectiveTarget, transition } from '../../src/game/quest';
import { newGame } from '../../src/game/types';

describe('the complete chapter', () => {
  it.each([
    ['net', 'bread'],
    ['bread', 'net'],
  ] as const)('supports collecting %s then %s', (...order) => {
    const initial = newGame();
    let state = transition(initial, { type: 'accept-quest' });
    for (const item of order) state = transition(state, { type: 'collect', item });
    expect(hasSupplies(state)).toBe(true);
    expect(objectiveTarget(state)).toBe('simon');
    state = transition(state, { type: 'deliver' });
    expect(state.inventory).toEqual([]);
    expect(objectiveTarget(state)).toBe('jesus');
    state = transition(state, { type: 'listen' });
    expect(state.quest).toBe('complete');
    expect(state.journal).toContain('complete');
    expect(initial).toEqual(newGame());
  });
  it('rejects out-of-order transitions and repeated item rewards', () => {
    const initial = newGame();
    expect(transition(initial, { type: 'listen' })).toBe(initial);
    expect(transition(initial, { type: 'collect', item: 'net' })).toBe(initial);
    let state = transition(initial, { type: 'accept-quest' });
    expect(transition(state, { type: 'deliver' })).toBe(state);
    state = transition(state, { type: 'collect', item: 'net' });
    expect(transition(state, { type: 'collect', item: 'net' })).toBe(state);
    expect(transition(state, { type: 'accept-quest' })).toBe(state);
  });
  it('records a discovery only once without advancing the quest', () => {
    const state = transition(newGame(), { type: 'discover', id: 'shore' });
    expect(state.quest).toBe('not-started');
    expect(state.discoveries).toEqual(['shore']);
    expect(transition(state, { type: 'discover', id: 'shore' })).toBe(state);
  });
  it('has valid authored conversations and provenance at every stage', () => {
    const states = [newGame()];
    states.push(transition(states[0]!, { type: 'accept-quest' }));
    states.push(transition(states[1]!, { type: 'collect', item: 'net' }));
    states.push(transition(states[2]!, { type: 'collect', item: 'bread' }));
    states.push(transition(states[3]!, { type: 'deliver' }));
    states.push(transition(states[4]!, { type: 'listen' }));
    for (const state of states) {
      const seen = new Set<string>();
      const queue = interactables.map((p) => p.id);
      while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const node = dialogueFor(id, state);
        expect(node.text.length).toBeGreaterThan(20);
        expect(node.provenance).toBeTruthy();
        expect(node.choices.length).toBeGreaterThan(0);
        if (node.speaker === 'Jesus') {
          expect(node.provenance).toBe('Scripture · WEB');
          expect(node.reference).toBe('Luke 5:4');
        }
        for (const choice of node.choices) {
          expect(Boolean(choice.next || choice.close)).toBe(true);
          if (choice.next) queue.push(choice.next);
        }
      }
      for (const id of state.journal) expect(journalEntries[id]).toBeDefined();
    }
  });
});
