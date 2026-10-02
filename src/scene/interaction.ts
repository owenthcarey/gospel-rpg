import type { Scene } from '@babylonjs/core/scene';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import type { Point } from '../game/types';
import type { Interactable } from '../content/region';
import { examineText } from '../content/examine';
import type { ScreenClick } from './input';
import { TapGesture } from '../game/gestures';
import { HoldView } from './hold-view';
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
  navigate: (id: string, click?: ScreenClick) => void;
  walk: (point: Point, click?: ScreenClick) => void;
  notice: (message: string) => void;
  cancelTap: () => void;
}

/** Action previews and deliberate mouse, keyboard and touch alternatives to the default tap. */
export class InteractionFeedback {
  private hint = document.createElement('div');
  private menu = document.createElement('div');
  private flash = document.createElement('div');
  private origin?: { x: number; y: number; moved: boolean };
  private pending?: { id: string; click: ScreenClick };
  private labelGesture = new TapGesture();
  private labelPointer?: number;
  private touches = new Map<number, ScreenClick>();
  private touchRejected = false;
  private suppressClick = false;
  private hold?: { id: number; click: ScreenClick; target: HTMLElement; view?: HoldView };
  private holdTimer?: ReturnType<typeof setTimeout>;
  private hoverView?: HoldView;
  private disposed = false;
  private lastPick = 0;
  private returnFocus?: HTMLElement;
  private timer?: ReturnType<typeof setTimeout>;
  private releaseView?: () => void;
  private readonly previousCursorHandling: boolean;
  constructor(private input: InteractionOptions) {
    // Feedback owns the cursor; Babylon otherwise resets it after each native move.
    this.previousCursorHandling = input.scene.doNotHandleCursors;
    input.scene.doNotHandleCursors = true;
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
    document.addEventListener('click', this.click, true);
    document.addEventListener('pointercancel', this.cancel, true);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('contextmenu', this.context);
    document.addEventListener('keydown', this.key, true);
    window.addEventListener('blur', this.loseFocus);
    window.addEventListener('resize', this.clear);
    const camera = input.scene.activeCamera;
    if (camera) {
      const observer = camera.onViewMatrixChangedObservable.add(this.viewChanged);
      const projection = camera.onProjectionMatrixChangedObservable.add(this.viewChanged);
      this.releaseView = () => {
        camera.onViewMatrixChangedObservable.remove(observer);
        camera.onProjectionMatrixChangedObservable.remove(projection);
      };
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
    if (e.pointerType === 'touch') {
      // A repeated ID belongs to a new sequence after a lost release (for example app switching).
      if (this.touches.has(e.pointerId)) {
        this.cancelHold();
        this.touches.clear();
      }
      if (!this.touches.size) {
        this.touchRejected = false;
        this.suppressClick = false;
      }
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // A second finger on the HUD or a label must also disqualify a canvas tap.
      if (this.touches.size > 1) this.rejectTouches();
    } else if (!this.touches.size) this.suppressClick = false;
    if (this.menu.contains(e.target as Node)) return;
    this.close(false);
    this.pending = undefined;
    const label = this.label(e.target);
    if (this.input.paused() || (e.target !== this.input.canvas && !label)) return;
    this.clearHover();
    this.labelGesture.down(e.pointerId, e.clientX, e.clientY, e.button);
    if (label && e.button === 0) this.labelPointer = e.pointerId;
    if (e.button === 2) this.origin = { x: e.clientX, y: e.clientY, moved: false };
    if (e.pointerType === 'touch' && e.button === 0 && !this.touchRejected) {
      const target = label ?? this.input.canvas;
      if (target.hasAttribute('disabled')) return;
      const view = this.captureView();
      this.hold = { id: e.pointerId, click: { x: e.clientX, y: e.clientY }, target, view };
      this.holdTimer = setTimeout(this.openHold, 500);
    }
  };
  private click = (e: MouseEvent) => {
    // The release of a hold can synthesize a click on the label or the menu now under it.
    // A fresh pointerdown permits the next intentional option; keyboard activation stays available.
    if (this.suppressClick && e.detail > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const label = this.label(e.target);
    // Keyboard activation has no pointer position and keeps its regular focus feedback.
    if (label && e.detail === 0) {
      this.pending = undefined;
      this.labelGesture.clear();
      this.labelPointer = undefined;
    }
    if (label && !label.hasAttribute('disabled') && e.button === 0 && e.detail > 0) {
      const allowed =
        this.labelPointer !== undefined && this.labelGesture.consume(this.labelPointer);
      this.labelPointer = undefined;
      if (!allowed || this.input.paused()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      this.prepareNavigate(label.dataset.value!, { x: e.clientX, y: e.clientY });
    }
  };
  prepareNavigate(id: string, click?: ScreenClick) {
    this.pending = !this.input.paused() && click ? { id, click } : undefined;
  }
  completeNavigate(id: string, accepted: boolean) {
    const pending = this.pending;
    if (pending?.id !== id) return;
    this.pending = undefined;
    if (accepted) this.accepted('object', pending.click);
  }
  private move = (e: PointerEvent) => {
    const touch = this.touches.get(e.pointerId);
    if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 8) this.rejectTouches();
    this.labelGesture.move(e.pointerId, e.clientX, e.clientY);
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
    if (!place) {
      this.clearHover();
      return;
    }
    // A new native pointer pick owns the baseline; camera notifications never refresh it.
    this.hoverView = this.captureView();
    this.input.canvas.style.cursor = 'pointer';
    this.describe(this.hint, place);
    this.hint.hidden = false;
    this.position(this.hint, e.clientX + 16, e.clientY + 18);
  };
  private up = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      const touch = this.touches.get(e.pointerId);
      if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 8) this.rejectTouches();
      // The window's canonical pointerup has already run. Reject its candidate before Babylon's tap.
      if (this.touchRejected) {
        this.input.cancelTap();
        this.labelGesture.reject();
      }
      this.touches.delete(e.pointerId);
      if (this.hold?.id === e.pointerId) this.cancelHold();
    }
    this.labelGesture.up(e.pointerId, e.clientX, e.clientY);
    const origin = this.origin;
    this.origin = undefined;
    if (e.button !== 2 || !origin || origin.moved || this.input.paused()) return;
    // A drag that returns to its starting point is still a drag.
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 8) return;
    this.open(e.clientX, e.clientY, e.target, { x: e.clientX, y: e.clientY });
  };
  private cancelHold() {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    this.hold = undefined;
  }
  private rejectTouches() {
    this.cancelHold();
    this.touchRejected = true;
    this.suppressClick = true;
    this.input.cancelTap();
    this.labelGesture.reject();
    this.labelPointer = undefined;
  }
  private openHold = () => {
    const hold = this.hold;
    this.cancelHold();
    if (!hold) return;
    if (
      this.disposed ||
      this.input.paused() ||
      this.touchRejected ||
      this.touches.size !== 1 ||
      !this.touches.has(hold.id) ||
      !hold.target.isConnected ||
      hold.target.hasAttribute('disabled')
    ) {
      this.rejectTouches();
      return;
    }
    this.rejectTouches();
    this.open(hold.click.x, hold.click.y, hold.target, hold.click);
  };
  private cancel = (e: PointerEvent) => {
    this.clear();
    this.touches.delete(e.pointerId);
  };
  private visibility = () => {
    if (document.hidden) this.loseFocus();
  };
  private loseFocus = () => {
    this.clear();
    // The browser may never deliver a release while another app owns focus.
    // Blur clears canonical input; hidden documents also pause the world and clear it.
    this.touches.clear();
  };
  private captureView() {
    const camera = this.input.scene.activeCamera;
    if (!(camera instanceof TargetCamera)) return undefined;
    // Synchronize before assigning a hold or hover: observers cannot reject its new baseline.
    camera.getViewMatrix();
    camera.getProjectionMatrix();
    const rect = this.input.canvas.getBoundingClientRect();
    return HoldView.capture(
      camera.getTransformationMatrix(),
      camera.getTarget(),
      camera.viewport.toGlobal(rect.width, rect.height),
      rect,
    );
  }
  private changedView(view?: HoldView) {
    const camera = this.input.scene.activeCamera;
    const rect = this.input.canvas.getBoundingClientRect();
    // Observables fire after the new matrix is computed. Use cached view/projection
    // matrices, avoiding reentrant getViewMatrix and stale scene transforms.
    return (
      !camera ||
      !view ||
      view.changed(
        camera.getTransformationMatrix(),
        camera.viewport.toGlobal(rect.width, rect.height),
        rect,
      )
    );
  }
  private viewChanged = () => {
    if (this.hold && this.changedView(this.hold.view)) this.rejectTouches();
    if (!this.hint.hidden && this.changedView(this.hoverView)) this.clearHover();
  };
  private open(x: number, y: number, target: EventTarget | null, click?: ScreenClick) {
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
    if (place) this.option(place, () => this.input.navigate(place.id, click));
    if (ground || place) this.option('Walk here', () => this.input.walk(ground ?? place!, click));
    if (place) this.option(place, () => this.input.notice(examineText(place)), 'Examine');
    this.option('Cancel', () => {});
    this.menu.hidden = false;
    this.clearHover();
    this.position(this.menu, x, y);
    this.menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
  private describe(node: HTMLElement, place: Interactable, verb = interactionVerb(place.kind)) {
    const name = document.createElement('span');
    name.className = 'world-option-name ' + (place.kind === 'person' ? 'is-person' : 'is-object');
    name.textContent = place.name;
    node.replaceChildren(document.createTextNode(verb + ' '), name);
  }
  private option(label: string | Interactable, action: () => void, verb?: string) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    if (typeof label === 'string') button.textContent = label;
    else this.describe(button, label, verb);
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
  accepted(kind: 'ground' | 'object', click: ScreenClick) {
    if (this.disposed || this.input.paused()) return;
    if (this.timer) clearTimeout(this.timer);
    this.flash.hidden = false;
    this.flash.dataset.kind = kind;
    this.flash.style.left = click.x + 'px';
    this.flash.style.top = click.y + 'px';
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
    this.cancelHold();
    if (this.touches.size) this.rejectTouches();
    this.origin = undefined;
    this.pending = undefined;
    this.labelGesture.clear();
    this.labelPointer = undefined;
    this.close(false);
    this.clearHover();
    this.flash.hidden = true;
  };
  private clearHover = () => {
    this.hoverView = undefined;
    this.hint.hidden = true;
    this.input.canvas.style.cursor = '';
  };
  /** Menus and hints must disappear as soon as the world pauses or changes region. */
  setPaused(paused: boolean) {
    if (paused) this.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.touches.clear();
    if (this.timer) clearTimeout(this.timer);
    this.releaseView?.();
    document.removeEventListener('pointerdown', this.down, true);
    document.removeEventListener('pointermove', this.move, true);
    document.removeEventListener('pointerup', this.up, true);
    document.removeEventListener('click', this.click, true);
    document.removeEventListener('pointercancel', this.cancel, true);
    document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('contextmenu', this.context);
    document.removeEventListener('keydown', this.key, true);
    window.removeEventListener('blur', this.loseFocus);
    window.removeEventListener('resize', this.clear);
    this.hint.remove();
    this.menu.remove();
    this.flash.remove();
    this.input.scene.doNotHandleCursors = this.previousCursorHandling;
  }
}
