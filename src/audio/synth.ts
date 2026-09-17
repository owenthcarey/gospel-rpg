import type { Instrument, ScoreNote } from './types';

export interface Voice {
  stop(at?: number): void;
}
interface Timbre {
  partials: number[];
  attack: number;
  release: number;
  level: number;
  plucked?: boolean;
}
const timbres: Record<Exclude<Instrument, 'drum' | 'shaker'>, Timbre> = {
  flute: { partials: [1, 0.16, 0.07, 0.035, 0.014], attack: 0.055, release: 0.18, level: 0.19 },
  reed: {
    partials: [1, 0.24, 0.43, 0.11, 0.18, 0.04, 0.055],
    attack: 0.035,
    release: 0.14,
    level: 0.13,
  },
  lute: {
    partials: [1, 0.58, 0.31, 0.16, 0.09, 0.045, 0.025],
    attack: 0.005,
    release: 0.3,
    level: 0.2,
    plucked: true,
  },
  harp: {
    partials: [1, 0.42, 0.19, 0.08, 0.035],
    attack: 0.008,
    release: 0.65,
    level: 0.21,
    plucked: true,
  },
  dulcimer: {
    partials: [1, 0.18, 0.48, 0.08, 0.15, 0.025, 0.09],
    attack: 0.003,
    release: 0.6,
    level: 0.13,
    plucked: true,
  },
  strings: { partials: [1, 0.35, 0.21, 0.12, 0.07, 0.04], attack: 0.3, release: 0.55, level: 0.16 },
  bass: { partials: [1, 0.24, 0.08], attack: 0.014, release: 0.18, level: 0.26, plucked: true },
};
export const frequency = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);
/** Seeded texture sources make offline renders and the live instrument bank reproducible. */
export function noiseBuffer(context: BaseAudioContext, seconds: number, seed = 731): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let random = seed;
  for (let i = 0; i < data.length; i++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    data[i] = (random / 4294967296) * 2 - 1;
  }
  return buffer;
}
export function roomImpulse(context: BaseAudioContext): AudioBuffer {
  const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 1.6), context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const noise = noiseBuffer(context, 1.6, 31 + channel * 193).getChannelData(0);
    const data = impulse.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      smooth = smooth * 0.45 + noise[i]! * 0.55;
      data[i] = i < context.sampleRate * 0.025 ? 0 : smooth * (1 - i / data.length) ** 3;
    }
  }
  return impulse;
}
/** A small, shared instrument bank. Every source disconnects on completion. */
export class Synth {
  private waves = new Map<Instrument, PeriodicWave>();
  private noise: AudioBuffer;
  readonly voices = new Set<Voice>();
  constructor(
    private context: BaseAudioContext,
    private maxVoices = 96,
  ) {
    this.noise = noiseBuffer(context, 1);
  }
  note(
    note: ScoreNote,
    start: number,
    secondsPerBeat: number,
    destination: AudioNode,
  ): Voice | undefined {
    if (this.voices.size >= this.maxVoices) return;
    const context = this.context;
    const duration = Math.max(0.025, note.duration * secondsPerBeat);
    const envelope = context.createGain();
    const pan = context.createStereoPanner();
    pan.pan.value = note.pan;
    envelope.connect(pan);
    pan.connect(destination);
    const filter = context.createBiquadFilter();
    filter.connect(envelope);
    const sources: AudioScheduledSourceNode[] = [];
    const auxiliaries: AudioNode[] = [filter, envelope, pan];
    let end = start + duration + 0.2;
    if (note.instrument === 'shaker') {
      const source = context.createBufferSource();
      source.buffer = this.noise;
      filter.type = 'highpass';
      filter.frequency.value = 4300;
      source.connect(filter);
      sources.push(source);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(note.velocity * 0.15, start + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      end = start + duration + 0.01;
    } else if (note.instrument === 'drum') {
      const source = context.createOscillator();
      source.frequency.setValueAtTime(frequency(note.pitch) * 1.5, start);
      source.frequency.exponentialRampToValueAtTime(frequency(note.pitch) * 0.45, start + duration);
      source.connect(filter);
      filter.frequency.value = 900;
      sources.push(source);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(note.velocity * 0.6, start + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    } else {
      const timbre = timbres[note.instrument];
      let wave = this.waves.get(note.instrument);
      if (!wave) {
        const imaginary = new Float32Array([0, ...timbre.partials]);
        wave = context.createPeriodicWave(new Float32Array(imaginary.length), imaginary);
        this.waves.set(note.instrument, wave);
      }
      const source = context.createOscillator();
      source.setPeriodicWave(wave);
      source.frequency.value = frequency(note.pitch);
      source.connect(filter);
      sources.push(source);
      const attack = Math.min(timbre.attack, duration * 0.3);
      const level = note.velocity * timbre.level;
      filter.type = 'lowpass';
      filter.Q.value = 0.5;
      filter.frequency.setValueAtTime(
        Math.min(9000, frequency(note.pitch) * (timbre.plucked ? 10 : 5)),
        start,
      );
      if (timbre.plucked)
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(300, frequency(note.pitch) * 1.6),
          start + duration,
        );
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level, start + attack);
      envelope.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, level * (timbre.plucked ? 0.16 : 0.82)),
        start + duration,
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration + timbre.release);
      end = start + duration + timbre.release + 0.02;
      if (note.instrument === 'flute' || note.instrument === 'strings') {
        const vibrato = context.createOscillator();
        const depth = context.createGain();
        vibrato.frequency.value = note.instrument === 'flute' ? 4.7 : 5.2;
        depth.gain.setValueAtTime(0, start);
        depth.gain.linearRampToValueAtTime(
          note.instrument === 'flute' ? 7 : 10,
          start + Math.min(0.4, duration),
        );
        vibrato.connect(depth);
        depth.connect(source.detune);
        sources.push(vibrato);
        auxiliaries.push(depth);
      }
    }
    let stopped = false;
    const voice: Voice = {
      stop: (at = context.currentTime) => {
        if (stopped) return;
        stopped = true;
        envelope.gain.cancelScheduledValues(at);
        envelope.gain.setTargetAtTime(0, at, 0.015);
        sources.forEach((source) => source.stop(Math.max(context.currentTime, at) + 0.08));
      },
    };
    this.voices.add(voice);
    sources[0]!.onended = () => {
      sources.forEach((source) => source.disconnect());
      auxiliaries.forEach((node) => node.disconnect());
      this.voices.delete(voice);
    };
    sources.forEach((source) => {
      source.start(start);
      source.stop(end);
    });
    return voice;
  }
  dispose(): void {
    this.voices.forEach((voice) => voice.stop());
    this.voices.clear();
    this.waves.clear();
  }
}
