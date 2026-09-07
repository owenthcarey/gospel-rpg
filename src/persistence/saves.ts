import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameState, Settings } from '../game/types';
import { makeSave, parseSave, parseSettings, type SaveFile } from './schema';

export const SLOT_IDS = ['auto', 'slot-1', 'slot-2', 'slot-3'] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export interface SlotSummary {
  id: SlotId;
  save?: SaveFile;
  error?: string;
}
interface JourneyDB extends DBSchema {
  saves: { key: SlotId; value: SaveFile };
  preferences: { key: string; value: Settings };
}

export class SaveRepository {
  private db?: IDBPDatabase<JourneyDB>;
  private memory = new Map<SlotId, SaveFile>();
  private settings: Settings = parseSettings(null);
  persistent = false;
  async init(name = 'the-way-journeys'): Promise<void> {
    try {
      this.db = await openDB<JourneyDB>(name, 1, {
        upgrade(db) {
          db.createObjectStore('saves');
          db.createObjectStore('preferences');
        },
        blocking: () => {
          this.db?.close();
          this.persistent = false;
        },
        terminated: () => {
          this.persistent = false;
        },
      });
      this.settings = parseSettings(await this.db.get('preferences', 'settings'));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
  }
  async save(id: SlotId, state: GameState): Promise<SaveFile> {
    const save = makeSave(state);
    if (this.persistent && this.db) await this.db.put('saves', save, id);
    this.memory.set(id, save);
    return save;
  }
  async load(id: SlotId): Promise<SaveFile | null> {
    const raw = this.persistent && this.db ? await this.db.get('saves', id) : this.memory.get(id);
    return raw ? parseSave(raw) : null;
  }
  async list(): Promise<SlotSummary[]> {
    return Promise.all(
      SLOT_IDS.map(async (id) => {
        try {
          return { id, save: (await this.load(id)) ?? undefined };
        } catch {
          return {
            id,
            error: 'Unreadable save. Export your current journey or replace this slot.',
          };
        }
      }),
    );
  }
  getSettings(): Settings {
    return { ...this.settings };
  }
  async saveSettings(settings: Settings): Promise<void> {
    const safe = parseSettings(settings);
    if (this.persistent && this.db) await this.db.put('preferences', safe, 'settings');
    this.settings = safe;
  }
  close(): void {
    this.db?.close();
  }
}
