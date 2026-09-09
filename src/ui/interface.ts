import { chapters } from '../content/campaign/chapters';
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
import { allInteractables, activeInteractables, buildings, shoreline } from '../content/region';
import { items, journalEntries, type Dialogue } from '../content/story';
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

export type Panel =
  | 'journal'
  | 'inventory'
  | 'map'
  | 'settings'
  | 'help'
  | 'welcome'
  | 'dialogue'
  | 'transcript'
  | 'context'
  | 'scene-summary'
  | 'diagnostics'
  | null;
export interface UIActions {
  action: (name: string, value?: string) => void;
  setting: (key: keyof Settings, value: string | boolean) => void;
  importFile: (file: File) => void;
}

export class Interface {
  panel: Panel = null;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private labels: HTMLElement;
  private quest: HTMLElement;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private focusBefore?: HTMLElement;
  private labelNodes = new Map<string, HTMLElement>();
  private active = false;
  private currentState?: GameState;
  private scenePaused = false;
  private sceneControls: HTMLElement;
  private lastNearest: string | null = null;
  private onClick: (e: MouseEvent) => void;
  private onChange: (e: Event) => void;
  private onKey: (e: KeyboardEvent) => void;

  constructor(
    private root: HTMLElement,
    private actions: UIActions,
  ) {
    root.innerHTML = `
      <div class="world-vignette"></div>
      <div id="hud" hidden>
        <header class="topbar"><div class="brand"><span class="brand-mark">✧</span><span>The Way<small>A JOURNEY THROUGH GALILEE</small></span></div>
        <div class="region-title"><span class="location-diamond">${icon('pin')}</span><span>CAPERNAUM<small>Northern shore · Galilee</small></span></div>
        <nav class="toolbar" aria-label="Game menus"><button data-action="journal" title="Travel journal (J)">${icon('journal')}<span>Journal</span><kbd>J</kbd></button><button data-action="inventory" title="Satchel (I)">${icon('bag')}<span>Satchel</span><kbd>I</kbd></button><button data-action="map" title="Village map (M)">${icon('map')}<span>Map</span><kbd>M</kbd></button><span class="toolbar-divider"></span><button class="icon-button" data-action="settings" aria-label="Settings and saves">${icon('settings')}</button></nav></header>
        <aside id="quest-card" class="quest-card" aria-label="Current quest"></aside>
        <div class="time-of-day">${icon('sun')}<span>A quiet morning</span></div>
        <div id="world-labels" class="world-labels" aria-label="People and places"></div>
        <div class="traveler-card"><div class="traveler-seal">${icon('person')}</div><div><span class="eyebrow">THE TRAVELER</span><p>A willing pair of hands</p><small id="save-indicator">Your journey is saved locally</small></div></div>
        <div class="bottom-center"><button id="nearby-action" class="nearby-action" data-action="nearest" hidden></button><div class="control-hints"><span>${icon('mouse')} Click to walk</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span>Right-drag to look</span><button data-action="help" aria-label="Show all controls">${icon('help')}</button></div></div>
        <div class="minimap-wrap"><button class="minimap" data-action="map" aria-label="Open village map">${this.mapSvg(false)}<span class="map-north">N</span><span class="minimap-name">SHORES OF GALILEE</span></button><div class="camera-controls"><button data-action="rotate-left" aria-label="Rotate camera left">↶</button><button data-action="reset-camera" aria-label="Reset camera">${icon('compass')}</button><button data-action="rotate-right" aria-label="Rotate camera right">↷</button><span></span><button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">−</button></div></div>
      </div>
      <section id="scene-controls" class="scene-controls" aria-labelledby="scene-title" hidden></section><div id="overlay"></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
      <div id="announcer" class="sr-only" aria-live="polite"></div>`;
    this.overlay = root.querySelector('#overlay')!;
    this.sceneControls = root.querySelector('#scene-controls')!;
    this.hud = root.querySelector('#hud')!;
    this.labels = root.querySelector('#world-labels')!;
    this.quest = root.querySelector('#quest-card')!;
    for (const p of allInteractables) {
      const button = document.createElement('button');
      button.className = `world-label ${p.kind}`;
      button.dataset.action = 'navigate';
      button.dataset.value = p.id;
      button.setAttribute(
        'aria-label',
        `${p.kind === 'person' ? 'Speak with' : 'Visit'} ${p.name}`,
      );
      button.innerHTML = `<span class="label-symbol">${p.kind === 'person' ? '◇' : '·'}</span><span class="label-name">${esc(p.name)}</span>`;
      this.labels.append(button);
      this.labelNodes.set(p.id, button);
    }
    this.onClick = (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (button && !button.hasAttribute('disabled'))
        this.actions.action(button.dataset.action!, button.dataset.value);
    };
    this.onChange = (e) => {
      const input = e.target as HTMLInputElement;
      if (input.id === 'import-save' && input.files?.[0]) {
        this.actions.importFile(input.files[0]);
        input.value = '';
      } else if (input.dataset.setting)
        this.actions.setting(
          input.dataset.setting as keyof Settings,
          input.type === 'checkbox' ? input.checked : input.value,
        );
    };
    this.onKey = (e) => {
      if (e.key !== 'Tab' || !this.panel) return;
      const focusable = [
        ...this.overlay.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([type="file"]),select,[tabindex="0"]',
        ),
      ].filter((el) => !el.hidden);
      const first = focusable[0],
        last = focusable.at(-1);
      if (!first) return;
      if (
        e.shiftKey &&
        (document.activeElement === first || !this.overlay.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || !this.overlay.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('click', this.onClick);
    root.addEventListener('change', this.onChange);
    window.addEventListener('keydown', this.onKey);
  }
  start(): void {
    this.active = true;
    this.hud.hidden = false;
    this.close();
  }
  update(state: GameState): void {
    this.currentState = structuredClone(state);
    const inScene = regions[state.region].mode === 'presentation';
    this.root.classList.toggle('scene-mode', inScene);
    this.sceneControls.hidden = !inScene || !this.active;
    this.sceneControls.innerHTML = inScene
      ? state.region === 'roof-account'
        ? roofControls(state, this.scenePaused)
        : sceneControls(state, this.scenePaused)
      : '';
    this.quest.innerHTML = questView(state);
    this.root.querySelector('.time-of-day span')!.textContent =
      state.region === 'capernaum' ? 'A quiet morning' : 'Some days later';
    const minimap = this.root.querySelector('.minimap')!;
    minimap.innerHTML =
      this.mapSvg(false, state.position, state) +
      '<span class="map-north">N</span><span class="minimap-name">' +
      esc(regions[state.region].title.toUpperCase()) +
      '</span>';
    const region = regions[state.region];
    const regionTitle = this.root.querySelector('.region-title')!;
    regionTitle.innerHTML =
      '<span class="location-diamond">' +
      icon('pin') +
      '</span><span>' +
      esc(region.title.toUpperCase()) +
      '<small>' +
      esc(region.subtitle) +
      '</small></span>';
    const finished =
      chapters[
        state.tracking === 'main' && state.episode.stage === 'complete' ? 'roof' : state.tracking
      ].complete(state);
    const available = activeInteractables(state);
    this.labelNodes.forEach((node, id) => {
      if (!available.some((p) => p.id === id)) node.hidden = true;
      node.classList.toggle('quest-target', id === objectiveTarget(state) && !finished);
      node.classList.toggle(
        'remembered',
        state.discoveries.some((place) => place === id),
      );
    });
    for (const marker of this.root.querySelectorAll<SVGElement>('[data-map-place]')) {
      const id = marker.dataset.mapPlace;
      marker.classList.toggle(
        'map-remembered',
        state.discoveries.some((place) => place === id),
      );
      marker.classList.toggle('map-target', id === objectiveTarget(state) && !finished);
    }
    const announcer = this.root.querySelector('#announcer')!;
    announcer.textContent = objective(state);
  }
  frame(position: Point, labels: ScreenLabel[], heading: number, nearest: string | null): void {
    for (const label of labels) {
      const node = this.labelNodes.get(label.id);
      if (!node) continue;
      node.style.transform = `translate(${label.x}px,${label.y}px) translate(-50%,-100%)`;
      node.hidden = !label.visible;
    }
    const minimapPlayer = this.root.querySelector<SVGElement>('#minimap-player');
    const extent = campaignLayout(this.currentState?.region ?? '')?.bounds.max ?? 24;
    const mapScale = 192 / (extent * 2);
    minimapPlayer?.setAttribute(
      'transform',
      `translate(${(position.x + extent) * mapScale},${(extent - position.z) * mapScale}) rotate(${(-heading * 180) / Math.PI - 90})`,
    );
    const button = this.root.querySelector<HTMLButtonElement>('#nearby-action')!;
    const person = allInteractables.find((p) => p.id === nearest);
    if (nearest !== this.lastNearest) {
      this.lastNearest = nearest;
      button.hidden = !person;
      if (person)
        button.innerHTML = `<kbd>E</kbd> ${person.kind === 'person' ? 'Speak with' : 'Explore'} ${esc(person.name)} ${icon('arrow')}`;
    }
  }
  saveStatus(text: string): void {
    this.root.querySelector('#save-indicator')!.textContent = text;
  }
  toast(message: string): void {
    const toast = this.root.querySelector<HTMLElement>('#toast')!;
    clearTimeout(this.toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    this.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }
  private show(panel: Panel, content: string): void {
    if (!this.panel)
      this.focusBefore =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.panel = panel;
    this.hud.inert = true;
    this.sceneControls.inert = true;
    this.overlay.innerHTML = content;
    this.overlay.className =
      panel === 'dialogue'
        ? 'dialogue-overlay'
        : panel === 'welcome'
          ? 'welcome-overlay'
          : 'panel-overlay';
    requestAnimationFrame(() =>
      this.overlay.querySelector<HTMLElement>('button:not([disabled]),[tabindex="0"]')?.focus(),
    );
  }
  close(): void {
    this.panel = null;
    this.overlay.innerHTML = '';
    this.overlay.className = '';
    this.hud.inert = false;
    this.sceneControls.inert = false;
    if (
      this.active &&
      this.currentState &&
      regions[this.currentState.region].mode === 'presentation'
    ) {
      this.sceneControls.querySelector<HTMLElement>('.scene-continue')?.focus();
      return;
    }
    if (this.active)
      (this.focusBefore ?? document.querySelector<HTMLElement>('#game-canvas'))?.focus();
  }
  welcome(hasSave: boolean, storage: boolean): void {
    this.show(
      'welcome',
      `<div class="welcome-shade"></div><section class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="welcome-brand"><span>✧</span> THE WAY</div><p class="eyebrow">CHAPTER I &nbsp; / &nbsp; GALILEE</p><h1 id="welcome-title">Every journey begins with a small kindness.</h1><p class="welcome-copy">Morning comes to Capernaum. Help on the shore, witness the catch and calling, then enter Capernaum’s lanes for Through the Roof.</p><p class="welcome-copy secondary">Walk the shore. Meet its people.<br>Find your place along the way.</p><button class="primary-button" data-action="${hasSave ? 'continue' : 'begin'}">${hasSave ? 'Continue your journey' : 'Begin your journey'} ${icon('arrow')}</button>${hasSave ? '<button class="text-button" data-action="new-journey">Start a new journey</button>' : ''}<div class="welcome-meta">${icon('leaf')} A quiet adventure · Explore at your own pace</div>${!storage ? '<p class="storage-warning">Browser storage is unavailable. You can export your journey from Settings during this session.</p>' : ''}<p class="welcome-note">Two Gospel chapters · Luke 5:1–11 and Mark 2:1–12.<br>Original conversations and scripture are clearly identified.</p><button class="welcome-saves text-button" data-action="settings">${icon('save')} Saves &amp; settings</button></section><div class="welcome-location">${icon('pin')}<span>CAPERNAUM<small>The shores of Galilee</small></span></div>`,
    );
  }
  private panelShell(title: string, eyebrow: string, body: string, wide = false): string {
    return `<div class="panel-backdrop"></div><section class="panel ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="panel-title">${title}</h2></div><button class="icon-button" data-action="close" aria-label="Close menu">${icon('close')}</button></header><div class="panel-body">${body}</div><footer class="panel-footer"><span>Your journey waits for you.</span><button class="text-button" data-action="close">Return to your journey <kbd>Esc</kbd></button></footer></section>`;
  }
  private villageSummary(state: GameState): string {
    const complete = state.villageStory === 'complete';
    const target = villageTarget(state);
    return `<section class="village-summary" aria-label="Optional village story"><button class="text-button story-track-button" data-action="track-story" data-value="village">Track village story</button><div class="village-summary-heading"><span class="chapter-icon">${icon('leaf')}</span><div><span class="eyebrow">VILLAGE STORY · OPTIONAL</span><h3>An ordinary morning</h3></div><span class="status-pill">${complete ? 'Complete' : `${state.discoveries.length} / 3`}</span></div><p>${esc(villageObjective(state))}</p><div class="discovery-cards">${discoveryOrder.map((id) => `<button class="discovery-card ${state.discoveries.includes(id) ? 'remembered' : ''}" data-action="travel" data-value="${id}">${icon(state.discoveries.includes(id) ? 'check' : id === 'olive' ? 'leaf' : 'pin')}<span>${esc(allInteractables.find((p) => p.id === id)!.name)}<small>${state.discoveries.includes(id) ? 'Remembered' : 'A memory to find'}</small></span></button>`).join('')}</div>${complete ? '<p class="village-complete">You have a place among neighbors.</p>' : `<button class="secondary-button" data-action="travel" data-value="${target}">${icon('compass')} ${state.villageStory === 'not-started' ? 'Meet Ezra' : target === 'ezra' ? 'Return to Ezra' : 'Find the next memory'} ${icon('arrow')}</button>`}</section>`;
  }
  journal(state: GameState): void {
    this.show(
      'journal',
      this.panelShell(
        'A traveler’s journal',
        'PEOPLE, PLACES & SMALL DISCOVERIES',
        `<div class="journal-summary"><span class="chapter-icon">${icon('leaf')}</span><div><h3>A place by the water</h3><p>${esc(objective(state))}</p></div><span class="status-pill">${state.quest === 'complete' ? 'Complete' : 'Chapter I'}</span></div>${state.quest === 'complete' ? '<button class="text-button" data-action="prelude-reading">Optional reading · Luke 5:4</button>' : ''}${campaignSummary(state)}${episodeSummary(state)}${this.villageSummary(state)}<div class="journal-entries">${[
          ...state.journal,
        ]
          .reverse()
          .map((id, i) => {
            const entry = journalEntries[id]!;
            return `<article class="journal-entry"><span class="entry-number">${String(state.journal.length - i).padStart(2, '0')}</span><div><h3>${entry.title}</h3><p>${entry.text}</p>${entry.reference ? `<span class="reference-tag">${icon('journal')} ${entry.reference}</span>` : ''}</div></article>`;
          })
          .join(
            '',
          )}</div><aside class="content-note"><strong>About this chapter</strong><p>The lake scenes follow Luke 5:1–11. The traveler, Miriam, Ezra, shoreline errands, and aftermath conversations are original. Scripture is quoted from the public-domain World English Bible. The scene viewpoints are a dramatization, not a claim that your traveler was aboard.</p><a href="https://ebible.org/engwebp/LUK05.htm" target="_blank" rel="noopener noreferrer">Read Luke 5:1–11 ${icon('arrow')}</a></aside>`,
        true,
      ),
    );
  }
  inventory(state: GameState): void {
    this.show(
      'inventory',
      this.panelShell(
        'Your satchel',
        'A FEW THINGS FOR THE ROAD',
        `${carriedView(state)}<p class="panel-lead">What you carry is often a chance to help someone else.</p>${state.episode.carrying ? '<article class="carried-object"><span class="item-art">' + icon('bag') + '</span><div><span class="eyebrow">IN YOUR HANDS</span><h3>Empty basket</h3><p>Carry it to the landing beside Simon’s boats. It does not use a satchel space.</p><button class="secondary-button" data-action="travel" data-value="landing">Walk to the landing</button></div></article>' : ''}<div class="inventory-grid">${state.inventory.map((id) => `<article class="inventory-item"><div class="item-art">${icon(items[id].icon)}</div><span class="eyebrow">QUEST ITEM</span><h3>${items[id].name}</h3><p>${items[id].description}</p><span class="item-count">1</span></article>`).join('')}${Array.from({ length: 4 - state.inventory.length }, () => '<div class="empty-slot" aria-label="Empty satchel space"><span>＋</span></div>').join('')}</div><p class="inventory-note">${state.inventory.length ? `Bring these supplies to Simon by the boats.` : 'Your satchel is light. The people of Capernaum may have something for you to carry.'}</p><div class="inventory-capacity">${icon('bag')} ${state.inventory.length} / 4 spaces used</div>`,
      ),
    );
  }
  map(state: GameState): void {
    if (regions[state.region].mode === 'presentation') {
      this.show(
        'map',
        this.panelShell(
          regions[state.region].title,
          'A NARRATED GOSPEL ACCOUNT',
          '<p class="panel-lead">Your traveler waits while the narrated scenes present the Gospel account. Return to exploration whenever you wish; your scene checkpoint will be kept.</p><button class="primary-button" data-action="scene-leave">Return to your traveler</button>',
        ),
      );
      return;
    }
    this.show(
      'map',
      this.panelShell(
        regions[state.region].title,
        'THE NORTHERN SHORE OF GALILEE',
        `<p class="panel-lead">Choose a person or place to walk there. Your traveler will find a clear path.</p><div class="map-layout"><div class="large-map">${this.mapSvg(true, state.position, state)}<span class="large-map-north">N ↑</span>${state.region === 'capernaum' ? '<span class="lake-label">Sea of<br>Galilee</span>' : ''}</div><div class="map-destinations">${activeInteractables(
          state,
        )
          .map(
            (p) =>
              `<button data-action="travel" data-value="${p.id}">${icon(p.kind === 'person' ? 'person' : 'pin')}<span>${p.name}<small>${state.discoveries.some((id) => id === p.id) ? 'Remembered in your journal' : p.id === objectiveTarget(state) && !(state.quest === 'complete' && state.villageStory === 'complete') ? 'Next stop' : p.role}</small></span>${icon('arrow')}</button>`,
          )
          .join(
            '',
          )}</div></div><div class="map-legend"><span><i class="legend-player"></i> You are here</span><span><i class="legend-place"></i> People & places</span><span>${state.discoveries.length} / 3 places remembered</span></div>`,
        true,
      ),
    );
  }
  settings(settings: Settings, slots: SlotSummary[], persistent: boolean, started: boolean): void {
    this.show(
      'settings',
      this.panelShell(
        'A moment of rest',
        'SETTINGS & SAVED JOURNEYS',
        `<div class="settings-grid"><div><h3>Your experience</h3><label class="setting-row"><span>${icon('sound')} Ambient sound<small>Soft regional ambience and gentle chimes</small></span><input type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}></label><label class="setting-row"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-setting="volume" aria-label="Sound volume"></label><label class="setting-row"><span>Visual quality<small>Lower quality saves battery</small></span><select data-setting="quality"><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low</option></select></label><label class="setting-row"><span>Reduce motion<small>Still water and immediate camera follow</small></span><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}></label><label class="setting-row"><span>Reading size<small>Dialogue, scripture and journal text</small></span><select data-setting="textSize"><option value="standard" ${settings.textSize === 'standard' ? 'selected' : ''}>Standard</option><option value="large" ${settings.textSize === 'large' ? 'selected' : ''}>Large</option></select></label><button class="secondary-button full-width" data-action="help">${icon('help')} Controls &amp; how to play</button></div><div><h3>Saved journeys</h3><p class="settings-note">${persistent ? 'Progress autosaves as you explore. Manual slots keep a moment you can return to.' : 'Browser storage is unavailable. These slots last only this session. Export a file to keep your journey.'}</p><div class="save-slots">${slots.map((slot) => `<div class="save-slot"><span class="slot-icon">${icon('save')}</span><div><strong>${slot.id === 'auto' ? 'Autosave' : `Journey ${slot.id.at(-1)}`}</strong><small>${slot.error ? 'Unreadable save' : slot.save ? `${regions[slot.save.state.region].title + (slot.save.state.campaign.roof.stage === 'complete' ? ' · Chapter II complete' : slot.save.state.campaign.roof.checkpoint ? ' · ' + slot.save.state.campaign.roof.checkpoint : '')} · ${esc(new Date(slot.save.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}` : 'Empty slot'}</small></div>${slot.id !== 'auto' ? `<button class="small-button" data-action="save-slot" data-value="${slot.id}" ${started ? '' : 'disabled'}>Save</button>` : ''}<button class="small-button" data-action="load-slot" data-value="${slot.id}" ${slot.save ? '' : 'disabled'}>Load</button></div>`).join('')}</div><div class="save-actions"><button class="secondary-button" data-action="export" ${started ? '' : 'disabled'}>${icon('download')} Export</button><label class="secondary-button import-button">${icon('upload')} Import<input type="file" id="import-save" accept=".json,application/json" aria-label="Import a journey save"></label></div></div></div>${started ? '<button class="text-button new-journey" data-action="new-journey">Start a new journey…</button>' : ''}`,
        true,
      ),
    );
  }
  help(): void {
    const rows = [
      ['Click / tap the ground', 'Walk to a place'],
      ['Click a name or use the map', 'Walk over and interact'],
      ['W A S D / arrow keys', 'Move relative to the camera'],
      ['E', 'Speak or examine nearby'],
      ['Right mouse drag / two fingers', 'Rotate the camera'],
      ['Mouse wheel / pinch / + − buttons', 'Zoom in or out'],
      ['Q / ↶ ↷ buttons', 'Rotate the view'],
      ['R', 'Reset the camera'],
      ['J / I / M', 'Journal / satchel / map'],
      ['Escape', 'Pause or close a menu'],
    ];
    this.show(
      'help',
      this.panelShell(
        'Find your own pace',
        'A LITTLE GUIDANCE',
        `<p class="panel-lead">Speak with Simon by the boats to begin. Follow the chapter card, or wander and discover the village. There is no combat, timer, or wrong dialogue choice.</p><dl class="controls-list">${rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="content-note">Progress is stored in this browser. Export a save from Settings before clearing browser data or changing devices.</p>`,
      ),
    );
  }
  private regionBusy = false;
  private actionPending = false;
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
    if (this.currentState && regions[this.currentState.region].mode === 'presentation') {
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
    this.show(
      'transcript',
      this.panelShell(
        chapter === 'roof' ||
          (chapter !== 'lake' &&
            (state.region === 'roof-account' || state.campaign.roof.stage !== 'not-started'))
          ? 'Through the Roof · Transcript'
          : 'Words beside the water',
        'THE COMPLETE SCENE TRANSCRIPT',
        chapter === 'roof' ||
          (chapter !== 'lake' &&
            (state.region === 'roof-account' || state.campaign.roof.stage !== 'not-started'))
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
        state.region === 'roof-account' ? roofSummary(state) : sceneSummaryView(state),
      ),
    );
  }
  diagnostics(data: Diagnostics): void {
    const rows = Object.entries(data)
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
          '</table>',
      ),
    );
  }
  dialogue(dialogue: Dialogue): void {
    this.show(
      'dialogue',
      `<section class="dialogue-box" role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker"><div class="dialogue-portrait">${icon(dialogue.provenance === 'Original narration' ? 'leaf' : 'person')}<span>✦</span></div><div class="dialogue-main"><header><div><h2 id="dialogue-speaker">${dialogue.speaker}</h2><p>${dialogue.subtitle}</p></div><button class="icon-button" data-action="close" aria-label="Leave conversation">${icon('close')}</button></header><p class="dialogue-text ${dialogue.provenance === 'Scripture · WEB' ? 'scripture' : ''}">${dialogue.text}</p><div class="dialogue-choices">${dialogue.choices.map((choice, index) => `<button data-action="choice" data-value="${index}"><span class="choice-index">${index + 1}</span>${choice.label}${icon('arrow')}</button>`).join('')}</div><div class="dialogue-source">${dialogue.provenance}${dialogue.reference ? ` <span>·</span> ${dialogue.reference}` : ''}</div></div></section>`,
    );
    requestAnimationFrame(() =>
      this.overlay.querySelector<HTMLElement>('[data-action="choice"]')?.focus(),
    );
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
    const view = contextView(id, state);
    if (!view) return false;
    this.show('context', this.panelShell(esc(view.title), 'PEOPLE & PLACES', view.body));
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
    return `<svg class="map-svg" viewBox="0 0 192 192" aria-label="Map of Capernaum"><rect width="192" height="192" fill="#87aaa2"/><path d="M0 0H${(shoreline(24) + 24) * 4} ${shorePoints
      .split(' ')
      .map((p) => `L${p}`)
      .join(' ')}H0Z" fill="#b5b080"/><path d="M${(shoreline(24) + 24) * 4} 0 ${shorePoints
      .split(' ')
      .map((p) => `L${p}`)
      .join(
        ' ',
      )}" fill="none" stroke="#ddd0a0" stroke-width="8"/><path d="m80 192 4-100 12-92M16 100h110M36 64h60" stroke="#dace9f" fill="none" stroke-width="7"/>${buildings.map((p) => `<rect x="${(p.x + 24) * 4 - 7}" y="${(24 - p.z) * 4 - 6}" width="14" height="12" fill="#81765a" stroke="#e1cf9c" stroke-width="1"/>`).join('')}${(state ? activeInteractables(state) : allInteractables).map((p) => `<circle data-map-place="${p.id}" class="${state?.discoveries.some((id) => id === p.id) ? 'map-remembered' : ''} ${state && p.id === objectiveTarget(state) && !(state.quest === 'complete' && state.villageStory === 'complete') ? 'map-target' : ''}" cx="${(p.x + 24) * 4}" cy="${(24 - p.z) * 4}" r="${large ? 2.6 : 2}" fill="#f2dfaa" stroke="#665d43" stroke-width="1"/>`).join('')}<g id="${id}" transform="translate(${((position?.x ?? -1) + 24) * 4},${(24 - (position?.z ?? -3)) * 4})"><circle r="5" fill="#233b36" stroke="#e8d390" stroke-width="1.5"/><path d="m0-3 2 5-2-1-2 1z" fill="#fff1c4"/></g></svg>`;
  }
  dispose(): void {
    clearTimeout(this.toastTimer);
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('change', this.onChange);
    window.removeEventListener('keydown', this.onKey);
  }
}
