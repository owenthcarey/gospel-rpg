import { VILLAGE_ASSETS, type AssetId } from './assets';
import { campaignLayout } from './campaign/layouts';
import { neighborhoodPlaces } from './campaign/places';
import { heldAssets, lifeRegionAssets } from './life/presentation';
import type { ExplorationRegion } from '../game/campaign/types';

/** Interiors only load their own architecture, actors and activity props. */
export function explorationAssets(region: ExplorationRegion): AssetId[] {
  const shared = ['traveler' as const, ...Object.values(heldAssets), ...lifeRegionAssets[region]];
  if (region === 'capernaum') return [...new Set([...VILLAGE_ASSETS, ...shared])];
  const layout = campaignLayout(region)!;
  const activity: AssetId[] = region === 'capernaum-lanes' ? ['villager', 'gate', 'handcart'] : [];
  return [
    ...new Set([
      ...shared,
      ...layout.decor.map((p) => p.asset),
      ...neighborhoodPlaces[region].flatMap((p) => (p.asset ? [p.asset as AssetId] : [])),
      ...activity,
    ]),
  ];
}
