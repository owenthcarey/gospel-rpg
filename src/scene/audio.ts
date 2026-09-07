import type { Settings } from '../game/types';

/** Small synthesized lakeside soundscape. No network audio or autoplay. */
export class Ambience {
  private context?: AudioContext;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private chimeNodes: OscillatorNode[] = [];
  private settings?: Settings;
  set(settings: Settings): void {
    this.settings = settings;
    if (!settings.sound) {
      void this.context?.suspend();
      return;
    }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.connect(this.context.destination);
        const buffer = this.context.createBuffer(
          1,
          this.context.sampleRate * 4,
          this.context.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
          data[i] = brown * 2;
        }
        this.source = this.context.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 650;
        this.source.connect(filter);
        filter.connect(this.gain);
        this.source.start();
      }
      this.gain!.gain.setTargetAtTime(settings.volume * 0.3, this.context.currentTime, 0.5);
      void this.context.resume().catch(() => {});
    } catch {
      /* Sound is optional; rendering and progress remain available. */
    }
  }
  pause(): void {
    void this.context?.suspend();
  }
  resume(): void {
    if (this.settings) this.set(this.settings);
  }
  chime(): void {
    if (!this.settings?.sound || !this.context || !this.gain) return;
    [392, 493.88, 587.33].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator(),
        envelope = this.context!.createGain();
      const start = this.context!.currentTime + index * 0.16;
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.18, start + 0.03);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
      oscillator.connect(envelope);
      envelope.connect(this.gain!);
      oscillator.start(start);
      oscillator.stop(start + 1.3);
      this.chimeNodes.push(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        this.chimeNodes = this.chimeNodes.filter((n) => n !== oscillator);
      };
    });
  }
  dispose(): void {
    this.source?.stop();
    this.chimeNodes.forEach((n) => n.stop());
    void this.context?.close();
  }
}
