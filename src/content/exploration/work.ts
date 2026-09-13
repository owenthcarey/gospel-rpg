import type { GameState, Point } from '../../game/types';
import { isPresenting } from '../../game/connection/accounts';
import { activeInteractables } from '../region';
import { practicalActions, type PracticalAction } from '../practical';
import { worldActions, actionBlocker, actionMotion } from '../campaign/actions';
import { galileeActions, galileeBlocker, canTurnChannel, galileeInReach } from '../galilee/actions';
import { allGalileePlaces } from '../galilee/places';
import { galileeText } from '../galilee/conversations';
import {
  CHANNEL_IDS,
  type ChannelId,
  type Direction,
  type RestSite,
} from '../../game/galilee/types';
import { DIRECTIONS, ports, traceWater } from '../../game/galilee/channel';
import { REST_LAYOUTS, checkArrangement } from '../../game/galilee/arrangement';
import { distance } from '../../game/pathfinding';

export interface WorkAction extends PracticalAction {
  notice?: string;
}
export interface WorkTarget {
  id: string;
  title: string;
  text: string;
  status: string;
  near: boolean;
  point: Point;
  focus: { center: Point; radius: number };
  family: 'spring' | 'shelter' | 'ordinary';
  actions: WorkAction[];
  related: { id: string; title: string; status?: string }[];
  channel?: ChannelId;
  site?: RestSite;
}
export interface ScreenPreview {
  site: RestSite;
  expected: Direction;
  direction: Direction;
}

export function screenCanMove(s: GameState, target: string): boolean {
  const r = s.galilee.shelter;
  return (
    r.stage === 'arranging' &&
    target === 'rest-' + r.site &&
    r.placed.includes('screen') &&
    !s.campaign.carrying &&
    galileeInReach(s, target)
  );
}
export function validPreview(s: GameState, target: string, preview: ScreenPreview): boolean {
  return (
    screenCanMove(s, target) &&
    preview.site === s.galilee.shelter.site &&
    preview.expected === s.galilee.shelter.screen &&
    Number.isInteger(preview.direction) &&
    preview.direction >= 0 &&
    preview.direction <= 3
  );
}
export function previewDescription(s: GameState, preview: ScreenPreview): string {
  const result = checkArrangement({ ...s.galilee.shelter, screen: preview.direction });
  return 'Preview · Screen to the ' + DIRECTIONS[preview.direction] + '. ' + result.message;
}

/** One presentation adapter for physical work. Reducers remain the authority for every command. */
export function workTarget(s: GameState, id: string): WorkTarget | undefined {
  if (isPresenting(s)) return;
  const p = activeInteractables(s).find((p) => p.id === id);
  if (!p || p.kind === 'person') return;
  const galilee = allGalileePlaces.some((p) => p.id === id);
  const family = galilee
    ? id.startsWith('spring-') || id.startsWith('channel-')
      ? 'spring'
      : 'shelter'
    : 'ordinary';
  const channel =
    id.startsWith('channel-') && CHANNEL_IDS.includes(id.slice(8) as ChannelId)
      ? (id.slice(8) as ChannelId)
      : undefined;
  const site = id === 'rest-shade' ? 'shade' : id === 'rest-breeze' ? 'breeze' : undefined;
  const actions: WorkAction[] = galilee
    ? galileeActions
        .filter((a) => a.target === id && (a.visible?.(s) ?? a.available(s)))
        .map((a) => ({
          id: 'galilee:' + a.id,
          target: id,
          label: a.label,
          blocker: galileeBlocker(s, a),
          motion: a.motion,
          notice: a.notice,
          event: { type: 'galilee-action', id: a.id },
        }))
    : [
        ...practicalActions(s).filter((a) => a.target === id && a.event.type !== 'campaign-action'),
        ...worldActions
          .filter((a) => a.target === id && (a.visible?.(s) ?? a.available(s)))
          .map((a): WorkAction => ({
            id: a.id,
            target: id,
            label: a.label,
            blocker: actionBlocker(a, s),
            motion: actionMotion(a),
            notice: a.notice,
            event: { type: 'campaign-action', id: a.id },
          })),
      ];
  // Reading-only destinations keep their normal narrative surface.
  if (!galilee && !actions.some((a) => a.motion || a.event.type === 'journey')) return;
  if (channel && s.galilee.spring.stage !== 'complete')
    actions.unshift({
      id: 'turn:' + channel,
      target: id,
      label: 'Turn this section clockwise',
      motion: 'Repair',
      blocker: canTurnChannel(s, id)
        ? undefined
        : 'Inspect and clear both ends, return the scoop, then approach with free hands.',
      event: { type: 'galilee-turn', id: channel, expected: s.galilee.spring.turns[channel] },
    });
  if (
    site &&
    s.galilee.shelter.site === site &&
    s.galilee.shelter.stage === 'arranging' &&
    s.galilee.shelter.placed.includes('screen')
  )
    actions.unshift({
      id: 'screen-turn',
      target: id,
      label: 'Move the screen clockwise',
      motion: 'Repair',
      blocker: screenCanMove(s, id) ? undefined : 'Approach your selected site with free hands.',
      event: { type: 'galilee-screen', expected: s.galilee.shelter.screen },
    });
  const spring = s.galilee.spring;
  const status =
    family === 'spring'
      ? channel
        ? 'Open ends: ' +
          ports(channel, spring.turns[channel])
            .map((d) => DIRECTIONS[d])
            .join(' / ') +
          '.'
        : spring.tested
          ? traceWater(spring.turns).message
          : spring.stage === 'not-started'
            ? 'Look at the source to begin.'
            : 'Water has not been tested in this arrangement.'
      : family === 'shelter' && site
        ? s.galilee.shelter.site === site
          ? 'Screen: ' +
            DIRECTIONS[s.galilee.shelter.screen] +
            '. ' +
            checkArrangement(s.galilee.shelter).message
          : REST_LAYOUTS[site].description
        : p.role;
  return {
    id,
    title: p.name,
    text: galilee ? galileeText(id, s) : p.role,
    status,
    near: distance(s.position, p) < 2.8,
    point: { x: p.x, z: p.z },
    focus:
      family === 'spring' && id !== 'spring-tools'
        ? { center: { x: 5.6, z: -7 }, radius: 5.5 }
        : { center: { x: p.x, z: p.z }, radius: site ? 3.8 : 3 },
    family,
    actions,
    channel,
    site,
    related:
      family === 'spring'
        ? allGalileePlaces
            .filter((p) => p.id.startsWith('spring-') || p.id.startsWith('channel-'))
            .map((p) => ({
              id: p.id,
              title: p.name,
              status: p.id.startsWith('channel-')
                ? ports(p.id.slice(8) as ChannelId, spring.turns[p.id.slice(8) as ChannelId])
                    .map((d) => DIRECTIONS[d])
                    .join(' / ')
                : undefined,
            }))
        : family === 'shelter'
          ? allGalileePlaces
              .filter((p) => p.id.startsWith('rest-') || p.id === 'leah')
              .map((p) => ({ id: p.id, title: p.name }))
          : [],
  };
}
