import type { GameState } from '../types';
import type { Gateway } from '../../content/campaign/places';
import { localLakePlaces, lakeGateways } from '../../content/lake/places';
import { distance } from '../pathfinding';
import { LANDINGS, normalizeHeading, waterPosition } from './navigation';
import {
  isLakeRegion,
  LAKE_EVIDENCE,
  LAKE_INTERPRETATIONS,
  LAKE_ENDINGS,
  STORM_SCENES,
  STORM_REFLECTIONS,
  type LakeEvent,
  type LakeState,
  type Berth,
} from './types';

export function lakeJournalIds(l: LakeState): string[] {
  const ids: string[] = [],
    c = l.chapter,
    t = l.trail;
  if (c.stage !== 'not-started') ids.push('storm-invitation');
  const scenes = ['aftermath', 'complete'].includes(c.stage)
    ? STORM_SCENES
    : c.checkpoint
      ? STORM_SCENES.slice(0, STORM_SCENES.indexOf(c.checkpoint))
      : [];
  ids.push(
    ...scenes.map((id) => 'storm-scene-' + id),
    ...c.aftermath.map((id) => 'storm-after-' + id),
  );
  if (c.reflection) ids.push('storm-reflection-' + c.reflection, 'storm-complete');
  if (t.stage !== 'not-started') ids.push('crossing-invitation');
  ids.push(...t.evidence.map((id) => 'crossing-evidence-' + id));
  if (['interpreted', 'arrived', 'complete'].includes(t.stage)) ids.push('crossing-interpreted');
  if (['arrived', 'complete'].includes(t.stage)) ids.push('crossing-arrived');
  if (t.ending) ids.push('crossing-ending-' + t.ending, 'crossing-complete');
  ids.push(...l.notes.map((id) => 'lake-note-' + id));
  return ids;
}
function record(next: GameState): GameState {
  if (isLakeRegion(next.region)) next.lake.visited[next.region] = { ...next.position };
  for (const id of lakeJournalIds(next.lake)) if (!next.journal.includes(id)) next.journal.push(id);
  return next;
}
export function nearLakePlace(s: GameState, id: string): boolean {
  return localLakePlaces(s).some((p) => p.id === id && distance(s.position, p) < 2.8);
}
export function lakeGateAllowed(s: GameState, gate: Gateway): boolean {
  if (
    s.road.chapter.stage !== 'complete' ||
    gate.from !== s.region ||
    distance(s.position, gate) >= 2.8
  )
    return false;
  return gate.to === 'galilee-water'
    ? s.lake.boat.mode === 'ashore' && s.lake.boat.berth === gate.from
    : s.lake.boat.mode === 'afloat' && waterPosition(s.position);
}
/** Boarding/docking always commits together with a successful transactional scene load. */
export function transitionBoat(state: GameState, gateway: string): GameState {
  const gate = lakeGateways.find((g) => g.id === gateway);
  if (!gate || !lakeGateAllowed(state, gate)) return state;
  const next = structuredClone(state),
    b = next.lake.boat;
  if (isLakeRegion(state.region)) next.lake.visited[state.region] = { ...state.position };
  else next.campaign.visited.capernaum = { ...state.position };
  if (gate.to === 'galilee-water') {
    b.mode = 'afloat';
    b.berth = null;
    b.position = { ...gate.arrival };
    b.heading = normalizeHeading(gate.from === 'capernaum' ? Math.PI / 2 : -Math.PI / 2);
  } else {
    b.mode = 'ashore';
    b.berth = gate.to as Berth;
    b.position = { ...LANDINGS[b.berth].water };
  }
  next.region = gate.to;
  next.position = { ...gate.arrival };
  if (next.lake.chapter.stage === 'not-started') {
    next.lake.chapter.stage = 'exploring';
    if (['main', 'nain'].includes(next.tracking)) next.tracking = 'storm';
  }
  return record(next);
}
function returnToCove(next: GameState): void {
  next.region = 'sheltered-cove';
  next.position = { ...(next.lake.visited['sheltered-cove'] ?? { x: -2, z: 0 }) };
}
export function transitionLake(state: GameState, event: LakeEvent): GameState {
  if (state.road.chapter.stage !== 'complete') return state;
  const next = structuredClone(state),
    l = next.lake,
    t = l.trail,
    c = l.chapter;
  switch (event.type) {
    case 'lake-action': {
      const id = event.id;
      if (id === 'accept' && t.stage === 'not-started' && nearLakePlace(state, 'joel')) {
        t.stage = 'exploring';
        next.tracking = 'crossing';
      } else if (id.startsWith('evidence-')) {
        const evidence = LAKE_EVIDENCE.find((v) => 'evidence-' + v === id);
        if (
          !evidence ||
          t.stage !== 'exploring' ||
          t.evidence.includes(evidence) ||
          !nearLakePlace(state, 'lake-' + evidence)
        )
          return state;
        t.evidence.push(evidence);
      } else if (id === 'arrive' && t.stage === 'interpreted' && nearLakePlace(state, 'cove-shore'))
        t.stage = 'arrived';
      else if (
        id === 'enter' &&
        ['exploring', 'witnessing'].includes(c.stage) &&
        nearLakePlace(state, 'storm-viewpoint')
      ) {
        l.visited['sheltered-cove'] = { ...state.position };
        c.stage = 'witnessing';
        c.checkpoint ??= STORM_SCENES[0];
        next.region = 'storm-account';
        next.tracking = 'storm';
      } else if (id.startsWith('after-')) {
        const after = (
          {
            'after-landing': 'landing',
            'after-lookout': 'lookout',
            'after-neighbor': 'neighbor',
          } as const
        )[id as 'after-landing'];
        const target =
          after === 'landing' ? 'cove-shore' : after === 'lookout' ? 'cove-lookout' : 'dalia';
        if (
          !after ||
          !['aftermath', 'complete'].includes(c.stage) ||
          c.aftermath.includes(after) ||
          !nearLakePlace(state, target)
        )
          return state;
        c.aftermath.push(after);
      } else if (id === 'reed-shore' || id === 'cove-shore') {
        if (!nearLakePlace(state, id) || l.notes.includes(id)) return state;
        l.notes.push(id);
      } else return state;
      break;
    }
    case 'lake-interpret':
      if (
        !LAKE_INTERPRETATIONS.includes(event.id) ||
        t.stage !== 'exploring' ||
        t.evidence.length !== 2 ||
        t.interpretation === event.id
      )
        return state;
      t.interpretation = event.id;
      if (event.id === 'sheltered') t.stage = 'interpreted';
      break;
    case 'lake-hint':
      if (t.stage === 'not-started' || t.stage === 'complete' || t.hint === 3) return state;
      t.hint++;
      break;
    case 'lake-ending':
      if (
        !LAKE_ENDINGS.includes(event.id) ||
        t.stage !== 'arrived' ||
        !nearLakePlace(state, 'joel')
      )
        return state;
      t.ending = event.id;
      t.stage = 'complete';
      break;
    case 'storm-next':
    case 'storm-summary': {
      if (
        state.region !== 'storm-account' ||
        c.stage !== 'witnessing' ||
        c.checkpoint !== event.checkpoint ||
        !STORM_SCENES.includes(event.checkpoint)
      )
        return state;
      const following = STORM_SCENES[STORM_SCENES.indexOf(event.checkpoint) + 1];
      if (event.type === 'storm-next' && following) c.checkpoint = following;
      else {
        c.stage = 'aftermath';
        c.checkpoint = null;
        returnToCove(next);
      }
      break;
    }
    case 'storm-leave':
      if (state.region !== 'storm-account' || c.stage !== 'witnessing') return state;
      returnToCove(next);
      break;
    case 'storm-reflect':
      if (
        !STORM_REFLECTIONS.includes(event.id) ||
        c.stage !== 'aftermath' ||
        c.aftermath.length !== 3 ||
        !nearLakePlace(state, 'storm-viewpoint')
      )
        return state;
      c.reflection = event.id;
      c.stage = 'complete';
      break;
  }
  return record(next);
}
