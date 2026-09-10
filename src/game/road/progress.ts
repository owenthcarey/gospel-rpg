import type { GameState } from '../types';
import type { Gateway } from '../../content/campaign/places';
import { companyMeeting, COMPANY_PATHS } from '../../content/road/routes';
import { nearRoadPlace, roadActionAllowed } from '../../content/road/actions';
import { distance } from '../pathfinding';
import {
  isRoadRegion,
  NAIN_AFTERMATH,
  NAIN_SCENES,
  NAIN_REFLECTIONS,
  TRAIL_EVIDENCE,
  TRAIL_INTERPRETATIONS,
  TRAIL_ENDINGS,
  COMPANY_ROUTES,
  type RoadEvent,
  type RoadState,
} from './types';

export function roadJournalIds(r: RoadState): string[] {
  const ids: string[] = [],
    c = r.chapter,
    t = r.trail,
    w = r.company;
  if (c.stage !== 'not-started') ids.push('nain-invitation');
  const scenes = ['aftermath', 'complete'].includes(c.stage)
    ? NAIN_SCENES
    : c.checkpoint
      ? NAIN_SCENES.slice(0, NAIN_SCENES.indexOf(c.checkpoint))
      : [];
  ids.push(
    ...scenes.map((id) => 'nain-scene-' + id),
    ...c.aftermath.map((id) => 'nain-after-' + id),
  );
  if (c.reflection) ids.push('nain-reflection-' + c.reflection, 'nain-complete');
  if (t.stage !== 'not-started') ids.push('trail-invitation');
  ids.push(...t.evidence.map((id) => 'trail-evidence-' + id));
  if (['interpreted', 'arrived', 'complete'].includes(t.stage)) ids.push('trail-interpreted');
  if (['arrived', 'complete'].includes(t.stage)) ids.push('trail-arrived');
  if (t.ending) ids.push('trail-ending-' + t.ending, 'trail-complete');
  if (w.stage !== 'not-started') ids.push('company-invitation');
  if (w.route) ids.push('company-route-' + w.route);
  if (['arrived', 'complete'].includes(w.stage)) ids.push('company-arrived');
  if (w.stage === 'complete') ids.push('company-complete');
  return ids;
}
export function recordRoadJournal(next: GameState): void {
  for (const id of roadJournalIds(next.road)) if (!next.journal.includes(id)) next.journal.push(id);
}
export function visitPosition(s: GameState, region: Gateway['from']) {
  return isRoadRegion(region) ? s.road.visited[region] : s.campaign.visited[region];
}
export function rememberPosition(
  s: GameState,
  region: Gateway['from'],
  position = s.position,
): void {
  if (isRoadRegion(region)) s.road.visited[region] = { ...position };
  else s.campaign.visited[region] = { ...position };
}
/** Called only after a guarded, deliberate gateway action. A different exit leaves Neri behind. */
export function companyTravelsThrough(s: GameState, gate: Gateway): boolean {
  const w = s.road.company,
    meeting = companyMeeting(w);
  return (
    meeting?.exit === gate.id &&
    w.region === gate.from &&
    distance(s.position, meeting) < 2.8 &&
    distance(w.position, meeting) <= 1.2 &&
    isRoadRegion(gate.to)
  );
}
export function roadJourney(next: GameState, gate: Gateway, previous: GameState): void {
  if (isRoadRegion(gate.to) && next.road.chapter.stage === 'not-started') {
    next.road.chapter.stage = 'exploring';
    if (['main', 'roof', 'nain'].includes(next.tracking)) next.tracking = 'nain';
  }
  const w = next.road.company;
  if (companyTravelsThrough(previous, gate) && isRoadRegion(gate.to)) {
    w.step++;
    w.region = gate.to;
    w.position = { ...gate.arrival };
    // Arrive together even when the player has an older remembered position in this region.
    next.position = { ...gate.arrival };
  }
  recordRoadJournal(next);
}
export function nainReadyReflection(s: GameState): boolean {
  return NAIN_AFTERMATH.every((id) => s.road.chapter.aftermath.includes(id));
}
function backToGate(next: GameState): void {
  next.region = 'nain-gate';
  next.position = { ...(next.road.visited['nain-gate'] ?? { x: 0, z: -5 }) };
}
export function transitionRoad(state: GameState, event: RoadEvent): GameState {
  if (state.campaign.roof.stage !== 'complete') return state;
  const next = structuredClone(state),
    r = next.road,
    t = r.trail,
    w = r.company,
    c = r.chapter;
  switch (event.type) {
    case 'road-action':
      if (!roadActionAllowed(state, event.id)) return state;
      switch (event.id) {
        case 'trail-accept':
          t.stage = 'exploring';
          next.tracking = 'trail';
          break;
        case 'trail-arrive':
          t.stage = 'arrived';
          break;
        case 'company-accept':
          w.stage = 'invited';
          next.tracking = 'company';
          break;
        case 'company-start':
          w.stage = 'walking';
          next.tracking = 'company';
          break;
        case 'company-finish':
          w.stage = 'complete';
          break;
        case 'nain-enter':
          rememberPosition(next, 'nain-gate');
          c.stage = 'witnessing';
          c.checkpoint ??= NAIN_SCENES[0];
          next.region = 'nain-account';
          next.tracking = 'nain';
          break;
        case 'nain-after-gate':
          c.aftermath.push('gate');
          break;
        case 'nain-after-courtyard':
          c.aftermath.push('courtyard');
          break;
        case 'nain-after-neighbor':
          c.aftermath.push('neighbor');
          break;
      }
      break;
    case 'road-evidence':
      if (
        !TRAIL_EVIDENCE.includes(event.id) ||
        t.stage !== 'exploring' ||
        t.evidence.includes(event.id) ||
        !nearRoadPlace(state, 'road-' + event.id)
      )
        return state;
      t.evidence.push(event.id);
      break;
    case 'road-interpret':
      if (
        !TRAIL_INTERPRETATIONS.includes(event.id) ||
        t.stage !== 'exploring' ||
        t.evidence.length !== 2 ||
        !nearRoadPlace(state, 'tamar')
      )
        return state;
      t.interpretation = event.id;
      if (event.id === 'shelter') t.stage = 'interpreted';
      break;
    case 'road-ending':
      if (
        !TRAIL_ENDINGS.includes(event.id) ||
        t.stage !== 'arrived' ||
        !nearRoadPlace(state, 'tamar')
      )
        return state;
      t.ending = event.id;
      t.stage = 'complete';
      break;
    case 'road-hint':
      if (t.stage === 'not-started' || t.stage === 'complete' || t.hint === 3) return state;
      t.hint++;
      break;
    case 'road-route':
      if (
        !COMPANY_ROUTES.includes(event.id) ||
        w.stage !== 'invited' ||
        w.route ||
        !nearRoadPlace(state, 'neri')
      )
        return state;
      w.route = event.id;
      break;
    case 'road-step': {
      const meeting = companyMeeting(w);
      if (
        !meeting ||
        meeting.exit ||
        w.step !== event.step ||
        state.region !== w.region ||
        meeting.region !== w.region ||
        distance(state.position, meeting) > 2.6 ||
        distance(w.position, meeting) > 1.2
      )
        return state;
      w.position = { x: meeting.x, z: meeting.z };
      w.step++;
      if (w.step === COMPANY_PATHS[w.route!].length) w.stage = 'arrived';
      break;
    }
    case 'nain-next':
    case 'nain-summary': {
      if (
        state.region !== 'nain-account' ||
        c.stage !== 'witnessing' ||
        c.checkpoint !== event.checkpoint
      )
        return state;
      const following = NAIN_SCENES[NAIN_SCENES.indexOf(event.checkpoint) + 1];
      if (event.type === 'nain-next' && following) c.checkpoint = following;
      else {
        c.stage = 'aftermath';
        c.checkpoint = null;
        backToGate(next);
      }
      break;
    }
    case 'nain-leave':
      if (state.region !== 'nain-account' || c.stage !== 'witnessing') return state;
      backToGate(next);
      break;
    case 'nain-reflect':
      if (
        !NAIN_REFLECTIONS.includes(event.id) ||
        c.stage !== 'aftermath' ||
        !nainReadyReflection(state) ||
        !nearRoadPlace(state, 'nain-viewpoint')
      )
        return state;
      c.reflection = event.id;
      c.stage = 'complete';
      break;
  }
  if (isRoadRegion(next.region)) rememberPosition(next, next.region);
  recordRoadJournal(next);
  return next;
}
