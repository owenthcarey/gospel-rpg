import { isRecord, idList } from './episode';
import { validPoint } from './campaign';
import {
  BERTHS,
  isLakeRegion,
  LAKE_EVIDENCE,
  LAKE_INTERPRETATIONS,
  LAKE_ENDINGS,
  STORM_AFTERMATH,
  STORM_REFLECTIONS,
  STORM_SCENES,
  type LakeState,
} from '../game/lake/types';
import { LANDINGS, waterPosition } from '../game/lake/navigation';
import { distance, findPath, WalkGrid } from '../game/pathfinding';
import { lakeLayouts } from '../content/lake/layouts';
import type { Point } from '../game/types';
import type { RegionId } from '../game/campaign/types';
const member = (v: unknown, ids: readonly string[]) => typeof v === 'string' && ids.includes(v);
function fail(): never {
  throw new Error('This save contains inconsistent lake travel or Gospel progress.');
}
export function reachableLakePosition(region: string, position: unknown): position is Point {
  if (!isLakeRegion(region) || !validPoint(position, region === 'galilee-water' ? 25 : 16))
    return false;
  const layout = lakeLayouts[region];
  const grid = new WalkGrid(layout.obstacles, layout.terrain, layout.bounds.min, layout.bounds.max);
  return (
    grid.walkable(position) &&
    findPath(
      grid,
      region === 'galilee-water' ? LANDINGS.capernaum.water : { x: 0, z: -6 },
      position,
    ).length > 0
  );
}
export function parseLake(
  raw: unknown,
  nainStage: string,
  region: RegionId,
  position: unknown,
): LakeState {
  if (
    !isRecord(raw) ||
    !isRecord(raw.boat) ||
    !isRecord(raw.trail) ||
    !isRecord(raw.chapter) ||
    !isRecord(raw.visited)
  )
    fail();
  const b = raw.boat,
    t = raw.trail,
    c = raw.chapter;
  if (
    !member(b.mode, ['ashore', 'afloat']) ||
    (b.berth !== null && !member(b.berth, BERTHS)) ||
    !validPoint(b.position, 25) ||
    !waterPosition(b.position) ||
    typeof b.heading !== 'number' ||
    !Number.isFinite(b.heading) ||
    b.heading < 0 ||
    b.heading >= Math.PI * 2 ||
    !member(t.stage, ['not-started', 'exploring', 'interpreted', 'arrived', 'complete']) ||
    !idList(t.evidence, LAKE_EVIDENCE) ||
    (t.interpretation !== null && !member(t.interpretation, LAKE_INTERPRETATIONS)) ||
    (t.ending !== null && !member(t.ending, LAKE_ENDINGS)) ||
    typeof t.hint !== 'number' ||
    !Number.isInteger(t.hint) ||
    t.hint < 0 ||
    t.hint > 3 ||
    !member(c.stage, ['not-started', 'exploring', 'witnessing', 'aftermath', 'complete']) ||
    (c.checkpoint !== null && !member(c.checkpoint, STORM_SCENES)) ||
    !idList(c.aftermath, STORM_AFTERMATH) ||
    (c.reflection !== null && !member(c.reflection, STORM_REFLECTIONS)) ||
    !idList(raw.notes, ['reed-shore', 'cove-shore'])
  )
    fail();
  const l = raw as unknown as LakeState;
  if (
    nainStage !== 'complete' &&
    (c.stage !== 'not-started' || t.stage !== 'not-started' || b.heading !== 0)
  )
    fail();
  if ((region === 'galilee-water') !== (l.boat.mode === 'afloat')) fail();
  if (l.boat.mode === 'afloat') {
    if (
      l.boat.berth !== null ||
      !validPoint(position, 25) ||
      !waterPosition(position) ||
      distance(l.boat.position, position) > 0.001
    )
      fail();
  } else {
    if (!l.boat.berth || distance(l.boat.position, LANDINGS[l.boat.berth].water) > 0.001) fail();
    if ((region === 'reed-landing' || region === 'sheltered-cove') && l.boat.berth !== region)
      fail();
    if (
      l.boat.berth !== 'capernaum' &&
      !['reed-landing', 'sheltered-cove', 'storm-account'].includes(region)
    )
      fail();
  }
  for (const [id, p] of Object.entries(raw.visited)) {
    if (!reachableLakePosition(id, p)) fail();
  }
  if (isLakeRegion(region) && (!l.visited[region] || !reachableLakePosition(region, position)))
    fail();
  if (c.stage === 'not-started') {
    if (
      l.boat.mode !== 'ashore' ||
      l.boat.berth !== 'capernaum' ||
      Object.keys(l.visited).length ||
      l.notes.length ||
      t.evidence.length ||
      !['not-started', 'exploring'].includes(l.trail.stage)
    )
      fail();
  } else if (!l.visited['galilee-water'] || nainStage !== 'complete') fail();
  if (
    ['not-started', 'exploring'].includes(l.chapter.stage) &&
    (c.checkpoint || l.chapter.aftermath.length || c.reflection)
  )
    fail();
  if (c.stage === 'witnessing' && (!c.checkpoint || l.chapter.aftermath.length || c.reflection))
    fail();
  if (
    ['witnessing', 'aftermath', 'complete'].includes(l.chapter.stage) &&
    !l.visited['sheltered-cove']
  )
    fail();
  if (['aftermath', 'complete'].includes(l.chapter.stage) && c.checkpoint) fail();
  if (
    (c.stage === 'complete') !== !!c.reflection ||
    (c.stage === 'complete' && l.chapter.aftermath.length !== 3)
  )
    fail();
  if (
    region === 'storm-account' &&
    (c.stage !== 'witnessing' || l.boat.mode !== 'ashore' || l.boat.berth !== 'sheltered-cove')
  )
    fail();
  if (
    t.stage === 'not-started' &&
    (l.trail.evidence.length || t.interpretation || t.ending || t.hint)
  )
    fail();
  if (t.stage === 'exploring' && t.interpretation === 'sheltered') fail();
  if (t.interpretation && l.trail.evidence.length !== 2) fail();
  if (
    ['interpreted', 'arrived', 'complete'].includes(l.trail.stage) &&
    (l.trail.evidence.length !== 2 || t.interpretation !== 'sheltered')
  )
    fail();
  if (l.trail.evidence.length && !l.visited['galilee-water']) fail();
  if (['arrived', 'complete'].includes(l.trail.stage) && !l.visited['sheltered-cove']) fail();
  if ((t.stage === 'complete') !== !!t.ending) fail();
  if (l.notes.includes('reed-shore') && !l.visited['reed-landing']) fail();
  if (l.notes.includes('cove-shore') && !l.visited['sheltered-cove']) fail();
  // Copy only known fields; uploaded objects never become runtime capabilities.
  return {
    boat: {
      mode: l.boat.mode,
      berth: l.boat.berth,
      position: { ...l.boat.position },
      heading: l.boat.heading,
    },
    trail: {
      stage: l.trail.stage,
      evidence: [...l.trail.evidence],
      interpretation: l.trail.interpretation,
      hint: l.trail.hint,
      ending: l.trail.ending,
    },
    chapter: {
      stage: l.chapter.stage,
      checkpoint: l.chapter.checkpoint,
      aftermath: [...l.chapter.aftermath],
      reflection: l.chapter.reflection,
    },
    notes: [...l.notes],
    visited: Object.fromEntries(
      Object.entries(l.visited).map(([id, p]) => [id, { x: p.x, z: p.z }]),
    ),
  };
}
