import { expect, it, vi } from 'vitest';
import { GameAudio } from '../../src/scene/audio';
import { newGame } from '../../src/game/types';

function stepsOver(distance: number, frames: number) {
  const audio = new GameAudio();
  const play = vi.spyOn(audio, 'play').mockImplementation(() => {});
  audio.movement({ x: 0, z: 0 }, true);
  for (let i = 1; i <= frames; i++) audio.movement({ x: (distance * i) / frames, z: 0 }, true);
  return play.mock.calls.map(([effect]) => effect);
}

it('sounds the same number of footsteps across low and high frame rates', () => {
  expect(stepsOver(12, 20)).toEqual(stepsOver(12, 240));
  expect(stepsOver(12, 20)).toEqual(Array(9).fill('step'));
});

it('starts a fresh cadence after teleports, reading pauses and region changes', () => {
  const audio = new GameAudio();
  const play = vi.spyOn(audio, 'play').mockImplementation(() => {});
  audio.movement({ x: 0, z: 0 }, true);
  audio.movement({ x: 1, z: 0 }, true);
  audio.movement({ x: 20, z: 0 }, true);
  audio.movement({ x: 20.5, z: 0 }, true);
  expect(play).not.toHaveBeenCalled();
  audio.movement({ x: 20.5, z: 0 }, false);
  audio.movement({ x: 21.5, z: 0 }, true);
  expect(play).not.toHaveBeenCalled();
  audio.update({ ...newGame(), region: 'galilee-water' });
  audio.movement({ x: 0, z: 0 }, true);
  for (const x of [1, 2, 3]) audio.movement({ x, z: 0 }, true);
  expect(play.mock.calls).toEqual([['oar']]);
});
