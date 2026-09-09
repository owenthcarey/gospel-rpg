import { isRecord, idList } from './episode';
import {
  EXPLORATION_REGIONS,
  HELD_ITEMS,
  NEIGHBOR_NOTES,
  ROOF_AFTERMATH,
  ROOF_REFLECTIONS,
  ROOF_SCENES,
  type CampaignState,
  type RegionId,
  type ExplorationRegion,
} from '../game/campaign/types';
import { WALK_ROUTES } from '../content/campaign/places';
import type { Point } from '../game/types';
import { LIFE_ITEMS } from '../game/life/types';
const member = (value: unknown, values: readonly string[]): boolean =>
  typeof value === 'string' && values.includes(value);
function fail(): never {
  throw new Error('This save contains inconsistent chapter or neighborhood progress.');
}
export function regionBounds(region: RegionId): number {
  return region === 'capernaum' || region === 'lake-gennesaret'
    ? 24
    : region === 'capernaum-lanes'
      ? 16
      : 8;
}
export function validPoint(raw: unknown, bounds: number): raw is Point {
  return (
    isRecord(raw) &&
    typeof raw.x === 'number' &&
    typeof raw.z === 'number' &&
    Number.isFinite(raw.x) &&
    Number.isFinite(raw.z) &&
    Math.abs(raw.x) <= bounds &&
    Math.abs(raw.z) <= bounds
  );
}
export function parseCampaign(raw: unknown, episodeStage: string, region: RegionId): CampaignState {
  if (
    !isRecord(raw) ||
    !isRecord(raw.roof) ||
    !isRecord(raw.walk) ||
    !isRecord(raw.table) ||
    !isRecord(raw.visited)
  )
    fail();
  const r = raw.roof,
    w = raw.walk,
    t = raw.table;
  if (
    !member(r.stage, ['not-started', 'exploring', 'witnessing', 'aftermath', 'complete']) ||
    (r.checkpoint !== null && !member(r.checkpoint, ROOF_SCENES)) ||
    !idList(r.aftermath, ROOF_AFTERMATH) ||
    (r.reflection !== null && !member(r.reflection, ROOF_REFLECTIONS)) ||
    !member(w.stage, ['not-started', 'invited', 'walking', 'arrived', 'complete']) ||
    (w.route !== null && !member(w.route, ['passage', 'outer'])) ||
    typeof w.gateOpen !== 'boolean' ||
    typeof w.step !== 'number' ||
    !Number.isInteger(w.step) ||
    w.step < 0 ||
    !validPoint(w.position, 16) ||
    !member(t.stage, ['not-started', 'preparing', 'complete']) ||
    (t.location !== null && !member(t.location, ['courtyard', 'bakehouse'])) ||
    !idList(t.delivered, ['bread', 'water']) ||
    (raw.carrying !== null && !member(raw.carrying, HELD_ITEMS)) ||
    !idList(raw.notes, NEIGHBOR_NOTES)
  )
    fail();
  const c = raw as unknown as CampaignState;
  if (c.roof.stage !== 'not-started' && episodeStage !== 'complete') fail();
  if (
    c.roof.stage === 'not-started' &&
    (c.walk.stage !== 'not-started' ||
      c.table.stage !== 'not-started' ||
      c.notes.length ||
      (c.carrying && !LIFE_ITEMS.some((id) => id === c.carrying)) ||
      Object.keys(c.visited).some((id) => id !== 'capernaum' || episodeStage !== 'complete'))
  )
    fail();
  if (
    ['not-started', 'exploring'].includes(c.roof.stage) &&
    (c.roof.checkpoint || c.roof.aftermath.length || c.roof.reflection)
  )
    fail();
  if (
    c.roof.stage === 'witnessing' &&
    (!c.roof.checkpoint || c.roof.aftermath.length || c.roof.reflection)
  )
    fail();
  if (['aftermath', 'complete'].includes(c.roof.stage) && c.roof.checkpoint) fail();
  if (c.roof.stage === 'aftermath' && c.roof.reflection) fail();
  if (
    c.roof.stage === 'complete' &&
    (!c.roof.reflection || c.roof.aftermath.length !== ROOF_AFTERMATH.length)
  )
    fail();
  if (region === 'roof-account' && c.roof.stage !== 'witnessing') fail();
  if (!['capernaum', 'lake-gennesaret'].includes(region) && c.roof.stage === 'not-started') fail();
  if (
    c.walk.stage === 'not-started' &&
    (c.walk.route ||
      c.walk.step ||
      c.walk.gateOpen ||
      c.walk.position.x !== -9 ||
      c.walk.position.z !== -5)
  )
    fail();
  if (
    c.walk.stage === 'invited' &&
    (c.walk.step !== 0 || c.walk.position.x !== -9 || c.walk.position.z !== -5)
  )
    fail();
  if (c.walk.gateOpen && c.walk.route !== 'passage') fail();
  if (['walking', 'arrived', 'complete'].includes(c.walk.stage)) {
    if (!c.walk.route || (c.walk.route === 'passage' && !c.walk.gateOpen)) fail();
    const length = WALK_ROUTES[c.walk.route].length;
    if (c.walk.stage === 'walking' ? c.walk.step >= length : c.walk.step !== length) fail();
    if (
      ['arrived', 'complete'].includes(c.walk.stage) &&
      (c.walk.position.x !== 4 || c.walk.position.z !== 5)
    )
      fail();
  }
  if (c.table.stage === 'not-started' && (c.table.location || c.table.delivered.length)) fail();
  if (!c.table.location && c.table.delivered.length) fail();
  if (c.table.stage === 'complete' && (!c.table.location || c.table.delivered.length !== 2)) fail();
  if (c.carrying === 'cart-handle' && (c.walk.route !== 'passage' || c.walk.gateOpen)) fail();
  if (c.carrying && ['bread-basket', 'empty-jug', 'water-jug'].includes(c.carrying)) {
    if (c.table.stage !== 'preparing' || !c.table.location) fail();
    if (c.table.delivered.includes(c.carrying === 'bread-basket' ? 'bread' : 'water')) fail();
  }
  const visited: CampaignState['visited'] = {};
  for (const [id, point] of Object.entries(raw.visited)) {
    if (!member(id, EXPLORATION_REGIONS) || !validPoint(point, regionBounds(id as RegionId)))
      fail();
    visited[id as ExplorationRegion] = { x: point.x, z: point.z };
  }
  return {
    roof: {
      stage: c.roof.stage,
      checkpoint: c.roof.checkpoint,
      aftermath: [...c.roof.aftermath],
      reflection: c.roof.reflection,
    },
    walk: {
      stage: c.walk.stage,
      route: c.walk.route,
      gateOpen: c.walk.gateOpen,
      step: c.walk.step,
      position: { ...c.walk.position },
    },
    table: { stage: c.table.stage, location: c.table.location, delivered: [...c.table.delivered] },
    carrying: c.carrying,
    notes: [...c.notes],
    visited,
  };
}
