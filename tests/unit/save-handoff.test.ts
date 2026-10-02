import 'fake-indexeddb/auto';
import { forceCloseDatabase } from 'fake-indexeddb';
import { openDB } from 'idb';
import { expect, it, vi } from 'vitest';
import { SaveRepository } from '../../src/persistence/saves';
import { newGame, DEFAULT_SETTINGS } from '../../src/game/types';
import { transition } from '../../src/game/quest';
import { makeSave, SAVE_VERSION } from '../../src/persistence/schema';

const preferences = { ...DEFAULT_SETTINGS, quality: 'low' as const, reducedMotion: true };
const progressed = transition(newGame(), { type: 'accept-quest' });

async function prepared() {
  const name = 'handoff-' + crypto.randomUUID();
  const writer = new SaveRepository();
  await writer.init(name);
  await writer.save('auto', newGame());
  await writer.save('slot-1', progressed);
  await writer.saveSettings(preferences);
  writer.close();
  return name;
}

/** Capture the real connection to exercise the IndexedDB abnormal-close event. */
async function connected(name: string) {
  const open = indexedDB.open.bind(indexedDB);
  let connection: IDBDatabase | undefined;
  const capture = vi.spyOn(indexedDB, 'open').mockImplementation((...args) => {
    const request = open(...args);
    request.addEventListener('success', () => (connection = request.result), { once: true });
    return request;
  });
  const repository = new SaveRepository();
  try {
    await repository.init(name);
    if (!connection) throw new Error('The repository must open an IndexedDB connection.');
    return { repository, connection };
  } finally {
    capture.mockRestore();
  }
}

function terminate(connection: IDBDatabase) {
  // fake-indexeddb's declaration names the constructor; its documented API takes a connection.
  forceCloseDatabase(connection as unknown as Parameters<typeof forceCloseDatabase>[0]);
}

it('retains displayed journeys and preferences when another connection requests an upgrade', async () => {
  const name = await prepared();
  const repository = new SaveRepository();
  await repository.init(name);
  const before = await repository.list();
  expect(before.find((slot) => slot.id === 'slot-1')?.save?.state).toEqual(progressed);
  const upgraded = await openDB(name, 2);
  try {
    expect(repository.persistent).toBe(false);
    expect(await repository.list()).toEqual(before);
    expect(repository.getSettings()).toEqual(preferences);
    await repository.save('slot-2', progressed);
    await repository.saveSettings({ ...preferences, quality: 'high' });
    expect((await repository.load('slot-2'))?.state).toEqual(progressed);
    expect(repository.getSettings().quality).toBe('high');
    expect(await upgraded.get('saves', 'slot-2')).toBeUndefined();
    expect(await upgraded.get('preferences', 'settings')).toEqual(preferences);
  } finally {
    upgraded.close();
    repository.close();
  }
});

it('isolates returned saves from the fallback retained after abnormal connection termination', async () => {
  const { repository, connection } = await connected(await prepared());
  try {
    const returned = await repository.load('slot-1');
    returned!.state.position.x = 20;
    returned!.state.journal.push('well');
    const settings = repository.getSettings();
    settings.quality = 'high';
    terminate(connection);
    await vi.waitFor(() => expect(repository.persistent).toBe(false));
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
    expect(repository.getSettings()).toEqual(preferences);
    const fallback = await repository.load('slot-1');
    fallback!.state.position.z = 20;
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
  } finally {
    repository.close();
  }
});

it('honors a successfully read empty slot after another connection deletes its saved journey', async () => {
  const name = await prepared();
  const { repository, connection } = await connected(name);
  const other = await openDB(name, 1);
  try {
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
    await other.put('saves', { ...makeSave(progressed), version: SAVE_VERSION + 1 }, 'slot-1');
    await expect(repository.load('slot-1')).rejects.toThrow(/newer version/);
    await other.delete('saves', 'slot-1');
    expect(await repository.load('slot-1')).toBeNull();
    terminate(connection);
    await vi.waitFor(() => expect(repository.persistent).toBe(false));
    expect(await repository.load('slot-1')).toBeNull();
    expect((await repository.list()).find((slot) => slot.id === 'slot-1')?.save).toBeUndefined();
  } finally {
    other.close();
    repository.close();
  }
});

it('keeps a successfully reread repair available after the connection is interrupted', async () => {
  const name = await prepared();
  const { repository, connection } = await connected(name);
  const other = await openDB(name, 1);
  try {
    await other.put('saves', { ...makeSave(progressed), version: SAVE_VERSION + 1 }, 'slot-1');
    await expect(repository.load('slot-1')).rejects.toThrow(/newer version/);
    await other.put('saves', makeSave(progressed), 'slot-1');
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
    terminate(connection);
    await vi.waitFor(() => expect(repository.persistent).toBe(false));
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
  } finally {
    other.close();
    repository.close();
  }
});

it('isolates newly written session copies from the save returned to their caller', async () => {
  const { repository, connection } = await connected(await prepared());
  try {
    const returned = await repository.save('slot-2', progressed);
    returned.state.position.x = 20;
    returned.state.journal.push('well');
    terminate(connection);
    await vi.waitFor(() => expect(repository.persistent).toBe(false));
    expect((await repository.load('slot-2'))?.state).toEqual(progressed);
  } finally {
    repository.close();
  }
});

it('retains observed corrupt-slot feedback through handoff until the user replaces the slot', async () => {
  const name = await prepared();
  const { repository, connection } = await connected(name);
  const other = await openDB(name, 1);
  try {
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
    await other.put('saves', { ...makeSave(progressed), version: SAVE_VERSION + 1 }, 'slot-1');
    await expect(repository.load('slot-1')).rejects.toThrow(/newer version/);
    expect((await repository.list()).find((slot) => slot.id === 'slot-1')?.error).toMatch(
      /Unreadable save/,
    );
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    try {
      await expect(repository.save('slot-1', progressed)).rejects.toThrow('Storage is full');
    } finally {
      put.mockRestore();
    }
    terminate(connection);
    await vi.waitFor(() => expect(repository.persistent).toBe(false));
    await expect(repository.load('slot-1')).rejects.toThrow(/newer version/);
    expect((await repository.list()).find((slot) => slot.id === 'slot-1')?.error).toMatch(
      /Unreadable save/,
    );
    await repository.save('slot-1', progressed);
    expect((await repository.load('slot-1'))?.state).toEqual(progressed);
  } finally {
    other.close();
    repository.close();
  }
});
