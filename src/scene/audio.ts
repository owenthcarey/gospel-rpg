import type { GameState, Point, Settings } from '../game/types';
import { DEFAULT_SETTINGS } from '../game/types';
import type { ActionMotion } from '../content/campaign/actions';
import { musicTracks } from '../content/audio/music';
import { cueForState, regionAudio, type AudioCue } from '../content/audio/cues';
import { soundEffects } from '../content/audio/effects';
import type { SoundEffect } from '../audio/types';
import { Synth, roomImpulse } from '../audio/synth';
import { MusicPlayer } from '../audio/music-player';
import { AmbiencePlayer } from '../audio/ambience';

/** One context and independent buses for the entire journey, across disposable scenes. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private ambience?: GainNode;
  private effects?: GainNode;
  private graph: AudioNode[] = [];
  private player?: MusicPlayer;
  private soundscape?: AmbiencePlayer;
  private synth?: Synth;
  private settings = { ...DEFAULT_SETTINGS };
  private cue: AudioCue = regionAudio.capernaum;
  private timer?: ReturnType<typeof setInterval>;
  private paused = false;
  private disposed = false;
  private reading = false;
  private lastEffect = new Map<SoundEffect, number>();
  private lastPosition?: Point;
  private walked = 0;
  private region = 'capernaum';

  /** Call synchronously from a trusted click/key event, before asynchronous game loading. */
  unlock(): void {
    if (this.disposed || this.paused || !this.settings.sound) return;
    try {
      if (!this.context) this.create();
      this.resume();
    } catch {
      // Optional audio failure must never prevent travel, saving, or reading.
      this.release();
    }
  }
  private create(): void {
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.master.connect(limiter).connect(context.destination);
    this.music = context.createGain();
    this.ambience = context.createGain();
    this.effects = context.createGain();
    this.music.connect(this.master);
    this.ambience.connect(this.master);
    this.effects.connect(this.master);
    const musicInput = context.createGain();
    musicInput.connect(this.music);
    const reverb = context.createConvolver();
    reverb.buffer = roomImpulse(context);
    const wet = context.createGain();
    wet.gain.value = 0.16;
    musicInput.connect(reverb).connect(wet).connect(this.music);
    this.graph = [
      this.master,
      limiter,
      this.music,
      this.ambience,
      this.effects,
      musicInput,
      reverb,
      wet,
    ];
    this.player = new MusicPlayer(context, musicInput);
    this.soundscape = new AmbiencePlayer(context, this.ambience);
    this.synth = new Synth(context);
    this.player.select(musicTracks[this.cue.track]);
    this.soundscape.select(this.cue.ambience);
    this.mix();
  }
  set(settings: Settings): void {
    this.settings = { ...settings };
    this.mix();
    if (!settings.sound) this.suspend();
    else if (!this.paused && this.context) this.resume();
  }
  update(state: GameState): void {
    const next = cueForState(state);
    if (this.region !== state.region) {
      this.lastPosition = undefined;
      this.walked = 0;
    }
    this.region = state.region;
    if (this.cue.track !== next.track) this.player?.select(musicTracks[next.track]);
    if (this.cue.ambience !== next.ambience) this.soundscape?.select(next.ambience);
    this.cue = next;
  }
  /** Menus/dialogue gently lower the score, without restarting the composition. */
  duck(reading: boolean): void {
    if (reading === this.reading) return;
    this.reading = reading;
    this.mix();
  }
  private mix(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const volume = (value: number) =>
      Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.master?.gain.setTargetAtTime(
      this.settings.sound ? volume(this.settings.volume) : 0,
      now,
      0.06,
    );
    this.music?.gain.setTargetAtTime(
      volume(this.settings.musicVolume) * (this.reading ? 0.62 : 1),
      now,
      0.25,
    );
    this.ambience?.gain.setTargetAtTime(volume(this.settings.ambienceVolume), now, 0.15);
    this.effects?.gain.setTargetAtTime(volume(this.settings.effectsVolume), now, 0.08);
  }
  play(effect: SoundEffect): void {
    const context = this.context;
    if (
      !context ||
      context.state !== 'running' ||
      !this.settings.sound ||
      this.paused ||
      this.disposed ||
      !this.settings.effectsVolume ||
      !this.effects
    )
      return;
    const now = context.currentTime;
    const cooldown = effect === 'step' ? 0.28 : effect === 'oar' ? 0.85 : 0.12;
    if (now - (this.lastEffect.get(effect) ?? -Infinity) < cooldown) return;
    this.lastEffect.set(effect, now);
    for (const note of soundEffects[effect])
      this.synth?.note(note, now + note.beat, 1, this.effects);
  }
  motion(motion?: ActionMotion): void {
    if (motion)
      this.play(
        (
          {
            PickUp: 'pickup',
            PutDown: 'place',
            Repair: 'repair',
            SitDown: 'place',
            Use: 'water',
          } as const
        )[motion],
      );
  }
  movement(position: Point, enabled: boolean): void {
    const previous = this.lastPosition;
    this.lastPosition = { ...position };
    if (!enabled || !previous) {
      this.walked = 0;
      return;
    }
    const distance = Math.hypot(position.x - previous.x, position.z - previous.z);
    if (distance > 2) {
      this.walked = 0;
      return;
    } // Teleports/load corrections are silent.
    this.walked += distance;
    const afloat = this.region === 'galilee-water';
    if (this.walked >= (afloat ? 2.4 : 1.25)) {
      this.walked = 0;
      this.play(afloat ? 'oar' : 'step');
    }
  }
  private suspend(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    void this.context?.suspend().catch(() => {});
  }
  pause(): void {
    this.paused = true;
    this.suspend();
  }
  resume(): void {
    this.paused = false;
    const context = this.context;
    if (this.disposed || !context || !this.settings.sound) return;
    void context
      .resume()
      .then(() => {
        if (this.disposed || this.paused || !this.settings.sound || context !== this.context)
          return;
        this.mix();
        this.player?.tick();
        if (!this.timer)
          this.timer = setInterval(() => {
            if (context.state === 'running') this.player?.tick();
          }, 50);
      })
      .catch(() => {});
  }
  diagnostics(): { state: string; track: string; players: number; voices: number } {
    const player = this.player?.diagnostics();
    return {
      state: this.context?.state ?? 'locked',
      track: this.cue.track,
      players: player?.players ?? 0,
      voices: (player?.voices ?? 0) + (this.synth?.voices.size ?? 0),
    };
  }
  private release(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.player?.dispose();
    this.soundscape?.dispose();
    this.synth?.dispose();
    this.graph.forEach((node) => node.disconnect());
    this.graph = [];
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.player = undefined;
    this.soundscape = undefined;
    this.synth = undefined;
  }
  dispose(): void {
    this.disposed = true;
    this.release();
  }
}
