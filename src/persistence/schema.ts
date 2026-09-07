import { journalEntries } from '../content/story';
import type { GameState, Settings } from '../game/types';
import { DEFAULT_SETTINGS } from '../game/types';

export const SAVE_VERSION = 2;
export const MAX_SAVE_BYTES = 128 * 1024;
export interface SaveFile {
  version: 2;
  region: 'capernaum';
  savedAt: string;
  state: GameState;
}
export class SaveError extends Error {
  override name = 'SaveError';
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
function stringList(value: unknown, allowed: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= allowed.length &&
    new Set(value).size === value.length &&
    value.every((v) => typeof v === 'string' && allowed.includes(v))
  );
}

export function makeSave(state: GameState): SaveFile {
  return parseSave({
    version: SAVE_VERSION,
    region: 'capernaum',
    savedAt: new Date().toISOString(),
    state: structuredClone(state),
  });
}

/** Treat both IndexedDB records and uploaded JSON as untrusted input. */
export function parseSave(raw: unknown): SaveFile {
  if (!record(raw)) throw new SaveError('This file is not a valid journey save.');
  if (typeof raw.version === 'number' && raw.version > SAVE_VERSION)
    throw new SaveError(
      'This save is from a newer version of The Way. Update the game before importing it.',
    );
  if (raw.version === 1 && record(raw.state)) {
    raw = {
      ...raw,
      version: 2,
      region: 'capernaum',
      state: {
        ...raw.state,
        discoveries: raw.state.discoveries ?? [],
        playTime: raw.state.playTime ?? 0,
      },
    };
  }
  if (
    !record(raw) ||
    raw.version !== 2 ||
    raw.region !== 'capernaum' ||
    typeof raw.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(raw.savedAt)) ||
    !record(raw.state)
  )
    throw new SaveError('The save format is damaged or unsupported.');
  const s = raw.state;
  if (
    !record(s.position) ||
    !finite(s.position.x) ||
    !finite(s.position.z) ||
    Math.abs(s.position.x) > 24 ||
    Math.abs(s.position.z) > 24 ||
    typeof s.quest !== 'string' ||
    !['not-started', 'gathering', 'delivered', 'complete'].includes(s.quest) ||
    !stringList(s.inventory, ['net', 'bread']) ||
    !stringList(s.discoveries, ['shore', 'well', 'olive']) ||
    !stringList(s.journal, Object.keys(journalEntries)) ||
    !finite(s.playTime) ||
    s.playTime < 0 ||
    s.playTime > 1e9
  )
    throw new SaveError('This save contains invalid progress or a damaged player position.');
  if (s.quest !== 'gathering' && s.inventory.length > 0)
    throw new SaveError('This save has inconsistent quest items.');
  if (
    !s.journal.includes('arrival') ||
    (s.quest !== 'not-started' && !s.journal.includes('simon')) ||
    (['delivered', 'complete'].includes(String(s.quest)) && !s.journal.includes('delivered')) ||
    (s.quest === 'complete' && !s.journal.includes('complete')) ||
    s.inventory.some((item) => !(s.journal as string[]).includes(item)) ||
    s.discoveries.some((id) => !(s.journal as string[]).includes(id))
  )
    throw new SaveError('This save has an incomplete journey record.');
  const expectedJournal = new Set(['arrival', ...s.discoveries]);
  if (s.quest !== 'not-started') expectedJournal.add('simon');
  if (s.quest === 'gathering') s.inventory.forEach((id) => expectedJournal.add(id));
  if (s.quest === 'delivered' || s.quest === 'complete') {
    ['net', 'bread', 'delivered'].forEach((id) => expectedJournal.add(id));
  }
  if (s.quest === 'complete') expectedJournal.add('complete');
  if (
    s.journal.length !== expectedJournal.size ||
    s.journal.some((id) => !expectedJournal.has(id))
  ) {
    throw new SaveError('This save has inconsistent journal progress.');
  }
  return {
    version: 2,
    region: 'capernaum',
    savedAt: raw.savedAt,
    state: {
      position: { x: s.position.x, z: s.position.z },
      quest: s.quest as GameState['quest'],
      inventory: [...s.inventory] as GameState['inventory'],
      discoveries: [...s.discoveries] as GameState['discoveries'],
      journal: [...s.journal],
      playTime: s.playTime,
    },
  };
}

export function importSave(text: string): SaveFile {
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES)
    throw new SaveError('This file is too large to be a journey save (maximum 128 KB).');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveError('The file is not readable JSON. Choose an exported journey file.');
  }
  return parseSave(data);
}

export function parseSettings(raw: unknown): Settings {
  if (!record(raw)) return { ...DEFAULT_SETTINGS };
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
    volume: finite(raw.volume) ? Math.max(0, Math.min(1, raw.volume)) : DEFAULT_SETTINGS.volume,
    quality: raw.quality === 'low' ? 'low' : 'high',
    reducedMotion:
      typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
  };
}
