import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicPlayer } from '../../src/audio/music-player';
import type { MusicTrack } from '../../src/audio/types';

const calls = vi.hoisted(() => ({ notes: vi.fn(), dispose: vi.fn() }));
vi.mock('../../src/audio/synth', () => ({
  Synth: class {
    voices = new Set();
    note = calls.notes;
    dispose = calls.dispose;
  },
}));
const score: MusicTrack = {
  id: 'a',
  title: 'A',
  description: '',
  bpm: 60,
  beatsPerBar: 4,
  bars: 1,
  notes: [0, 1, 2, 3].map((beat) => ({
    beat,
    duration: 0.5,
    pitch: 60,
    instrument: 'flute',
    pan: 0,
    velocity: 0.5,
  })),
};
function clock() {
  return {
    currentTime: 0,
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
}
beforeEach(() => vi.clearAllMocks());
describe('audio-clock scheduler', () => {
  it('keeps notes on the audio clock across a loop and ignores repeated region updates', () => {
    const context = clock();
    const player = new MusicPlayer(context as unknown as BaseAudioContext, {} as AudioNode);
    player.select(score);
    expect(calls.notes.mock.calls[0]![1]).toBeCloseTo(0.04);
    player.select(score);
    expect(calls.notes).toHaveBeenCalledTimes(1);
    for (let beat = 1; beat <= 4; beat++) {
      context.currentTime = beat;
      player.tick();
    }
    expect(calls.notes.mock.calls.map((call) => call[1])).toEqual([0.04, 1.04, 2.04, 3.04, 4.04]);
  });
  it('drops missed notes after a long task without a catch-up burst or drifting the beat', () => {
    const context = clock();
    const player = new MusicPlayer(context as unknown as BaseAudioContext, {} as AudioNode);
    player.select(score);
    calls.notes.mockClear();
    context.currentTime = 101;
    player.tick();
    expect(calls.notes).toHaveBeenCalledTimes(1);
    expect(calls.notes.mock.calls[0]![1]).toBeCloseTo(101.04);
  });
  it('bounds overlapping transitions and releases retired and disposed players', () => {
    const context = clock();
    const player = new MusicPlayer(context as unknown as BaseAudioContext, {} as AudioNode);
    for (let index = 0; index < 30; index++) player.select({ ...score, id: String(index) });
    expect(player.diagnostics().players).toBe(3);
    context.currentTime = 2;
    player.tick();
    expect(player.diagnostics().players).toBe(1);
    expect(calls.dispose).toHaveBeenCalledTimes(29);
    player.dispose();
    expect(player.diagnostics().players).toBe(0);
    expect(calls.dispose).toHaveBeenCalledTimes(30);
  });
});
