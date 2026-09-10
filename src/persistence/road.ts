import { isRecord, idList } from './episode';
import { validPoint } from './campaign';
import {
  COMPANY_ROUTES,
  isRoadRegion,
  NAIN_AFTERMATH,
  NAIN_REFLECTIONS,
  NAIN_SCENES,
  NERI_START,
  TRAIL_ENDINGS,
  TRAIL_EVIDENCE,
  TRAIL_INTERPRETATIONS,
  type RoadState,
} from '../game/road/types';
import type { RegionId } from '../game/campaign/types';
import { COMPANY_PATHS } from '../content/road/routes';
import { roadLayouts } from '../content/road/layouts';
import { distance, findPath, WalkGrid } from '../game/pathfinding';
import type { Point } from '../game/types';
const member = (v: unknown, ids: readonly string[]) => typeof v === 'string' && ids.includes(v);
function fail(): never {
  throw new Error('Inconsistent road progress.');
}
export function reachableRoadPosition(region: string, position: unknown): position is Point {
  if (!isRoadRegion(region) || !validPoint(position, 16)) return false;
  const layout = roadLayouts[region],
    grid = new WalkGrid(layout.obstacles, layout.terrain, -16, 16);
  return grid.walkable(position) && findPath(grid, { x: 0, z: -9 }, position).length > 0;
}
export function parseRoad(
  raw: unknown,
  roofStage: string,
  region: RegionId,
  position: unknown,
): RoadState {
  if (
    !isRecord(raw) ||
    !isRecord(raw.chapter) ||
    !isRecord(raw.trail) ||
    !isRecord(raw.company) ||
    !isRecord(raw.visited)
  )
    fail();
  const c = raw.chapter,
    t = raw.trail,
    w = raw.company;
  if (
    !member(c.stage, ['not-started', 'exploring', 'witnessing', 'aftermath', 'complete']) ||
    (c.checkpoint !== null && !member(c.checkpoint, NAIN_SCENES)) ||
    !idList(c.aftermath, NAIN_AFTERMATH) ||
    (c.reflection !== null && !member(c.reflection, NAIN_REFLECTIONS)) ||
    !member(t.stage, ['not-started', 'exploring', 'interpreted', 'arrived', 'complete']) ||
    !idList(t.evidence, TRAIL_EVIDENCE) ||
    (t.interpretation !== null && !member(t.interpretation, TRAIL_INTERPRETATIONS)) ||
    (t.ending !== null && !member(t.ending, TRAIL_ENDINGS)) ||
    typeof t.hint !== 'number' ||
    !Number.isInteger(t.hint) ||
    t.hint < 0 ||
    t.hint > 3 ||
    !member(w.stage, ['not-started', 'invited', 'walking', 'arrived', 'complete']) ||
    (w.route !== null && !member(w.route, COMPANY_ROUTES)) ||
    typeof w.step !== 'number' ||
    !Number.isInteger(w.step) ||
    w.step < 0 ||
    typeof w.region !== 'string' ||
    !reachableRoadPosition(w.region, w.position)
  )
    fail();
  const r = raw as unknown as RoadState;
  if (r.chapter.stage !== 'not-started' && roofStage !== 'complete') fail();
  if (r.chapter.stage !== 'not-started' && !r.visited['galilean-road']) fail();
  if (isRoadRegion(region) && !r.visited[region]) fail();
  if (['witnessing', 'aftermath', 'complete'].includes(r.chapter.stage) && !r.visited['nain-gate'])
    fail();
  if (['arrived', 'complete'].includes(r.trail.stage) && !r.visited['roadside-farm']) fail();
  if (
    r.company.stage !== 'not-started' &&
    (!r.visited['roadside-farm'] || !r.visited[r.company.region])
  )
    fail();
  if (
    r.chapter.stage === 'not-started' &&
    (r.trail.stage !== 'not-started' ||
      r.company.stage !== 'not-started' ||
      Object.keys(r.visited).length)
  )
    fail();
  if (
    ['not-started', 'exploring'].includes(r.chapter.stage) &&
    (r.chapter.checkpoint || r.chapter.aftermath.length || r.chapter.reflection)
  )
    fail();
  if (
    r.chapter.stage === 'witnessing' &&
    (!r.chapter.checkpoint || r.chapter.aftermath.length || r.chapter.reflection)
  )
    fail();
  if (['aftermath', 'complete'].includes(r.chapter.stage) && r.chapter.checkpoint) fail();
  if (r.chapter.stage === 'aftermath' && r.chapter.reflection) fail();
  if (r.chapter.stage === 'complete' && (!r.chapter.reflection || r.chapter.aftermath.length !== 3))
    fail();
  if (region === 'nain-account' && (r.chapter.stage !== 'witnessing' || !r.visited['nain-gate']))
    fail();
  if (
    isRoadRegion(region) &&
    (r.chapter.stage === 'not-started' || !reachableRoadPosition(region, position))
  )
    fail();
  if (
    r.trail.stage === 'not-started' &&
    (r.trail.evidence.length || r.trail.interpretation || r.trail.ending || r.trail.hint)
  )
    fail();
  if (r.trail.stage === 'exploring' && (r.trail.ending || r.trail.interpretation === 'shelter'))
    fail();
  if (r.trail.interpretation && r.trail.evidence.length !== 2) fail();
  if (
    ['interpreted', 'arrived', 'complete'].includes(r.trail.stage) &&
    (r.trail.evidence.length !== 2 || r.trail.interpretation !== 'shelter')
  )
    fail();
  if ((r.trail.stage === 'complete') !== !!r.trail.ending) fail();
  if (
    ['not-started', 'invited'].includes(r.company.stage) &&
    (r.company.step ||
      r.company.region !== 'roadside-farm' ||
      distance(r.company.position, NERI_START) > 0.001)
  )
    fail();
  if (r.company.stage === 'not-started' && r.company.route) fail();
  if (['walking', 'arrived', 'complete'].includes(r.company.stage)) {
    if (!r.company.route) fail();
    const path = COMPANY_PATHS[r.company.route];
    if (r.company.stage === 'walking') {
      const meeting = path[r.company.step];
      if (!meeting || meeting.region !== r.company.region) fail();
    } else if (
      r.company.step !== path.length ||
      r.company.region !== 'nain-gate' ||
      distance(r.company.position, path[path.length - 1]!) > 0.001
    )
      fail();
  }
  const visited: RoadState['visited'] = {};
  for (const [id, p] of Object.entries(raw.visited)) {
    if (!isRoadRegion(id) || !reachableRoadPosition(id, p)) fail();
    visited[id] = { x: p.x, z: p.z };
  }
  return {
    chapter: {
      stage: r.chapter.stage,
      checkpoint: r.chapter.checkpoint,
      aftermath: [...r.chapter.aftermath],
      reflection: r.chapter.reflection,
    },
    trail: {
      stage: r.trail.stage,
      evidence: [...r.trail.evidence],
      interpretation: r.trail.interpretation,
      ending: r.trail.ending,
      hint: r.trail.hint,
    },
    company: {
      stage: r.company.stage,
      route: r.company.route,
      step: r.company.step,
      region: r.company.region,
      position: { x: r.company.position.x, z: r.company.position.z },
    },
    visited,
  };
}
