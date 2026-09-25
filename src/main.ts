import './ui/harbor.css';
import { harborActions, harborNotice } from './content/harbor/actions';
import {
  workTarget,
  validPreview,
  screenCanMove,
  type ScreenPreview,
} from './content/exploration/work';
import { workCommand } from './ui/views/exploration';
import './ui/connection.css';
import { displayRegion, isPresenting } from './game/connection/accounts';
import { routePlan } from './game/connection/routes';
import {
  ACCOUNTS,
  HOME_VISITS,
  HOME_REFLECTIONS,
  type AccountId,
  type HomeVisit,
} from './game/connection/types';
import { STORY_STATUSES, type StoryStatusFilter } from './ui/views/connection';
import './ui/lake.css';
import { normalizeHeading } from './game/lake/navigation';
import { galileeActions } from './content/galilee/actions';
import { practicalActions } from './content/practical';
import { suggestStory } from './content/exploration/suggestions';
import type { Direction } from './game/galilee/types';
import { traceWater } from './game/galilee/channel';
import { checkArrangement } from './game/galilee/arrangement';
import './ui/galilee.css';
import { STORY_TRACKS } from './game/campaign/types';
import { worldAction, actionMotion } from './content/campaign/actions';
import './ui/styles.css';
import './ui/episode.css';
import './ui/campaign.css';
import './ui/life.css';
import './ui/road.css';
import './ui/exploration.css';
import './ui/presence.css';
import { leavePresentationEvent } from './game/presentation';
import { parseStoryCommand } from './game/commands';
import { motionFor, noticeFor } from './content/notices';
import { dialogueFor, type Dialogue, type Choice } from './content/story';
import { transition } from './game/quest';
import { newGame, type GameEvent, type GameState, type Settings } from './game/types';
import { importSave, makeSave, MAX_SAVE_BYTES } from './persistence/schema';
import { SaveRepository, SLOT_IDS, type SlotId } from './persistence/saves';
import { ActionQueue } from './game/action-queue';
import { GameAudio } from './scene/audio';
import { feedbackForEvent } from './content/audio/feedback';
import type { ActionMotion } from './content/campaign/actions';
import { GameRuntime } from './scene/runtime';
import { SCENE_IDS } from './game/episode/types';
import { Interface } from './ui/interface';
import { JOURNAL_CATEGORIES, type JournalCategory, type JournalFilter } from './ui/views/journal';
import { escapeHtml } from './ui/icons';
import { ColdOpen, ChapterCard, Veil } from './ui/cinematic';
import { accountCards, openingCards, OPENING_PROVENANCE, placeLines } from './content/opening';
import { logoMark } from './ui/logo';
import { regions } from './content/regions';
import { trackedChapter } from './content/campaign/chapters';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const loadingMessage = document.querySelector<HTMLElement>('#loading-message')!;
const saves = new SaveRepository();
const audio = new GameAudio();
let state: GameState = newGame();
let settings: Settings;
let world: GameRuntime | undefined;
let regionLoading = false;
let scenePaused = false;
let graphicsLost = false;
let started = false;
let conversation: Dialogue | null = null;
let contextId: string | null = null;
let working: { target: string; feedback: string; preview?: ScreenPreview } | undefined;
let inspectionWork: string | undefined;
let saveQueue: Promise<unknown> = Promise.resolve();
let menuRequest = 0;
let disposed = false;
let storageWarned = false;
let timer: ReturnType<typeof setInterval> | undefined;
let cinematic = false;
const coldOpen = new ColdOpen();
const chapterCard = new ChapterCard(document.querySelector<HTMLElement>('#ui')!);
const veil = new Veil();
// Title cards announce each place and account once per session.
const regionsSeen = new Set<string>();

const ui = new Interface(document.querySelector('#ui')!, {
  action: (name, value) => {
    if (started || ['begin', 'continue', 'confirm-new', 'load-slot'].includes(name)) audio.unlock();
    if (started && ['journal', 'inventory', 'map', 'settings'].includes(name)) audio.play('page');
    const choice = name === 'choice' ? conversation?.choices[Number(value)] : undefined;
    runAction(() => handleAction(name, value, choice));
  },
  setting: (key, value) => {
    if (key === 'sound') audio.set({ ...settings, sound: Boolean(value) });
    audio.unlock();
    runAction(() => updateSetting(key, value));
  },
  workLayout: (rect) => world?.setWorkBounds(rect),
  readingLayout: (rect) => world?.setReadingBounds(rect),
  presentationLayout: (id, rect, paused) => world?.setConversation(id, rect, paused),
  importFile: (file) => {
    audio.unlock();
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
  const workBefore = working;
  clearWorking();
  inspectionWork = undefined;
  regionLoading = true;
  syncPause();
  const destination = displayRegion(next);
  ui.setBusy(true);
  await veil.cover({
    reduced: settings.reducedMotion,
    title: regions[destination].title,
    line: placeLines[destination],
  });
  try {
    await world.load(next, (message) => {
      loadingMessage.textContent = message;
    });
  } catch (error) {
    // A failed transactional replacement keeps the old region usable, including
    // the focused controls that requested boarding. Temporary proposals are discarded.
    if (workBefore && ui.panel === 'work') {
      working = {
        target: workBefore.target,
        feedback: 'The journey could not open. Your work is kept; you can try again.',
      };
      refreshWork();
    }
    throw error;
  } finally {
    regionLoading = false;
    loading.hidden = true;
    ui.setBusy(false);
    syncPause();
    void veil.reveal({ reduced: settings.reducedMotion });
  }
}
/** HUD lines and the once-per-session title card for the displayed place. */
function presentArrival(): void {
  ui.setAtmosphere(world?.atmosphere() ?? '');
  ui.setTraveler(trackedChapter(state).title);
  const region = displayRegion(state);
  if (regionsSeen.has(region)) return;
  regionsSeen.add(region);
  const account = accountCards[region];
  const place = regions[region];
  void chapterCard.show(
    account ?? { eyebrow: place.subtitle.split(' · ')[0] ?? 'Galilee', title: place.title },
    { reduced: settings.reducedMotion },
  );
}
async function playOpening(): Promise<void> {
  cinematic = true;
  syncPause();
  try {
    await coldOpen.play(openingCards, OPENING_PROVENANCE, { reduced: settings.reducedMotion });
  } finally {
    cinematic = false;
    syncPause();
  }
  if (!settings.openingSeen) {
    settings = { ...settings, openingSeen: true };
    await saves.saveSettings(settings).catch(() => {});
  }
}
function reportError(error: unknown): void {
  console.error(error);
  ui.toast(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}
function clearWorking(): void {
  working = undefined;
  world?.setWorkFocus();
}
function openWork(id: string): boolean {
  const target = workTarget(snapshot(), id);
  if (!target?.near) return false;
  world?.cancelNavigation();
  conversation = null;
  contextId = id;
  inspectionWork = undefined;
  working = { target: id, feedback: '' };
  ui.work(snapshot(), id);
  world?.setWorkFocus(target);
  syncPause();
  return true;
}
function refreshWork(): void {
  if (!working || ui.panel !== 'work') return;
  const current = snapshot(),
    target = workTarget(current, working.target);
  if (!target?.near) {
    clearWorking();
    ui.close();
    syncPause();
    return;
  }
  if (working.preview && !validPreview(current, working.target, working.preview))
    working.preview = undefined;
  ui.work(current, working.target, working.feedback, working.preview);
  world?.setWorkFocus(target, working.preview);
}
function pause(): void {
  audio.duck(true);
  clearWorking();
  inspectionWork = undefined;
  world?.setPaused(true);
  if (started && !regionLoading) void enqueueSave();
}
function syncPause(): void {
  audio.duck(ui.panel !== null && ui.panel !== 'work');
  world?.setPaused(
    !started ||
      (ui.panel !== null && ui.panel !== 'work') ||
      document.hidden ||
      regionLoading ||
      graphicsLost ||
      cinematic ||
      (isPresenting(state) && scenePaused),
  );
}
function snapshot(): GameState {
  const current = structuredClone({
    ...state,
    position: state.connection.replay ? state.position : (world?.getPosition() ?? state.position),
  });
  if (state.connection.replay) return current;
  if (current.region === 'galilee-water') {
    current.lake.boat.position = { ...current.position };
    current.lake.boat.heading = normalizeHeading(
      world?.getBoatHeading() ?? current.lake.boat.heading,
    );
    current.lake.visited['galilee-water'] = { ...current.position };
  }
  const companion = world?.getCompanionPosition();
  if (companion) current.campaign.walk.position = companion;
  const neri = world?.getRoadCompanionPosition();
  if (neri) current.road.company.position = neri;
  return current;
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
function performInteraction(motion?: ActionMotion, target?: string): void {
  world?.performInteraction(motion, target);
  audio.motion(motion);
}
async function apply(event: GameEvent): Promise<void> {
  const previous = state;
  const current = snapshot();
  const next = transition(current, event);
  if (next === current) return;
  if (displayRegion(next) !== displayRegion(state)) await changeRegion(next);
  state = next;
  world?.update(state);
  ui.update(state);
  audio.update(state);
  presentArrival();
  const feedback = feedbackForEvent(event);
  if (feedback) audio.play(feedback);
  const motion = motionFor(event, previous, state);
  if (motion) performInteraction(motion.motion, motion.target);
  const notice = noticeFor(event, previous, state);
  if (notice) ui.toast(notice);
  await enqueueSave();
}
function openDialogue(id: string): void {
  // Physical Galilee tasks open beside the world; conversations retain their reading surface.
  const target = workTarget(snapshot(), id);
  if (target && target.family !== 'ordinary' && openWork(id)) return;
  if (id === 'neri-meeting') {
    ui.toast(
      'Stay near Neri at this stop. At a doorway, wait until you are together before continuing.',
    );
    return;
  }
  if (id === 'amos-waypoint') {
    ui.toast('Stay near Amos at this turn. The next meeting point appears when you both arrive.');
    return;
  }
  pause();
  const current = snapshot();
  if (ui.context(id, current)) {
    contextId = id;
    conversation = null;
    return;
  }
  contextId = null;
  conversation = dialogueFor(id, current);
  ui.dialogue(conversation);
  if (target) ui.addWorkEntry(id);
}
async function showSettings(): Promise<void> {
  pause();
  const request = ++menuRequest;
  const slots = await saves.list();
  if (request === menuRequest && !disposed) ui.settings(settings, slots, saves.persistent, started);
}
async function close(): Promise<void> {
  const returnTo = inspectionWork;
  inspectionWork = undefined;
  if (returnTo && openWork(returnTo)) return;
  clearWorking();
  menuRequest++;
  conversation = null;
  contextId = null;
  if (!started) {
    const saved = await saves.load('auto').catch(() => null);
    ui.welcome(Boolean(saved), saves.persistent, saved?.state);
    return;
  }
  ui.close();
  syncPause();
  if (isPresenting(state)) ui.focusScene();
  else canvas.focus();
}
async function begin(saved?: GameState): Promise<void> {
  await saveQueue.catch(() => {});
  // The first new journey opens with the cold open; automation and returning players skip it.
  const firstJourney = !saved && !settings.openingSeen && !navigator.webdriver;
  if (firstJourney) await playOpening();
  const next = saved ? structuredClone(saved) : newGame();
  await changeRegion(next);
  state = next;
  state.position = state.connection.replay
    ? state.position
    : (world?.getPosition() ?? state.position);
  scenePaused = false;
  ui.setScenePaused(false);
  started = true;
  conversation = null;
  menuRequest++;
  ui.start();
  world?.update(state);
  ui.update(state);
  syncPause();
  audio.update(state);
  audio.set(settings);
  if (isPresenting(state)) ui.focusScene();
  else canvas.focus();
  presentArrival();
  if (firstJourney) world?.playArrival();
  await enqueueSave();
  if (!saved) ui.toast('Welcome to Capernaum. Speak with Simon by the boats to begin.');
}
async function updateSetting(key: keyof Settings, value: string | boolean): Promise<void> {
  if (key === 'sound' || key === 'reducedMotion') settings = { ...settings, [key]: Boolean(value) };
  if (['volume', 'musicVolume', 'ambienceVolume', 'effectsVolume'].includes(key)) {
    const level = Number(value);
    if (Number.isFinite(level)) settings = { ...settings, [key]: Math.max(0, Math.min(1, level)) };
  }
  if (key === 'textSize')
    settings = { ...settings, textSize: value === 'large' ? 'large' : 'standard' };
  if (key === 'guidance')
    settings = { ...settings, guidance: value === 'explore' ? 'explore' : 'full' };
  if (key === 'quality') settings = { ...settings, quality: value === 'low' ? 'low' : 'high' };
  world?.applySettings(settings);
  audio.set(settings);
  document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  document.documentElement.dataset.textSize = settings.textSize;
  await saves.saveSettings(settings);
}
async function loadFile(file: File): Promise<void> {
  if (file.size > MAX_SAVE_BYTES)
    throw new Error('This file is too large. Choose a journey save smaller than 128 KB.');
  const save = importSave(await file.text());
  await begin(save.state);
  ui.toast(
    'Your imported journey is ready. Open Journey recap in the journal to see where you left off.',
  );
}
function resumeRoute(): void {
  const plan = routePlan(snapshot());
  if (!plan) return;
  if (plan.available && plan.leg) world?.navigate(plan.leg);
  else ui.toast(plan.message);
}
async function navigateTo(target: string): Promise<void> {
  if (ui.panel === 'work') {
    clearWorking();
    ui.close();
    syncPause();
  }
  await apply({ type: 'route-select', target });
  const plan = routePlan(snapshot(), target);
  if (plan?.available && plan.leg) world?.navigate(plan.leg);
  else if (plan) ui.toast(plan.message);
}
async function handleAction(name: string, value?: string, chosen?: Choice): Promise<void> {
  if (!world) return;
  if (ui.panel === 'work' && working) {
    const target = workTarget(snapshot(), working.target);
    const action = target?.actions.find((a) => {
      const command = workCommand(a);
      return command.name === name && command.value === (value ?? '');
    });
    if (action) {
      if (action.blocker) {
        ui.toast(action.blocker);
        return;
      }
      const oldState = state;
      working.preview = undefined;
      await apply(action.event);
      if (working && state !== oldState) {
        const event = action.event;
        working.feedback =
          event.type === 'harbor-action'
            ? harborNotice(state, event)
            : event.type === 'galilee-action' && event.id === 'spring-test'
              ? traceWater(state.galilee.spring.turns).message
              : event.type === 'galilee-action' && event.id.startsWith('shelter-check-')
                ? checkArrangement(state.galilee.shelter).message
                : event.type === 'galilee-turn'
                  ? (workTarget(snapshot(), working.target)?.status ?? 'Section turned.')
                  : event.type === 'galilee-screen'
                    ? 'Screen moved. Check the approach when you are ready.'
                    : (action.notice ?? 'Your work is saved.');
      }
      refreshWork();
      if (action.event.type === 'journey') {
        await close();
        resumeRoute();
      }
      return;
    }
    if (name === 'harbor-action' && value === 'hint' && target?.family === 'harbor') {
      await apply({ type: 'harbor-action', id: 'hint' });
      refreshWork();
      return;
    }
    if (name === 'galilee-hint' && target?.family === 'spring') {
      await apply({ type: 'galilee-hint' });
      refreshWork();
      return;
    }
    // Stale commands from an earlier work surface cannot fall through to unrelated handlers.
    if (
      [
        'harbor-action',
        'galilee-action',
        'galilee-turn',
        'galilee-screen',
        'campaign-action',
        'lake-action',
        'journey',
        'work-act',
      ].includes(name)
    )
      return;
  }
  switch (name) {
    case 'harbor-action': {
      const [id, expected] = (value ?? '').split('|');
      if (!id) break;
      const before = state;
      const motion = harborActions(snapshot()).find((action) => action.id === id)?.motion;
      await apply({ type: 'harbor-action', id, expected });
      if (state !== before && motion) await close();
      else if (contextId) ui.context(contextId, snapshot());
      break;
    }
    case 'follow-story': {
      if (!STORY_TRACKS.includes(value as (typeof STORY_TRACKS)[number])) break;
      const story = value as (typeof STORY_TRACKS)[number];
      const suggestion = suggestStory(snapshot(), story);
      if (!suggestion?.available) break;
      await apply({ type: 'track-story', story });
      inspectionWork = undefined;
      await close();
      await navigateTo(suggestion.target);
      break;
    }
    case 'objective-toggle':
      ui.toggleObjective();
      break;
    case 'work-open':
      if (value && !openWork(value)) {
        await close();
        await navigateTo(value);
      }
      break;
    case 'work-visit':
      if (value) {
        await close();
        await navigateTo(value);
      }
      break;
    case 'work-frame':
      world.frameWork();
      break;
    case 'work-inspect': {
      const id = working?.target;
      if (id) {
        pause();
        if (ui.context(id, snapshot())) {
          inspectionWork = id;
          ui.addWorkReturn(id);
        } else {
          openDialogue(id);
          inspectionWork = id;
          ui.addWorkReturn(id);
        }
      }
      break;
    }
    case 'work-preview':
      if (working && /^[0-3]$/.test(value ?? '') && screenCanMove(snapshot(), working.target)) {
        working.preview = {
          site: state.galilee.shelter.site!,
          expected: state.galilee.shelter.screen,
          direction: Number(value) as Direction,
        };
        refreshWork();
      }
      break;
    case 'work-preview-cancel':
      if (working) {
        working.preview = undefined;
        refreshWork();
      }
      break;
    case 'work-preview-apply':
      if (working?.preview && validPreview(snapshot(), working.target, working.preview)) {
        const session = working;
        const { expected, direction } = working.preview;
        working.preview = undefined;
        await apply({ type: 'galilee-screen', expected, direction });
        if (working === session) {
          working.feedback = 'Screen placed. ' + checkArrangement(state.galilee.shelter).message;
          refreshWork();
        }
      }
      break;
    case 'recap':
      pause();
      menuRequest++;
      ui.recap(snapshot());
      break;
    case 'replay-library':
      pause();
      menuRequest++;
      ui.replayLibrary(snapshot());
      break;
    case 'replay-open':
    case 'replay-next':
    case 'replay-previous': {
      const [account, checkpoint] = (value ?? '').split(':');
      if (!ACCOUNTS.includes(account as AccountId) || !checkpoint) break;
      await apply({ type: name, account: account as AccountId, checkpoint });
      scenePaused = false;
      ui.setScenePaused(false);
      await close();
      break;
    }
    case 'home-remember': {
      const [visit, choice] = (value ?? '').split(':');
      if (!HOME_VISITS.includes(visit as HomeVisit) || !choice) break;
      await apply({ type: name, visit: visit as HomeVisit, choice });
      if (contextId) ui.context(contextId, snapshot());
      break;
    }
    case 'home-reflect':
      if (HOME_REFLECTIONS.some((id) => id === value)) {
        await apply({ type: name, choice: value as (typeof HOME_REFLECTIONS)[number] });
        await close();
        ui.toast(
          'This part of your journey is remembered. All paths and unfinished stories remain open.',
        );
      }
      break;
    case 'route-resume':
      if (isPresenting(state)) await apply(leavePresentationEvent(state));
      await close();
      resumeRoute();
      break;
    case 'open-story':
      if (STORY_TRACKS.some((id) => id === value)) {
        pause();
        menuRequest++;
        contextId = null;
        ui.journal(snapshot(), 'stories', value as (typeof STORY_TRACKS)[number], 'all');
      }
      break;
    case 'journal-status':
      if (ui.panel === 'journal' && STORY_STATUSES.some((id) => id === value)) {
        ui.journal(snapshot(), 'stories', undefined, value as StoryStatusFilter);
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              '[data-action="journal-status"][data-value="' + value + '"]',
            )
            ?.focus(),
        );
      }
      break;
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
      if (name === 'journal') {
        if (value === 'memories' || value === 'stories')
          ui.journal(snapshot(), value, 'all', 'all');
        else ui.journal(snapshot());
      }
      if (name === 'transcript') ui.transcript(state, value);
      if (name === 'inventory') ui.inventory(snapshot());
      if (name === 'map') ui.map(snapshot());
      if (name === 'help') ui.help();
      break;
    case 'settings':
      if (ui.panel === 'settings' && value === 'toggle') await close();
      else await showSettings();
      break;
    case 'replay-opening':
      await close();
      await playOpening();
      if (!started) await close();
      break;
    case 'journey-map':
    case 'local-map':
      pause();
      menuRequest++;
      conversation = null;
      contextId = null;
      ui.map(snapshot(), name === 'journey-map');
      break;
    case 'road-guide':
    case 'road-company':
    case 'lake-guide':
      pause();
      menuRequest++;
      conversation = null;
      contextId = null;
      ui.journal(
        snapshot(),
        'stories',
        name === 'lake-guide' ? 'crossing' : name === 'road-guide' ? 'trail' : 'company',
        'all',
      );
      if (name === 'lake-guide') ui.focusCrossing('review');
      break;
    case 'cancel-navigation':
      if (state.connection.replay) await apply(leavePresentationEvent(state));
      world.cancelNavigation();
      await apply({ type: 'route-cancel' });
      if (ui.panel === 'recap') ui.recap(snapshot());
      else canvas.focus();
      break;
    case 'navigate':
      if (started && (!ui.panel || ui.panel === 'work') && value) await navigateTo(value);
      break;
    case 'travel':
      inspectionWork = undefined;
      if (value) {
        if (isPresenting(state)) await apply(leavePresentationEvent(state));
        await close();
        await navigateTo(value);
      }
      break;
    case 'nearest': {
      const p = world.nearest();
      if (p) await navigateTo(p.id);
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
    case 'prelude-reading':
      openDialogue('jesus-scripture');
      break;
    case 'journey':
      if (value) {
        const before = state.region;
        await apply({ type: 'journey', gateway: value });
        await close();
        if (state.region !== before) resumeRoute();
      }
      break;
    case 'quick-action': {
      if (ui.panel && ui.panel !== 'work') break;
      const action = practicalActions(snapshot()).find((a) => a.id === value);
      if (!action || action.blocker) {
        ui.toast(action?.blocker ?? 'This action is no longer available.');
        break;
      }
      const before = displayRegion(state);
      await apply(action.event);
      if (displayRegion(state) !== before) {
        await close();
        if (action.event.type === 'journey') resumeRoute();
      }
      break;
    }
    case 'galilee-action':
    case 'galilee-turn':
    case 'galilee-screen':
    case 'galilee-hint': {
      const hintsOpen = Boolean(document.querySelector<HTMLDetailsElement>('.work-hints')?.open);
      const workScroll = document.querySelector('.panel-body')?.scrollTop ?? 0;
      const focus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.dataset.value
          : undefined;
      const event = parseStoryCommand(name, value);
      if (event) await apply(event);
      const action =
        name === 'galilee-action' ? galileeActions.find((a) => a.id === value) : undefined;
      if (
        action?.motion === 'PickUp' ||
        action?.motion === 'PutDown' ||
        action?.motion === 'Repair'
      )
        await close();
      else if (contextId) {
        ui.context(contextId, snapshot());
        const hints = document.querySelector<HTMLDetailsElement>('.work-hints');
        if (hints) hints.open = hintsOpen;
        const body = document.querySelector('.panel-body');
        if (body) body.scrollTop = workScroll;
        requestAnimationFrame(() => {
          if (name === 'galilee-hint') {
            (
              document.querySelector<HTMLElement>('[data-action="galilee-hint"]') ??
              document.querySelector<HTMLElement>('.work-hints summary')
            )?.focus({ preventScroll: true });
            return;
          }
          const candidates = [
            ...document.querySelectorAll<HTMLElement>('#overlay button:not([disabled])'),
          ];
          (
            candidates.find(
              (b) =>
                b.dataset.value === focus || (name === 'galilee-turn' && b.dataset.action === name),
            ) ?? candidates[0]
          )?.focus();
        });
      }
      break;
    }
    case 'campaign-action':
      if (value) {
        await apply(parseStoryCommand(name, value)!);
        if (
          isPresenting(state) ||
          worldAction(value)?.verb === 'Accompany' ||
          !!(worldAction(value) && actionMotion(worldAction(value)!))
        )
          await close();
        else if (contextId) ui.context(contextId, snapshot());
      }
      break;
    case 'neighbor-note':
      if (parseStoryCommand(name, value)) {
        await apply(parseStoryCommand(name, value)!);
        if (contextId) ui.context(contextId, snapshot());
      }
      break;
    case 'road-action':
    case 'road-evidence':
    case 'road-interpret':
    case 'road-ending':
    case 'road-route':
    case 'nain-reflect': {
      const event = parseStoryCommand(name, value);
      if (!event) break;
      await apply(event);
      if (
        isPresenting(state) ||
        value === 'company-start' ||
        name === 'nain-reflect' ||
        name === 'road-ending'
      )
        await close();
      else if (contextId) ui.context(contextId, snapshot());
      break;
    }
    case 'road-hint':
      await apply(parseStoryCommand(name)!);
      if (contextId && ui.panel === 'context') ui.context(contextId, snapshot());
      else ui.journal(snapshot(), 'stories', 'trail', 'all');
      break;
    case 'lake-action':
    case 'lake-interpret':
    case 'lake-ending':
    case 'lake-hint':
    case 'storm-reflect': {
      const event = parseStoryCommand(name, value);
      if (event) await apply(event);
      if (state.region === 'storm-account' || name === 'storm-reflect' || name === 'lake-ending')
        await close();
      else if (contextId && ui.panel === 'context') ui.context(contextId, snapshot());
      else ui.journal(snapshot(), 'stories', 'crossing', 'all');
      if (name === 'lake-hint') {
        const hints = document.querySelector<HTMLDetailsElement>('.crossing-hints');
        if (hints) hints.open = true;
        ui.focusCrossing('hint');
      }
      if (name === 'lake-interpret') ui.focusCrossing('feedback');
      break;
    }
    case 'storm-next':
    case 'storm-summary':
    case 'nain-next':
    case 'nain-summary':
    case 'roof-reflect':
    case 'roof-next':
    case 'roof-summary': {
      const event = parseStoryCommand(name, value);
      if (event) {
        await apply(event);
        await close();
      }
      break;
    }

    case 'journal-category':
      if (ui.panel === 'journal' && JOURNAL_CATEGORIES.some((id) => id === value))
        ui.journal(snapshot(), value as JournalCategory);
      break;
    case 'journal-filter':
      if (ui.panel === 'journal' && (value === 'all' || STORY_TRACKS.some((id) => id === value)))
        ui.journal(snapshot(), undefined, value as JournalFilter);
      break;
    case 'track-story':
      if (STORY_TRACKS.some((id) => id === value)) {
        const wasJournal = ui.panel === 'journal';
        await apply({ type: 'track-story', story: value as (typeof STORY_TRACKS)[number] });
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
      await apply(leavePresentationEvent(state));
      await close();
      break;
    case 'scene-summary':
      if (state.connection.replay) {
        ui.replayLibrary(snapshot());
        break;
      }
      if (isPresenting(state)) {
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
      await enqueueSave();
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
const unlockAudio = () => {
  if (started) audio.unlock();
};
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
window.addEventListener('keydown', keydown);
document.addEventListener('visibilitychange', visibility);
const pagehide = () => {
  if (started && !regionLoading) void enqueueSave();
};
window.addEventListener('pagehide', pagehide);

async function boot(): Promise<void> {
  await saves.init();
  settings = saves.getSettings();
  audio.set(settings);
  if (document.hidden) audio.pause();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) settings.reducedMotion = true;
  world = new GameRuntime(canvas, {
    requestNavigate: (id) => runAction(() => navigateTo(id)),
    manualMove: () => {
      if (ui.panel === 'work') {
        clearWorking();
        contextId = null;
        ui.close();
        syncPause();
      }
    },
    interact: (id) =>
      runAction(async () => {
        await apply({ type: 'route-arrive', target: id });
        openDialogue(id);
      }),
    walkCheckpoint: () => runAction(() => apply({ type: 'walk-step' })),
    roadCheckpoint: (step) => runAction(() => apply({ type: 'road-step', step })),
    notice: (message) => ui.toast(message),
    frame: (position, labels, heading, nearest, destination) => {
      audio.movement(
        position,
        started &&
          !regionLoading &&
          !graphicsLost &&
          !document.hidden &&
          (!ui.panel || ui.panel === 'work') &&
          !isPresenting(state),
      );
      state.position = { ...position };
      ui.frame(position, labels, heading, nearest, destination);
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
  world.applySettings(settings);
  void world.showTitle().catch((error) => console.warn('Title view unavailable', error));
  document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  document.documentElement.dataset.textSize = settings.textSize;
  const autosave = await saves.load('auto').catch(() => {
    ui.toast('The autosave could not be read. You can import a backup in Settings.');
    return null;
  });
  ui.update(state);
  ui.welcome(Boolean(autosave), saves.persistent, autosave?.state);
  loading.hidden = true;
  let ticks = 0;
  timer = setInterval(() => {
    if (
      !started ||
      document.hidden ||
      (ui.panel && ui.panel !== 'work') ||
      regionLoading ||
      graphicsLost ||
      (isPresenting(state) && scenePaused)
    )
      return;
    if (state.connection.replay) return;
    state.playTime += 1;
    if (++ticks % 20 === 0) void enqueueSave();
  }, 1000);
}

void boot().catch((error) => {
  console.error('Could not start The Way', error);
  world?.dispose();
  world = undefined;
  loading.innerHTML = `<div class="loading-error">${logoMark('loading-mark')}<h1>A pause on the journey</h1><p>${escapeHtml(error instanceof Error ? error.message : 'The village could not be loaded.')}</p><p>Check your connection and use a current browser with WebGL 2 enabled, then try again. Existing saves stay on this device.</p><button class="primary-button" id="retry">Try again</button></div>`;
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
    window.removeEventListener('pointerdown', unlockAudio, { capture: true });
    window.removeEventListener('keydown', unlockAudio, { capture: true });
    window.removeEventListener('keydown', keydown);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pagehide);
  });
