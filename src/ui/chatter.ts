/** Pure timing for overhead remarks: a few at a time, each neighbor in turn, never rushed. */
export interface ChatterLine {
  id: string;
  text: string;
}

interface Speaker {
  nextAt: number;
  until: number;
  spoken: number;
}

/** A small stable offset per person so neighbors do not all speak at once. */
function stagger(id: string, span: number): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % span;
}

export class ChatterSchedule {
  private speakers = new Map<string, Speaker>();
  constructor(
    private lines: Readonly<Record<string, readonly string[]>>,
    readonly interval = 15_000,
    readonly duration = 4_500,
    readonly maxActive = 2,
  ) {}
  /** Lines showing at `now` among the eligible people; ineligible speakers fall silent. */
  tick(now: number, eligible: readonly string[]): ChatterLine[] {
    const allowed = new Set(eligible.filter((id) => this.lines[id]?.length));
    for (const id of allowed)
      if (!this.speakers.has(id))
        this.speakers.set(id, {
          nextAt: now + 2_500 + stagger(id, this.interval),
          until: 0,
          spoken: 0,
        });
    let active = 0;
    for (const [id, s] of this.speakers) {
      if (!allowed.has(id)) s.until = 0;
      else if (s.until > now) active++;
    }
    for (const id of allowed) {
      const s = this.speakers.get(id)!;
      if (s.until > now || now < s.nextAt || active >= this.maxActive) continue;
      s.until = now + this.duration;
      s.nextAt = now + this.interval + stagger(id + s.spoken, this.interval / 2);
      s.spoken++;
      active++;
    }
    return [...allowed]
      .filter((id) => this.speakers.get(id)!.until > now)
      .map((id) => {
        const s = this.speakers.get(id)!;
        const options = this.lines[id]!;
        return { id, text: options[(s.spoken - 1) % options.length]! };
      });
  }
  /** Silence everyone, for example while reading or after a region change. */
  quiet(): void {
    for (const s of this.speakers.values()) s.until = 0;
  }
}
