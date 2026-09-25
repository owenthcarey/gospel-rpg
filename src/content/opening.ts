import type { RegionId } from '../game/episode/types';

/** One card of the optional cold open. All text is original narration, never scripture. */
export interface OpeningCard {
  eyebrow: string;
  text: string;
}
export const OPENING_PROVENANCE = 'Original narration · An imagined traveler';
export const openingCards: readonly OpeningCard[] = [
  {
    eyebrow: 'Galilee · The first century',
    text: 'Before the sun clears the hills, the lake is already awake. Nets are hung to dry, boats are drawn up on the stones, and smoke rises from the first ovens.',
  },
  {
    eyebrow: 'The northern shore',
    text: 'Capernaum is a fishing town of dark stone and open doorways. Its people rise early, work with their hands and know one another by name.',
  },
  {
    eyebrow: 'A traveler arrives',
    text: 'You are no one in particular: a willing pair of hands, come to the water on an ordinary morning. What you notice, and whom you help, is yours to choose.',
  },
  {
    eyebrow: 'The Way',
    text: 'Some mornings are remembered for a long time.',
  },
];

/** A short line of place description for arrival and loading surfaces. Original text. */
export const placeLines: Record<RegionId, string> = {
  capernaum: 'Boats drawn up on the stones, nets drying in the morning light.',
  'capernaum-lanes': 'Narrow lanes of basalt walls, courtyards and shared bread ovens.',
  'gathering-house': 'An open room where neighbors crowd the doorway to listen.',
  bakehouse: 'Warm stone, flour dust and a long table for company.',
  'roof-account': 'A crowded house in Capernaum. Mark 2:1–12.',
  'lake-gennesaret': 'A long night on the water, and a morning crowd on the shore. Luke 5:1–11.',
  'galilean-road': 'A dusty road between terraces, olive shade and a working spring.',
  'roadside-farm': 'Olive trees, low walls and a place to rest out of the sun.',
  'nain-gate': 'A small town gate on the slope above the valley.',
  'nain-account': 'At the gate of a town called Nain. Luke 7:11–17.',
  'galilee-water': 'Open water, a light wind and the far shore in haze.',
  'reed-landing': 'A quiet landing among the reeds on the eastern shore.',
  'sheltered-cove': 'A cove under split rock, sheltered from the evening wind.',
  'storm-account': 'Evening on the lake, and a sudden wind. Mark 4:35–41.',
};

/** Title cards for the four Gospel accounts, shown as each presentation opens. */
export const accountCards: Partial<
  Record<RegionId, { eyebrow: string; title: string; reference: string }>
> = {
  'lake-gennesaret': { eyebrow: 'Chapter I', title: 'Into the Deep', reference: 'Luke 5:1–11' },
  'roof-account': { eyebrow: 'Chapter II', title: 'Through the Roof', reference: 'Mark 2:1–12' },
  'nain-account': { eyebrow: 'Chapter III', title: 'At the gate', reference: 'Luke 7:11–17' },
  'storm-account': { eyebrow: 'Chapter IV', title: 'Peace, be still', reference: 'Mark 4:35–41' },
};
