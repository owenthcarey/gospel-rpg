export const ANIMATION_CLIPS = [
  'Idle',
  'Walk',
  'Carry',
  'Gesture',
  'Sit',
  'Row',
  'Haul',
  'Kneel',
  'Recline',
  'Rise',
  'MatCarry',
  'Use',
  'PickUp',
  'PutDown',
  'Repair',
  'SitDown',
] as const;
export type ActorClip = (typeof ANIMATION_CLIPS)[number] | 'SitUp' | 'FrameCarry' | 'TouchFrame';
export const ACTOR_ASSETS = [
  'traveler',
  'simon',
  'miriam',
  'jesus',
  'villager',
  'james',
  'john',
  'hannah',
  'amos',
  'ruth',
  'bearer',
  'healed_man',
  'widow',
  'young_man',
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
  'room_wall',
  'low_wall',
  'doorway',
  'roof_opening',
  'roof_panel',
  'gate',
  'exterior_steps',
  'oven',
  'worktable',
  'bench',
  'stool',
  'shelf',
  'jug',
  'bread_basket',
  'handcart',
  'cart_handle',
  'mat_flat',
  'mat_rolled',
  'flour_sack',
  'sewing_pouch',
  'thread_clue',
  'mending_cloth',
  'lashing_cord',
  'wood_brace',
  'bench_loose',
  'bench_lashed',
  'bench_braced',
  'bench_pieces',
  'town_gate',
  'terrace_wall',
  'spring_marker',
  'terrace_marker',
  'farm_shelter',
  'split_olive',
  'procession_frame',
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
    clips: [
      ...ANIMATION_CLIPS,
      ...(id === 'young_man'
        ? ['SitUp' as const]
        : id === 'bearer'
          ? ['FrameCarry' as const]
          : id === 'jesus'
            ? ['TouchFrame' as const]
            : []),
    ],
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
export const VILLAGE_ASSETS: readonly AssetId[] = [
  'traveler',
  'simon',
  'miriam',
  'jesus',
  'villager',
  'james',
  'john',
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
  'oar',
  'bread_bundle',
  'mooring',
  'landing_mat',
];
export const ROOF_ASSETS: readonly AssetId[] = [
  'jesus',
  'bearer',
  'healed_man',
  'villager',
  'room_wall',
  'doorway',
  'low_wall',
  'roof_opening',
  'mat_flat',
  'mat_rolled',
  'bench',
];
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
export const NAIN_ASSETS: readonly AssetId[] = [
  'jesus',
  'widow',
  'young_man',
  'bearer',
  'villager',
  'hannah',
  'town_gate',
  'procession_frame',
  'house',
  'low_wall',
  'olive',
  'rock',
];
export function isActorAsset(id: string): id is ActorAsset {
  return ACTOR_ASSETS.some((candidate) => candidate === id);
}
