import type { RegionId } from '../game/campaign/types';
import type { AssetId } from './assets';
/** Essential static geometry exists independently of episode poses and shadows. */
export const requiredRegionAssets: Record<RegionId, readonly AssetId[]> = {
  capernaum: ['house', 'olive', 'well'],
  'capernaum-lanes': ['house_large', 'low_wall', 'well', 'worktable'],
  'gathering-house': ['room_wall', 'bench', 'stool'],
  bakehouse: ['room_wall', 'oven', 'worktable', 'shelf'],
  'lake-gennesaret': ['boat', 'oar'],
  'roof-account': ['room_wall', 'low_wall'],
  'galilean-road': ['spring_marker', 'terrace_marker', 'terrace_wall', 'olive'],
  'roadside-farm': ['house_large', 'farm_shelter', 'split_olive'],
  'nain-gate': ['town_gate', 'house', 'bench'],
  'nain-account': ['town_gate', 'procession_frame'],
};
