import type { ScoreNote, SoundEffect } from '../../audio/types';
const tone = (
  pitch: number,
  beat = 0,
  duration = 0.12,
  instrument: ScoreNote['instrument'] = 'lute',
  velocity = 0.4,
): ScoreNote => ({ pitch, beat, duration, instrument, velocity, pan: 0 });
/** Durations and offsets are seconds for effects (one beat per second). */
export const soundEffects: Record<SoundEffect, readonly ScoreNote[]> = {
  step: [tone(43, 0, 0.055, 'drum', 0.18), tone(63, 0.012, 0.045, 'shaker', 0.18)],
  oar: [tone(48, 0, 0.13, 'drum', 0.12), tone(60, 0.06, 0.4, 'shaker', 0.32)],
  pickup: [tone(67, 0, 0.08), tone(74, 0.075, 0.14)],
  place: [tone(48, 0, 0.1, 'drum', 0.3), tone(55, 0.04, 0.08, 'lute', 0.22)],
  repair: [
    tone(59, 0, 0.07, 'drum', 0.28),
    tone(64, 0.14, 0.08, 'drum', 0.23),
    tone(71, 0.25, 0.1, 'lute', 0.24),
  ],
  water: [
    tone(72, 0, 0.12, 'harp', 0.24),
    tone(79, 0.12, 0.2, 'harp', 0.2),
    tone(74, 0.26, 0.22, 'harp', 0.22),
  ],
  page: [tone(70, 0, 0.075, 'shaker', 0.23)],
  discovery: [
    tone(74, 0, 0.25, 'dulcimer'),
    tone(81, 0.16, 0.3, 'dulcimer'),
    tone(83, 0.33, 0.5, 'harp'),
  ],
  complete: [
    tone(62, 0, 0.6, 'harp'),
    tone(69, 0.16, 0.5, 'harp'),
    tone(74, 0.32, 0.55, 'dulcimer'),
    tone(78, 0.49, 0.65, 'dulcimer'),
    tone(81, 0.7, 0.9, 'harp'),
  ],
  travel: [tone(62, 0, 0.22, 'lute', 0.22), tone(69, 0.13, 0.32, 'harp', 0.25)],
};
