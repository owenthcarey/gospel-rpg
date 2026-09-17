import { describe, expect, it } from 'vitest';
import { musicTracks } from '../../src/content/audio/music';
import { cueForState, regionAudio } from '../../src/content/audio/cues';
import { REGION_IDS } from '../../src/game/campaign/types';
import { newGame, DEFAULT_SETTINGS } from '../../src/game/types';
import { parseSettings } from '../../src/persistence/schema';
import { arrange, midi, type Composition } from '../../src/content/audio/score';
import { feedbackForEvent } from '../../src/content/audio/feedback';

describe('original soundtrack', () => {
  it('ships complete, distinct, playable arrangements with no notes beyond the loop', () => {
    const tracks = Object.values(musicTracks);
    expect(tracks).toHaveLength(9);
    expect(new Set(tracks.map((track) => JSON.stringify(track.notes))).size).toBe(9);
    for (const track of tracks) {
      expect(track.bars).toBe(40);
      expect((track.bars * track.beatsPerBar * 60) / track.bpm).toBeGreaterThan(75);
      expect(new Set(track.notes.map((note) => note.instrument)).size).toBeGreaterThanOrEqual(4);
      for (const [index, note] of track.notes.entries()) {
        expect(note.beat).toBeGreaterThanOrEqual(index ? track.notes[index - 1]!.beat : 0);
        expect(note.beat).toBeLessThan(track.bars * track.beatsPerBar);
        expect(note.pitch).toBeGreaterThanOrEqual(24);
        expect(note.pitch).toBeLessThanOrEqual(96);
        expect(note.velocity).toBeGreaterThan(0);
        expect(note.velocity).toBeLessThanOrEqual(1);
        expect(note.duration).toBeGreaterThan(0);
      }
    }
  });
  it('rejects broken authoring instead of silently drifting out of meter', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('Bb3')).toBe(58);
    expect(() => midi('H5')).toThrow('Invalid score pitch');
    const theme = { chords: Array(8).fill('C3 E3 G3 B3'), melody: Array(8).fill('C5/3') };
    expect(() =>
      arrange({
        id: 'bad',
        title: 'Bad',
        description: '',
        bpm: 80,
        meter: 4,
        lead: 'flute',
        pluck: 'harp',
        character: 'flowing',
        a: theme,
        b: theme,
      } as Composition),
    ).toThrow('expected 4 beats');
  });
});

describe('music direction', () => {
  it('explicitly covers every region', () => {
    expect(Object.keys(regionAudio).sort()).toEqual([...REGION_IDS].sort());
    for (const region of REGION_IDS) {
      const cue = cueForState({ ...newGame(), region });
      expect(musicTracks[cue.track]).toBeDefined();
    }
  });
  it('resolves tension at the command, and replay follows its own checkpoint', () => {
    const state = newGame();
    state.region = 'storm-account';
    state.lake.chapter.checkpoint = 'storm';
    expect(cueForState(state)).toEqual({ track: 'gathering-wind', ambience: 'storm' });
    state.lake.chapter.checkpoint = 'command';
    expect(cueForState(state)).toEqual({ track: 'a-great-calm', ambience: 'lake' });
    state.region = 'capernaum';
    state.connection.replay = { account: 'storm', checkpoint: 'waking' };
    const before = structuredClone(state);
    expect(cueForState(state).track).toBe('gathering-wind');
    expect(state).toEqual(before);
    state.connection.replay = null;
    expect(cueForState(state).track).toBe('first-light');
  });
  it('keeps restored Nain hopeful through its final scene', () => {
    const state = newGame();
    state.region = 'nain-account';
    state.road.chapter.checkpoint = 'procession';
    expect(cueForState(state).track).toBe('at-the-gate');
    for (const checkpoint of ['restored', 'wonder'] as const) {
      state.road.chapter.checkpoint = checkpoint;
      expect(cueForState(state).track).toBe('a-great-calm');
    }
  });
  it('uses distinct feedback for objects, memories, and scene controls', () => {
    expect(feedbackForEvent({ type: 'collect', item: 'bread' })).toBe('pickup');
    expect(feedbackForEvent({ type: 'discover', id: 'shore' })).toBe('discovery');
    expect(feedbackForEvent({ type: 'storm-next', checkpoint: 'calm' })).toBe('page');
    expect(feedbackForEvent({ type: 'reflect', id: 'trust' })).toBe('complete');
    expect(feedbackForEvent({ type: 'track-story', story: 'main' })).toBeUndefined();
  });
});

describe('audio preferences', () => {
  it('upgrades older settings while preserving a deliberate mute and master volume', () => {
    expect(parseSettings({ sound: false, volume: 0.2 })).toEqual({
      ...DEFAULT_SETTINGS,
      sound: false,
      volume: 0.2,
    });
    expect(parseSettings(null).sound).toBe(true);
  });
  it('clamps channels independently and rejects non-finite or nonnumeric values', () => {
    expect(parseSettings({ musicVolume: -2, ambienceVolume: 8, effectsVolume: NaN })).toMatchObject(
      { musicVolume: 0, ambienceVolume: 1, effectsVolume: DEFAULT_SETTINGS.effectsVolume },
    );
    expect(parseSettings({ musicVolume: '0.5', ambienceVolume: Infinity })).toMatchObject({
      musicVolume: DEFAULT_SETTINGS.musicVolume,
      ambienceVolume: DEFAULT_SETTINGS.ambienceVolume,
    });
  });
});
