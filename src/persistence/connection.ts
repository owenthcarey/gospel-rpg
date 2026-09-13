import type { GameState } from '../game/types';
import {
  ACCOUNTS,
  HOME_VISITS,
  HOME_CHOICES,
  HOME_REFLECTIONS,
  type ConnectionState,
} from '../game/connection/types';
import { isRecord } from './episode';
import { canReplay } from '../game/connection/accounts';
import { knownDestination } from '../game/connection/routes';
import { homeAvailable } from '../content/connection/home';
export function parseConnection(raw: unknown, state: GameState): ConnectionState {
  const fail = (): never => {
    throw new Error('This save contains inconsistent route, replay or homecoming progress.');
  };
  if (!isRecord(raw) || !isRecord(raw.home) || !isRecord(raw.home.visits)) fail();
  const r = raw as Record<string, unknown>;
  const home = r.home as Record<string, unknown>;
  const visits = home.visits as Record<string, unknown>;
  if (
    Object.entries(visits).some(
      ([id, choice]) =>
        !HOME_VISITS.includes(id as (typeof HOME_VISITS)[number]) ||
        typeof choice !== 'string' ||
        !(HOME_CHOICES[id as (typeof HOME_VISITS)[number]] as readonly string[]).includes(choice),
    )
  )
    fail();
  if (
    home.reflection !== null &&
    !HOME_REFLECTIONS.includes(home.reflection as (typeof HOME_REFLECTIONS)[number])
  )
    fail();
  if (home.reflection && HOME_VISITS.some((id) => !visits[id])) fail();
  if (
    !homeAvailable(state) &&
    (Object.keys(visits).length || home.reflection || state.tracking === 'home')
  )
    fail();
  let route: ConnectionState['route'] = null;
  if (r.route !== null) {
    if (
      !isRecord(r.route) ||
      typeof r.route.target !== 'string' ||
      !knownDestination(state, r.route.target)
    )
      fail();
    route = { target: (r.route as { target: string }).target };
    if (route.target.startsWith('home-') && !homeAvailable(state)) fail();
  }
  let replay: ConnectionState['replay'] = null;
  if (r.replay !== null) {
    if (
      !isRecord(r.replay) ||
      !ACCOUNTS.includes(r.replay.account as (typeof ACCOUNTS)[number]) ||
      typeof r.replay.checkpoint !== 'string'
    )
      fail();
    const value = r.replay as NonNullable<ConnectionState['replay']>;
    if (!canReplay(state, value.account, value.checkpoint)) fail();
    replay = { account: value.account, checkpoint: value.checkpoint };
  }
  return {
    route,
    replay,
    home: {
      visits: { ...visits } as ConnectionState['home']['visits'],
      reflection: home.reflection as ConnectionState['home']['reflection'],
    },
  };
}
