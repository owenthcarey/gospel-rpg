import type { GameState } from '../../game/types';
import type { RegionId } from '../../game/episode/types';
import { presentationState } from '../../game/connection/accounts';
import type { Soundscape } from '../../audio/types';
import type { TrackId } from './music';

export interface AudioCue {
  track: TrackId;
  ambience: Soundscape;
}
export const regionAudio: Record<RegionId, AudioCue> = {
  capernaum: { track: 'first-light', ambience: 'shore' },
  'capernaum-lanes': { track: 'lantern-lanes', ambience: 'village' },
  bakehouse: { track: 'bread-and-embers', ambience: 'hearth' },
  'gathering-house': { track: 'open-door', ambience: 'room' },
  'roof-account': { track: 'open-door', ambience: 'room' },
  'galilean-road': { track: 'olive-path', ambience: 'country' },
  'roadside-farm': { track: 'olive-path', ambience: 'country' },
  'nain-gate': { track: 'at-the-gate', ambience: 'country' },
  'nain-account': { track: 'at-the-gate', ambience: 'country' },
  'galilee-water': { track: 'small-sails', ambience: 'lake' },
  'reed-landing': { track: 'small-sails', ambience: 'shore' },
  'sheltered-cove': { track: 'a-great-calm', ambience: 'shore' },
  'lake-gennesaret': { track: 'open-door', ambience: 'lake' },
  'storm-account': { track: 'small-sails', ambience: 'lake' },
};
/** Resolve the displayed account, including replay, without modifying durable progress. */
export function cueForState(state: GameState): AudioCue {
  const view = presentationState(state);
  if (view.region === 'storm-account') {
    if (['storm', 'waking'].includes(view.lake.chapter.checkpoint ?? ''))
      return { track: 'gathering-wind', ambience: 'storm' };
    if (['command', 'calm', 'question'].includes(view.lake.chapter.checkpoint ?? ''))
      return { track: 'a-great-calm', ambience: 'lake' };
  }
  if (
    (view.region === 'nain-account' &&
      ['restored', 'wonder'].includes(view.road.chapter.checkpoint ?? '')) ||
    (view.region === 'nain-gate' && ['aftermath', 'complete'].includes(view.road.chapter.stage)) ||
    (view.region === 'roof-account' &&
      ['rise', 'amazement'].includes(view.campaign.roof.checkpoint ?? '')) ||
    (view.region === 'lake-gennesaret' &&
      ['abundance', 'partners', 'astonishment', 'calling', 'return'].includes(
        view.episode.checkpoint ?? '',
      ))
  )
    return { track: 'a-great-calm', ambience: regionAudio[view.region].ambience };
  return regionAudio[view.region];
}
