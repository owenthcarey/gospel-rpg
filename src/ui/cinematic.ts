/**
 * Cinematic interface surfaces for RFC-011: the cold open, chapter cards and the travel veil.
 * DOM only (no Babylon). Each mounts inside #app, above the HUD, and never grants progress.
 */
import { escapeHtml as esc, icon } from './icons';
import { logoMark, ornamentRule } from './logo';
import { trapFocus } from './focus';
import './cinematic.css';

export interface OpeningCardText {
  eyebrow: string;
  text: string;
}
export type ColdOpenResult = 'finished' | 'skipped';

/** Card timing in milliseconds; a card fades in, holds, then fades out. */
export const COLD_OPEN_TIMING = {
  card: 5800,
  fadeIn: 1100,
  fadeOut: 800,
  manualOut: 320,
  exit: 700,
};
export const CHAPTER_CARD_TIMING = { fadeIn: 700, hold: 3000, fadeOut: 900 };
export const VEIL_TIMING = { cover: 350, reveal: 450, reduced: 60 };

export interface ColdOpenState {
  index: number;
  total: number;
  result: ColdOpenResult | null;
}
export type ColdOpenEvent = 'advance' | 'skip';
/** Pure cold-open progression: advancing past the last card finishes; skip ends at once. */
export function coldOpenStep(state: ColdOpenState, event: ColdOpenEvent): ColdOpenState {
  if (state.result) return state;
  if (event === 'skip') return { ...state, result: 'skipped' };
  if (state.index + 1 >= state.total) return { ...state, result: 'finished' };
  return { ...state, index: state.index + 1 };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const appHost = (): HTMLElement => document.querySelector<HTMLElement>('#app') ?? document.body;

/**
 * A skippable, letterboxed sequence of original-narration cards over the live title view.
 * Focus starts on Skip. Escape skips; click, ArrowRight/PageDown, and Enter or Space (outside
 * a focused button) advance. Under reduced motion, cards are static and advance manually.
 */
export class ColdOpen {
  private element?: HTMLElement;
  private state: ColdOpenState = { index: 0, total: 0, result: null };
  private timers: ReturnType<typeof setTimeout>[] = [];
  private resolve?: (result: ColdOpenResult) => void;
  private cards: readonly OpeningCardText[] = [];
  private reduced = false;
  private leaving = false;
  private focusBefore?: Element | null;
  private onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private host: HTMLElement = appHost()) {}

  get active(): boolean {
    return !!this.element;
  }

  play(
    cards: readonly OpeningCardText[],
    provenance: string,
    opts: { reduced: boolean },
  ): Promise<ColdOpenResult> {
    this.finish('skipped', true);
    if (!cards.length) return Promise.resolve('finished');
    this.cards = cards;
    this.reduced = opts.reduced;
    this.state = { index: 0, total: cards.length, result: null };
    this.focusBefore = document.activeElement;
    const el = document.createElement('section');
    el.className = 'cold-open' + (opts.reduced ? ' is-reduced' : '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Opening');
    el.innerHTML = `<div class="cold-open-scrim"></div><div class="cold-open-bar is-top"></div><div class="cold-open-bar is-bottom"></div><div class="cold-open-stage"><div class="cold-open-card" aria-live="polite" aria-atomic="true"></div></div><footer class="cold-open-footer"><p class="cold-open-provenance">${icon('memory')}<span>${esc(provenance)}</span></p><ol class="cold-open-progress" aria-hidden="true">${cards.map(() => '<li></li>').join('')}</ol><div class="cold-open-actions"><button type="button" class="cold-open-continue">Continue ${icon('arrow')}</button><button type="button" class="cold-open-skip">Skip ${icon('skip')}</button></div></footer>`;
    el.querySelector('.cold-open-stage')!.addEventListener('click', () => this.advance());
    el.querySelector('.cold-open-continue')!.addEventListener('click', () => this.advance());
    el.querySelector('.cold-open-skip')!.addEventListener('click', () => this.skip());
    this.element = el;
    this.host.append(el);
    this.host.classList.add('has-cold-open');
    window.addEventListener('keydown', this.onKey, true);
    el.querySelector<HTMLElement>('.cold-open-skip')!.focus({ preventScroll: true });
    // Insert the text after mounting so the live region announces the first card.
    requestAnimationFrame(() => this.render());
    return new Promise((resolve) => (this.resolve = resolve));
  }
  /** Advance to the next card, or finish after the last one. */
  advance(): void {
    if (!this.element || this.state.result) return;
    if (this.leaving && !this.reduced) return;
    this.clearTimers();
    if (this.reduced) return this.next();
    this.leaving = true;
    this.element.querySelector('.cold-open-card')!.classList.add('is-leaving');
    this.timers.push(setTimeout(() => this.next(), COLD_OPEN_TIMING.manualOut));
  }
  skip(): void {
    if (!this.element || this.state.result) return;
    this.state = coldOpenStep(this.state, 'skip');
    this.finish('skipped');
  }

  private next(): void {
    this.leaving = false;
    this.state = coldOpenStep(this.state, 'advance');
    if (this.state.result) this.finish(this.state.result);
    else this.render();
  }
  private render(): void {
    const el = this.element;
    if (!el || this.state.result) return;
    const card = this.cards[this.state.index]!;
    const last = this.state.index === this.state.total - 1;
    const slot = el.querySelector<HTMLElement>('.cold-open-card')!;
    slot.classList.remove('is-leaving');
    slot.innerHTML = `${ornamentRule('cold-open-ornament')}<p class="cold-open-eyebrow">${esc(card.eyebrow)}</p><p class="cold-open-text">${esc(card.text)}</p>`;
    // Restart the entrance for each card.
    slot.classList.remove('is-in');
    void slot.offsetWidth;
    slot.classList.add('is-in');
    el.querySelectorAll('.cold-open-progress li').forEach((li, i) => {
      li.classList.toggle('is-done', i < this.state.index);
      li.classList.toggle('is-current', i === this.state.index);
    });
    const next = el.querySelector<HTMLElement>('.cold-open-continue')!;
    next.innerHTML = `${last ? 'Begin' : 'Continue'} ${icon('arrow')}`;
    if (this.reduced) return;
    const t = COLD_OPEN_TIMING;
    this.timers.push(
      setTimeout(() => slot.classList.add('is-leaving'), t.card - t.fadeOut),
      setTimeout(() => this.next(), t.card),
    );
  }
  private key(e: KeyboardEvent): void {
    const el = this.element;
    if (!el) return;
    const onButton = e.target instanceof HTMLButtonElement && el.contains(e.target);
    if (e.key === 'Tab') {
      trapFocus(e, el);
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      this.skip();
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      this.advance();
    } else if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
      e.preventDefault();
      this.advance();
    }
  }
  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
  private finish(result: ColdOpenResult, immediate = false): void {
    const el = this.element;
    if (!el) return;
    this.clearTimers();
    window.removeEventListener('keydown', this.onKey, true);
    this.element = undefined;
    this.leaving = false;
    this.host.classList.remove('has-cold-open');
    const resolve = this.resolve;
    this.resolve = undefined;
    // Leave no element that could intercept input once the sequence ends.
    el.classList.add('is-exiting');
    el.inert = true;
    const done = () => {
      el.remove();
      if (this.focusBefore instanceof HTMLElement && this.focusBefore.isConnected)
        this.focusBefore.focus({ preventScroll: true });
      resolve?.(result);
    };
    if (immediate || this.reduced) done();
    else setTimeout(done, COLD_OPEN_TIMING.exit);
  }
}

export interface ChapterCardText {
  eyebrow: string;
  title: string;
  reference?: string;
}
/** A nonmodal chapter title that never intercepts input and is announced politely. */
export class ChapterCard {
  private live: HTMLElement;
  private element?: HTMLElement;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private resolve?: () => void;

  constructor(private host: HTMLElement = appHost()) {
    this.live = document.createElement('div');
    this.live.className = 'sr-only chapter-card-live';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    host.append(this.live);
  }
  show(card: ChapterCardText, opts: { reduced: boolean }): Promise<void> {
    this.hide();
    const el = document.createElement('div');
    el.className = 'chapter-card' + (opts.reduced ? ' is-reduced' : '');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="chapter-card-inner"><p class="chapter-card-eyebrow">${esc(card.eyebrow)}</p>${ornamentRule('chapter-card-rule')}<h2 class="chapter-card-title">${esc(card.title)}</h2>${card.reference ? `<p class="chapter-card-reference">${esc(card.reference)}</p>` : ''}</div>`;
    this.element = el;
    this.host.append(el);
    this.live.textContent = [card.eyebrow, card.title, card.reference].filter(Boolean).join('. ');
    const t = CHAPTER_CARD_TIMING;
    requestAnimationFrame(() => el.classList.add('is-in'));
    this.timers.push(
      setTimeout(
        () => {
          el.classList.remove('is-in');
          el.classList.add('is-out');
        },
        (opts.reduced ? 0 : t.fadeIn) + t.hold,
      ),
      setTimeout(() => this.hide(), (opts.reduced ? 0 : t.fadeIn + t.fadeOut) + t.hold),
    );
    return new Promise((resolve) => (this.resolve = resolve));
  }
  hide(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.element?.remove();
    this.element = undefined;
    const resolve = this.resolve;
    this.resolve = undefined;
    resolve?.();
  }
}

export interface VeilCover {
  reduced: boolean;
  title?: string;
  line?: string;
  /** Scene tint for the veil, any CSS color. */
  tint?: string;
}
/**
 * A scene-tinted veil with an illustrated loading composition for region changes.
 * It does not move focus; it blocks pointer input only while fully covering, and leaves no
 * element behind once revealed.
 */
export class Veil {
  private element?: HTMLElement;
  private generation = 0;

  constructor(private host: HTMLElement = appHost()) {}

  get covered(): boolean {
    return !!this.element && !this.element.classList.contains('is-revealing');
  }
  async cover(opts: VeilCover): Promise<void> {
    const generation = ++this.generation;
    let el = this.element;
    if (!el) {
      el = document.createElement('div');
      el.className = 'veil';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = `<div class="veil-composition"><span class="veil-mark">${logoMark('veil-logo')}<svg class="veil-ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="23" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round" pathLength="100" stroke-dasharray="18 82"/></svg></span><p class="veil-eyebrow">The journey continues</p><h2 class="veil-title"></h2>${ornamentRule('veil-rule')}<p class="veil-line"></p></div>`;
      this.element = el;
      this.host.append(el);
    }
    el.classList.toggle('is-reduced', opts.reduced);
    el.classList.remove('is-revealing');
    if (opts.tint) el.style.setProperty('--veil-tint', opts.tint);
    else el.style.removeProperty('--veil-tint');
    el.querySelector('.veil-title')!.textContent = opts.title ?? '';
    el.querySelector('.veil-line')!.textContent = opts.line ?? '';
    el.classList.toggle('has-title', !!opts.title);
    if (el.classList.contains('is-covered')) return;
    if (opts.reduced) {
      el.classList.add('is-covered');
      return;
    }
    void el.offsetWidth;
    el.classList.add('is-covered');
    await wait(VEIL_TIMING.cover);
    if (generation !== this.generation) return;
  }
  async reveal(opts: { reduced: boolean }): Promise<void> {
    const generation = ++this.generation;
    const el = this.element;
    if (!el) return;
    el.classList.add('is-revealing');
    el.classList.remove('is-covered');
    if (!opts.reduced) await wait(VEIL_TIMING.reveal);
    if (generation !== this.generation) return;
    el.remove();
    if (this.element === el) this.element = undefined;
  }
}
