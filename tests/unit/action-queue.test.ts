import { expect, it } from 'vitest';
import { ActionQueue } from '../../src/game/action-queue';
import { onLake } from '../helpers/journey';
import { transition } from '../../src/game/quest';
it('retains an input received while persistence is pending, including after a failure', async () => {
  const activity: boolean[] = [];
  const events: string[] = [];
  const queue = new ActionQueue((pending) => activity.push(pending));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = queue.run(async () => {
    events.push('save');
    await gate;
    throw new Error('Write failed');
  });
  const rejection = expect(first).rejects.toThrow('Write failed');
  const second = queue.run(async () => {
    events.push('open-journal');
  });
  await Promise.resolve();
  expect(events).toEqual(['save']);
  expect(activity).not.toContain(false);
  release();
  await rejection;
  await second;
  expect(events).toEqual(['save', 'open-journal']);
  expect(activity.at(-1)).toBe(false);
  expect(activity.filter((pending) => !pending)).toHaveLength(1);
});
it('queued duplicate scene clicks retain their original checkpoint and cannot skip a beat', async () => {
  const queue = new ActionQueue(() => {});
  let state = onLake();
  const checkpoint = state.episode.checkpoint!;
  const click = async () => {
    state = transition(state, { type: 'advance-scene', checkpoint });
  };
  await Promise.all([queue.run(click), queue.run(click)]);
  expect(state.episode.checkpoint).toBe('teaching');
  expect(state.journal.filter((id) => id === 'scene-gathering')).toHaveLength(1);
});
