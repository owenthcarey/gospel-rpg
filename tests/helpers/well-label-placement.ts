import { allInteractables } from '../../src/content/region';
import { LABEL_NEAR, labelPlacementPriority } from '../../src/ui/hud';
import { arrangeLabels, type LabelBox } from '../../src/ui/labels';

export interface WellLabelFlags {
  id: string | null;
  person: boolean;
  place: boolean;
  object: boolean;
  selected: boolean;
  target: boolean;
  hovered: boolean;
  focused: boolean;
}
export interface WellLabelObservation {
  x: number;
  y: number;
  hidden: boolean;
  width: number;
  height: number;
  basis: {
    labels: WellLabelFlags[];
    nearest: { text: string; action: string | null; hidden: boolean } | null;
    ui: { x: number; y: number; width: number; height: number } | null;
    canvas: { x: number; y: number; width: number; height: number } | null;
    reserved: LabelBox[] | null;
  };
}

/** Reconstruct placement from fresh projection and passive HUD measurements, never target y. */
export function wellLabelError(
  observed: WellLabelObservation,
  projected: { x: number; y: number },
  canvas: { x: number; y: number; width: number; height: number },
) {
  // Hidden nodes do not expose the app's temporary pre-placement measurement.
  // Preserve the original raw-coordinate predicate for that branch exactly.
  if (observed.hidden)
    return {
      basis: 'hidden-legacy',
      error: Math.max(
        Math.abs(observed.x - projected.x),
        Math.min(
          ...[0, -28, 28, -56, 56].map((offset) => Math.abs(observed.y - projected.y - offset)),
        ),
      ),
    };
  const reject = (basis: string) => ({ basis, error: Infinity });
  const target = allInteractables.find((point) => point.id === 'water-point');
  const nearest = observed.basis.nearest;
  if (
    !target ||
    target.kind !== 'object' ||
    new Set(allInteractables.filter((point) => point.name === target.name).map((point) => point.id))
      .size !== 1 ||
    !nearest ||
    nearest.hidden ||
    nearest.action !== 'nearest' ||
    nearest.text !== `Explore ${target.name}`
  )
    return reject('nearest identity unproved');
  const ui = observed.basis.ui,
    currentCanvas = observed.basis.canvas;
  if (
    !ui ||
    !currentCanvas ||
    canvas.x !== 0 ||
    canvas.y !== 0 ||
    ui.x !== 0 ||
    ui.y !== 0 ||
    ui.width !== canvas.width ||
    ui.height !== canvas.height ||
    currentCanvas.x !== canvas.x ||
    currentCanvas.y !== canvas.y ||
    currentCanvas.width !== canvas.width ||
    currentCanvas.height !== canvas.height ||
    ![
      projected.x,
      projected.y,
      observed.x,
      observed.y,
      observed.width,
      observed.height,
      canvas.width,
      canvas.height,
    ].every(Number.isFinite) ||
    observed.width <= 0 ||
    observed.height <= 0
  )
    return reject('current size or projection basis unproved');
  const sources = new Map(allInteractables.map((point) => [point.id, point]));
  const flags = observed.basis.labels;
  if (flags.length !== sources.size || new Set(flags.map((flag) => flag.id)).size !== sources.size)
    return reject('complete label ordering unproved');
  for (const flag of flags) {
    const source = flag.id ? sources.get(flag.id) : undefined;
    if (
      !source ||
      ![
        flag.person,
        flag.place,
        flag.object,
        flag.selected,
        flag.target,
        flag.hovered,
        flag.focused,
      ].every((value) => typeof value === 'boolean') ||
      flag.person !== (source.kind === 'person') ||
      flag.place !== (source.kind === 'place') ||
      flag.object !== (source.kind === 'object')
    )
      return reject('label flags or source identity unproved');
  }
  const targetFlags = flags.find((flag) => flag.id === target.id)!;
  const state = (flag: WellLabelFlags, nearest: boolean) => ({
    kind: flag.person ? ('person' as const) : ('place' as const),
    // Non-nearest proximity uses its maximum possible priority; not a measured distance.
    distance: LABEL_NEAR[flag.person ? 'person' : 'place'],
    nearest,
    selected: flag.selected,
    target: flag.target,
    hovered: flag.hovered,
    focused: flag.focused,
  });
  // interface.frame only sets personSharesPoint for .place; this target is .object.
  const priority = labelPlacementPriority(state(targetFlags, true), false);
  for (const flag of flags.filter((flag) => flag.id !== target.id)) {
    const upperPriority = labelPlacementPriority(state(flag, false), false);
    if (
      upperPriority > priority ||
      (upperPriority === priority && flag.id!.localeCompare(target.id) < 0)
    )
      return reject('an earlier label may reserve space');
  }
  const reserved = observed.basis.reserved;
  if (
    !reserved ||
    reserved.some(
      (box) =>
        ![box.left, box.top, box.right, box.bottom].every(Number.isFinite) ||
        box.right < box.left ||
        box.bottom < box.top,
    )
  )
    return reject('HUD reservations unproved');
  const expected = arrangeLabels(
    [
      {
        id: target.id,
        ...projected,
        visible: true,
        width: observed.width,
        height: observed.height,
        priority,
      },
    ],
    reserved,
    canvas.width,
    canvas.height,
  )[0]!;
  if (!expected.visible) return reject('shipped fitter would hide the target');
  return {
    basis: 'target first, shipped fitter, measured HUD',
    expected,
    error: Math.max(Math.abs(observed.x - expected.x), Math.abs(observed.y - expected.y)),
  };
}
