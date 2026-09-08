import './ui/styles.css';
import './ui/episode.css';
import { dialogueFor, type Dialogue, type Choice } from './content/story';
import { transition } from './game/quest';
import { newGame, type GameEvent, type GameState, type Settings } from './game/types';
import { importSave, makeSave, MAX_SAVE_BYTES } from './persistence/schema';
import { SaveRepository, SLOT_IDS, type SlotId } from './persistence/saves';
import { ActionQueue } from './game/action-queue';
import { Ambience } from './scene/audio';
import { GameRuntime } from './scene/runtime';
import { SCENE_IDS } from './game/episode/types';
import { actionFor } from './content/episode/interactions';
import { Interface } from './ui/interface';
import { escapeHtml } from './ui/icons';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const loadingMessage = document.querySelector<HTMLElement>('#loading-message')!;
const saves = new SaveRepository();
const audio = new Ambience();
let state: GameState = newGame();
let settings: Settings;
let world: GameRuntime | undefined;
let regionLoading = false;
let scenePaused = false;
let graphicsLost = false;
let started = false;
let conversation: Dialogue | null = null;
let saveQueue: Promise<unknown> = Promise.resolve();
let menuRequest = 0;
let disposed = false;
let storageWarned = false;
let timer: ReturnType<typeof setInterval> | undefined;

const ui = new Interface(document.querySelector('#ui')!, {
  action: (name, value) => {
    const choice = name === 'choice' ? conversation?.choices[Number(value)] : undefined;
    runAction(() => handleAction(name, value, choice));
  },
  setting: (key, value) => {
    runAction(() => updateSetting(key, value));
  },
  importFile: (file) => {
    runAction(() => loadFile(file));
  },
});

const actions = new ActionQueue((pending) => ui.setActionPending(pending));
function runAction(action: () => Promise<void>): void {
  if (disposed) return;
  void actions
    .run(async () => {
      if (!disposed) await action();
    })
    .catch(reportError);
}
async function changeRegion(next: GameState): Promise<void> {
  if (!world) return;
  regionLoading = true;
  syncPause();
  loading.hidden = false;
  loadingMessage.textContent = 'Opening the next part of your journey…';
  ui.setBusy(true);
  try {
    await world.load(next, (message) => {
      loadingMessage.textContent = message;
    });
  } finally {
    regionLoading = false;
    loading.hidden = true;
    ui.setBusy(false);
    syncPause();
  }
}
function reportError(error: unknown): void {
  console.error(error);
  ui.toast(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}
function pause(): void {
  world?.setPaused(true);
}
function syncPause(): void {
  world?.setPaused(
    !started ||
      ui.panel !== null ||
      document.hidden ||
      regionLoading ||
      graphicsLost ||
      (state.region === 'lake-gennesaret' && scenePaused),
  );
}
function snapshot(): GameState {
  return structuredClone({ ...state, position: world?.getPosition() ?? state.position });
}
function enqueueSave(slot: SlotId = 'auto', notify = false): Promise<void> {
  if (!started) return Promise.resolve();
  const current = snapshot();
  const task = saveQueue
    .catch(() => {})
    .then(async () => {
      await saves.save(slot, current);
      ui.saveStatus(
        saves.persistent
          ? 'Journey saved · on this device'
          : 'Session only · export to keep your journey',
      );
      if (notify)
        ui.toast(
          saves.persistent
            ? 'Your journey has been saved.'
            : 'Saved for this session. Export a file to keep it.',
        );
    });
  saveQueue = task;
  return task.catch((error) => {
    ui.saveStatus('Could not save · export your journey');
    if (!storageWarned) {
      ui.toast('Progress could not be saved. Export your journey from Settings to keep it.');
      storageWarned = true;
    }
    console.error('Save failed', error);
    if (notify) throw new Error('The save could not be written. Try exporting a file instead.');
  });
}
async function apply(event: GameEvent): Promise<void> {
  const previous = state;
  const current = snapshot();
  const next = transition(current, event);
  if (next === current) return;
  if (next.region !== state.region) await changeRegion(next);
  state = next;
  world?.update(state);
  ui.update(state);
  if (event.type === 'episode-action') {
    world?.performInteraction();
    audio.chime();
    ui.toast(actionFor(event.id).notice);
  }
  if (event.type === 'start-episode') ui.toast('Into the Deep · Make room on the shore.');
  if (event.type === 'episode-note') ui.toast('An observation has been added to your journal.');
  if (event.type === 'reflect') {
    audio.chime();
    ui.toast('Into the Deep complete · Your reflection is in the journal.');
  }
  if (event.type === 'leave-scene')
    ui.toast('Your place on the lake is kept. Resume at the shoreline viewpoint.');
  if (
    (event.type === 'advance-scene' || event.type === 'skip-scene') &&
    state.region === 'capernaum'
  )
    ui.toast('Back on shore · Help at the landing, then visit Miriam and Ezra.');
  if (event.type === 'track-story')
    ui.toast(event.story === 'main' ? 'Main story tracked.' : 'Ezra’s village story tracked.');
  if (event.type === 'collect' && !previous.inventory.includes(event.item)) {
    audio.chime();
    ui.toast(
      `${event.item === 'net' ? 'Mended fishing net' : 'Barley loaves'} added to your satchel.`,
    );
  }
  if (event.type === 'accept-quest' && previous.quest === 'not-started')
    ui.toast('Chapter begun · A place by the water');
  if (event.type === 'deliver' && state.quest === 'delivered')
    ui.toast('Supplies delivered · Jesus is waiting by the water.');
  if (event.type === 'discover' && !previous.discoveries.includes(event.id)) {
    audio.chime();
    ui.toast('A new memory has been added to your journal.');
  }
  if (event.type === 'listen' && previous.quest === 'delivered') {
    audio.chime();
    ui.toast('Prelude complete · Speak with Simon to continue Into the Deep.');
  }
  if (event.type === 'accept-village-story')
    ui.toast('Village story begun · An ordinary morning. Find your next stop in the journal.');
  if (event.type === 'finish-village-story') {
    audio.chime();
    ui.toast('Village story complete · A place among neighbors. A new memory is in your journal.');
  }
  await enqueueSave();
}
function openDialogue(id: string): void {
  pause();
  conversation = dialogueFor(id, state);
  ui.dialogue(conversation);
}
async function showSettings(): Promise<void> {
  pause();
  const request = ++menuRequest;
  const slots = await saves.list();
  if (request === menuRequest && !disposed) ui.settings(settings, slots, saves.persistent, started);
}
async function close(): Promise<void> {
  menuRequest++;
  conversation = null;
  if (!started) {
    ui.welcome(Boolean(await saves.load('auto').catch(() => null)), saves.persistent);
    return;
  }
  ui.close();
  syncPause();
  if (state.region === 'lake-gennesaret') ui.focusScene();
  else canvas.focus();
}
async function begin(saved?: GameState): Promise<void> {
  await saveQueue.catch(() => {});
  const next = saved ? structuredClone(saved) : newGame();
  await changeRegion(next);
  state = next;
  state.position = world?.getPosition() ?? state.position;
  scenePaused = false;
  ui.setScenePaused(false);
  started = true;
  conversation = null;
  menuRequest++;
  ui.start();
  world?.update(state);
  ui.update(state);
  syncPause();
  audio.set(settings);
  if (state.region === 'lake-gennesaret') ui.focusScene();
  else canvas.focus();
  await enqueueSave();
  if (!saved) ui.toast('Welcome to Capernaum. Speak with Simon by the boats to begin.');
}
async function updateSetting(key: keyof Settings, value: string | boolean): Promise<void> {
  if (key === 'sound' || key === 'reducedMotion') settings = { ...settings, [key]: Boolean(value) };
  if (key === 'volume') settings = { ...settings, volume: Math.max(0, Math.min(1, Number(value))) };
  if (key === 'quality') settings = { ...settings, quality: value === 'low' ? 'low' : 'high' };
  world?.applySettings(settings);
  audio.set(settings);
  document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  await saves.saveSettings(settings);
}
async function loadFile(file: File): Promise<void> {
  if (file.size > MAX_SAVE_BYTES)
    throw new Error('This file is too large. Choose a journey save smaller than 128 KB.');
  const save = importSave(await file.text());
  await begin(save.state);
  ui.toast('Your imported journey is ready.');
}
async function handleAction(name: string, value?: string, chosen?: Choice): Promise<void> {
  if (!world) return;
  switch (name) {
    case 'begin':
      await begin();
      break;
    case 'continue': {
      const save = await saves.load('auto');
      if (save) await begin(save.state);
      else await begin();
      break;
    }
    case 'new-journey':
      pause();
      menuRequest++;
      ui.confirmNew();
      break;
    case 'confirm-new':
      await begin();
      break;
    case 'close':
      await close();
      break;
    case 'transcript':
    case 'journal':
    case 'inventory':
    case 'map':
    case 'help':
      if (ui.panel === name) {
        await close();
        break;
      }
      pause();
      menuRequest++;
      conversation = null;
      if (name === 'journal') ui.journal(state);
      if (name === 'transcript') ui.transcript(state);
      if (name === 'inventory') ui.inventory(state);
      if (name === 'map') ui.map(snapshot());
      if (name === 'help') ui.help();
      break;
    case 'settings':
      if (ui.panel === 'settings' && value === 'toggle') await close();
      else await showSettings();
      break;
    case 'navigate':
      if (started && !ui.panel && value) world.navigate(value);
      break;
    case 'travel':
      if (value) {
        await close();
        world.navigate(value);
      }
      break;
    case 'nearest': {
      const p = world.nearest();
      if (p) world.navigate(p.id);
      break;
    }
    case 'rotate-left':
      world.rotate(0.9);
      break;
    case 'rotate-right':
      world.rotate(-0.9);
      break;
    case 'zoom-in':
      world.zoom(-1);
      break;
    case 'zoom-out':
      world.zoom(1);
      break;
    case 'reset-camera':
      world.resetCamera();
      break;
    case 'choice': {
      if (!chosen) break;
      // The clicked choice is captured before asynchronous work, never looked up in a later dialogue.
      if (chosen.event) await apply(chosen.event);
      if (chosen.next) openDialogue(chosen.next);
      else if (chosen.close) await close();
      break;
    }
    case 'track-story':
      if (value === 'main' || value === 'village') {
        const wasJournal = ui.panel === 'journal';
        await apply({ type: 'track-story', story: value });
        if (wasJournal) ui.journal(state);
      }
      break;
    case 'scene-next':
    case 'scene-skip':
      if (SCENE_IDS.some((id) => id === value)) {
        await apply({
          type: name === 'scene-next' ? 'advance-scene' : 'skip-scene',
          checkpoint: value as (typeof SCENE_IDS)[number],
        });
        await close();
      }
      break;
    case 'scene-leave':
      await apply({ type: 'leave-scene' });
      await close();
      break;
    case 'scene-summary':
      if (state.region === 'lake-gennesaret') {
        pause();
        ui.sceneSummary(state);
      }
      break;
    case 'scene-pause':
      scenePaused = !scenePaused;
      ui.setScenePaused(scenePaused);
      syncPause();
      break;
    case 'diagnostics': {
      const snapshot = world.diagnostics();
      pause();
      ui.diagnostics(snapshot);
      break;
    }
    case 'save-slot':
      if (value && SLOT_IDS.includes(value as SlotId)) {
        await enqueueSave(value as SlotId, true);
        await showSettings();
      }
      break;
    case 'load-slot':
      if (value && SLOT_IDS.includes(value as SlotId)) {
        await saveQueue.catch(() => {});
        const save = await saves.load(value as SlotId);
        if (save) {
          await begin(save.state);
          ui.toast('Your saved journey has been restored.');
        }
      }
      break;
    case 'export': {
      const json = JSON.stringify(makeSave(snapshot()), null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `the-way-journey-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.toast('Journey exported. Keep the file somewhere safe.');
      break;
    }
  }
}

const keydown = (event: KeyboardEvent) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    event.preventDefault();
    runAction(() => (ui.panel ? close() : showSettings()));
    return;
  }
  if (ui.panel === 'dialogue' && ['1', '2', '3'].includes(key)) {
    event.preventDefault();
    const choice = conversation?.choices[Number(key) - 1];
    runAction(() => handleAction('choice', String(Number(key) - 1), choice));
    return;
  }
  if (!started || ui.panel === 'welcome' || ui.panel === 'dialogue') return;
  const shortcuts: Record<string, string> = {
    j: 'journal',
    i: 'inventory',
    m: 'map',
    '?': 'help',
    f3: 'diagnostics',
  };
  if (shortcuts[key]) {
    event.preventDefault();
    runAction(() => handleAction(shortcuts[key]!));
  }
};
const visibility = () => {
  syncPause();
  if (document.hidden) {
    audio.pause();
    void enqueueSave();
  } else audio.resume();
};
window.addEventListener('keydown', keydown);
document.addEventListener('visibilitychange', visibility);

async function boot(): Promise<void> {
  await saves.init();
  settings = saves.getSettings();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) settings.reducedMotion = true;
  world = new GameRuntime(canvas, {
    interact: openDialogue,
    notice: (message) => ui.toast(message),
    frame: (position, labels, heading, nearest) => {
      state.position = { ...position };
      ui.frame(position, labels, heading, nearest);
    },
  });
  world.engine.onContextLostObservable.add(() => {
    graphicsLost = true;
    syncPause();
    ui.toast('Graphics paused. Waiting for your browser to restore the view…');
  });
  world.engine.onContextRestoredObservable.add(() => {
    graphicsLost = false;
    syncPause();
    ui.toast('The view has been restored.');
  });
  await world.load(state, (message) => {
    loadingMessage.textContent = message;
  });
  world.applySettings(settings);
  document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  const autosave = await saves.load('auto').catch(() => {
    ui.toast('The autosave could not be read. You can import a backup in Settings.');
    return null;
  });
  ui.update(state);
  ui.welcome(Boolean(autosave), saves.persistent);
  loading.hidden = true;
  let ticks = 0;
  timer = setInterval(() => {
    if (
      !started ||
      document.hidden ||
      ui.panel ||
      regionLoading ||
      graphicsLost ||
      (state.region === 'lake-gennesaret' && scenePaused)
    )
      return;
    state.playTime += 1;
    if (++ticks % 20 === 0) void enqueueSave();
  }, 1000);
}

void boot().catch((error) => {
  console.error('Could not start The Way', error);
  world?.dispose();
  world = undefined;
  loading.innerHTML = `<div class="loading-error"><div class="loading-mark">✧</div><h1>A pause on the journey</h1><p>${escapeHtml(error instanceof Error ? error.message : 'The village could not be loaded.')}</p><p>Check your connection and use a current browser with WebGL 2 enabled, then try again. Existing saves stay on this device.</p><button class="primary-button" id="retry">Try again</button></div>`;
  loading.querySelector('#retry')?.addEventListener('click', () => window.location.reload());
});

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposed = true;
    clearInterval(timer);
    ui.dispose();
    world?.dispose();
    audio.dispose();
    saves.close();
    window.removeEventListener('keydown', keydown);
    document.removeEventListener('visibilitychange', visibility);
  });
