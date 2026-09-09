import type { AssetId } from '../assets';
import type { HeldItem, ExplorationRegion } from '../../game/campaign/types';
import type { GameState } from '../../game/types';
export const heldAssets: Record<HeldItem, AssetId> = {
  'bread-basket': 'bread_basket',
  'empty-jug': 'jug',
  'water-jug': 'jug',
  'cart-handle': 'cart_handle',
  'sewing-pouch': 'sewing_pouch',
  'lashing-cord': 'lashing_cord',
  'wood-brace': 'wood_brace',
};
export const lifeRegionAssets: Record<ExplorationRegion, readonly AssetId[]> = {
  capernaum: [
    'sewing_pouch',
    'lashing_cord',
    'basket_empty',
    'bench_loose',
    'bench_lashed',
    'bench_braced',
    'bench_pieces',
    'villager',
  ],
  'capernaum-lanes': ['sewing_pouch', 'thread_clue', 'villager'],
  bakehouse: ['mending_cloth', 'wood_brace', 'villager'],
  'gathering-house': [],
};
export function lifePresentation(s: GameState) {
  const { thread, bench } = s.life;
  return {
    active: s.episode.stage === 'complete',
    pouchAtShore:
      !['returned', 'complete'].includes(thread.stage) && s.campaign.carrying !== 'sewing-pouch',
    pouchWithRuth: ['returned', 'complete'].includes(thread.stage),
    benchAsset: (['fitted', 'complete'].includes(bench.stage)
      ? bench.method === 'lashing'
        ? 'bench_lashed'
        : 'bench_braced'
      : 'bench_loose') as AssetId,
    piecesCleared: bench.cleared,
    benchOccupied: bench.stage === 'complete',
    tableCompany: s.campaign.table.stage === 'complete' ? s.campaign.table.location : null,
  };
}
