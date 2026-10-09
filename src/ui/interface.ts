import { harborContext, harborSummary } from './views/harbor';
import { audioSettings, volumePercent } from './views/audio';
import { journeyOverview, workSurface } from './views/exploration';
import { workTarget, type ScreenPreview } from '../content/exploration/work';
import { requiresWorldView, requiresWorldEvent } from '../game/commands';
import { trapFocus, restoreFocus, focusLost } from './focus';
import { layoutDialogueReading } from './dialogue-reading';
import type { WorkRect } from '../scene/work';
import { accounts, isPresenting, presentationState } from '../game/connection/accounts';
import { routePlan, type RoutePlan } from '../game/connection/routes';
import {
  statusToolbar,
  statusStories,
  homeSummary,
  homeContext,
  recap,
  replayLibrary,
  type StoryStatusFilter,
} from './views/connection';
import { stormControls, stormTranscript, stormSummary, lakeSummary } from './views/lake';
import { galileeSummary } from './views/galilee';
import { trackedChapter } from '../content/campaign/chapters';
import { nainControls, nainTranscript, nainSummary, roadSummary } from './views/road';
import { journeyMap } from './views/journey';
import { accountFor } from '../game/presentation';
import { preludeObjective } from '../game/episode/objectives';
import {
  campaignSummary,
  contextView,
  roofControls,
  roofTranscript,
  roofSummary,
  neighborhoodMap,
  carriedView,
} from './views/campaign';
import { campaignLayout } from '../content/campaign/layouts';
import {
  questView,
  episodeSummary,
  sceneControls,
  transcriptView,
  sceneSummaryView,
} from './views/episode';
import { regions } from '../content/regions';
import type { Diagnostics } from '../scene/runtime';
import { allInteractables, activeInteractables, shoreline } from '../content/region';
import { items, type Dialogue } from '../content/story';
import { nearbyActions } from './views/actions';
import { arrangeLabels, measureLabels } from './labels';
import {
  journalToolbar,
  memoryEntries,
  journalPeople,
  journalPlaces,
  threadEvidence,
  type JournalCategory,
  type JournalFilter,
} from './views/journal';
import {
  discoveryOrder,
  objective,
  objectiveTarget,
  villageObjective,
  villageTarget,
} from '../game/quest';
import type { GameState, Point, Settings } from '../game/types';
import type { SlotSummary } from '../persistence/saves';
import type { ScreenLabel } from '../scene/world';
import { escapeHtml as esc, icon } from './icons';
import { openingGuidance, personIdentity, portraitUrl } from '../content/presence';
import { logoLockup } from './logo';
import { itemArtwork } from './item-art';
import {
  HintFade,
  LABEL_NEAR,
  labelExpanded,
  labelPlacementPriority,
  toastKind,
  TOAST_ICONS,
  type LabelState,
  type ToastKind,
} from './hud';
import './fonts.css';
import './theme.css';
import { MinimapControls, mapPoint } from './minimap';
import { capernaumMapScenery } from './map-scenery';
import {
  capernaumMapIcons,
  MAP_ICON_LABELS,
  mapIconGlyph,
  mapIconNames,
  mapIconSwatch,
} from './map-icons';
import './satchel-map.css';
import './classic-reading.css';
import { CHAT_FILTERS, MessageHistory, type ChatFilter } from './messages';
import { ChatterSchedule } from './chatter';
import { suggestStory } from '../content/exploration/suggestions';
import { STORY_TRACKS } from '../game/campaign/types';
import { pixelIcon, type PixelIconName } from './pixel-icons';
import { EMOTES } from '../content/emotes';
import { interfaceHover } from './interface-hover';
import { CHATTER, CHATTER_RANGE } from '../content/chatter';
import './messages.css';

export type Panel =
  | 'work'
  | 'journal'
  | 'inventory'
  | 'map'
  | 'settings'
  | 'help'
  | 'messages'
  | 'welcome'
  | 'dialogue'
  | 'transcript'
  | 'context'
  | 'scene-summary'
  | 'diagnostics'
  | 'recap'
  | 'replay-library'
  | null;
export interface UIActions {
  action: (name: string, value?: string) => void;
  setting: (key: keyof Settings, value: string | boolean, preview?: boolean) => void;
  importFile: (file: File) => void;
  walk?: (point: Point) => void;
  workLayout?: (rect?: WorkRect) => void;
  presentationLayout?: (id?: string, rect?: WorkRect, paused?: boolean) => void;
  readingLayout?: (rect?: WorkRect) => void;
}

/** Stories waiting to begin in this region, by the person or place where each starts. */
function storyStarts(state: GameState): Set<string> {
  return new Set(
    STORY_TRACKS.flatMap((track) => {
      const story = suggestStory(state, track);
      return story?.status === 'available' && story.local ? [story.target] : [];
    }),
  );
}

export class Interface {
  panel: Panel = null;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private readonly hudReservations: { node: HTMLElement; lower: boolean }[];
  private readonly toastNode: HTMLElement;
  private readonly noticeActions: HTMLElement;
  private readonly routeGuidance: HTMLElement;
  private readonly routeScrollCue: HTMLElement;
  private routeCueFrame?: number;
  private readonly actionScrollCue: HTMLElement;
  private readonly actionScrollObserver: ResizeObserver;
  private readonly onActionScroll = () => {
    this.updateActionScrollCue();
    this.updateRouteScrollCue();
    this.onPausedNoticeLayout();
  };
  private readonly onRouteScroll = () => this.updateRouteScrollCue();
  private readonly onRouteKey = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.travel-guidance') &&
      [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        'q',
        'e',
        'r',
        'pageup',
        'pagedown',
        'home',
        'end',
        ' ',
      ].includes(event.key.toLowerCase())
    )
      // Let the native reading area scroll without passing movement to the world.
      event.stopPropagation();
  };
  private readonly shortLandscape: MediaQueryList;
  private readonly shortPortrait: MediaQueryList;
  private cameraControls: HTMLElement;
  private cameraCommands: HTMLElement;
  private cameraToggle: HTMLButtonElement;
  private cameraExpanded = false;
  private readonly onNoticeLayout = () => this.placeNotice(true);
  private readonly onPausedNoticeLayout = () => {
    if (this.graphicsPaused) this.placeNotice(true);
  };
  private readonly onMenuResize = () => {
    this.renderCameraDisclosure();
    // Publish the new panel bounds before the next render, including paused conversations.
    this.measureWork();
    const active = document.activeElement;
    if (
      this.panel === 'dialogue' &&
      active instanceof HTMLButtonElement &&
      this.overlay.contains(active) &&
      active.closest('.dialogue-box[data-conversation-person] .dialogue-main')
    )
      active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    this.onPausedNoticeLayout();
    if (this.panel === 'welcome') {
      const active = document.activeElement;
      if (active instanceof HTMLElement && this.overlay.contains(active))
        active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      return;
    }
    this.revealReadingFocus();
  };
  private labels: HTMLElement;
  private quest: HTMLElement;
  private pendingQuestReveal?: HTMLElement;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private heldNotice?: { message: string; kind: ToastKind };
  private hints = new HintFade();
  private lastPosition?: Point;
  private activePoints = new Map<string, Point>();
  private atmosphere?: string;
  private lastSceneKey = '';
  private focusBefore?: HTMLElement;
  private labelNodes = new Map<string, HTMLElement>();
  private active = false;
  private currentState?: GameState;
  private travelPlan?: RoutePlan;
  private activeWalkTarget?: Point;
  private scenePaused = false;
  private sceneControls: HTMLElement;
  private lastNearest: string | null = null;
  private lastTray = '';
  private trayTargets = new Set<string>();
  private journalCategory: JournalCategory = 'overview';
  private journalFilter: JournalFilter = 'all';
  private journalStatus: StoryStatusFilter = 'all';
  private objectiveExpanded = false;
  private conversationPaused = false;
  private workObserver?: ResizeObserver;
  private onClick: (e: MouseEvent) => void;
  private onChange: (e: Event) => void;
  private onInput: (e: Event) => void;
  private onKey: (e: KeyboardEvent) => void;
  private onPointer: () => void;
  private minimap: MinimapControls;
  private messageHistory = new MessageHistory();
  private unreadMessages = 0;
  private storyScrollTimer?: ReturnType<typeof setTimeout>;
  private chatter = new ChatterSchedule(CHATTER);
  private heardTracks = new Set<string>();
  private interfaceHintKey = '';
  private speechUntil = 0;
  /** Lives on the body, like the world-action hint, so it reads above open panels. */
  private interfaceHint = Object.assign(document.createElement('div'), {
    className: 'interface-hint',
    hidden: true,
  });
  private overheadNodes = new Map<string, HTMLElement>();
  private overhead!: HTMLElement;

  constructor(
    private root: HTMLElement,
    private actions: UIActions,
  ) {
    root.innerHTML = `
      <div class="world-vignette"></div>
      <div id="hud" hidden>
        <header class="topbar"><div class="brand">${logoLockup('hud')}</div>
        <div class="region-title"><span class="location-diamond">${icon('pin')}</span><span>CAPERNAUM<small>Northern shore · Galilee</small></span></div>
        <nav class="toolbar" aria-label="Game menus"><button data-action="journal" title="Travel journal (J)">${icon('journal')}${pixelIcon('journal')}<span>Journal</span><kbd>J</kbd></button><button data-action="inventory" title="Satchel (I)">${icon('bag')}${pixelIcon('satchel')}<span>Satchel</span><kbd>I</kbd></button><button data-action="map" title="Local and journey maps (M)">${icon('map')}${pixelIcon('map')}<span>Map</span><kbd>M</kbd></button><button data-action="emotes" title="Emotes" aria-expanded="false" aria-controls="emote-panel">${icon('person')}${pixelIcon('emotes')}<span>Emotes</span></button><span class="toolbar-divider"></span><button class="icon-button" data-action="settings" aria-label="Settings and saves">${icon('settings')}${pixelIcon('settings')}</button></nav></header>
        <aside id="quest-card" class="quest-card" aria-label="Current quest"></aside>
        <div class="time-of-day">${icon('sun')}<span>A quiet morning</span></div>
        <div id="world-labels" class="world-labels" aria-label="People and places"></div><div class="overhead-chat" aria-hidden="true"><span class="overhead-line traveler-speech" hidden></span></div><section id="emote-panel" class="emote-panel" aria-label="Emotes" hidden><h2 class="emote-title">Emotes</h2><div class="emote-grid">${EMOTES.map((e) => `<button data-action="emote" data-value="${e.id}">${pixelIcon(e.id as PixelIconName)}<span>${esc(e.label)}</span></button>`).join('')}</div></section>
        <div class="traveler-card"><ol class="chat-log" aria-hidden="true"></ol><div class="traveler-seal">${icon('person')}</div><div class="traveler-details"><span class="eyebrow">THE TRAVELER</span><p class="traveler-line">A willing pair of hands</p><small id="save-indicator">Your journey is saved locally</small><label class="chat-say"><span class="chat-say-name">Traveler:</span><input class="chat-input" type="text" maxlength="80" autocomplete="off" spellcheck="false" aria-label="Say something aloud" placeholder="Press Enter to chat"></label></div></div>
        <div class="bottom-center"><div class="hud-actions"><section id="action-tray" class="action-tray" aria-label="Nearby practical actions" hidden></section><button id="nearby-action" class="nearby-action" data-action="nearest" hidden></button></div><div class="action-scroll-cue" aria-hidden="true" hidden></div><div id="travel-status" class="travel-status" role="status" hidden><span class="travel-guidance" role="region" aria-label="Route guidance" tabindex="-1"></span><small class="route-scroll-cue" aria-hidden="true" hidden></small><button data-action="route-resume" hidden>Resume route</button><button data-action="cancel-navigation">Cancel walk</button></div><div class="control-hints"><span>${icon('mouse')} Click to walk</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span>Right-drag to look</span><span class="chat-filters" role="group" aria-label="Chat lines">${CHAT_FILTERS.map((f) => `<button type="button" class="chat-filter" data-chat-filter="${f.id}" aria-pressed="${f.id === 'all'}">${f.label}</button>`).join('')}</span><button class="messages-button" data-action="messages" aria-label="Recent game messages" aria-describedby="unread-message-description" title="Recent game messages">${icon('scroll')}<span class="message-button-text">Messages</span><span class="message-count" aria-hidden="true" hidden></span><span id="unread-message-description" class="sr-only">No unread game messages</span></button><button data-action="help" aria-label="Show all controls" title="Controls">${icon('help')}</button></div></div>
        <div class="minimap-wrap"><button class="minimap" aria-label="Walk using minimap; press Enter to open local map" title="Click to walk. Enter opens the local map.">${this.mapSvg(false)}</button><button class="minimap-compass" data-action="face-north" aria-label="Face north" title="Face north"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4L21 19L16 16L11 19Z" fill="#c75337" stroke="#efc578" stroke-width="1"/><path d="M16 28L11 19L16 16L21 19Z" fill="#d3bd83"/><text x="16" y="9" text-anchor="middle" fill="#fff3cd" font-size="8" font-weight="700" font-family="Way Pixel, Arial">N</text></svg></button><button class="minimap-open" data-action="map" aria-label="Open local map" title="Local map (M)">LOCAL MAP</button><button class="run-orb" data-action="run-toggle" aria-pressed="false" aria-label="Run, energy 100%" title="Run"><span class="run-orb-icon" aria-hidden="true"></span><span class="run-orb-energy" aria-hidden="true">100</span></button><div class="camera-controls" role="group" aria-label="Camera"><button class="camera-disclosure" data-action="camera-toggle" data-world-action aria-label="Show camera controls" aria-expanded="false" aria-controls="camera-command-buttons" hidden>Camera</button><div id="camera-command-buttons" class="camera-command-buttons"><button data-action="rotate-left" aria-label="Rotate camera left" title="Rotate left (Q)">${icon('rotate-left')}</button><button data-action="reset-camera" aria-label="Reset camera" title="Reset camera (R)">${icon('compass')}</button><button data-action="rotate-right" aria-label="Rotate camera right" title="Rotate right">${icon('rotate-right')}</button><span></span><button data-action="zoom-in" aria-label="Zoom in" title="Zoom in">${icon('plus')}</button><button data-action="zoom-out" aria-label="Zoom out" title="Zoom out">${icon('minus')}</button></div></div></div>
      </div>
      <section id="scene-controls" class="scene-controls" aria-labelledby="scene-title" hidden></section><div id="overlay"></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
      <div id="announcer" class="sr-only" aria-live="polite"></div>`;
    this.overlay = root.querySelector('#overlay')!;
    this.sceneControls = root.querySelector('#scene-controls')!;
    this.hud = root.querySelector('#hud')!;
    this.toastNode = root.querySelector('#toast')!;
    this.noticeActions = this.hud.querySelector('.hud-actions')!;
    this.routeGuidance = this.hud.querySelector('.travel-guidance')!;
    this.routeScrollCue = this.hud.querySelector('.route-scroll-cue')!;
    this.shortLandscape = window.matchMedia('(min-width: 480px) and (max-height: 420px)');
    this.shortPortrait = window.matchMedia(
      '(max-width: 479px) and (max-height: 640px) and (orientation: portrait)',
    );
    this.cameraControls = this.hud.querySelector('.camera-controls')!;
    this.cameraCommands = this.hud.querySelector('.camera-command-buttons')!;
    this.cameraToggle = this.hud.querySelector('.camera-disclosure')!;
    this.shortLandscape.addEventListener('change', this.onNoticeLayout);
    window.addEventListener('resize', this.onMenuResize);
    this.actionScrollCue = this.hud.querySelector('.action-scroll-cue')!;
    this.actionScrollObserver = new ResizeObserver(this.onActionScroll);
    for (const node of [
      this.noticeActions,
      this.toastNode,
      this.routeGuidance,
      this.hud.querySelector<HTMLElement>('#travel-status')!,
      ...this.noticeActions.children,
    ])
      this.actionScrollObserver.observe(node);
    this.routeGuidance.addEventListener('scroll', this.onRouteScroll, { passive: true });
    root.addEventListener('keydown', this.onRouteKey);
    this.noticeActions.addEventListener('scroll', this.onActionScroll, { passive: true });
    this.toastNode.addEventListener('animationend', this.onPausedNoticeLayout);
    this.hudReservations = [
      ...this.hud.querySelectorAll<HTMLElement>(
        '.topbar,.quest-card,.minimap-wrap,.minimap-compass,.minimap-open,.run-orb,.emote-panel,.bottom-center,.traveler-card',
      ),
    ].map((node) => ({
      node,
      lower: node.matches('.bottom-center,.minimap-wrap,.minimap-compass,.run-orb,.emote-panel'),
    }));
    this.labels = root.querySelector('#world-labels')!;
    this.overhead = root.querySelector('.overhead-chat')!;
    this.interfaceHint.setAttribute('aria-hidden', 'true');
    const chat = root.querySelector<HTMLInputElement>('.chat-input')!;
    chat.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.say(chat.value);
        chat.value = '';
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        chat.blur();
        document.querySelector<HTMLElement>('#game-canvas')?.focus({ preventScroll: true });
      }
    });
    for (const button of root.querySelectorAll<HTMLButtonElement>('.chat-filter'))
      button.addEventListener('click', () => {
        this.chatFilter = button.dataset.chatFilter as ChatFilter;
        for (const other of root.querySelectorAll('.chat-filter'))
          other.setAttribute('aria-pressed', String(other === button));
        const log = root.querySelector<HTMLElement>('.chat-log');
        if (log) log.scrollTop = log.scrollHeight;
        this.renderChat();
      });
    // The minimap orbs answer a right-click with their one action, as the classic orbs do.
    for (const [selector, verb, action] of [
      ['.run-orb', 'Toggle Run', 'run-toggle'],
      ['.minimap-open', 'World Map', 'map'],
    ] as const) {
      const orb = root.querySelector<HTMLElement>(selector);
      orb?.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.optionMenu(
          orb,
          event.clientX,
          event.clientY,
          [{ verb, action: () => this.actions.action(action) }],
          root,
        );
      });
    }
    const compass = root.querySelector<HTMLElement>('.minimap-compass');
    compass?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.optionMenu(
        compass,
        event.clientX,
        event.clientY,
        (['North', 'East', 'South', 'West'] as const).map((direction) => ({
          verb: 'Look ' + direction,
          action: () => this.actions.action('look', direction.toLowerCase()),
        })),
        root,
      );
    });
    document.body.append(this.interfaceHint);
    this.quest = root.querySelector('#quest-card')!;
    this.renderChat();
    for (const button of this.hud.querySelectorAll<HTMLElement>(
      '[data-action="journal"],[data-action="inventory"],[data-action="map"],[data-action="settings"],[data-action="help"],[data-action="messages"]',
    )) {
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
    }
    this.minimap = new MinimapControls(
      root.querySelector('.minimap-wrap')!,
      (point) => this.actions.walk?.(point),
      () => this.actions.action('map'),
    );
    for (const p of allInteractables) {
      const button = document.createElement('button');
      button.className = `world-label ${p.kind}`;
      button.dataset.action = 'navigate';
      button.dataset.value = p.id;
      button.setAttribute(
        'aria-label',
        `${p.kind === 'person' ? 'Speak with' : 'Visit'} ${p.name}`,
      );
      button.innerHTML = `<span class="label-symbol">${icon(p.kind === 'person' ? 'marker' : 'pin')}</span><span class="label-name">${esc(p.name)}</span>`;
      this.labels.append(button);
      this.labelNodes.set(p.id, button);
    }
    this.onClick = (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (button?.dataset.action === 'camera-toggle') {
        if (!button.hasAttribute('disabled')) this.toggleCameraDisclosure();
        return;
      }
      if (button?.dataset.action === 'conversation-pause') {
        this.conversationPaused = !this.conversationPaused;
        button.setAttribute('aria-pressed', String(this.conversationPaused));
        button.textContent = this.conversationPaused ? 'Resume motion' : 'Pause motion';
        this.measureWork();
        return;
      }
      if (button && !button.hasAttribute('disabled')) {
        if (button.dataset.action !== 'help') this.noteInteraction();
        this.actions.action(button.dataset.action!, button.dataset.value);
      }
    };
    this.onChange = (e) => {
      const input = e.target as HTMLInputElement;
      if (input.hasAttribute('data-journal-filter')) {
        this.actions.action('journal-filter', input.value);
        return;
      }
      if (input.id === 'import-save' && input.files?.[0]) {
        this.actions.importFile(input.files[0]);
        input.value = '';
      } else if (input.dataset.setting) {
        if (input.type === 'range') this.updateVolumeLevel(input);
        this.actions.setting(
          input.dataset.setting as keyof Settings,
          input.type === 'checkbox' ? input.checked : input.value,
        );
      }
    };
    this.onInput = (e) => {
      const input = e.target;
      if (input instanceof HTMLInputElement && input.type === 'range' && input.dataset.setting) {
        this.updateVolumeLevel(input);
        this.actions.setting(input.dataset.setting as keyof Settings, input.value, true);
      }
    };
    this.onKey = (e) => {
      this.completeReveal();
      if (
        e.key === 'Escape' &&
        !this.panel &&
        this.cameraControls.classList.contains('camera-compact') &&
        this.cameraExpanded &&
        e.target instanceof Node &&
        this.cameraControls.contains(e.target) &&
        !this.cameraControls.inert &&
        !this.root.inert
      ) {
        e.preventDefault();
        this.toggleCameraDisclosure();
        return;
      }
      if (e.key === 'Escape' && this.emotesOpen && !this.panel && !this.root.inert) {
        e.preventDefault();
        this.toggleEmotes(false, true);
        return;
      }
      if (this.panel && this.panel !== 'work') {
        trapFocus(e, this.overlay);
        if (e.key === 'Tab') this.revealReadingFocus();
      }
    };
    this.onPointer = () => this.completeReveal();
    this.workObserver = new ResizeObserver(() => this.measureWork());
    this.workObserver.observe(root);
    this.workObserver.observe(this.overlay);
    this.workObserver.observe(this.sceneControls);
    root.addEventListener('click', this.onClick);
    root.addEventListener('change', this.onChange);
    root.addEventListener('input', this.onInput);
    root.addEventListener('pointerdown', this.onPointer);
    root.addEventListener('pointerover', this.onInterfaceHover);
    root.addEventListener('pointerleave', this.onInterfaceHover);
    window.addEventListener('keydown', this.onKey);
  }
  start(): void {
    this.active = true;
    this.hud.hidden = false;
    this.close();
  }
  update(state: GameState, trackingRefresh = false): void {
    this.currentState = structuredClone(state);
    this.travelPlan = routePlan(state);
    if (this.graphicsPaused) this.renderTravelStatus();
    const inScene = isPresenting(state);
    const view = presentationState(state);
    this.root.classList.toggle('scene-mode', inScene);
    if (inScene) this.toggleEmotes(false);
    this.renderCameraDisclosure();
    this.placeNotice();
    this.sceneControls.hidden = !inScene || !this.active;
    const sceneKey = inScene ? view.region + ':' + this.sceneCheckpoint(view) : '';
    // Reveal scripture once per scene; later re-renders of the same scene appear at once.
    this.sceneControls.classList.toggle('reveal-done', sceneKey === this.lastSceneKey);
    if (sceneKey !== this.lastSceneKey && inScene) this.startReveal();
    this.lastSceneKey = sceneKey;
    this.sceneControls.innerHTML = inScene
      ? view.region === 'storm-account'
        ? stormControls(view, this.scenePaused)
        : view.region === 'nain-account'
          ? nainControls(view, this.scenePaused)
          : view.region === 'roof-account'
            ? roofControls(view, this.scenePaused)
            : sceneControls(view, this.scenePaused)
      : '';
    this.root.querySelector('.control-hints span')!.innerHTML =
      icon('mouse') +
      ' ' +
      esc(
        openingGuidance(state) ??
          (state.region === 'galilee-water' ? 'Click to steer' : 'Click to walk'),
      );
    this.root.querySelector('.control-hints > span:nth-child(2)')!.lastChild!.textContent =
      state.region === 'galilee-water' ? ' Steer' : ' Move';

    const quest = questView(state);
    if (this.quest.dataset.content !== quest) {
      const active = document.activeElement;
      const restore = active instanceof HTMLElement && this.quest.contains(active);
      const action = restore ? active.dataset.action : undefined;
      const value = restore ? active.dataset.value : undefined;
      const shortcut = restore && active.matches('.village-shortcut');
      const scroll = this.quest.scrollTop;
      this.quest.dataset.content = quest;
      this.quest.innerHTML =
        quest +
        '<button class="objective-toggle text-button" data-action="objective-toggle" aria-expanded="false">Show steps</button>';
      this.renderObjective();
      if (restore) {
        this.quest.scrollTop = scroll;
        const surface = this.quest.firstElementChild;
        requestAnimationFrame(() => {
          if (
            this.quest.firstElementChild !== surface ||
            !this.quest.isConnected ||
            this.hud.hidden ||
            this.hud.inert ||
            this.root.inert ||
            !focusLost()
          )
            return;
          // Story toggles change their value while retaining the same place in the card.
          const inverse = shortcut
            ? this.quest.querySelector<HTMLButtonElement>('.village-shortcut:not(:disabled)')
            : null;
          restoreFocus(this.quest, action, inverse?.dataset.value ?? value);
          const focused = document.activeElement;
          if (focused instanceof HTMLElement && this.quest.contains(focused))
            focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        });
      }
    }
    this.pendingQuestReveal =
      trackingRefresh && this.objectiveExpanded && !this.panel
        ? (this.quest.querySelector<HTMLElement>('.village-shortcut') ?? undefined)
        : undefined;
    this.root.querySelector('.time-of-day span')!.textContent =
      this.atmosphere ??
      (state.region === 'capernaum'
        ? 'A quiet morning'
        : ['galilean-road', 'roadside-farm', 'nain-gate', 'nain-account'].includes(state.region)
          ? 'Later in the journey'
          : 'Some days later');
    const minimap = this.root.querySelector('.minimap')!;
    minimap.innerHTML = this.mapSvg(false, state.position, state);
    const sailing = state.region === 'galilee-water';
    minimap.setAttribute(
      'aria-label',
      sailing
        ? 'Steer using minimap; press Enter to open local map'
        : 'Walk using minimap; press Enter to open local map',
    );
    minimap.setAttribute(
      'title',
      sailing
        ? 'Click to steer. Enter opens the local map.'
        : 'Click to walk. Enter opens the local map.',
    );
    const region = regions[view.region];
    const regionTitle = this.root.querySelector('.region-title')!;
    regionTitle.innerHTML =
      '<span class="location-diamond">' +
      icon('pin') +
      '</span><span>' +
      esc(region.title.toUpperCase()) +
      '<small>' +
      esc(region.subtitle) +
      '</small></span>';
    const finished = trackedChapter(state).complete(state);
    const available = activeInteractables(state);
    this.activePoints = new Map(available.map((p) => [p.id, { x: p.x, z: p.z }]));
    this.labelNodes.forEach((node, id) => {
      if (!available.some((p) => p.id === id)) node.hidden = true;
      node.classList.toggle('quest-target', id === objectiveTarget(state) && !finished);
      node.classList.toggle(
        'remembered',
        state.discoveries.some((place) => place === id),
      );
    });
    this.markMaps(state, finished);
    const announcer = this.root.querySelector('#announcer')!;
    const nextObjective = objective(state);
    if (announcer.textContent !== nextObjective) announcer.textContent = nextObjective;
  }
  /** Map markers share discovery, target and quest-start classes on the radar and local map. */
  private markMaps(state: GameState, finished = trackedChapter(state).complete(state)): void {
    const starts = storyStarts(state);
    for (const marker of this.root.querySelectorAll<SVGElement>('[data-map-place]')) {
      const id = marker.dataset.mapPlace;
      marker.classList.toggle(
        'map-remembered',
        state.discoveries.some((place) => place === id),
      );
      const target = id === objectiveTarget(state) && !finished;
      marker.classList.toggle('map-target', target);
      marker.classList.toggle('map-quest-start', !target && !!id && starts.has(id));
    }
  }
  private renderCameraDisclosure(): void {
    const compact =
      this.shortPortrait.matches &&
      this.active &&
      !this.panel &&
      !this.root.classList.contains('scene-mode') &&
      !this.worldPaused &&
      !this.graphicsPaused;
    const active = document.activeElement;
    // Keep an existing camera selection available when the viewport becomes compact.
    if (compact && active instanceof Node && this.cameraCommands.contains(active))
      this.cameraExpanded = true;
    // The ordinary layout has no disclosure; retain a live camera focus destination.
    if (
      !compact &&
      active === this.cameraToggle &&
      !this.panel &&
      !this.worldPaused &&
      !this.graphicsPaused &&
      !this.root.inert
    )
      this.cameraCommands
        .querySelector<HTMLButtonElement>('[data-action="reset-camera"]')
        ?.focus({ preventScroll: true });
    this.cameraControls.classList.toggle('camera-compact', compact);
    this.cameraControls.classList.toggle('camera-expanded', compact && this.cameraExpanded);
    this.cameraToggle.hidden = !compact;
    this.cameraToggle.textContent = this.cameraExpanded ? 'Hide' : 'Camera';
    this.cameraToggle.setAttribute(
      'aria-label',
      this.cameraExpanded ? 'Hide camera controls' : 'Show camera controls',
    );
    this.cameraToggle.setAttribute('aria-expanded', String(compact && this.cameraExpanded));
  }
  private toggleCameraDisclosure(): void {
    if (this.cameraToggle.hidden || this.cameraToggle.disabled || this.cameraControls.inert) return;
    this.cameraExpanded = !this.cameraExpanded;
    if (
      !this.cameraExpanded &&
      document.activeElement instanceof Node &&
      this.cameraCommands.contains(document.activeElement)
    )
      this.cameraToggle.focus({ preventScroll: true });
    this.renderCameraDisclosure();
    this.noteInteraction();
    this.placeNotice(true);
  }
  private renderTravelStatus(destination?: string): void {
    const travel = this.root.querySelector<HTMLElement>('#travel-status')!;
    const selected = allInteractables.find((p) => p.id === destination);
    const plan = this.travelPlan;
    const walking = !!this.activeWalkTarget && !this.worldPaused && !this.graphicsPaused;
    const cancel = travel.querySelector<HTMLButtonElement>('[data-action="cancel-navigation"]')!;
    const cancelText =
      this.currentState?.region === 'galilee-water' ? 'Cancel course' : 'Cancel walk';
    if (cancel.textContent !== cancelText) cancel.textContent = cancelText;
    travel.hidden = !selected && !plan && !walking;
    const currentTravel = selected
      ? 'Approaching ' + selected.name
      : walking
        ? this.currentState?.region === 'galilee-water'
          ? 'Steering to chosen point'
          : 'Walking to chosen point'
        : undefined;
    const travelText = plan
      ? plan.target === destination && currentTravel
        ? currentTravel
        : plan.title + ' · ' + (currentTravel ?? plan.message)
      : (currentTravel ?? '');
    const resume = travel.querySelector<HTMLButtonElement>('[data-action="route-resume"]')!;
    resume.hidden = !plan || !!destination;
    if (resume.dataset.pauseDisabled !== undefined) {
      resume.dataset.pauseDisabled = String(!plan?.available);
      resume.disabled = true;
    } else resume.disabled = !plan?.available;
    if (this.routeGuidance.textContent !== travelText) {
      this.routeGuidance.textContent = travelText;
      this.routeGuidance.title = travelText;
      this.routeGuidance.scrollTop = 0;
      if (this.routeCueFrame === undefined)
        this.routeCueFrame = requestAnimationFrame(() => {
          this.routeCueFrame = undefined;
          this.updateRouteScrollCue();
        });
    }
  }
  frame(
    position: Point,
    labels: ScreenLabel[],
    heading: number,
    nearest: string | null,
    destination?: string,
    walkTarget?: Point,
    head?: { x: number; y: number },
  ): void {
    this.placeSpeech(head);
    this.activeWalkTarget = this.worldPaused || this.graphicsPaused ? undefined : walkTarget;
    this.renderTravelStatus(destination);
    if (this.lastPosition)
      this.setHintsFaded(
        this.hints.move(
          Math.hypot(position.x - this.lastPosition.x, position.z - this.lastPosition.z),
        ),
      );
    this.lastPosition = { x: position.x, z: position.z };
    const focused = document.activeElement;
    const states = new Map<string, LabelState>();
    for (const [id, node] of this.labelNodes) {
      node.classList.toggle('selected-destination', id === destination);
      const point = this.activePoints.get(id);
      const s: LabelState = {
        kind: node.classList.contains('person') ? 'person' : 'place',
        distance: point ? Math.hypot(point.x - position.x, point.z - position.z) : Infinity,
        nearest: id === nearest,
        target: node.classList.contains('quest-target'),
        selected: id === destination,
        hovered: node.matches(':hover'),
        focused: node === focused,
      };
      states.set(id, s);
      node.classList.toggle('expanded', labelExpanded(s));
    }
    if (this.currentState) this.updateTray({ ...this.currentState, position });
    const height = this.root.clientHeight;
    // Notice clearance and world names share the same current HUD measurements.
    const hudBounds = this.hudReservations
      .filter(({ node }) => node.offsetHeight > 0)
      .map(({ node, lower }) => ({ node, lower, rect: node.getBoundingClientRect() }));
    this.setNoticeClearance(height, hudBounds);
    const noticeBounds =
      !this.toastNode.hidden && this.toastNode.offsetHeight > 0
        ? this.toastNode.getBoundingClientRect()
        : undefined;
    this.reserveQuestNoticeSpace(
      hudBounds.find(({ node }) => node === this.quest)?.rect,
      noticeBounds,
    );
    const arrival = this.root.querySelector<HTMLElement>('.chapter-card');
    const arrivalBounds =
      arrival && getComputedStyle(arrival).visibility !== 'hidden'
        ? arrival.querySelector('.chapter-card-inner')?.getBoundingClientRect()
        : undefined;
    const reserved = [
      ...hudBounds.map(({ rect }) => rect),
      ...(noticeBounds ? [noticeBounds] : []),
      ...(arrivalBounds ? [arrivalBounds] : []),
    ];
    const nearbyPeople = labels.flatMap(({ id, visible }) => {
      const s = states.get(id),
        point = this.activePoints.get(id);
      // Walking companions move between state updates; their saved points can be stale.
      const walkingCompanion =
        (id === 'amos' && this.currentState?.campaign.walk.stage === 'walking') ||
        (id === 'neri' && this.currentState?.road.company.stage === 'walking');
      return this.currentState &&
        !walkingCompanion &&
        visible &&
        s?.kind === 'person' &&
        s.distance <= LABEL_NEAR.person &&
        point
        ? [point]
        : [];
    });
    const placed = arrangeLabels(
      measureLabels(
        labels.map((label) => {
          const s = states.get(label.id),
            point = this.activePoints.get(label.id);
          const personSharesPoint =
            this.labelNodes.get(label.id)?.classList.contains('place') &&
            !!point &&
            nearbyPeople.some((person) => person.x === point.x && person.z === point.z);
          return {
            ...label,
            priority: s ? labelPlacementPriority(s, !!personSharesPoint) : 0,
            focused: s?.focused ?? false,
          };
        }),
        this.labelNodes,
      ),
      reserved,
      this.root.clientWidth,
      height,
    );
    for (const label of placed) {
      const node = this.labelNodes.get(label.id);
      if (!node) continue;
      node.style.transform = `translate(${label.x}px,${label.y}px) translate(-50%,-100%)`;
      node.hidden = !label.visible;
    }
    this.speakOverhead(placed, states);
    const minimapPlayer = this.root.querySelector<SVGElement>('#minimap-player');
    const bounds = campaignLayout(this.currentState?.region ?? '')?.bounds ?? {
      min: -24,
      max: 24,
    };
    const mapped = mapPoint(position, bounds);
    minimapPlayer?.setAttribute('transform', `translate(${mapped.x},${mapped.y})`);
    this.minimap.update(heading, bounds, position, walkTarget);
    const button = this.root.querySelector<HTMLButtonElement>('#nearby-action')!;
    const person = allInteractables.find((p) => p.id === nearest);
    const ownedFocus = document.activeElement === button;
    // An explicit available action already serves this object; keep the extra prompt for people.
    button.hidden = !person || (person.kind !== 'person' && this.trayTargets.has(person.id));
    if (
      ownedFocus &&
      button.hidden &&
      !this.panel &&
      !this.worldPaused &&
      !this.graphicsPaused &&
      !this.hud.inert &&
      !this.root.inert &&
      !document.hidden
    )
      document.querySelector<HTMLElement>('#game-canvas')?.focus({ preventScroll: true });
    if (nearest !== this.lastNearest) {
      this.lastNearest = nearest;
      if (person)
        button.innerHTML = `<kbd>E</kbd> ${person.kind === 'person' ? 'Speak with' : 'Explore'} ${esc(person.name)} ${icon('arrow')}`;
    }
  }
  private updateTray(s: GameState): void {
    const body = nearbyActions(s);
    if (body === this.lastTray) return;
    const tray = this.root.querySelector<HTMLElement>('#action-tray')!;
    const focus = tray.contains(document.activeElement);
    const value = (document.activeElement as HTMLElement | null)?.dataset.value;
    this.lastTray = body;
    tray.innerHTML = body;
    tray.hidden = !body;
    this.trayTargets = new Set(
      [...tray.querySelectorAll<HTMLButtonElement>('button[data-target]:not(:disabled)')].map(
        (button) => button.dataset.target!,
      ),
    );
    if (focus) {
      const replacement =
        [...tray.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].find(
          (b) => b.dataset.value === value,
        ) ?? tray.querySelector<HTMLButtonElement>('button:not([disabled])');
      const nearby = this.root.querySelector<HTMLButtonElement>('#nearby-action')!;
      (
        replacement ??
        (nearby.hidden ? document.querySelector<HTMLElement>('#game-canvas') : nearby)
      )?.focus();
    }
  }
  saveStatus(text: string): void {
    this.root.querySelector('#save-indicator')!.textContent = text;
  }
  private updateVolumeLevel(input: HTMLInputElement): void {
    const output = input.closest('.audio-control')?.querySelector('output');
    if (!output) return;
    const level = volumePercent(input.valueAsNumber);
    output.value = level;
    input.setAttribute('aria-valuetext', level);
  }
  /**
   * Show a journal ribbon. `kind` picks its icon and accent; when omitted it is inferred from
   * the text (warnings, saves, memories, items, places, otherwise story).
   */
  toast(message: string, kind: ToastKind = toastKind(message)): void {
    this.messageHistory.add(message, kind);
    this.renderChat();
    // New memories and items flash their tab until it is opened, as tutorial tabs do.
    if (kind === 'memory' && this.panel !== 'journal') this.flashTab('journal', true);
    if (kind === 'item' && this.panel !== 'inventory') this.flashTab('inventory', true);
    this.unreadMessages = Math.min(40, this.unreadMessages + 1);
    this.updateMessageCount();
    clearTimeout(this.toastTimer);
    this.renderNotice(message, kind);
    if (this.toastNode.dataset.held === 'true') return;
    this.toastTimer = setTimeout(() => {
      if (this.heldNotice) this.renderNotice(this.heldNotice.message, this.heldNotice.kind);
      else {
        this.toastNode.hidden = true;
        this.clearQuestNoticeSpace();
      }
    }, 4800);
  }
  /** Keep an unresolved system condition explained; ordinary feedback can still appear. */
  holdNotice(message?: string, kind: ToastKind = 'warning'): void {
    this.heldNotice = message ? { message, kind } : undefined;
    if (message) this.toast(message, kind);
    else if (this.toastNode.dataset.held === 'true') {
      this.toastNode.hidden = true;
      this.clearQuestNoticeSpace();
    }
  }
  private renderNotice(message: string, kind: ToastKind): void {
    const toast = this.toastNode;
    const held = this.heldNotice?.message === message && this.heldNotice.kind === kind;
    toast.dataset.held = String(held);
    toast.dataset.kind = kind;
    toast.innerHTML = `<span class="toast-icon">${icon(TOAST_ICONS[kind])}</span><span class="toast-text">${esc(message)}</span>`;
    // Restart the ribbon animation when one notice replaces another.
    toast.hidden = true;
    void toast.offsetWidth;
    // Reading menus retain their full space; returning to the world reveals the condition.
    toast.hidden = held && this.panel !== null && this.panel !== 'work';
    this.placeNotice(true);
    if (!toast.hidden) this.revealReadingFocus();
    if (toast.parentElement === this.noticeActions) this.noticeActions.scrollTop = 0;
  }
  private revealReadingFocus(active = document.activeElement): void {
    if (
      active instanceof HTMLElement &&
      this.overlay.contains(active) &&
      active.closest('.panel > .panel-body')
    ) {
      const control = active.closest<HTMLElement>('.audio-control,.import-button') ?? active;
      control.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  }
  private placeNotice(refresh = false): void {
    const footer = this.panel
      ? this.overlay.querySelector<HTMLElement>('.panel > .panel-footer')
      : null;
    // Short landscapes have a dedicated action column; let its tray make room for feedback.
    const parent =
      footer?.parentElement ??
      (this.shortLandscape.matches &&
      this.active &&
      !this.panel &&
      !this.root.classList.contains('scene-mode')
        ? this.noticeActions
        : this.root);
    const moved = this.toastNode.parentElement !== parent;
    if (moved) {
      parent.insertBefore(this.toastNode, footer);
      if (parent === this.noticeActions && !this.toastNode.hidden) parent.scrollTop = 0;
    }
    if (moved || refresh) this.updateActionScrollCue();
    if (
      (moved || refresh) &&
      parent === this.root &&
      this.active &&
      !this.panel &&
      !this.root.classList.contains('scene-mode')
    ) {
      this.setNoticeClearance(
        this.root.clientHeight,
        this.hudReservations
          .filter(({ node, lower }) => lower && node.offsetHeight > 0)
          .map(({ node, lower }) => ({ lower, rect: node.getBoundingClientRect() })),
      );
    }
    if (
      parent !== this.root ||
      !this.active ||
      this.panel ||
      this.shortLandscape.matches ||
      this.root.classList.contains('scene-mode')
    )
      this.clearQuestNoticeSpace();
    else if (this.graphicsPaused) {
      // Context loss stops world frames; DOM events still keep held feedback clear.
      this.reserveQuestNoticeSpace(
        this.quest.offsetHeight > 0 ? this.quest.getBoundingClientRect() : undefined,
        !this.toastNode.hidden && this.toastNode.offsetHeight > 0
          ? this.toastNode.getBoundingClientRect()
          : undefined,
      );
    }
  }
  private clearQuestNoticeSpace(): void {
    this.root.style.removeProperty('--quest-notice-max-height');
    this.pendingQuestReveal = undefined;
  }
  private reserveQuestNoticeSpace(quest?: DOMRect, notice?: DOMRect): void {
    const chosen = this.pendingQuestReveal;
    this.pendingQuestReveal = undefined;
    const floating =
      this.active &&
      !this.panel &&
      !this.hud.hidden &&
      !this.hud.inert &&
      !this.root.inert &&
      !this.shortLandscape.matches &&
      !this.root.classList.contains('scene-mode') &&
      this.toastNode.parentElement === this.root &&
      !this.toastNode.hidden;
    // Only a notice below the card's top can crowd it; the classic frame's notices sit above.
    const space =
      floating &&
      quest &&
      notice &&
      notice.top > quest.top &&
      quest.left < notice.right &&
      quest.right > notice.left
        ? Math.max(0, Math.floor(notice.top - quest.top - 12)) + 'px'
        : '';
    const changed = this.root.style.getPropertyValue('--quest-notice-max-height') !== space;
    if (changed) {
      if (space) this.root.style.setProperty('--quest-notice-max-height', space);
      else this.root.style.removeProperty('--quest-notice-max-height');
    }
    if (!floating) return;
    const active = document.activeElement;
    const reveal =
      chosen?.isConnected && this.quest.contains(chosen) && (focusLost() || active === chosen)
        ? chosen
        : changed && active instanceof HTMLElement && this.quest.contains(active)
          ? active
          : undefined;
    reveal?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
  private setNoticeClearance(height: number, bounds: { lower: boolean; rect: DOMRect }[]): void {
    const lower = bounds.filter(
      ({ lower, rect }) => lower && rect.height > 0 && rect.bottom > height / 2,
    );
    if (lower.length)
      this.root.style.setProperty(
        '--notice-bottom',
        height - Math.min(...lower.map(({ rect }) => rect.top)) + 12 + 'px',
      );
  }
  private updateActionScrollCue(): void {
    const actions = this.noticeActions;
    const enabled =
      this.shortLandscape.matches &&
      this.active &&
      !this.panel &&
      !this.root.classList.contains('scene-mode');
    // A notice can scroll its own text, but its frame must fit the action scrollport.
    const style = enabled && actions.clientHeight > 0 ? getComputedStyle(actions) : null;
    const noticeHeight = style
      ? Math.floor(
          actions.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
        )
      : 0;
    const noticeSpace = noticeHeight > 0 ? `${noticeHeight}px` : '';
    if (actions.style.getPropertyValue('--hud-action-notice-height') !== noticeSpace) {
      if (noticeSpace) actions.style.setProperty('--hud-action-notice-height', noticeSpace);
      else actions.style.removeProperty('--hud-action-notice-height');
    }
    const above = enabled && actions.scrollTop > 1;
    const below = enabled && actions.scrollTop + actions.clientHeight < actions.scrollHeight - 1;
    this.actionScrollCue.hidden = !above && !below;
    const text = above && below ? 'More ↑ ↓' : above ? 'More above ↑' : 'More below ↓';
    if (this.actionScrollCue.textContent !== text) this.actionScrollCue.textContent = text;
  }
  private updateRouteScrollCue(): void {
    const guidance = this.routeGuidance;
    const overflow = guidance.clientHeight > 0 && guidance.scrollHeight > guidance.clientHeight + 1;
    guidance.tabIndex = overflow ? 0 : -1;
    this.routeScrollCue.hidden = !overflow;
    const above = guidance.scrollTop > 1;
    const below = guidance.scrollTop + guidance.clientHeight < guidance.scrollHeight - 1;
    const text = above && below ? 'More ↑ ↓' : above ? 'More above ↑' : 'More below ↓';
    if (this.routeScrollCue.textContent !== text) this.routeScrollCue.textContent = text;
  }
  /** A small Choose Option menu for a satchel item; it closes on choice, Escape or elsewhere. */
  private itemMenu(button: HTMLElement, x: number, y: number, onExamine: () => void): void {
    this.optionMenu(button, x, y, [
      { verb: 'Examine', item: button.getAttribute('title') ?? '', action: onExamine },
    ]);
  }
  /** The classic Choose Option menu for interface controls, ending with Cancel. */
  private optionMenu(
    button: HTMLElement,
    x: number,
    y: number,
    options: readonly { verb: string; item?: string; action: () => void }[],
    host: HTMLElement = this.overlay,
  ): void {
    document.querySelector('.item-option-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'world-option-menu item-option-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Choose Option');
    const title = document.createElement('div');
    title.className = 'world-option-title';
    title.textContent = 'Choose Option';
    menu.append(title);
    const close = (restore: boolean) => {
      menu.remove();
      document.removeEventListener('pointerdown', outside, true);
      if (restore && button.isConnected) button.focus({ preventScroll: true });
    };
    const outside = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node)) close(false);
    };
    const option = (verb: string, item: string, action: () => void) => {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.setAttribute('role', 'menuitem');
      entry.append(document.createTextNode(verb));
      if (item) {
        const label = document.createElement('span');
        label.className = 'world-option-name is-item';
        label.textContent = ' ' + item;
        entry.append(label);
      }
      entry.addEventListener('click', () => {
        close(true);
        action();
      });
      menu.append(entry);
    };
    for (const entry of options) option(entry.verb, entry.item ?? '', entry.action);
    option('Cancel', '', () => {});
    menu.addEventListener('keydown', (event) => {
      const entries = [...menu.querySelectorAll<HTMLButtonElement>('button')];
      const at = entries.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        entries[(at + step + entries.length) % entries.length]?.focus();
      }
    });
    host.append(menu);
    const left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8));
    const top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    document.addEventListener('pointerdown', outside, true);
    menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
  /** Classic interface controls describe themselves in the corner, as world actions do. */
  private onInterfaceHover = (e: PointerEvent): void => {
    const hint = this.interfaceHint;
    if (!hint) return;
    const target = e.type === 'pointerover' && e.target instanceof Element ? e.target : null;
    const described = target ? interfaceHover(target) : undefined;
    // Touch the DOM only when the description changes; most crossings are over the world.
    const key = described ? described.verb + '\n' + (described.item ?? '') : '';
    if (key === this.interfaceHintKey) return;
    this.interfaceHintKey = key;
    hint.hidden = !described;
    if (!described) return;
    hint.replaceChildren(document.createTextNode(described.verb));
    if (described.item) {
      const name = document.createElement('span');
      name.className = 'interface-hint-item';
      name.textContent = ' ' + described.item;
      hint.append(name);
    }
  };
  /** Enter from the world moves typing into the chatbox where it is shown. */
  focusChat(): boolean {
    const chat = this.root.querySelector<HTMLInputElement>('.chat-input');
    if (!chat || !chat.offsetParent || this.hud.hidden) return false;
    chat.focus({ preventScroll: true });
    return true;
  }
  /** The traveler says a line aloud: it joins the chatbox and floats overhead for a while. */
  say(text: string): void {
    const line = text.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!line) return;
    this.messageHistory.add('Traveler: ' + line, 'story', true);
    this.renderChat();
    const speech = this.root.querySelector<HTMLElement>('.traveler-speech');
    if (!speech) return;
    speech.textContent = line;
    this.speechUntil = performance.now() + 4500;
  }
  private placeSpeech(head?: { x: number; y: number }): void {
    const speech = this.root.querySelector<HTMLElement>('.traveler-speech');
    if (!speech) return;
    const show = !!head && performance.now() < this.speechUntil && !this.panel;
    speech.hidden = !show;
    if (show) speech.style.transform = `translate(${head!.x}px,${head!.y}px) translate(-50%,-100%)`;
  }
  /** Neighbors nearby remark now and then above their names while the traveler explores. */
  private speakOverhead(
    placed: readonly { id: string; x: number; y: number; visible: boolean }[],
    states: ReadonlyMap<string, LabelState>,
  ): void {
    // Test doubles may build an interface without its constructor or overhead layer.
    if (!this.chatter || !this.overhead) return;
    const exploring =
      this.active &&
      !this.panel &&
      !this.worldPaused &&
      !this.graphicsPaused &&
      !this.root.classList.contains('scene-mode') &&
      !this.root.classList.contains('conversing');
    if (!exploring) this.chatter.quiet();
    const eligible = exploring
      ? placed
          .filter(({ id, visible }) => {
            const s = states.get(id);
            return visible && s?.kind === 'person' && s.distance <= CHATTER_RANGE;
          })
          .map(({ id }) => id)
      : [];
    const lines = this.chatter.tick(performance.now(), eligible);
    const speaking = new Set(lines.map((line) => line.id));
    for (const [id, node] of this.overheadNodes)
      if (!speaking.has(id)) {
        node.remove();
        this.overheadNodes.delete(id);
      }
    for (const line of lines) {
      const label = placed.find(({ id }) => id === line.id);
      const anchor = this.labelNodes.get(line.id);
      if (!label || !anchor) continue;
      let node = this.overheadNodes.get(line.id);
      if (!node) {
        node = document.createElement('span');
        node.className = 'overhead-line';
        this.overhead.append(node);
        this.overheadNodes.set(line.id, node);
      }
      if (node.textContent !== line.text) node.textContent = line.text;
      node.style.transform = `translate(${label.x}px,${label.y - anchor.offsetHeight - 2}px) translate(-50%,-100%)`;
    }
  }
  /** A score heard for the first time on this device is announced in the chatbox. */
  private flashTab(action: 'journal' | 'inventory', on: boolean): void {
    this.root
      .querySelector<HTMLElement>(`.toolbar [data-action="${action}"]`)
      ?.classList.toggle('tab-flash', on);
  }
  setSoundOn(on: boolean): void {
    this.soundOn = on;
    this.root.querySelector('.welcome-sound')?.setAttribute('aria-pressed', String(on));
  }
  get emotesOpen(): boolean {
    return !this.root.querySelector<HTMLElement>('#emote-panel')?.hidden;
  }
  /** The Emotes tab opens a small, nonmodal panel; the world keeps running behind it. */
  toggleEmotes(open = !this.emotesOpen, restoreFocus = false): void {
    const panel = this.root.querySelector<HTMLElement>('#emote-panel');
    const tab = this.root.querySelector<HTMLElement>('.toolbar [data-action="emotes"]');
    if (!panel || !tab) return;
    panel.hidden = !open;
    tab.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) tab.focus({ preventScroll: true });
  }
  /** The run orb shows whether the traveler runs and how much energy remains. */
  setRun(on: boolean, energy: number): void {
    const orb = this.root.querySelector<HTMLElement>('.run-orb');
    if (!orb) return;
    const percent = Math.floor(energy);
    orb.setAttribute('aria-pressed', String(on));
    orb.setAttribute('aria-label', `Run, energy ${percent}%`);
    orb.style.setProperty('--run-energy', String(energy / 100));
    orb.querySelector('.run-orb-energy')!.textContent = String(percent);
  }
  chosenTrack?: string;
  /** Which lines the chatbox shows; the Messages history always keeps every notice. */
  private chatFilter: ChatFilter = 'all';
  /** Whether game audio is on, for the title's sound toggle. */
  soundOn = true;
  setHeardTracks(ids: Iterable<string>): void {
    this.heardTracks = new Set(ids);
  }
  musicUnlocked(title: string): void {
    this.messageHistory.add(`You have unlocked a new music track: ${title}.`, 'memory', true);
    this.renderChat();
  }
  /** The classic completion scroll: a passing celebration that never takes focus or input. */
  storyComplete(title: string, points: number): void {
    this.messageHistory.add(`Congratulations, you've completed a story: ${title}!`, 'memory', true);
    this.renderChat();
    this.root.querySelector('.story-scroll')?.remove();
    const scroll = document.createElement('section');
    scroll.className = 'story-scroll';
    scroll.setAttribute('aria-hidden', 'true');
    scroll.innerHTML = `<div class="story-scroll-roll"></div><div class="story-scroll-sheet"><h2>Congratulations!</h2><p class="story-scroll-lead">You have completed <b>${esc(title)}</b>!</p><div class="story-scroll-body"><span class="story-scroll-art">${icon('scroll')}</span><div><p>You are awarded:</p><ul><li>A memory kept in your journal</li><li>1 Story point</li></ul></div></div><p class="story-scroll-points">Story points: ${points}</p></div><div class="story-scroll-roll"></div>`;
    this.root.append(scroll);
    clearTimeout(this.storyScrollTimer);
    this.storyScrollTimer = setTimeout(() => {
      scroll.classList.add('leaving');
      this.storyScrollTimer = setTimeout(() => scroll.remove(), 400);
    }, 6400);
  }
  /** The chatbox mirrors recent feedback; Messages keeps the readable, announced history. */
  private renderChat(): void {
    const log = this.root.querySelector<HTMLElement>('.chat-log');
    if (!log) return;
    // Follow new lines only while the reader is at the bottom, as a game chat does.
    const following = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
    const offset = log.scrollTop;
    const filter = this.chatFilter ?? 'all';
    log.innerHTML =
      (filter === 'public' ? '' : '<li class="chat-welcome">Welcome to <b>The Way</b>.</li>') +
      this.messageHistory.chat(40, filter);
    log.scrollTop = following ? log.scrollHeight : offset;
  }
  private updateMessageCount(): void {
    const count = this.root.querySelector<HTMLElement>('.message-count')!;
    count.hidden = this.unreadMessages === 0;
    count.textContent = String(this.unreadMessages);
    this.root.querySelector('#unread-message-description')!.textContent = this.unreadMessages
      ? `${this.unreadMessages} unread game message${this.unreadMessages === 1 ? '' : 's'}`
      : 'No unread game messages';
  }
  messages(): void {
    clearTimeout(this.toastTimer);
    this.toastNode.hidden = true;
    this.clearQuestNoticeSpace();
    this.unreadMessages = 0;
    this.updateMessageCount();
    this.show(
      'messages',
      this.panelShell('Game messages', 'RECENT FEEDBACK', this.messageHistory.view()),
    );
  }
  /** The HUD's time-of-day line, for example from the region's environment profile. */
  setAtmosphere(label: string): void {
    this.atmosphere = label;
    this.root.querySelector('.time-of-day span')!.textContent = label;
  }
  /** The traveler card's line, for example the current chapter's journey line. */
  setTraveler(line: string): void {
    this.root.querySelector('.traveler-line')!.textContent = line;
  }
  private noteInteraction(): void {
    this.setHintsFaded(this.hints.interact());
  }
  private setHintsFaded(faded: boolean): void {
    this.root.querySelector('.control-hints')?.classList.toggle('hints-faded', faded);
  }
  private sceneCheckpoint(s: GameState): string {
    return [
      s.episode.checkpoint,
      s.campaign.roof.checkpoint,
      s.road.chapter.checkpoint,
      s.lake.chapter.checkpoint,
    ].join('|');
  }
  private revealTimer?: ReturnType<typeof setTimeout>;
  private revealing = false;
  /** Mark that a gentle reveal is running, so the next key or tap can complete it. */
  private startReveal(): void {
    this.revealing = true;
    clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => (this.revealing = false), 2400);
  }
  private completeReveal(): void {
    if (!this.revealing) return;
    this.revealing = false;
    this.overlay.classList.add('reveal-done');
    this.sceneControls.classList.add('reveal-done');
  }
  private show(panel: Panel, content: string, initialFocus = true): void {
    if (panel !== 'work') this.toggleEmotes(false);
    if (!this.panel)
      this.focusBefore =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.panel = panel;
    if (panel !== 'work' && this.toastNode.dataset.held === 'true') this.toastNode.hidden = true;
    this.menuSelection(panel);
    this.root.classList.remove('conversing');
    if (panel !== 'dialogue' && panel !== 'context') {
      this.actions.presentationLayout?.();
      this.conversationPaused = false;
    }
    this.root.classList.toggle('working', panel === 'work');
    this.hud.inert = panel !== 'work';
    this.sceneControls.inert = true;
    const previousWork = this.overlay.querySelector<HTMLElement>(
      '.work-panel,[data-conversation-person]',
    );
    if (previousWork) this.workObserver?.unobserve(previousWork);
    this.overlay.innerHTML = content;
    this.placeNotice();
    const workPanel = this.overlay.querySelector<HTMLElement>(
      '.work-panel,[data-conversation-person]',
    );
    if (workPanel) this.workObserver?.observe(workPanel);
    this.overlay.className =
      panel === 'work'
        ? 'work-overlay'
        : panel === 'dialogue'
          ? 'dialogue-overlay'
          : panel === 'welcome'
            ? 'welcome-overlay'
            : 'panel-overlay';
    this.pauseWorldControls();
    const surface = this.overlay.firstElementChild;
    if (initialFocus)
      requestAnimationFrame(() => {
        if (
          this.overlay.firstElementChild === surface &&
          !this.overlay.contains(document.activeElement)
        ) {
          const answer =
            panel === 'dialogue'
              ? this.overlay.querySelector<HTMLElement>('[data-action="choice"]:not([disabled])')
              : undefined;
          (
            answer ??
            this.overlay.querySelector<HTMLElement>('button:not([disabled]),[tabindex="0"]')
          )?.focus();
        }
      });
  }
  close(): void {
    this.actions.presentationLayout?.();
    this.root.classList.remove('conversing');
    this.conversationPaused = false;
    this.root.classList.remove('working');
    this.panel = null;
    this.menuSelection(null);
    const workPanel = this.overlay.querySelector<HTMLElement>(
      '.work-panel,[data-conversation-person]',
    );
    if (workPanel) this.workObserver?.unobserve(workPanel);
    this.overlay.innerHTML = '';
    this.overlay.className = '';
    this.hud.inert = false;
    this.sceneControls.inert = false;
    if (this.heldNotice && this.toastNode.hidden)
      this.renderNotice(this.heldNotice.message, this.heldNotice.kind);
    this.placeNotice(true);
    if (this.active && this.currentState && isPresenting(this.currentState)) {
      this.sceneControls.querySelector<HTMLElement>('.scene-continue')?.focus();
      return;
    }
    if (this.active)
      (this.focusBefore ?? document.querySelector<HTMLElement>('#game-canvas'))?.focus();
  }
  private menuSelection(panel: Panel): void {
    for (const button of this.hud.querySelectorAll<HTMLElement>('[aria-haspopup="dialog"]'))
      button.setAttribute('aria-expanded', String(button.dataset.action === panel));
  }
  welcome(hasSave: boolean, storage: boolean, saved?: GameState): void {
    this.show(
      'welcome',
      `<div class="welcome-shade"></div><div class="welcome-crest" aria-hidden="true"><span class="crest-torch"></span>${logoLockup('title')}<span class="crest-torch"></span></div><section class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="welcome-brand">${logoLockup('title')}</div><p class="eyebrow">Chapter I · Galilee</p><h1 id="welcome-title">Every journey begins with a small kindness.</h1><p class="welcome-copy">Morning comes to Capernaum. Help on the shore and witness the catch and calling, then follow the lanes, the road to Nain and the lake to a sheltered cove.</p>${saved ? recap(saved, true) : ''}<p class="welcome-copy secondary">Walk the shore. Meet its people. Find your place along the way.</p><button class="primary-button" data-action="${hasSave ? 'continue' : 'begin'}">${hasSave ? 'Continue your journey' : 'Begin your journey'} ${icon('arrow')}</button>${hasSave ? '<button class="text-button" data-action="new-journey">Start a new journey</button>' : ''}<div class="welcome-meta">${icon('leaf')} A quiet adventure · Explore at your own pace</div>${!storage ? '<p class="storage-warning">Browser storage is unavailable. You can export your journey from Settings during this session.</p>' : ''}<p class="welcome-note">Four Gospel chapters: Luke 5:1–11, Mark 2:1–12, Luke 7:11–17 and Mark 4:35–41. Original conversations and scripture are clearly identified.</p><button class="welcome-saves text-button" data-action="settings">${icon('save')} Saves &amp; settings</button></section><div class="welcome-location">${icon('pin')}<span>CAPERNAUM<small>The shores of Galilee</small></span></div><button class="welcome-sound" data-action="toggle-sound" aria-pressed="${this.soundOn}" aria-label="Game audio" title="Game audio">${pixelIcon('music')}</button>`,
    );
  }
  private panelShell(
    title: string,
    eyebrow: string,
    body: string,
    wide = false,
    bodyClass = '',
  ): string {
    return `<div class="panel-backdrop"></div><section class="panel ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="panel-title">${title}</h2></div><button class="icon-button" data-action="close" aria-label="Close menu">${icon('close')}</button></header><div class="panel-body${bodyClass ? ` ${bodyClass}` : ''}">${body}</div><footer class="panel-footer"><span>Your journey waits for you.</span><button class="text-button" data-action="close">Return to your journey <kbd>Esc</kbd></button></footer></section>`;
  }
  private villageSummary(state: GameState): string {
    const complete = state.villageStory === 'complete';
    const target = villageTarget(state);
    return `<section class="village-summary" aria-label="Optional village story"><button class="text-button story-track-button" data-action="track-story" data-value="village">Track village story</button><div class="village-summary-heading"><span class="chapter-icon">${icon('leaf')}</span><div><span class="eyebrow">VILLAGE STORY · OPTIONAL</span><h3>An ordinary morning</h3></div><span class="status-pill">${complete ? 'Complete' : `${state.discoveries.length} / 3`}</span></div><p>${esc(villageObjective(state))}</p><div class="discovery-cards">${discoveryOrder.map((id) => `<button class="discovery-card ${state.discoveries.includes(id) ? 'remembered' : ''}" data-action="travel" data-value="${id}">${icon(state.discoveries.includes(id) ? 'check' : id === 'olive' ? 'leaf' : 'pin')}<span>${esc(allInteractables.find((p) => p.id === id)!.name)}<small>${state.discoveries.includes(id) ? 'Remembered' : 'A memory to find'}</small></span></button>`).join('')}</div>${complete ? '<p class="village-complete">You have a place among neighbors.</p>' : `<button class="secondary-button" data-action="travel" data-value="${target}">${icon('compass')} ${state.villageStory === 'not-started' ? 'Meet Ezra' : target === 'ezra' ? 'Return to Ezra' : 'Find the next memory'} ${icon('arrow')}</button>`}</section>`;
  }
  journal(
    state: GameState,
    category = this.journalCategory,
    filter = this.journalFilter,
    status = this.journalStatus,
    trackingRefresh = false,
  ): void {
    this.flashTab('journal', false);
    const active =
      this.panel === 'journal' && this.overlay.contains(document.activeElement)
        ? document.activeElement
        : null;
    const action = active instanceof HTMLElement ? active.dataset.action : undefined;
    const value = active instanceof HTMLElement ? active.dataset.value : undefined;
    const focusFilter =
      active instanceof HTMLSelectElement && active.hasAttribute('data-journal-filter');
    // Native pointer activation may leave BODY focused, so refresh intent owns the scroll bookmark.
    const sameReading =
      trackingRefresh &&
      this.panel === 'journal' &&
      category === this.journalCategory &&
      filter === this.journalFilter &&
      status === this.journalStatus;
    const scroll = sameReading ? (this.overlay.querySelector('.panel-body')?.scrollTop ?? 0) : 0;
    const matchingActions = () =>
      [...this.overlay.querySelectorAll<HTMLElement>('[data-action]')].filter(
        (node) => node.dataset.action === action && node.dataset.value === value,
      );
    const actionIndex =
      sameReading && active instanceof HTMLElement ? matchingActions().indexOf(active) : -1;
    const restore =
      focusFilter ||
      action === 'journal-category' ||
      action === 'journal-status' ||
      (sameReading && action !== undefined);
    this.journalStatus = status;
    this.journalCategory = category;
    this.journalFilter = filter;
    const matches = (id: string) => filter === 'all' || filter === id;
    const content =
      category === 'overview'
        ? journeyOverview(state)
        : category === 'people'
          ? journalPeople(state)
          : category === 'places'
            ? journalPlaces(state)
            : category === 'memories'
              ? memoryEntries(state, filter)
              : status !== 'all' || filter === 'all'
                ? statusStories(state, status, filter)
                : `${matches('home') && (filter === 'home' || state.lake.chapter.stage === 'complete') ? homeSummary(state) : ''}${matches('main') ? `<div class="journal-summary"><span class="chapter-icon">${icon('leaf')}</span><div><h3>A place by the water</h3><p>${esc(preludeObjective(state))}</p></div><span class="status-pill">${state.quest === 'complete' ? 'Complete' : 'Chapter I'}</span></div>${state.quest === 'complete' ? '<button class="text-button" data-action="prelude-reading">Optional reading · Luke 5:4</button>' : ''}${episodeSummary(state)}` : ''}${matches('village') ? this.villageSummary(state) : ''}${campaignSummary(state, filter)}${roadSummary(state, filter)}${harborSummary(state, filter)}${galileeSummary(state, filter)}${lakeSummary(state, filter)}${matches('belonging') ? threadEvidence(state) : ''}<h2 class="recent-memories">Recent memories</h2>${memoryEntries(state, filter, 3)}<button class="secondary-button" data-action="journal-category" data-value="memories">Read all memories</button>`;
    this.show(
      'journal',
      this.panelShell(
        'A traveler’s journal',
        'PEOPLE, PLACES & SMALL DISCOVERIES',
        `${journalToolbar(category, filter)}${category === 'stories' ? statusToolbar(status) : ''}<div class="journey-tools"><button class="secondary-button" data-action="recap">Journey recap</button><button class="secondary-button" data-action="replay-library">Replay Gospel scenes</button></div>${content}<aside class="content-note"><strong>About these stories</strong><p>Into the Deep follows Luke 5:1–11; Through the Roof follows Mark 2:1–12; At the gate follows Luke 7:11–17; Peace, be still follows Mark 4:35–41. Scripture is quoted from the public-domain World English Bible. The traveler, neighbors, investigations, repairs, and connective conversations are original. Each memory preserves its own reference. All four full transcripts remain in Stories.</p></aside>`,
        true,
        'journal-reading',
      ),
      !restore && !sameReading,
    );
    if (sameReading) {
      const body = this.overlay.querySelector('.panel-body');
      if (body) body.scrollTop = scroll;
    }
    if (restore || sameReading) {
      const surface = this.overlay.firstElementChild;
      requestAnimationFrame(() => {
        // Restore the control the refresh removed, without taking later focus or a newer panel.
        if (this.panel !== 'journal' || this.overlay.firstElementChild !== surface || !focusLost())
          return;
        if (!restore) {
          // Native touch can leave BODY focused; expose its tracked row without taking focus.
          const tracked = this.overlay.querySelector<HTMLElement>(
            `[data-action="track-story"][data-value="${state.tracking}"]`,
          );
          this.revealReadingFocus(tracked);
        } else if (focusFilter) {
          const filter = this.overlay.querySelector<HTMLSelectElement>('[data-journal-filter]');
          if (filter) filter.focus({ preventScroll: true });
          else restoreFocus(this.overlay);
        } else {
          const control = sameReading ? matchingActions()[actionIndex] : undefined;
          if (control) control.focus({ preventScroll: true });
          else restoreFocus(this.overlay, action, value);
        }
        if (sameReading && restore) this.revealReadingFocus();
      });
    }
  }
  focusTrailHint(): void {
    if (this.panel !== 'journal' && this.panel !== 'context') return;
    const heading = this.overlay.querySelector<HTMLElement>('.road-hint h4');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.closest<HTMLElement>('.road-hint')?.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'instant',
    });
  }
  focusCrossing(mode: 'review' | 'feedback' | 'hint'): void {
    // Own the newly mounted reading target now; show() respects focus in this surface.
    if (this.panel !== 'journal' && this.panel !== 'context') return;
    const target = this.overlay.querySelector<HTMLElement>(
      mode === 'review'
        ? '.crossing-evidence h3'
        : mode === 'feedback'
          ? '.crossing-feedback'
          : '.crossing-hints summary',
    );
    if (!target) return;
    if (mode !== 'hint') target.tabIndex = -1;
    target.focus({ preventScroll: true });
    const reading = mode === 'hint' ? target.closest('.crossing-hints')! : target;
    reading.scrollIntoView({ block: mode === 'review' ? 'start' : 'nearest' });
  }
  inventory(state: GameState): void {
    this.flashTab('inventory', false);
    const inspected = state.inventory[0];
    const carrying = state.campaign.carrying || state.episode.carrying;
    const carriedOnly = !inspected && !!carrying;
    const inspection = (id: (typeof state.inventory)[number]): string =>
      `<div class="satchel-inspection-art">${itemArtwork(id, items[id].icon)}</div><div><span class="eyebrow">EXAMINE · QUEST ITEM</span><strong>${esc(items[id].name)}</strong><p>${esc(items[id].description)}</p></div>`;
    const slots = Array.from({ length: 4 }, (_, index) => {
      const id = state.inventory[index];
      return id
        ? `<article class="satchel-slot" role="listitem"><button class="satchel-slot-button" data-inventory-item="${id}" aria-label="Examine ${esc(items[id].name)}" aria-pressed="${id === inspected}" aria-controls="satchel-inspection" title="${esc(items[id].name)}">${itemArtwork(id, items[id].icon)}<span class="satchel-quantity" aria-hidden="true">1</span></button><h3>${esc(items[id].name)}</h3></article>`
        : `<div class="satchel-slot satchel-slot-empty" role="listitem" aria-label="Empty satchel space"><span class="satchel-empty-mark" aria-hidden="true">${icon('bag')}</span><span>Empty</span></div>`;
    }).join('');
    this.show(
      'inventory',
      this.panelShell(
        'Your satchel',
        'A FEW THINGS FOR THE ROAD',
        `<section class="satchel-surface${carriedOnly ? ' satchel-carried-only' : ''}" aria-label="Satchel contents"><div class="satchel-capacity">${icon('bag')}<span>${state.inventory.length} / 4 spaces used</span><span class="satchel-help">${inspected ? 'Select an item to examine it' : carrying ? 'Carried supplies appear below' : 'Four spaces for small quest items'}</span></div><div class="satchel-slots" role="list" aria-label="Satchel spaces">${slots}</div>${carriedOnly ? '' : `<section id="satchel-inspection" class="satchel-inspection" aria-label="Item inspection" aria-live="polite">${inspected ? inspection(inspected) : `<div class="satchel-inspection-art">${icon('bag')}</div><div><strong>Your satchel is light.</strong><p>The people of Capernaum may have something for you to carry.</p></div>`}</section>`}${state.inventory.length ? '<div class="satchel-return"><p>Bring these supplies to Simon by the boats.</p><button class="secondary-button" data-action="travel" data-value="simon">Find Simon ' + icon('arrow') + '</button></div>' : ''}<div class="satchel-carried">${carriedView(state)}</div>${state.episode.carrying ? `<article class="satchel-carried carried-object"><span class="item-art">${itemArtwork('empty-basket')}</span><div><span class="eyebrow">IN YOUR HANDS</span><h3>Empty basket</h3><p>Carry it to the landing beside Simon’s boats. It does not use a satchel space.</p><button class="secondary-button" data-action="travel" data-value="landing">Walk to the landing</button></div></article>` : ''}</section>`,
      ),
    );
    // Inspecting supplies changes this reading surface only; it never dispatches a game event.
    const buttons = [...this.overlay.querySelectorAll<HTMLButtonElement>('[data-inventory-item]')];
    const examine = (button: HTMLButtonElement): void => {
      const id = state.inventory.find((item) => item === button.dataset.inventoryItem);
      const surface = this.overlay.querySelector<HTMLElement>('#satchel-inspection');
      if (!id || !surface) return;
      for (const slot of buttons) slot.setAttribute('aria-pressed', String(slot === button));
      surface.innerHTML = inspection(id);
    };
    for (const [index, button] of buttons.entries()) {
      button.addEventListener('click', () => examine(button));
      // Right-click offers the item's options, as the classic inventory does.
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.itemMenu(button, event.clientX, event.clientY, () => examine(button));
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        const next =
          buttons[
            (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
          ]!;
        next.focus();
        examine(next);
      });
    }
    if (state.campaign.carrying) {
      const art = this.overlay.querySelector<HTMLElement>('.satchel-carried .item-art');
      if (art) art.innerHTML = itemArtwork(state.campaign.carrying);
    }
  }
  map(state: GameState, regional = false): void {
    const active = document.activeElement;
    const action =
      this.panel === 'map' &&
      active instanceof HTMLElement &&
      this.overlay.contains(active) &&
      active.closest('.map-tabs')
        ? active.dataset.action
        : undefined;
    const restore = action === 'local-map' || action === 'journey-map';
    const showMap = (content: string): void => {
      this.show('map', content, !restore);
      if (!restore) return;
      const surface = this.overlay.firstElementChild;
      requestAnimationFrame(() => {
        if (this.panel !== 'map' || this.overlay.firstElementChild !== surface || !focusLost())
          return;
        restoreFocus(this.overlay, action);
        this.revealReadingFocus();
      });
    };
    if (regional) {
      showMap(
        this.panelShell(
          'Your journey through Galilee',
          'CONNECTED PLACES',
          `<nav class="map-tabs" aria-label="Map views"><button class="secondary-button" data-action="local-map" aria-pressed="false">Local destinations</button><button class="secondary-button" data-action="journey-map" aria-pressed="true">Journey map</button></nav>${journeyMap(state)}`,
          true,
        ),
      );
      return;
    }
    if (regions[state.region].mode === 'presentation') {
      showMap(
        this.panelShell(
          regions[state.region].title,
          'A NARRATED GOSPEL ACCOUNT',
          '<p class="panel-lead">Your traveler waits while the narrated scenes present the Gospel account. Return to exploration whenever you wish; your scene checkpoint will be kept.</p><button class="primary-button" data-action="scene-leave">Return to your traveler</button>',
        ),
      );
      return;
    }
    const starts = storyStarts(state);
    showMap(
      this.panelShell(
        regions[state.region].title,
        'LOCAL PEOPLE AND PLACES',
        `<nav class="map-tabs" aria-label="Map views"><button class="secondary-button" data-action="local-map" aria-pressed="true">Local destinations</button><button class="secondary-button" data-action="journey-map" aria-pressed="false">Journey map</button></nav><p class="panel-lead">Choose a person or place to approach it. Your traveler or boat will follow a clear route.</p><div class="map-layout"><div class="large-map">${this.mapSvg(true, state.position, state)}<span class="large-map-north">N ${icon('arrow')}</span>${state.region === 'capernaum' ? '<span class="lake-label">Sea of<br>Galilee</span>' : ''}</div><div class="map-destinations">${activeInteractables(
          state,
        )
          .map(
            (p) =>
              `<button data-action="travel" data-value="${p.id}">${icon(p.kind === 'person' ? 'person' : 'pin')}<span>${p.name}<small>${state.discoveries.some((id) => id === p.id) ? 'Remembered in your journal' : p.id === objectiveTarget(state) && !trackedChapter(state).complete(state) ? 'Next stop' : starts.has(p.id) ? 'A story to begin' : p.role}</small></span>${icon('arrow')}</button>`,
          )
          .join(
            '',
          )}</div></div><div class="map-legend"><span><i class="legend-player" aria-hidden="true"></i> You are here</span><span><i class="legend-person" aria-hidden="true"></i> People</span><span><i class="legend-place" aria-hidden="true"></i> Places</span><span><i class="legend-quest" aria-hidden="true"></i> Story to begin</span>${state.region === 'capernaum' ? mapIconNames.map((name) => `<span>${mapIconSwatch(name)} ${MAP_ICON_LABELS[name]}</span>`).join('') : ''}<span>${state.region === 'capernaum' ? state.discoveries.length + ' / 3 places remembered' : 'Paths remain open for your return'}</span></div>`,
        true,
      ),
    );
    this.markMaps(state);
  }
  settings(settings: Settings, slots: SlotSummary[], persistent: boolean, started: boolean): void {
    const wasSettings = this.panel === 'settings';
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restore = wasSettings && !!active && this.overlay.contains(active);
    const action = active?.dataset.action;
    const value = active?.dataset.value;
    const setting = active?.dataset.setting;
    const id = active?.id;
    const scroll = this.overlay.querySelector('.panel-body')?.scrollTop ?? 0;
    this.show(
      'settings',
      this.panelShell(
        'A moment of rest',
        'SETTINGS & SAVED JOURNEYS',
        `<div class="settings-grid"><div>${audioSettings(settings, this.currentState, this.heardTracks, this.chosenTrack)}<h3>Your experience</h3><label class="setting-row"><span>Visual quality<small>Lower quality saves battery</small></span><select data-setting="quality"><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low</option></select></label><label class="setting-row"><span>Reduce motion<small>Still water and immediate camera follow</small></span><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}></label><label class="setting-row"><span>Exploration guidance<small>Full labels and routes, or nearby labels with quieter paths. Maps remain available.</small></span><select data-setting="guidance"><option value="full" ${settings.guidance !== 'explore' ? 'selected' : ''}>Full guidance</option><option value="explore" ${settings.guidance === 'explore' ? 'selected' : ''}>Explore with fewer markers</option></select></label><label class="setting-row"><span>Reading size<small>Dialogue, scripture and journal text</small></span><select data-setting="textSize"><option value="standard" ${settings.textSize === 'standard' ? 'selected' : ''}>Standard</option><option value="large" ${settings.textSize === 'large' ? 'selected' : ''}>Large</option></select></label><button class="secondary-button full-width" data-action="help">${icon('help')} Controls &amp; how to play</button><button class="secondary-button full-width" data-action="replay-opening">${icon('dawn')} Watch the opening again</button></div><div><h3>Saved journeys</h3><p class="settings-note">${persistent ? 'Progress autosaves as you explore. Manual slots keep a moment you can return to.' : 'Browser storage is unavailable. These slots last only this session. Export a file to keep your journey.'}</p><div class="save-slots">${slots.map((slot) => `<div class="save-slot"><span class="slot-icon">${icon('save')}</span><div><strong>${slot.id === 'auto' ? 'Autosave' : `Journey ${slot.id.at(-1)}`}</strong><small>${slot.error ? 'Unreadable save' : slot.save ? `${regions[slot.save.state.region].title + (slot.save.state.lake.chapter.stage === 'complete' ? ' · Chapter IV complete' : slot.save.state.lake.chapter.checkpoint ? ' · ' + esc(accounts.storm.scenes.find((scene) => scene.id === slot.save?.state.lake.chapter.checkpoint)!.title) : slot.save.state.road.chapter.stage === 'complete' ? ' · Chapter III complete' : slot.save.state.road.chapter.checkpoint ? ' · ' + esc(accounts.nain.scenes.find((scene) => scene.id === slot.save?.state.road.chapter.checkpoint)!.title) : slot.save.state.campaign.roof.stage === 'complete' ? ' · Chapter II complete' : slot.save.state.campaign.roof.checkpoint ? ' · ' + esc(accounts.roof.scenes.find((scene) => scene.id === slot.save?.state.campaign.roof.checkpoint)!.title) : '')} · ${esc(new Date(slot.save.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}` : 'Empty slot'}</small></div>${slot.id !== 'auto' ? `<button class="small-button" data-action="save-slot" data-value="${slot.id}" ${started ? '' : 'disabled'}>Save</button>` : ''}<button class="small-button" data-action="load-slot" data-value="${slot.id}" ${slot.save ? '' : 'disabled'}>Load</button></div>`).join('')}</div><div class="save-actions"><button class="secondary-button" data-action="export" ${started ? '' : 'disabled'}>${icon('download')} Export</button><label class="secondary-button import-button">${icon('upload')} Import<input type="file" id="import-save" accept=".json,application/json" aria-label="Import a journey save"></label></div></div></div>${started ? '<button class="text-button new-journey" data-action="new-journey">Start a new journey…</button>' : ''}`,
        true,
      ),
      !wasSettings,
    );
    if (!wasSettings) return;
    const body = this.overlay.querySelector('.panel-body');
    if (body) body.scrollTop = scroll;
    const surface = this.overlay.firstElementChild;
    requestAnimationFrame(() => {
      // A save refresh must keep the selected slot, while respecting any newer focus or menu.
      if (this.panel !== 'settings' || this.overlay.firstElementChild !== surface || !focusLost())
        return;
      if (restore) {
        const control = [...this.overlay.querySelectorAll<HTMLElement>('[data-setting],[id]')].find(
          (node) => (setting && node.dataset.setting === setting) || (id && node.id === id),
        );
        if (control) control.focus({ preventScroll: true });
        else restoreFocus(this.overlay, action, value);
        this.revealReadingFocus();
      }
    });
  }
  help(): void {
    this.hints.reset();
    this.setHintsFaded(false);
    const sailing = this.currentState?.region === 'galilee-water';
    const rows = [
      [
        sailing ? 'Click / tap open water' : 'Click / tap the ground',
        sailing ? 'Steer to a point' : 'Walk to a place',
      ],
      [
        'Click / tap the minimap',
        sailing
          ? 'Steer to that point; the flag clears when you arrive'
          : 'Walk to that point; the flag clears when you arrive',
      ],
      ['Compass / map orb or LOCAL MAP', 'Face north / open local destinations'],
      ['Right-click the compass', 'Look north, east, south or west'],
      ['Run orb beside the map', 'Run or walk; energy refills as you walk'],
      ['Emotes tab', 'Wave, bow, cheer, clap and other gestures'],
      ['1–9 / Space in conversation', 'Choose an answer / continue a single answer'],
      ['Enter (desktop)', 'Say something aloud in the chatbox; Escape returns to the world'],
      [
        'Click / tap a person or object',
        sailing
          ? 'Steer over and interact; names and map destinations work too'
          : 'Walk over and interact; names and map destinations work too',
      ],
      ['Right-click / hold a world target', 'Choose an action'],
      [
        'World name: Shift+F10 / Menu key',
        'Open Choose Option; ↑ / ↓ selects, Enter confirms, Escape cancels',
      ],
      [
        'W A S D / arrow keys',
        sailing ? 'Steer relative to the camera' : 'Move relative to the camera',
      ],
      ['E', 'Interact with a nearby person or place'],
      ['Middle or right mouse drag / two fingers', 'Rotate the camera'],
      ['Mouse wheel / pinch / zoom buttons', 'Zoom in or out'],
      ['Q / rotate buttons', 'Rotate the view'],
      ['R', 'Reset the camera'],
      ['J / I / M', 'Journal / satchel / map'],
      ['Escape', 'Pause or close a menu'],
    ];
    this.show(
      'help',
      this.panelShell(
        'Find your own pace',
        'A LITTLE GUIDANCE',
        `<p class="panel-lead">Follow the chapter card to continue your current story, or wander and explore at your own pace. There is no combat or timer. If a route doesn't match the clues, your observations stay in the journal and you can try again.</p><dl class="controls-list">${rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="content-note">Progress is stored in this browser. Export a save from Settings before clearing browser data or changing devices.</p>`,
      ),
    );
  }
  private measureWork(): void {
    layoutDialogueReading(this.overlay);
    const reading = this.sceneControls.hidden
      ? undefined
      : this.sceneControls.getBoundingClientRect();
    this.actions.readingLayout?.(
      reading
        ? { left: reading.left, top: reading.top, right: reading.right, bottom: reading.bottom }
        : undefined,
    );
    const panel = this.overlay.querySelector<HTMLElement>('.work-panel');
    const bounds = panel?.getBoundingClientRect();
    this.actions.workLayout?.(
      bounds
        ? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
        : undefined,
    );
    const conversation = this.overlay.querySelector<HTMLElement>('[data-conversation-person]');
    if (conversation) {
      const r = conversation.getBoundingClientRect();
      this.actions.presentationLayout?.(
        conversation.dataset.conversationPerson,
        { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        this.conversationPaused,
      );
    } else this.actions.presentationLayout?.();
  }
  private decorateConversation(idOrName: string): void {
    const person = personIdentity(idOrName);
    const surface = this.overlay.querySelector<HTMLElement>('[role="dialog"]');
    if (!person || !surface) return;
    surface.dataset.conversationPerson = person.id;
    this.workObserver?.observe(surface);
    this.root.classList.add('conversing');
    this.overlay.classList.add('conversation-overlay');
    if (this.panel === 'context') surface.classList.add('conversation-context');
    const portrait = this.overlay.querySelector('.dialogue-portrait');
    const art = `<img src="${esc(portraitUrl(person.asset))}" width="192" height="224" alt="" decoding="async" class="speaker-portrait"/>`;
    if (portrait) portrait.innerHTML = art;
    else
      surface
        .querySelector('.panel-header')
        ?.insertAdjacentHTML('afterbegin', `<div class="context-portrait">${art}</div>`);
    const header = surface.querySelector('header');
    header?.insertAdjacentHTML(
      'beforeend',
      `<button class="conversation-motion text-button" data-action="conversation-pause" aria-pressed="${this.conversationPaused}">${this.conversationPaused ? 'Resume motion' : 'Pause motion'}</button>`,
    );
    this.measureWork();
  }
  toggleObjective(): void {
    this.objectiveExpanded = !this.objectiveExpanded;
    this.renderObjective();
    this.pendingQuestReveal =
      this.quest.querySelector<HTMLElement>('.objective-toggle') ?? undefined;
    this.placeNotice(true);
  }
  private renderObjective(): void {
    this.quest.classList.toggle('objective-expanded', this.objectiveExpanded);
    this.quest
      .querySelectorAll<HTMLElement>('.quest-details')
      .forEach((el) => (el.hidden = !this.objectiveExpanded));
    const toggle = this.quest.querySelector<HTMLButtonElement>('.objective-toggle');
    if (toggle) {
      toggle.textContent = this.objectiveExpanded ? 'Hide steps' : 'Show steps';
      toggle.setAttribute('aria-expanded', String(this.objectiveExpanded));
    }
  }
  work(state: GameState, target: string, feedback = '', preview?: ScreenPreview): boolean {
    if (!workTarget(state, target)) return false;
    const wasWork = this.panel === 'work';
    const active =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const restore = wasWork && !!active && this.overlay.contains(active);
    const action = active?.dataset.action,
      value = active?.dataset.value;
    const hintAction =
      action === 'galilee-hint' || (action === 'harbor-action' && value === 'hint');
    const open = [...this.overlay.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
      (node) => node.className,
    );
    const previous = this.overlay.querySelector<HTMLElement>('.work-panel');
    const newFeedback =
      !!feedback.trim() &&
      (previous?.dataset.workTarget !== target ||
        previous?.querySelector('.work-result')?.textContent?.trim() !== feedback.trim());
    const scroll = this.overlay.querySelector('.work-body')?.scrollTop ?? 0;
    // Mount an empty live region before updating its text, so feedback is announced
    // even when an action also replaces the list of available controls.
    this.show('work', workSurface(state, target, '', preview), !wasWork);
    const surface = this.overlay.firstElementChild;
    if (wasWork) {
      this.overlay.querySelectorAll<HTMLDetailsElement>('details').forEach((node) => {
        if (open.includes(node.className)) node.open = true;
      });
      const body = this.overlay.querySelector('.work-body');
      if (body) body.scrollTop = scroll;
    }
    const body = this.overlay.querySelector<HTMLElement>('.work-body');
    const readingTop = body?.scrollTop;
    const focusOwner = document.activeElement;
    requestAnimationFrame(() => {
      if (this.overlay.firstElementChild !== surface) return;
      this.measureWork();
      const focusTaken = wasWork && document.activeElement !== focusOwner && !focusLost();
      // Restore only focus the re-render dropped; a control focused since then keeps it.
      if (restore && focusLost()) {
        const summary =
          hintAction && !this.overlay.querySelector('.work-hints button')
            ? this.overlay.querySelector<HTMLElement>('.work-hints summary')
            : undefined;
        if (summary) summary.focus();
        else restoreFocus(this.overlay, action, value, active?.dataset.workId);
      }
      const result = this.overlay.querySelector('.work-result');
      if (!result) return;
      const readingUnchanged = body?.scrollTop === readingTop;
      result.textContent = feedback;
      if (!body || focusTaken || !readingUnchanged) return;
      // The temporary empty live region can clamp scrolling or move a browser anchor.
      // Restore the owned position after its text has regained its actual height.
      if (wasWork && body.scrollTop !== scroll) body.scrollTop = scroll;
      if (!newFeedback) return;
      // Reveal only a new result, without moving focus or any outer reading surface.
      const viewport = body.getBoundingClientRect();
      const top = viewport.top + body.clientTop;
      const bottom = top + body.clientHeight;
      const message = result.getBoundingClientRect();
      if (message.height > body.clientHeight || message.top < top)
        body.scrollTop += message.top - top;
      else if (message.bottom > bottom) body.scrollTop += message.bottom - bottom;
    });
    return true;
  }
  addWorkReturn(target: string): void {
    const entry = this.overlay.querySelector<HTMLElement>('[data-action="work-open"]');
    if (entry) entry.textContent = 'Return to the work';
    else
      this.overlay
        .querySelector('.panel-body,.dialogue-main')
        ?.insertAdjacentHTML(
          'beforeend',
          '<button class="secondary-button return-to-work" data-action="work-open" data-value="' +
            esc(target) +
            '">Return to the work</button>',
        );
  }
  addWorkEntry(target: string): void {
    this.overlay
      .querySelector('.dialogue-choices')
      ?.insertAdjacentHTML(
        'afterend',
        '<button class="secondary-button" data-action="work-open" data-value="' +
          esc(target) +
          '">Work in the world</button>',
      );
  }
  private regionBusy = false;
  private actionPending = false;
  private worldPaused = true;
  private graphicsPaused = false;
  private pausedWorldFocus?: HTMLButtonElement;
  setGraphicsPaused(paused: boolean): void {
    this.graphicsPaused = paused;
    this.root.dataset.graphicsPaused = String(paused);
    if (paused) {
      this.activeWalkTarget = undefined;
      this.renderTravelStatus();
    }
    this.pauseWorldControls();
  }
  setWorldPaused(paused: boolean): void {
    this.worldPaused = paused;
    this.minimap.setPaused(paused);
    // World.setPaused stops its path; reflect that handoff even without a render frame.
    if (paused) {
      this.activeWalkTarget = undefined;
      this.minimap.clearDestination();
      this.renderTravelStatus();
    }
    this.labels.inert = paused;
    for (const control of this.hud.querySelectorAll<HTMLElement>(
      '#action-tray, #nearby-action, .camera-controls',
    ))
      control.inert = paused;
    this.pauseWorldControls();
  }
  private pauseWorldControls(): void {
    let pausedInspection = false;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
      if (
        !button.hasAttribute('data-world-action') &&
        !requiresWorldView(button.dataset.action!, button.dataset.value)
      )
        continue;
      const paused = this.graphicsPaused || (this.panel === 'work' && this.worldPaused);
      if (this.graphicsPaused && this.panel !== 'work' && this.overlay.contains(button))
        pausedInspection = true;
      if (paused) {
        if (button.dataset.pauseDisabled === undefined) {
          button.dataset.pauseDisabled = String(button.disabled);
          if (document.activeElement === button) this.pausedWorldFocus = button;
        }
        button.disabled = true;
      } else if (button.dataset.pauseDisabled !== undefined) {
        button.disabled = button.dataset.pauseDisabled === 'true';
        delete button.dataset.pauseDisabled;
      }
    }
    const note = this.overlay.querySelector('[data-graphics-pause]');
    if (!pausedInspection) note?.remove();
    else if (!note) {
      const message = document.createElement('p');
      message.className = 'held-notice';
      message.dataset.graphicsPause = '';
      message.setAttribute('role', 'status');
      message.textContent = 'Graphics paused. Physical actions will resume when the view returns.';
      const body = this.overlay.querySelector('.panel-body,.dialogue-main');
      const header = body?.querySelector(':scope > header');
      if (header) header.after(message);
      else body?.prepend(message);
    }
    this.renderCameraDisclosure();
    if (
      this.pausedWorldFocus &&
      !this.graphicsPaused &&
      (this.panel !== 'work' || !this.worldPaused) &&
      // Context restoration precedes syncPause; wait until the disclosure is live.
      (this.pausedWorldFocus !== this.cameraToggle || !this.worldPaused)
    ) {
      const button =
        this.pausedWorldFocus === this.cameraToggle && this.cameraToggle.hidden
          ? this.cameraCommands.querySelector<HTMLButtonElement>('[data-action="reset-camera"]')!
          : this.pausedWorldFocus;
      this.pausedWorldFocus = undefined;
      if (button.isConnected && !button.disabled && focusLost())
        button.focus({ preventScroll: true });
    }
  }
  setActionPending(pending: boolean): void {
    this.actionPending = pending;
    this.root.dataset.actionPending = String(pending);
    this.root.setAttribute('aria-busy', String(pending || this.regionBusy));
  }
  setBusy(busy: boolean): void {
    this.regionBusy = busy;
    this.root.inert = busy;
    this.root.setAttribute('aria-busy', String(busy || this.actionPending));
  }
  setScenePaused(paused: boolean): void {
    this.scenePaused = paused;
    if (this.currentState && isPresenting(this.currentState)) {
      const button = this.sceneControls.querySelector<HTMLButtonElement>(
        '[data-action="scene-pause"]',
      );
      if (button) {
        button.textContent = paused ? 'Resume motion' : 'Pause motion';
        button.setAttribute('aria-pressed', String(paused));
      }
    }
  }
  focusScene(): void {
    this.sceneControls.querySelector<HTMLElement>('.scene-continue')?.focus();
  }
  transcript(state: GameState, chapter?: string): void {
    const account =
      chapter === 'lake' || chapter === 'roof' || chapter === 'nain' || chapter === 'storm'
        ? chapter
        : accountFor(state);
    this.show(
      'transcript',
      this.panelShell(
        account === 'storm'
          ? 'Peace, be still · Transcript'
          : account === 'nain'
            ? 'At the gate · Transcript'
            : account === 'roof'
              ? 'Through the Roof · Transcript'
              : 'Words beside the water',
        'THE COMPLETE SCENE TRANSCRIPT',
        account === 'storm'
          ? stormTranscript()
          : account === 'nain'
            ? nainTranscript()
            : account === 'roof'
              ? roofTranscript()
              : transcriptView(state),
        true,
      ),
    );
  }
  sceneSummary(state: GameState): void {
    this.show(
      'scene-summary',
      this.panelShell(
        'Finish with a summary',
        'CONTINUE AT YOUR OWN PACE',
        state.region === 'storm-account'
          ? stormSummary(state)
          : state.region === 'nain-account'
            ? nainSummary(state)
            : state.region === 'roof-account'
              ? roofSummary(state)
              : sceneSummaryView(state),
      ),
    );
  }
  recap(state: GameState): void {
    this.show(
      'recap',
      this.panelShell('Your journey so far', 'RETURN AT YOUR OWN PACE', recap(state), true),
    );
  }
  replayLibrary(state: GameState): void {
    this.show(
      'replay-library',
      this.panelShell(
        'Gospel scene library',
        'REVISIT A COMPLETED ACCOUNT',
        replayLibrary(state),
        true,
      ),
    );
  }
  diagnostics(data: Diagnostics): void {
    const rows = Object.entries(data)
      .filter(([key]) => key !== 'assets' && key !== 'inventory')
      .map(
        ([key, value]) =>
          '<tr><th scope="row">' + esc(key) + '</th><td>' + esc(String(value)) + '</td></tr>',
      )
      .join('');
    this.show(
      'diagnostics',
      this.panelShell(
        'Local rendering snapshot',
        'DIAGNOSTICS · NO TELEMETRY',
        '<p>This snapshot describes this browser and graphics setting. FPS is sampled immediately before opening this panel; it is not a hardware compatibility certification.</p><table class="diagnostics-table">' +
          rows +
          '</table><h3>Authored assets</h3><p>Placed geometry, enabled geometry, and geometry submitted in the most recent frame. Offscreen objects may be enabled without being drawn.</p><table class="asset-diagnostics"><thead><tr><th>Asset</th><th>Placed</th><th>Enabled</th><th>Drawn</th></tr></thead><tbody>' +
          Object.entries(data.assets)
            .map(
              ([id, a]) =>
                `<tr data-asset="${esc(id)}"><th scope="row">${esc(id)}</th><td>${a.placed}</td><td>${a.enabled}</td><td>${a.drawn}</td></tr>`,
            )
            .join('') +
          '</tbody></table><details><summary>Region download inventory · ' +
          data.inventory.length +
          ' assets</summary><p>' +
          esc(data.inventory.join(', ')) +
          '</p></details>',
      ),
    );
  }
  dialogue(dialogue: Dialogue): void {
    this.show(
      'dialogue',
      `<section class="dialogue-box" role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker"><div class="dialogue-portrait">${icon(dialogue.provenance === 'Original narration' ? 'leaf' : 'person')}<span>${icon('marker')}</span></div><div class="dialogue-main"><header><div><h2 id="dialogue-speaker">${dialogue.speaker}</h2><p>${dialogue.subtitle}</p></div><button class="icon-button" data-action="close" aria-label="Leave conversation">${icon('close')}</button></header><p class="dialogue-text reveal ${dialogue.provenance === 'Scripture · WEB' ? 'scripture' : ''}">${dialogue.text}</p><div class="dialogue-choices">${dialogue.choices.map((choice, index) => `<button data-action="choice" data-value="${index}" ${requiresWorldEvent(choice.event) ? 'data-world-action' : ''}><span class="choice-index"><span>${index + 1}</span></span>${choice.label}${icon('arrow')}</button>`).join('')}</div><div class="dialogue-source">${icon(dialogue.provenance === 'Scripture · WEB' ? 'scroll' : dialogue.provenance === 'Original narration' ? 'memory' : 'quote')}<span>${dialogue.provenance}${dialogue.reference ? ` <span>·</span> ${dialogue.reference}` : ''}</span></div></div></section>`,
    );
    this.startReveal();
    this.noteInteraction();
    if (dialogue.provenance !== 'Original narration') this.decorateConversation(dialogue.speaker);
  }
  confirmNew(): void {
    this.show(
      'settings',
      this.panelShell(
        'Begin again?',
        'A NEW JOURNEY',
        `<p class="panel-lead">Starting again replaces your autosave. Your three manual save slots will stay available. Save or export your current journey first if you want to keep it.</p><div class="confirm-actions"><button class="primary-button" data-action="confirm-new">Begin a new journey ${icon('arrow')}</button><button class="secondary-button" data-action="settings">Back to saves</button></div>`,
      ),
    );
  }
  context(id: string, state: GameState): boolean {
    const view = harborContext(id, state) ?? homeContext(id, state) ?? contextView(id, state);
    if (!view) return false;
    this.noteInteraction();
    this.show(
      'context',
      this.panelShell(
        esc(view.title),
        'PEOPLE & PLACES',
        (workTarget(state, id)
          ? '<button class="secondary-button" data-action="work-open" data-value="' +
            esc(id) +
            '">Work in the world</button>'
          : '') + view.body,
      ),
    );
    this.decorateConversation(id);
    return true;
  }
  private mapSvg(large: boolean, position?: Point, state?: GameState): string {
    if (state) {
      const local = neighborhoodMap(state, large, position);
      if (local) return local;
    }
    const id = large ? 'large-map-player' : 'minimap-player';
    const shorePoints = Array.from({ length: 25 }, (_, i) => {
      const z = 24 - i * 2;
      return `${(shoreline(z) + 24) * 4},${i * 8}`;
    }).join(' ');
    return `<svg class="map-svg" viewBox="0 0 192 192" aria-label="Map of Capernaum"><rect width="192" height="192" fill="#4f7f9a"/><path d="M0 0H${(shoreline(24) + 24) * 4} ${shorePoints
      .split(' ')
      .map((p) => `L${p}`)
      .join(' ')}H0Z" fill="#6c8a41"/><path d="M${(shoreline(24) + 24) * 4} 0 ${shorePoints
      .split(' ')
      .map((p) => `L${p}`)
      .join(
        ' ',
      )}" fill="none" stroke="#ddd0a0" stroke-width="8"/>${capernaumMapScenery()}${capernaumMapIcons()
      .map(
        (i) =>
          `<g class="map-icon" data-map-icon="${i.name}" transform="translate(${(i.at.x + 24) * 4},${(24 - i.at.z) * 4})"><g class="map-icon-glyph"${large ? ' transform="scale(0.65)"' : ''}>${mapIconGlyph(i.name)}</g></g>`,
      )
      .join(
        '',
      )}${(state ? activeInteractables(state) : allInteractables).map((p) => `<circle data-map-place="${p.id}" data-map-kind="${p.kind}" class="${state?.discoveries.some((id) => id === p.id) ? 'map-remembered' : ''} ${state && p.id === objectiveTarget(state) && !trackedChapter(state).complete(state) ? 'map-target' : ''}" cx="${(p.x + 24) * 4}" cy="${(24 - p.z) * 4}" r="${large ? 2.6 : 2}" fill="#f2dfaa" stroke="#665d43" stroke-width="1"/>`).join('')}<g id="${id}" transform="translate(${((position?.x ?? -1) + 24) * 4},${(24 - (position?.z ?? -3)) * 4})"><circle r="5" fill="#233b36" stroke="#e8d390" stroke-width="1.5"/><path d="m0-3 2 5-2-1-2 1z" fill="#fff1c4"/></g></svg>`;
  }
  dispose(): void {
    this.clearQuestNoticeSpace();
    this.shortLandscape.removeEventListener('change', this.onNoticeLayout);
    window.removeEventListener('resize', this.onMenuResize);
    this.noticeActions.removeEventListener('scroll', this.onActionScroll);
    this.routeGuidance.removeEventListener('scroll', this.onRouteScroll);
    this.root.removeEventListener('keydown', this.onRouteKey);
    if (this.routeCueFrame !== undefined) cancelAnimationFrame(this.routeCueFrame);
    this.toastNode.removeEventListener('animationend', this.onPausedNoticeLayout);
    this.actionScrollObserver.disconnect();
    this.minimap.dispose();
    this.workObserver?.disconnect();
    clearTimeout(this.toastTimer);
    clearTimeout(this.revealTimer);
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('change', this.onChange);
    this.root.removeEventListener('input', this.onInput);
    this.root.removeEventListener('pointerdown', this.onPointer);
    this.interfaceHint.remove();
    this.root.removeEventListener('pointerover', this.onInterfaceHover);
    this.root.removeEventListener('pointerleave', this.onInterfaceHover);
    window.removeEventListener('keydown', this.onKey);
  }
}
