import type { Instrument, MusicTrack, ScoreNote } from '../../audio/types';

const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(note: string): number {
  const match = /^([A-G])([#b]?)([0-8])$/.exec(note);
  if (!match) throw new Error(`Invalid score pitch: ${note}`);
  return (
    (Number(match[3]) + 1) * 12 +
    semitones[match[1]!]! +
    (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0)
  );
}
interface Theme {
  melody: readonly string[];
  chords: readonly string[];
}
export interface Composition {
  id: string;
  title: string;
  description: string;
  bpm: number;
  meter: 3 | 4;
  lead: 'flute' | 'reed' | 'dulcimer';
  pluck: 'lute' | 'harp';
  character: 'dance' | 'flowing' | 'solemn' | 'storm';
  a: Theme;
  b: Theme;
}
/** Fixed, authored A/A′/B/A″ form; no randomly generated melody. */
export function arrange(composition: Composition): MusicTrack {
  const { meter, character } = composition;
  const notes: ScoreNote[] = [];
  const add = (
    instrument: Instrument,
    beat: number,
    duration: number,
    pitch: number,
    velocity: number,
    pan = 0,
  ) => notes.push({ instrument, beat, duration, pitch, velocity, pan });
  const sections = [
    { theme: composition.a, count: 4, lead: false, intensity: 0.65 },
    { theme: composition.a, count: 8, lead: true, intensity: 0.9 },
    { theme: composition.a, count: 8, lead: true, intensity: 0.8 },
    { theme: composition.b, count: 8, lead: true, intensity: 1 },
    { theme: composition.a, count: 8, lead: true, intensity: 0.94 },
    { theme: composition.a, count: 4, lead: false, intensity: 0.6 },
  ];
  let bar = 0;
  sections.forEach((section, sectionIndex) => {
    for (let local = 0; local < section.count; local++, bar++) {
      const themeIndex = sectionIndex === 5 ? local + 4 : local;
      const chord = section.theme.chords[themeIndex]!.split(' ').map(midi);
      const start = bar * meter;
      const energy = section.intensity;
      // Rounded bass, hand-plucked broken chords, and a quiet sustained inner voice.
      add('bass', start, meter * 0.85, chord[0]! - 12, 0.42 * energy, -0.08);
      if (character === 'dance' || character === 'storm')
        add('bass', start + meter / 2, meter / 2 - 0.1, chord[2]! - 12, 0.25 * energy, -0.08);
      const spacing = character === 'solemn' ? 1 : 0.5;
      for (let step = 0; step < meter / spacing; step++) {
        const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
        const pitch =
          chord[pattern[(step + (local % 2) * 2) % pattern.length]! % chord.length]! + 12;
        add(
          composition.pluck,
          start + step * spacing,
          spacing * 1.6,
          pitch,
          (step % 2 === 0 ? 0.34 : 0.22) * energy,
          -0.36,
        );
      }
      chord
        .slice(1, 3)
        .forEach((pitch, index) =>
          add(
            'strings',
            start + index * 0.025,
            meter - 0.12,
            pitch,
            0.105 * energy,
            0.3 + index * 0.12,
          ),
        );
      if (section.lead) {
        let offset = 0;
        for (const token of section.theme.melody[themeIndex]!.split(' ')) {
          const [pitch, length] = token.split('/');
          const duration = Number(length);
          if (!(duration > 0)) throw new Error(`Invalid note duration: ${token}`);
          if (pitch !== '-')
            add(
              sectionIndex === 2 ? 'dulcimer' : composition.lead,
              start + offset,
              duration * 0.88,
              midi(pitch!),
              (offset % 1 === 0 ? 0.62 : 0.5) * energy,
              0.08,
            );
          offset += duration;
        }
        if (Math.abs(offset - meter) > 0.001)
          throw new Error(
            `${composition.id}, bar ${themeIndex}: expected ${meter} beats, got ${offset}`,
          );
      }
      // Answering bells enter in the bridge/reprise; space is left around the melody.
      if ((sectionIndex === 3 || sectionIndex === 4) && local % 2 === 1)
        add('dulcimer', start + meter - 1, 1.4, chord[1]! + 24, 0.18 * energy, 0.48);
      if (character === 'dance' || character === 'storm') {
        add('drum', start, 0.22, character === 'storm' ? 40 : 47, 0.24 * energy);
        add('drum', start + meter / 2, 0.15, 54, 0.12 * energy, 0.1);
        for (let step = 1; step < meter * 2; step += 2)
          add('shaker', start + step * 0.5, 0.09, 70, 0.09 * energy, 0.38);
      }
    }
  });
  return {
    id: composition.id,
    title: composition.title,
    description: composition.description,
    bpm: composition.bpm,
    beatsPerBar: meter,
    bars: bar,
    notes: notes.sort((a, b) => a.beat - b.beat),
  };
}
