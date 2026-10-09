import type { AssetId } from './assets';

/**
 * Names and original examine lines for ordinary scenery, so every visible thing answers a
 * right-click as in the classic games. Scenery is never interactive: examining it only adds
 * a line to the chatbox and never supplies evidence or performs story work.
 */
export interface SceneryExamine {
  name: string;
  text: string;
}

export const sceneryExaminations: Readonly<Partial<Record<AssetId, SceneryExamine>>> = {
  villager: { name: 'Villager', text: 'One of the people of Capernaum, busy with the morning.' },
  house: { name: 'House', text: 'A small stone house with a flat roof.' },
  house_large: { name: 'House', text: 'A family house, built around a shared courtyard.' },
  market: { name: 'Market stall', text: 'A striped awning keeps the sun off the goods.' },
  olive: { name: 'Olive tree', text: 'Old, gnarled and still bearing fruit.' },
  split_olive: { name: 'Olive tree', text: 'Split by age, and still growing anyway.' },
  cypress: { name: 'Cypress tree', text: 'A tall, dark tree, pointing straight up.' },
  palm: { name: 'Palm tree', text: 'A palm tree, leaning toward the water.' },
  boat: { name: 'Fishing boat', text: 'A wooden fishing boat, drawn up on the stones.' },
  nets: { name: 'Nets', text: 'Nets spread out to dry.' },
  crate: { name: 'Crate', text: 'A sturdy wooden crate.' },
  amphora: { name: 'Jar', text: 'A clay jar for oil or water.' },
  reeds: { name: 'Reeds', text: 'Reeds growing at the water’s edge.' },
  reed_bank: { name: 'Reeds', text: 'A thick bank of reeds along the shore.' },
  rock: { name: 'Rocks', text: 'Rocks worn smooth by the lake.' },
  split_rock: { name: 'Rock', text: 'A boulder cracked clean in two.' },
  cove_headland: { name: 'Headland', text: 'A rocky point sheltering the cove.' },
  quay_stones: { name: 'Quay', text: 'Dressed stones where boats can come alongside.' },
  landing_pier: { name: 'Jetty', text: 'A wooden jetty reaching out over the water.' },
  harbor_bollard: { name: 'Bollard', text: 'A post for tying up boats.' },
  door_awning: { name: 'Awning', text: 'A little shade over the doorway.' },
  courtyard_planter: { name: 'Planter', text: 'Herbs growing in a stone planter.' },
  low_wall: { name: 'Wall', text: 'A low dry-stone wall.' },
  terrace_wall: { name: 'Terrace wall', text: 'Stone terraces hold the hillside in place.' },
  town_gate: { name: 'Town gate', text: 'The gate of Nain, open for the day.' },
  gate: { name: 'Gate', text: 'A simple wooden gate.' },
  farm_shelter: { name: 'Shelter', text: 'A field shelter of poles and branches.' },
  oven: { name: 'Oven', text: 'A clay oven, still warm from the morning’s bread.' },
  worktable: { name: 'Table', text: 'A well-used wooden table.' },
  bench: { name: 'Bench', text: 'A plain wooden bench.' },
  stool: { name: 'Stool', text: 'A three-legged stool.' },
  shelf: { name: 'Shelves', text: 'Shelves for jars and bowls.' },
  jug: { name: 'Jug', text: 'A clay jug.' },
  bread_basket: { name: 'Bread basket', text: 'A basket of fresh loaves. It smells wonderful.' },
  flour_sack: { name: 'Flour sack', text: 'A sack of flour, ready for tomorrow’s baking.' },
  handcart: { name: 'Handcart', text: 'A small cart for carrying loads along the road.' },
  mat_flat: { name: 'Mat', text: 'A woven sleeping mat.' },
  mat_rolled: { name: 'Mat', text: 'A woven mat, rolled up for the day.' },
  oar: { name: 'Oar', text: 'A spare oar.' },
  basket_fish: { name: 'Basket', text: 'A basket of the night’s small catch.' },
};

/** The examine line for a scenery asset, if it has one. */
export function sceneryExamine(id: string | undefined): SceneryExamine | undefined {
  return id ? sceneryExaminations[id as AssetId] : undefined;
}

/** The bubbling fishing spot in the lake is not an asset but answers Examine too. */
export const FISHING_SPOT_EXAMINE: SceneryExamine = {
  name: 'Fishing spot',
  text: 'Fish are rising here. Someone with a net would do well.',
};
