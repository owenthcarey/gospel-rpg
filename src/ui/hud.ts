/** Pure HUD rules: label hierarchy, control-hint fading and notice kinds. No DOM access. */

export type LabelKind = 'person' | 'place';
export interface LabelState {
  kind: LabelKind;
  /** Meters from the traveler; Infinity when unknown. */
  distance: number;
  nearest: boolean;
  /** The tracked story's current destination. */
  target: boolean;
  /** The destination the traveler is currently walking to. */
  selected: boolean;
  hovered: boolean;
  focused: boolean;
}
/** Distance within which a label opens to its name without any interaction. */
export const LABEL_NEAR: Record<LabelKind, number> = { person: 7, place: 4.5 };

/** People and places show a small marker until they matter; the name then opens. */
export function labelExpanded(s: LabelState): boolean {
  return (
    s.nearest ||
    s.selected ||
    s.target ||
    s.hovered ||
    s.focused ||
    s.distance <= LABEL_NEAR[s.kind]
  );
}
/** Placement priority: interaction first, then guidance, then proximity. */
export function labelPriority(s: LabelState): number {
  if (s.hovered || s.focused) return 5;
  if (s.nearest) return 4;
  if (s.selected) return 3.5;
  if (s.target) return 3;
  if (labelExpanded(s)) return 2;
  return s.kind === 'person' ? 1 : 0;
}

/**
 * Control hints recede once the traveler has walked a little and acted a few times.
 * Session-only; Help brings them back.
 */
export class HintFade {
  moved = 0;
  interactions = 0;
  faded = false;
  constructor(
    readonly distance = 12,
    readonly actions = 3,
  ) {}
  /** Record travel; teleports (region changes, restores) are ignored. */
  move(meters: number): boolean {
    if (Number.isFinite(meters) && meters > 0 && meters < 3) this.moved += meters;
    return this.settle();
  }
  interact(): boolean {
    this.interactions += 1;
    return this.settle();
  }
  reset(): void {
    this.moved = 0;
    this.interactions = 0;
    this.faded = false;
  }
  private settle(): boolean {
    if (!this.faded && this.moved >= this.distance && this.interactions >= this.actions)
      this.faded = true;
    return this.faded;
  }
}

export const TOAST_KINDS = ['story', 'memory', 'item', 'place', 'warning', 'save'] as const;
export type ToastKind = (typeof TOAST_KINDS)[number];
export const TOAST_ICONS: Record<ToastKind, string> = {
  story: 'scroll',
  memory: 'memory',
  item: 'bag',
  place: 'pin',
  warning: 'warning',
  save: 'save',
};
/** Infer a notice's kind from its text when the caller does not say. */
export function toastKind(message: string): ToastKind {
  const text = message.toLowerCase();
  if (
    /could not|couldn|unavailable|failed|went wrong|try again|not be saved|cannot|can’t|can't/.test(
      text,
    )
  )
    return 'warning';
  if (/\bsaved?\b|export|import/.test(text)) return 'save';
  if (/journal|memory|memories|remembered|reflection|observation/.test(text)) return 'memory';
  if (/satchel|delivered|basket|supplies|in your hands|carry|carrying/.test(text)) return 'item';
  if (/arrived|welcome to|landing|dock|shore|steer|route|walk|approach/.test(text)) return 'place';
  return 'story';
}
