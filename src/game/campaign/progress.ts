import type { GameState } from '../types';
import { distance } from '../pathfinding';
import { actionAllowed, noteTargets } from '../../content/campaign/actions';
import { gateways, localNeighborhoodPlaces, WALK_ROUTES } from '../../content/campaign/places';
import {
  isExploration,
  ROOF_AFTERMATH,
  ROOF_SCENES,
  type CampaignEvent,
  type CampaignState,
} from './types';

export function campaignJournalIds(c: CampaignState): string[] {
  const ids: string[] = [];
  const roof = c.roof;
  if (roof.stage !== 'not-started') ids.push('roof-invitation');
  const completed =
    roof.stage === 'aftermath' || roof.stage === 'complete'
      ? ROOF_SCENES
      : roof.checkpoint
        ? ROOF_SCENES.slice(0, ROOF_SCENES.indexOf(roof.checkpoint))
        : [];
  ids.push(...completed.map((id) => 'roof-scene-' + id));
  ids.push(...roof.aftermath.map((id) => 'roof-after-' + id));
  if (roof.reflection) ids.push('roof-reflection-' + roof.reflection, 'roof-complete');
  if (c.walk.stage !== 'not-started') ids.push('walk-invitation');
  if (c.walk.route) ids.push('walk-' + c.walk.route);
  if (c.walk.gateOpen) ids.push('walk-gate');
  if (c.walk.stage === 'arrived' || c.walk.stage === 'complete') ids.push('walk-arrived');
  if (c.walk.stage === 'complete') ids.push('walk-complete');
  if (c.table.stage !== 'not-started') ids.push('table-invitation');
  if (c.table.location) ids.push('table-' + c.table.location);
  ids.push(...c.table.delivered.map((id) => 'table-' + id));
  if (c.table.stage === 'complete') ids.push('table-complete');
  ids.push(...c.notes.map((id) => 'neighbor-note-' + id));
  return ids;
}
export function roofReturned(s: GameState): boolean {
  return s.campaign.roof.stage === 'aftermath' || s.campaign.roof.stage === 'complete';
}
export function roofReadyReflection(s: GameState): boolean {
  return ROOF_AFTERMATH.every((id) => s.campaign.roof.aftermath.includes(id));
}
function backToHouse(next: GameState): void {
  next.region = 'gathering-house';
  next.position = { ...(next.campaign.visited['gathering-house'] ?? { x: 0, z: -2 }) };
}
export function transitionCampaign(state: GameState, event: CampaignEvent): GameState {
  if (state.episode.stage !== 'complete') return state;
  const next = structuredClone(state),
    c = next.campaign;
  switch (event.type) {
    case 'journey': {
      const gate = gateways.find((g) => g.id === event.gateway && g.from === state.region);
      if (!gate || distance(state.position, gate) >= 2.8) return state;
      c.visited[gate.from] = { ...state.position };
      next.region = gate.to;
      next.position = { ...(c.visited[gate.to] ?? gate.arrival) };
      c.visited[gate.to] = { ...next.position };
      if (c.roof.stage === 'not-started') {
        c.roof.stage = 'exploring';
        next.tracking = 'roof';
      }
      break;
    }
    case 'campaign-action': {
      if (!actionAllowed(state, event.id)) return state;
      switch (event.id) {
        case 'roof-enter':
          c.visited['gathering-house'] = { ...state.position };
          if (c.roof.stage === 'exploring') {
            c.roof.stage = 'witnessing';
            c.roof.checkpoint = ROOF_SCENES[0];
          }
          next.region = 'roof-account';
          next.tracking = 'roof';
          break;
        case 'after-ruth':
          c.roof.aftermath.push('ruth');
          break;
        case 'after-hannah':
          c.roof.aftermath.push('hannah');
          break;
        case 'after-house':
          c.roof.aftermath.push('house');
          break;
        case 'walk-accept':
          c.walk.stage = 'invited';
          next.tracking = 'neighbors';
          break;
        case 'walk-passage':
          c.walk.route = 'passage';
          break;
        case 'walk-outer':
          c.walk.route = 'outer';
          break;
        case 'borrow-handle':
          c.carrying = 'cart-handle';
          break;
        case 'open-passage':
          c.walk.gateOpen = true;
          c.carrying = null;
          break;
        case 'walk-start':
          c.walk.stage = 'walking';
          next.tracking = 'neighbors';
          break;
        case 'walk-finish':
          c.walk.stage = 'complete';
          break;
        case 'table-accept':
          c.table.stage = 'preparing';
          next.tracking = 'table';
          break;
        case 'table-courtyard':
          c.table.location = 'courtyard';
          break;
        case 'table-bakehouse':
          c.table.location = 'bakehouse';
          break;
        case 'take-bread':
          c.carrying = 'bread-basket';
          break;
        case 'take-jug':
          c.carrying = 'empty-jug';
          break;
        case 'fill-jug':
          c.carrying = 'water-jug';
          break;
        case 'place-bread-courtyard':
        case 'place-bread-bakehouse':
          c.table.delivered.push('bread');
          c.carrying = null;
          break;
        case 'place-water-courtyard':
        case 'place-water-bakehouse':
          c.table.delivered.push('water');
          c.carrying = null;
          break;
        case 'table-finish':
          c.table.stage = 'complete';
          break;
        case 'return-bread':
        case 'return-jug':
        case 'return-handle':
          c.carrying = null;
          break;
        default:
          return state;
      }
      break;
    }
    case 'roof-next':
    case 'roof-summary': {
      if (
        state.region !== 'roof-account' ||
        c.roof.stage !== 'witnessing' ||
        c.roof.checkpoint !== event.checkpoint
      )
        return state;
      const following = ROOF_SCENES[ROOF_SCENES.indexOf(event.checkpoint) + 1];
      if (event.type === 'roof-next' && following) c.roof.checkpoint = following;
      else {
        c.roof.stage = 'aftermath';
        c.roof.checkpoint = null;
        backToHouse(next);
      }
      break;
    }
    case 'roof-leave':
      if (state.region !== 'roof-account' || c.roof.stage !== 'witnessing') return state;
      backToHouse(next);
      break;
    case 'roof-reflect':
      if (
        state.region !== 'gathering-house' ||
        c.roof.stage !== 'aftermath' ||
        !roofReadyReflection(state) ||
        distance(state.position, { x: 0, z: 1 }) >= 2.8
      )
        return state;
      c.roof.reflection = event.id;
      c.roof.stage = 'complete';
      break;
    case 'neighbor-note': {
      const place = localNeighborhoodPlaces(state).find(
        (p) => noteTargets[p.id] === event.id && distance(state.position, p) < 2.8,
      );
      if (!place || c.notes.includes(event.id)) return state;
      c.notes.push(event.id);
      break;
    }
    case 'walk-step': {
      if (state.region !== 'capernaum-lanes' || c.walk.stage !== 'walking' || !c.walk.route)
        return state;
      const route = WALK_ROUTES[c.walk.route],
        target = route[c.walk.step];
      if (
        !target ||
        distance(state.position, target) > 2.6 ||
        distance(c.walk.position, target) > 1.2
      )
        return state;
      c.walk.position = { ...target };
      c.walk.step++;
      if (c.walk.step === route.length) c.walk.stage = 'arrived';
      break;
    }
  }
  if (isExploration(next.region)) c.visited[next.region] = { ...next.position };
  for (const id of campaignJournalIds(c)) if (!next.journal.includes(id)) next.journal.push(id);
  return next;
}
