import type { Soundscape } from './types';
import { noiseBuffer } from './synth';
interface Texture {
  low: number;
  high: number;
  level: number;
  pace: number;
  depth: number;
}
const textures: Record<Soundscape, Texture> = {
  shore: { low: 900, high: 180, level: 0.055, pace: 0.14, depth: 0.025 },
  lake: { low: 650, high: 110, level: 0.065, pace: 0.2, depth: 0.032 },
  village: { low: 1500, high: 300, level: 0.018, pace: 0.09, depth: 0.009 },
  country: { low: 2100, high: 550, level: 0.022, pace: 0.08, depth: 0.012 },
  room: { low: 380, high: 140, level: 0.008, pace: 0.06, depth: 0.003 },
  hearth: { low: 1600, high: 260, level: 0.026, pace: 1.9, depth: 0.013 },
  storm: { low: 2600, high: 80, level: 0.13, pace: 0.36, depth: 0.065 },
};
/** Continuous filtered wind/water with a slow wave envelope; no downloaded recordings. */
export class AmbiencePlayer {
  private source: AudioBufferSourceNode;
  private low: BiquadFilterNode;
  private high: BiquadFilterNode;
  private gain: GainNode;
  private swell: OscillatorNode;
  private depth: GainNode;
  constructor(
    private context: AudioContext,
    output: AudioNode,
  ) {
    this.source = context.createBufferSource();
    this.source.buffer = noiseBuffer(context, 4);
    this.source.loop = true;
    this.low = context.createBiquadFilter();
    this.low.type = 'lowpass';
    this.high = context.createBiquadFilter();
    this.high.type = 'highpass';
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.low).connect(this.high).connect(this.gain).connect(output);
    this.swell = context.createOscillator();
    this.depth = context.createGain();
    this.depth.gain.value = 0;
    this.swell.connect(this.depth).connect(this.gain.gain);
    this.source.start();
    this.swell.start();
  }
  select(id: Soundscape): void {
    const texture = textures[id],
      now = this.context.currentTime;
    this.low.frequency.setTargetAtTime(texture.low, now, 0.65);
    this.high.frequency.setTargetAtTime(texture.high, now, 0.65);
    this.gain.gain.setTargetAtTime(texture.level, now, 0.65);
    this.depth.gain.setTargetAtTime(texture.depth, now, 0.65);
    this.swell.frequency.setTargetAtTime(texture.pace, now, 0.65);
  }
  dispose(): void {
    this.source.stop();
    this.swell.stop();
    [this.source, this.low, this.high, this.gain, this.swell, this.depth].forEach((node) =>
      node.disconnect(),
    );
  }
}
