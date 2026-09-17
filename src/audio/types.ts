/** Scores use quarter-note beats and MIDI pitches (middle C = 60). */
export type Instrument =
  'flute' | 'reed' | 'lute' | 'harp' | 'dulcimer' | 'strings' | 'bass' | 'drum' | 'shaker';
export interface ScoreNote {
  beat: number;
  duration: number;
  pitch: number;
  velocity: number;
  instrument: Instrument;
  pan: number;
}
export interface MusicTrack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  notes: readonly ScoreNote[];
}
export type SoundEffect =
  | 'step'
  | 'oar'
  | 'pickup'
  | 'place'
  | 'repair'
  | 'water'
  | 'page'
  | 'discovery'
  | 'complete'
  | 'travel';
export type Soundscape = 'shore' | 'village' | 'room' | 'hearth' | 'country' | 'lake' | 'storm';
