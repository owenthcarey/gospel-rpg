import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../game/types';
import type { Interactable } from '../content/region';
import '../ui/interaction.css';

export const interactionVerb = (kind: Interactable['kind']) =>
  kind === 'person' ? 'Talk-to' : kind === 'object' ? 'Inspect' : 'Visit';

/** Keep menus and hover hints inside the viewport, including short landscape screens. */
export function menuPosition(x: number, y: number, w: number, h: number, vw: number, vh: number) {
  return {
    x: Math.max(8, Math.min(x, vw - w - 8)),
    y: Math.max(8, Math.min(y, vh - h - 8)),
  };
}

interface InteractionOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  paused: () => boolean;
  place: (id: string) => Interactable | undefined;
  navigate: (id: string) => void;
  walk: (point: Point) => void;
}

/** Cosmetic action previews and a deliberate right-click alternative to the default click. */
export class InteractionFeedback {
  private hint = document.createElement('div');
  private menu = document.createElement('div');
  private flash = document.createElement('div');
  private origin?: { x: number; y: number; moved: boolean };
  private lastPick = 0;
  private returnFocus?: HTMLElement;
  private timer?: ReturnType<typeof setTimeout>;
  private releaseView?: () => void;
  constructor(private input: InteractionOptions) {
    this.hint.className = 'world-action-hint';
    this.hint.hidden = true;
    this.hint.setAttribute('aria-hidden', 'true');
    this.menu.className = 'world-option-menu';
    this.menu.hidden = true;
    this.menu.setAttribute('role', 'menu');
    this.menu.setAttribute('aria-label', 'Choose Option');
    this.flash.className = 'world-click-feedback';
    this.flash.hidden = true;
    this.flash.setAttribute('aria-hidden', 'true');
    document.body.append(this.hint, this.menu, this.flash);
    document.addEventListener('pointerdown', this.down, true);
    document.addEventListener('pointermove', this.move, true);
    document.addEventListener('pointerup', this.up, true);
    document.addEventListener('pointercancel', this.clear);
    document.addEventListener('contextmenu', this.context);
    document.addEventListener('keydown', this.key, true);
    window.addEventListener('blur', this.clear);
    window.addEventListener('resize', this.clear);
    const camera = input.scene.activeCamera;
    if (camera) {
      const observer = camera.onViewMatrixChangedObservable.add(this.clearHover);
      this.releaseView = () => camera.onViewMatrixChangedObservable.remove(observer);
    }
  }
  private label(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLElement>('.world-label') : null;
  }
  private pick(x: number, y: number) {
    const rect = this.input.canvas.getBoundingClientRect();
    // Scene.pick uses CSS-local pointer coordinates, even on scaled/HiDPI canvases.
    return this.input.scene.pick(x - rect.left, y - rect.top);
  }
  private down = (e: PointerEvent) => {
    if (this.menu.contains(e.target as Node)) return;
    this.close(false);
    const label = this.label(e.target);
    if (this.input.paused() || (e.target !== this.input.canvas && !label)) return;
    this.clearHover();
    if (e.button === 2) this.origin = { x: e.clientX, y: e.clientY, moved: false };
    else if (e.button === 0 && e.pointerType !== 'touch') this.showClick(e.clientX, e.clientY);
  };
  private move = (e: PointerEvent) => {
    if (this.origin && Math.hypot(e.clientX - this.origin.x, e.clientY - this.origin.y) > 8)
      this.origin.moved = true;
    if (this.input.paused() || e.buttons || !this.menu.hidden || e.pointerType === 'touch') {
      this.clearHover();
      return;
    }
    const label = this.label(e.target);
    if (e.target !== this.input.canvas && !label) {
      this.clearHover();
      return;
    }
    if (performance.now() - this.lastPick < 80) return;
    this.lastPick = performance.now();
    const id =
      label?.dataset.value ?? this.pick(e.clientX, e.clientY)?.pickedMesh?.metadata?.interactionId;
    const place = typeof id === 'string' ? this.input.place(id) : undefined;
    this.input.canvas.style.cursor = place ? 'pointer' : '';
    if (!place) {
      this.hint.hidden = true;
      return;
    }
    this.describe(this.hint, place);
    this.hint.hidden = false;
    this.position(this.hint, e.clientX + 16, e.clientY + 18);
  };
  private up = (e: PointerEvent) => {
    const origin = this.origin;
    this.origin = undefined;
    if (e.button !== 2 || !origin || origin.moved || this.input.paused()) return;
    // A drag that returns to its starting point is still a drag.
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 8) return;
    this.open(e.clientX, e.clientY, e.target);
  };
  private open(x: number, y: number, target: EventTarget | null) {
    const label = this.label(target);
    const pick = this.pick(x, y);
    const id = label?.dataset.value ?? pick?.pickedMesh?.metadata?.interactionId;
    const place = typeof id === 'string' ? this.input.place(id) : undefined;
    const ground =
      !label && pick?.pickedPoint && pick.pickedMesh?.metadata?.ground
        ? { x: pick.pickedPoint.x, z: pick.pickedPoint.z }
        : undefined;
    if (!place && !ground) return;
    this.menu.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'world-option-title';
    heading.textContent = 'Choose Option';
    this.menu.append(heading);
    this.returnFocus = label ?? this.input.canvas;
    if (place) this.option(place, () => this.input.navigate(place.id));
    if (ground || place) this.option('Walk here', () => this.input.walk(ground ?? place!));
    this.option('Cancel', () => {});
    this.menu.hidden = false;
    this.hint.hidden = true;
    this.position(this.menu, x, y);
    this.menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
  private describe(node: HTMLElement, place: Interactable) {
    const name = document.createElement('span');
    name.className = 'world-option-name ' + (place.kind === 'person' ? 'is-person' : 'is-object');
    name.textContent = place.name;
    node.replaceChildren(document.createTextNode(interactionVerb(place.kind) + ' '), name);
  }
  private option(label: string | Interactable, action: () => void) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    if (typeof label === 'string') button.textContent = label;
    else this.describe(button, label);
    button.addEventListener('click', () => {
      this.close(true);
      if (!this.input.paused()) action();
    });
    this.menu.append(button);
  }
  private position(node: HTMLElement, x: number, y: number) {
    const pos = menuPosition(x, y, node.offsetWidth, node.offsetHeight, innerWidth, innerHeight);
    node.style.left = pos.x + 'px';
    node.style.top = pos.y + 'px';
  }
  private key = (e: KeyboardEvent) => {
    if (!this.input.paused() && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
      const target =
        this.label(e.target) ?? (e.target === this.input.canvas ? this.input.canvas : null);
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const rect = target.getBoundingClientRect();
        this.open(rect.left + rect.width / 2, rect.top + rect.height / 2, target);
      }
      return;
    }
    if (this.menu.hidden) return;
    if (e.key === 'Escape' || e.key === 'Tab') {
      this.close(true);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const buttons = [...this.menu.querySelectorAll<HTMLButtonElement>('button')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? buttons.length - 1
            : (current + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index]?.focus();
    } else if (['j', 'i', 'm', '?', 'f3'].includes(e.key.toLowerCase())) {
      // The regular panel records its return target after this event bubbles.
      // Restore a visible world control before that panel captures the focus bookmark.
      this.close(true);
    }
  };
  private context = (e: Event) => {
    if (
      e.target === this.input.canvas ||
      this.label(e.target) ||
      this.menu.contains(e.target as Node)
    )
      e.preventDefault();
  };
  private showClick(x: number, y: number) {
    if (this.timer) clearTimeout(this.timer);
    this.flash.hidden = false;
    this.flash.style.left = x + 'px';
    this.flash.style.top = y + 'px';
    this.timer = setTimeout(() => {
      this.flash.hidden = true;
    }, 260);
  }
  private close(restore: boolean) {
    if (!this.menu.hidden && restore && this.returnFocus?.isConnected)
      this.returnFocus.focus({ preventScroll: true });
    this.menu.hidden = true;
  }
  private clear = () => {
    this.origin = undefined;
    this.close(false);
    this.clearHover();
    this.flash.hidden = true;
  };
  private clearHover = () => {
    this.hint.hidden = true;
    this.input.canvas.style.cursor = '';
  };
  /** Menus and hints must disappear as soon as the world pauses or changes region. */
  setPaused(paused: boolean) {
    if (paused) this.clear();
  }
  dispose() {
    this.clear();
    if (this.timer) clearTimeout(this.timer);
    this.releaseView?.();
    document.removeEventListener('pointerdown', this.down, true);
    document.removeEventListener('pointermove', this.move, true);
    document.removeEventListener('pointerup', this.up, true);
    document.removeEventListener('pointercancel', this.clear);
    document.removeEventListener('contextmenu', this.context);
    document.removeEventListener('keydown', this.key, true);
    window.removeEventListener('blur', this.clear);
    window.removeEventListener('resize', this.clear);
    this.hint.remove();
    this.menu.remove();
    this.flash.remove();
  }
}
