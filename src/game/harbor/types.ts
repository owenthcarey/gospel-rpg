export const HARBOR_NOTES = ['water', 'passage'] as const;
export const HARBOR_ROUTES = ['north', 'south'] as const;
export const HARBOR_ENDINGS = ['patience', 'room'] as const;
export type HarborRoute = (typeof HARBOR_ROUTES)[number];
export interface HarborState {
  stage: 'not-started' | 'working' | 'ready' | 'complete';
  notes: (typeof HARBOR_NOTES)[number][];
  cleared: boolean;
  plank: 'rack' | HarborRoute;
  turn: 0 | 1;
  cargo: { nets: boolean; jars: boolean };
  tested: boolean;
  hint: 0 | 1 | 2 | 3;
  ending: (typeof HARBOR_ENDINGS)[number] | null;
}
export type HarborEvent = { type: 'harbor-action'; id: string; expected?: string };
export function newHarbor(): HarborState {
  return {
    stage: 'not-started',
    notes: [],
    cleared: false,
    plank: 'rack',
    turn: 1,
    cargo: { nets: false, jars: false },
    tested: false,
    hint: 0,
    ending: null,
  };
}
/** Commands describe the arrangement they were offered for, not an animation frame. */
export function harborRevision(h: HarborState): string {
  return [
    h.stage,
    Number(h.cleared),
    h.plank,
    h.turn,
    Number(h.cargo.nets),
    Number(h.cargo.jars),
  ].join(':');
}
