import type { GameEvent } from './types';
import { CHANNEL_IDS, type ChannelId, type Direction } from './galilee/types';
import { NEIGHBOR_NOTES, ROOF_REFLECTIONS, ROOF_SCENES } from './campaign/types';
import {
  ROAD_ACTIONS,
  TRAIL_EVIDENCE,
  TRAIL_INTERPRETATIONS,
  TRAIL_ENDINGS,
  COMPANY_ROUTES,
  NAIN_SCENES,
  NAIN_REFLECTIONS,
  type RoadEvent,
} from './road/types';
import {
  STORM_SCENES,
  STORM_REFLECTIONS,
  LAKE_INTERPRETATIONS,
  LAKE_ENDINGS,
  type LakeEvent,
} from './lake/types';

const member = <T extends string>(list: readonly T[], value: string | undefined): value is T =>
  list.some((id) => id === value);

/**
 * Translate an interface command and its untrusted `data-value` into a typed story event.
 * Unknown names or values return undefined; reducers still apply every guard.
 */
export function parseStoryCommand(name: string, value?: string): GameEvent | undefined {
  switch (name) {
    case 'galilee-action':
      return value ? { type: name, id: value } : undefined;
    case 'galilee-turn': {
      const [id, expected] = (value ?? '').split(':');
      return member(CHANNEL_IDS, id) && /^[0-3]$/.test(expected ?? '')
        ? { type: name, id: id as ChannelId, expected: Number(expected) as Direction }
        : undefined;
    }
    case 'galilee-screen':
      return /^[0-3]$/.test(value ?? '')
        ? { type: name, expected: Number(value) as Direction }
        : undefined;
    case 'galilee-hint':
    case 'road-hint':
    case 'lake-hint':
      return { type: name } as GameEvent;
    case 'campaign-action':
      return value ? { type: name, id: value } : undefined;
    case 'neighbor-note':
      return member(NEIGHBOR_NOTES, value) ? { type: name, id: value } : undefined;
    case 'road-action':
    case 'road-evidence':
    case 'road-interpret':
    case 'road-ending':
    case 'road-route':
    case 'nain-reflect': {
      const allowed = {
        'road-action': ROAD_ACTIONS,
        'road-evidence': TRAIL_EVIDENCE,
        'road-interpret': TRAIL_INTERPRETATIONS,
        'road-ending': TRAIL_ENDINGS,
        'road-route': COMPANY_ROUTES,
        'nain-reflect': NAIN_REFLECTIONS,
      }[name] as readonly string[];
      return member(allowed, value) ? ({ type: name, id: value } as RoadEvent) : undefined;
    }
    case 'lake-action':
      return value ? { type: name, id: value } : undefined;
    case 'lake-interpret':
      return member(LAKE_INTERPRETATIONS, value)
        ? ({ type: name, id: value } as LakeEvent)
        : undefined;
    case 'lake-ending':
      return member(LAKE_ENDINGS, value) ? ({ type: name, id: value } as LakeEvent) : undefined;
    case 'storm-reflect':
      return member(STORM_REFLECTIONS, value)
        ? ({ type: name, id: value } as LakeEvent)
        : undefined;
    case 'storm-next':
    case 'storm-summary':
      return member(STORM_SCENES, value)
        ? ({ type: name, checkpoint: value } as LakeEvent)
        : undefined;
    case 'nain-next':
    case 'nain-summary':
      return member(NAIN_SCENES, value)
        ? ({ type: name, checkpoint: value } as RoadEvent)
        : undefined;
    case 'roof-reflect':
      return member(ROOF_REFLECTIONS, value) ? { type: name, id: value } : undefined;
    case 'roof-next':
    case 'roof-summary':
      return member(ROOF_SCENES, value) ? { type: name, checkpoint: value } : undefined;
  }
  return undefined;
}
