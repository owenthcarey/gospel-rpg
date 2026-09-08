import { describe, expect, it } from 'vitest';
import { dialogueFor, journalEntries } from '../../src/content/story';
import { interactables } from '../../src/content/region';
import { hasSupplies, objectiveTarget, transition, villageTarget } from '../../src/game/quest';
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

describe('An ordinary morning', () => {
  it.each([
    ['well', 'olive', 'shore'],
    ['well', 'shore', 'olive'],
    ['olive', 'well', 'shore'],
    ['olive', 'shore', 'well'],
    ['shore', 'well', 'olive'],
    ['shore', 'olive', 'well'],
  ] as const)('remembers %s, %s, and %s in any order', (...order) => {
    let state = transition(newGame(), { type: 'accept-village-story' });
    expect(transition(state, { type: 'finish-village-story' })).toBe(state);
    for (const id of order) {
      state = transition(state, { type: 'discover', id });
      if (state.discoveries.length < 3)
        expect(state.discoveries).not.toContain(villageTarget(state));
    }
    expect(villageTarget(state)).toBe('ezra');
    for (const choice of dialogueFor('ezra', state).choices) {
      const response = dialogueFor(choice.next!, state);
      expect(response.provenance).toBe('Original dialogue');
      expect(response.choices[0]?.next).toBe('ezra-reflection');
    }
    state = transition(state, { type: 'finish-village-story' });
    expect(state.villageStory).toBe('complete');
    expect(state.quest).toBe('not-started');
    expect(state.inventory).toEqual([]);
    expect(state.journal).toContain('ezra-memory');
    expect(transition(state, { type: 'finish-village-story' })).toBe(state);
    expect(transition(state, { type: 'accept-village-story' })).toBe(state);
  });
  it('credits discoveries made before accepting and preserves the main quest', () => {
    let state = newGame();
    for (const id of ['shore', 'olive', 'well'] as const)
      state = transition(state, { type: 'discover', id });
    expect(transition(state, { type: 'finish-village-story' })).toBe(state);
    state = transition(state, { type: 'accept-quest' });
    state = transition(state, { type: 'collect', item: 'bread' });
    state = transition(state, { type: 'accept-village-story' });
    state = transition(state, { type: 'finish-village-story' });
    expect(state.inventory).toEqual(['bread']);
    expect(objectiveTarget(state)).toBe('nets');
    state = transition(state, { type: 'collect', item: 'net' });
    state = transition(state, { type: 'deliver' });
    state = transition(state, { type: 'listen' });
    expect(state.quest).toBe('complete');
    expect(state.villageStory).toBe('complete');
    expect(new Set(state.journal).size).toBe(state.journal.length);
  });
  it('guides completed chapters to Ezra and then only to missing discoveries', () => {
    const state = { ...newGame(), quest: 'complete' as const };
    expect(objectiveTarget(state)).toBe('ezra');
    let exploring = transition(state, { type: 'accept-village-story' });
    expect(objectiveTarget(exploring)).toBe('well');
    exploring = transition(exploring, { type: 'discover', id: 'well' });
    expect(objectiveTarget(exploring)).toBe('olive');
  });
});
