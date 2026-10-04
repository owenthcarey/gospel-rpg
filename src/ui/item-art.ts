import { escapeHtml as esc, icon } from './icons';

/** Original renders of the game's own props; presentation only, never save identifiers. */
export const itemSprites: Readonly<Record<string, string>> = {
  net: 'net',
  bread: 'bread',
  'empty-basket': 'empty-basket',
  'bread-basket': 'bread-basket',
  'empty-jug': 'jug',
  'water-jug': 'water-jug',
  'rest-water': 'water-jug',
  'cart-handle': 'cart-handle',
  'sewing-pouch': 'sewing-pouch',
  'lashing-cord': 'lashing-cord',
  'wood-brace': 'wood-brace',
  'channel-scoop': 'channel-scoop',
  'rest-mat': 'rest-mat',
  'rest-screen': 'rest-screen',
};

/** Names belong to the enclosing control/heading, so the sprite is decorative. */
export function itemArtwork(id: string, fallbackIcon = 'bag'): string {
  const sprite = itemSprites[id];
  return sprite
    ? `<img class="satchel-sprite" src="${esc(import.meta.env.BASE_URL + 'assets/items/' + sprite + '.webp')}" width="64" height="64" alt="" aria-hidden="true" decoding="async">`
    : icon(fallbackIcon);
}
