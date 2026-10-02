import type { Point } from '../game/types';
import { TapGesture } from '../game/gestures';
import './minimap.css';

export interface MapBounds {
  min: number;
  max: number;
}
export const minimapBearing = (alpha: number) => alpha + Math.PI / 2;
export function mapPoint(point: Point, bounds: MapBounds): { x: number; y: number } {
  const scale = 192 / (bounds.max - bounds.min);
  return { x: (point.x - bounds.min) * scale, y: (bounds.max - point.z) * scale };
}
/** Undo the camera's rotation before resolving a tap on the circular map. */
export function minimapTarget(
  x: number,
  y: number,
  bearing: number,
  bounds: MapBounds,
  center: Point = { x: (bounds.min + bounds.max) / 2, z: (bounds.min + bounds.max) / 2 },
): Point | undefined {
  const dx = x - 0.5,
    dy = y - 0.5;
  if (!Number.isFinite(x + y + bearing) || Math.hypot(dx, dy) > 0.5) return;
  const cos = Math.cos(bearing),
    sin = Math.sin(bearing),
    u = dx * cos + dy * sin + 0.5,
    v = -dx * sin + dy * cos + 0.5,
    span = bounds.max - bounds.min;
  return { x: center.x + (u - 0.5) * span, z: center.z - (v - 0.5) * span };
}

/** Pointer taps move in the world; keyboard activation opens the accessible local map. */
export class MinimapControls {
  private gesture = new TapGesture();
  private pointer?: number;
  private touches = new Set<number>();
  private bearing = 0;
  private bounds: MapBounds = { min: -24, max: 24 };
  private center: Point = { x: 0, z: 0 };
  private paused = false;
  private symbolScale = 1;
  private resize: ResizeObserver;
  constructor(
    private wrap: HTMLElement,
    private walk: (point: Point) => void,
    private open: () => void,
  ) {
    // Symbols describe people and destinations, so keep their screen size as the
    // radar shrinks. Terrain still scales normally with the world view.
    this.resize = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0) return;
      this.symbolScale = 192 / entry.contentRect.width;
      this.wrap.style.setProperty('--map-symbol-unit', `${this.symbolScale}px`);
      const map = entry.target as HTMLElement;
      this.wrap.style.setProperty('--map-size', `${map.offsetWidth}px`);
    });
    const map = wrap.querySelector('.minimap');
    if (map) this.resize.observe(map);
    document.addEventListener('pointerdown', this.down, true);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.clear);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.visibility);
    wrap.addEventListener('click', this.click);
    wrap.addEventListener('contextmenu', this.context);
  }
  private down = (event: PointerEvent) => {
    if (event.pointerType === 'touch') this.touches.add(event.pointerId);
    if (this.paused) return;
    if (event.target instanceof Element && event.target.closest('.minimap')) {
      this.pointer = event.pointerId;
      this.gesture.down(event.pointerId, event.clientX, event.clientY, event.button);
    }
    // A second finger on the world or HUD also owns the sequence. Neither release may walk.
    if (this.touches.size > 1) this.gesture.reject();
  };
  private move = (event: PointerEvent) =>
    this.gesture.move(event.pointerId, event.clientX, event.clientY);
  private up = (event: PointerEvent) => {
    this.gesture.up(event.pointerId, event.clientX, event.clientY);
    this.touches.delete(event.pointerId);
  };
  private clear = () => {
    this.gesture.clear();
    this.pointer = undefined;
    this.touches.clear();
  };
  private visibility = () => {
    if (document.hidden) this.clear();
  };
  private context = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('.minimap')) event.preventDefault();
  };
  private click = (event: MouseEvent) => {
    const button =
      event.target instanceof Element ? event.target.closest<HTMLElement>('.minimap') : null;
    if (!button) return;
    event.stopPropagation();
    if (this.paused) return;
    if (!event.detail) {
      this.open();
      return;
    }
    if (this.pointer === undefined || !this.gesture.consume(this.pointer)) return;
    this.pointer = undefined;
    const rect = button.getBoundingClientRect();
    const point = minimapTarget(
      (event.clientX - rect.left - button.clientLeft) / button.clientWidth,
      (event.clientY - rect.top - button.clientTop) / button.clientHeight,
      this.bearing,
      this.bounds,
      this.center,
    );
    if (point) this.walk(point);
  };
  update(alpha: number, bounds: MapBounds, position: Point, target?: Point) {
    this.bearing = minimapBearing(alpha);
    this.bounds = bounds;
    this.center = { ...position };
    this.wrap.style.setProperty('--map-bearing', `${(this.bearing * 180) / Math.PI}deg`);
    const svg = this.wrap.querySelector('.map-svg');
    if (!svg) return;
    const player = mapPoint(position, bounds);
    svg.setAttribute('viewBox', `${player.x - 96} ${player.y - 96} 192 192`);
    let flag = svg.querySelector<SVGGElement>('.minimap-destination');
    if (!flag) {
      flag = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      flag.classList.add('minimap-destination');
      flag.innerHTML =
        '<circle r="3" fill="#ffe746" stroke="#272015" stroke-width="1.2"/><path d="M0 0V-12H8L6-9L8-6H0" fill="#ffe746" stroke="#272015" stroke-width="1.4"/>';
      svg.append(flag);
    }
    flag.style.display = target ? '' : 'none';
    if (target) {
      const p = mapPoint(target, bounds);
      // The destination stays planted in the map while its flag remains upright
      // and legible when the player rotates the camera or uses a phone radar.
      flag.setAttribute(
        'transform',
        `translate(${p.x},${p.y}) rotate(${(-this.bearing * 180) / Math.PI}) scale(${this.symbolScale})`,
      );
    }
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.clear();
  }
  dispose() {
    this.clear();
    this.resize.disconnect();
    document.removeEventListener('pointerdown', this.down, true);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.clear);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.visibility);
    this.wrap.removeEventListener('click', this.click);
    this.wrap.removeEventListener('contextmenu', this.context);
  }
}
