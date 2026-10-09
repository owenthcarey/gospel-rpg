/**
 * Which original scores this browser has heard, for the classic "new music track" message.
 * A per-device courtesy kept outside the journey save; unavailable storage falls back to the
 * session so a blocked or private browser still hears each announcement only once.
 */
export const MUSIC_UNLOCK_KEY = 'the-way:music-unlocked';

export class MusicUnlocks {
  private heard = new Set<string>();
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | undefined) {
    try {
      const saved: unknown = JSON.parse(storage?.getItem(MUSIC_UNLOCK_KEY) ?? '[]');
      if (Array.isArray(saved))
        for (const id of saved) if (typeof id === 'string') this.heard.add(id);
    } catch {
      // Unreadable or blocked storage starts a fresh session list.
    }
  }
  list(): string[] {
    return [...this.heard];
  }
  /** True the first time a track is heard. */
  unlock(id: string): boolean {
    if (this.heard.has(id)) return false;
    this.heard.add(id);
    try {
      this.storage?.setItem(MUSIC_UNLOCK_KEY, JSON.stringify([...this.heard]));
    } catch {
      // The session still remembers the track.
    }
    return true;
  }
}
