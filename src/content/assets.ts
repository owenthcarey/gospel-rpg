export const ANIMATION_CLIPS = [
  'Idle',
  'Walk',
  'Carry',
  'Gesture',
  'Sit',
  'Row',
  'Haul',
  'Kneel',
] as const;
export type ActorClip = (typeof ANIMATION_CLIPS)[number];
export const ACTOR_ASSETS = [
  'traveler',
  'simon',
  'miriam',
  'jesus',
  'villager',
  'james',
  'john',
] as const;
export type ActorAsset = (typeof ACTOR_ASSETS)[number];
export const PROP_ASSETS = [
  'house',
  'house_large',
  'market',
  'olive',
  'cypress',
  'palm',
  'boat',
  'nets',
  'crate',
  'amphora',
  'reeds',
  'rock',
  'well',
  'basket_empty',
  'basket_fish',
  'net_folded',
  'net_cast',
  'net_full',
  'oar',
  'bread_bundle',
  'mooring',
  'landing_mat',
] as const;
export type AssetId = ActorAsset | (typeof PROP_ASSETS)[number];
export interface AssetDefinition {
  id: AssetId;
  kind: 'actor' | 'prop';
  maxTriangles: number;
  clips: readonly ActorClip[];
  attachments: readonly string[];
}
export const assets: readonly AssetDefinition[] = [
  ...ACTOR_ASSETS.map((id) => ({
    id,
    kind: 'actor' as const,
    maxTriangles: 5000,
    clips: ANIMATION_CLIPS,
    attachments: ['carry_socket'],
  })),
  ...PROP_ASSETS.map((id) => ({
    id,
    kind: 'prop' as const,
    maxTriangles: 10000,
    clips: [],
    attachments:
      id === 'boat'
        ? ['seat_front', 'seat_middle', 'seat_back', 'net_socket', 'oar_left', 'oar_right']
        : [],
  })),
];
export const VILLAGE_ASSETS: readonly AssetId[] = assets
  .map((asset) => asset.id)
  .filter((id) => id !== 'net_cast' && id !== 'net_full');
export const LAKE_ASSETS: readonly AssetId[] = [
  'boat',
  'oar',
  'net_folded',
  'net_cast',
  'net_full',
  'basket_fish',
  'simon',
  'jesus',
  'james',
  'john',
  'villager',
  'miriam',
  'reeds',
  'rock',
  'palm',
  'house',
];
export function isActorAsset(id: string): id is ActorAsset {
  return ACTOR_ASSETS.some((candidate) => candidate === id);
}
