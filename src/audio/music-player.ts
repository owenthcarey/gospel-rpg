import type { MusicTrack } from './types';
import { Synth } from './synth';
interface Performance {
  track: MusicTrack;
  gain: GainNode;
  synth: Synth;
  start: number;
  index: number;
  loop: number;
  retireAt?: number;
}
const FADE = 1.8;
/** The audio clock owns note timing; the timer only fills a short look-ahead window. */
export class MusicPlayer {
  private performances: Performance[] = [];
  private active?: Performance;
  constructor(
    private context: BaseAudioContext,
    private output: AudioNode,
  ) {}
  select(track: MusicTrack): void {
    if (this.active?.track.id === track.id) return;
    const now = this.context.currentTime;
    if (this.active) {
      const level = Math.min(1, Math.max(0, (now - this.active.start + 0.04) / FADE));
      this.active.gain.gain.cancelScheduledValues(now);
      this.active.gain.gain.setValueAtTime(level, now);
      this.active.gain.gain.linearRampToValueAtTime(0, now + FADE);
      this.active.retireAt = now + FADE;
    }
    // Rapid doorway/replay changes may overlap briefly, but never accumulate players.
    while (this.performances.length >= 3) this.remove(this.performances[0]!);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    gain.connect(this.output);
    this.active = {
      track,
      gain,
      synth: new Synth(this.context),
      start: now + 0.04,
      index: 0,
      loop: 0,
    };
    this.performances.push(this.active);
    this.tick();
  }
  tick(): void {
    const now = this.context.currentTime;
    for (const player of [...this.performances]) {
      if (player.retireAt !== undefined && now >= player.retireAt) {
        this.remove(player);
        continue;
      }
      const { track } = player;
      const beatSeconds = 60 / track.bpm;
      const length = track.bars * track.beatsPerBar;
      const time = () =>
        player.start + (player.loop * length + track.notes[player.index]!.beat) * beatSeconds;
      // A stalled main thread drops missed notes instead of emitting a catch-up burst.
      if (time() < now - 0.04) {
        const elapsed = Math.max(0, (now - player.start) / beatSeconds);
        player.loop = Math.floor(elapsed / length);
        player.index = track.notes.findIndex((note) => note.beat >= elapsed % length);
        if (player.index < 0) {
          player.index = 0;
          player.loop++;
        }
      }
      while (time() < now + 0.2) {
        player.synth.note(
          track.notes[player.index]!,
          Math.max(now, time()),
          beatSeconds,
          player.gain,
        );
        player.index++;
        if (player.index === track.notes.length) {
          player.index = 0;
          player.loop++;
        }
      }
    }
  }
  private remove(player: Performance): void {
    player.synth.dispose();
    player.gain.disconnect();
    this.performances = this.performances.filter((item) => item !== player);
  }
  diagnostics(): { players: number; voices: number; track?: string } {
    return {
      players: this.performances.length,
      voices: this.performances.reduce((sum, p) => sum + p.synth.voices.size, 0),
      track: this.active?.track.id,
    };
  }
  dispose(): void {
    [...this.performances].forEach((player) => this.remove(player));
    this.active = undefined;
  }
}
