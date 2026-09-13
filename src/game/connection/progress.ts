import type { GameState } from '../types';
import { distance } from '../pathfinding';
import { accounts, canReplay } from './accounts';
import { routeDestination } from './routes';
import { homeAvailable, homePlaces, homeReady } from '../../content/connection/home';
import {
  HOME_CHOICES,
  HOME_REFLECTIONS,
  HOME_VISITS,
  type ConnectionEvent,
  type ConnectionState,
} from './types';
export function homeJournalIds(home: ConnectionState['home']): string[] {
  return [
    ...HOME_VISITS.flatMap((id) => (home.visits[id] ? ['home-' + id + '-' + home.visits[id]] : [])),
    ...(home.reflection ? ['home-reflection-' + home.reflection] : []),
  ];
}
export function transitionConnection(s: GameState, event: ConnectionEvent): GameState {
  const next = structuredClone(s),
    c = next.connection;
  if (s.connection.replay && !event.type.startsWith('replay-')) return s;
  switch (event.type) {
    case 'route-select':
      if (!routeDestination(s, event.target) || c.route?.target === event.target) return s;
      c.route = { target: event.target };
      break;
    case 'route-cancel':
      if (!c.route) return s;
      c.route = null;
      break;
    case 'route-arrive': {
      const destination = routeDestination(s, event.target);
      if (
        c.route?.target !== event.target ||
        !destination ||
        s.region !== destination.region ||
        distance(s.position, destination) >= 2.8
      )
        return s;
      c.route = null;
      break;
    }
    case 'replay-open':
      if (!canReplay(s, event.account, event.checkpoint)) return s;
      if (c.replay?.account === event.account && c.replay.checkpoint === event.checkpoint) return s;
      c.replay = { account: event.account, checkpoint: event.checkpoint };
      break;
    case 'replay-next':
    case 'replay-previous': {
      const r = c.replay;
      if (!r || r.account !== event.account || r.checkpoint !== event.checkpoint) return s;
      const scenes = accounts[r.account].scenes;
      const index =
        scenes.findIndex((b) => b.id === r.checkpoint) + (event.type === 'replay-next' ? 1 : -1);
      if (index < 0) return s;
      if (index === scenes.length) c.replay = null;
      else r.checkpoint = scenes[index]!.id;
      break;
    }
    case 'replay-close':
      if (!c.replay) return s;
      c.replay = null;
      break;
    case 'home-remember': {
      const place = homePlaces.find((p) => p.visit === event.visit);
      if (
        !homeAvailable(s) ||
        !place ||
        place.region !== s.region ||
        distance(place, s.position) >= 2.8 ||
        c.home.visits[event.visit] ||
        !(HOME_CHOICES[event.visit] as readonly string[]).includes(event.choice)
      )
        return s;
      c.home.visits[event.visit] = event.choice;
      next.tracking = 'home';
      break;
    }
    case 'home-reflect': {
      const shore = homePlaces.find((p) => p.visit === 'shore')!;
      if (
        !homeAvailable(s) ||
        !homeReady(s) ||
        c.home.reflection ||
        s.region !== shore.region ||
        distance(s.position, shore) >= 2.8 ||
        !HOME_REFLECTIONS.includes(event.choice)
      )
        return s;
      c.home.reflection = event.choice;
      next.tracking = 'home';
      break;
    }
  }
  for (const id of homeJournalIds(c.home)) if (!next.journal.includes(id)) next.journal.push(id);
  return next;
}
