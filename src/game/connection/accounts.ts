import type { GameState } from '../types';
import { isExploration, type RegionId } from '../campaign/types';
import { regions } from '../../content/regions';
import { sceneBeats } from '../../content/episode/scenes';
import { roofBeats } from '../../content/campaign/scenes';
import { nainBeats } from '../../content/road/scenes';
import { stormBeats } from '../../content/lake/scenes';
import type { AccountId } from './types';
export interface AccountDefinition {
  title: string;
  reference: string;
  region: RegionId;
  scenes: readonly { id: string; title: string }[];
  complete(s: GameState): boolean;
}
export const accounts: Record<AccountId, AccountDefinition> = {
  lake: {
    title: 'Into the Deep',
    reference: 'Luke 5:1–11',
    region: 'lake-gennesaret',
    scenes: sceneBeats,
    complete: (s) => s.episode.stage === 'complete',
  },
  roof: {
    title: 'Through the Roof',
    reference: 'Mark 2:1–12',
    region: 'roof-account',
    scenes: roofBeats,
    complete: (s) => s.campaign.roof.stage === 'complete',
  },
  nain: {
    title: 'At the gate',
    reference: 'Luke 7:11–17',
    region: 'nain-account',
    scenes: nainBeats,
    complete: (s) => s.road.chapter.stage === 'complete',
  },
  storm: {
    title: 'Peace, be still',
    reference: 'Mark 4:35–41',
    region: 'storm-account',
    scenes: stormBeats,
    complete: (s) => s.lake.chapter.stage === 'complete',
  },
};
export function displayRegion(s: GameState): RegionId {
  return s.connection.replay ? accounts[s.connection.replay.account].region : s.region;
}
export function isPresenting(s: GameState): boolean {
  return regions[displayRegion(s)].mode === 'presentation';
}
export function canReplay(s: GameState, id: AccountId, checkpoint: string): boolean {
  return (
    isExploration(s.region) &&
    accounts[id]?.complete(s) &&
    accounts[id].scenes.some((b) => b.id === checkpoint)
  );
}
/** Projection only: durable progress and the ordinary traveler never enter replay scenes. */
export function presentationState(s: GameState): GameState {
  const replay = s.connection.replay;
  if (!replay) return s;
  const view = structuredClone(s);
  view.region = accounts[replay.account].region;
  switch (replay.account) {
    case 'lake':
      view.episode.checkpoint = replay.checkpoint as GameState['episode']['checkpoint'];
      view.episode.stage = 'witnessing';
      break;
    case 'roof':
      view.campaign.roof.checkpoint =
        replay.checkpoint as GameState['campaign']['roof']['checkpoint'];
      view.campaign.roof.stage = 'witnessing';
      break;
    case 'nain':
      view.road.chapter.checkpoint =
        replay.checkpoint as GameState['road']['chapter']['checkpoint'];
      view.road.chapter.stage = 'witnessing';
      break;
    case 'storm':
      view.lake.chapter.checkpoint =
        replay.checkpoint as GameState['lake']['chapter']['checkpoint'];
      view.lake.chapter.stage = 'witnessing';
      break;
  }
  return view;
}
