import { galileePlaces } from './galilee/places';
import { VILLAGE_ASSETS, type AssetId } from './assets';
import { campaignLayout } from './campaign/layouts';
import { neighborhoodPlaces } from './campaign/places';
import { heldAssets, lifeRegionAssets } from './life/presentation';
import type { ExplorationRegion } from '../game/campaign/types';
import { isRoadRegion } from '../game/road/types';
import { roadPlaces } from './road/places';

/** Interiors only load their own architecture, actors and activity props. */
export function explorationAssets(region: ExplorationRegion): AssetId[] {
  const shared = ['traveler' as const, ...Object.values(heldAssets), ...lifeRegionAssets[region]];
  if (region === 'capernaum') return [...new Set([...VILLAGE_ASSETS, ...shared])];
  const layout = campaignLayout(region)!;
  if (isRoadRegion(region))
    return [
      ...new Set([
        ...shared,
        ...(region === 'galilean-road'
          ? ([
              'channel_straight',
              'channel_bend',
              'water_basin',
              'supply_rack',
              'spring_marker',
              'rock',
              'villager',
            ] as AssetId[])
          : region === 'roadside-farm'
            ? (['leah', 'supply_rack', 'bench', 'villager'] as AssetId[])
            : []),
        ...(galileePlaces[region as keyof typeof galileePlaces] ?? []).flatMap((p) =>
          'asset' in p ? [p.asset as AssetId] : [],
        ),
        ...layout.decor.map((p) => p.asset),
        ...roadPlaces[region].flatMap((p) => (p.asset ? [p.asset as AssetId] : [])),
        'amos' as const,
      ]),
    ];
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
