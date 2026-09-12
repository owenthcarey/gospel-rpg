import type { JournalEntry } from '../campaign/journal';
import { stormBeats } from './scenes';
import { stormVerses } from './scripture';
export const joelRecollection =
  'Reeds stand along the open shore. A split rock marks the turn across the water. Beyond it, a long headland shelters a landing that faces inward. Look for the place protected by the stone, not the first bank you reach.';
export const lakeEvidence = {
  reeds: {
    title: 'Reeds on the open shore',
    text: 'A fan of tall reeds stands east of the crossing. Its landing faces open water; no headland shelters it.',
  },
  'split-rock': {
    title: 'A split rock at the turn',
    text: 'Two pale stone faces rise from the low island. Beyond their gap, to the northeast, a long dark headland conceals an inward-facing landing.',
  },
} as const;
export const interpretations = {
  exposed: {
    label: 'The reed landing on the open shore',
    text: 'The reeds match, but this landing faces the open water. Joel remembers shelter behind a headland. Keep your evidence and compare again.',
  },
  island: {
    label: 'The split rock itself',
    text: 'The rock marks the turn, but has no landing. Look beyond the gap toward the headland. Nothing has been lost.',
  },
  sheltered: {
    label: 'The cove behind the northeastern headland',
    text: 'Both observations agree. Pass around the headland, dock at the sheltered cove and inspect its inward-facing landing.',
  },
} as const;
export const crossingHints = [
  'Joel remembers an inward-facing landing. Observe the reeds and the split rock from the water.',
  'The reeds mark the exposed eastern bank; the split rock is on the low island. The map can guide your boat to either.',
  'The correct landing lies beyond the headland, northeast of the split rock. Compare both observations in the journal.',
  'Study The reed bank and The split rock on the lake map. Choose “The cove behind the northeastern headland,” navigate to The sheltered cove, dock, and inspect The inward landing. Return to Joel afterward.',
] as const;
export const stormReflections = {
  stillness: {
    title: 'Room for stillness',
    text: 'I remember the great calm in Mark’s account. At this imagined shore, I chose to leave a little space for stillness.',
  },
  trust: {
    title: 'A question carried onward',
    text: 'I remember the words spoken in the boat. I carry the question with me as a traveler, without turning it into a measure of another person’s faith.',
  },
  wonder: {
    title: 'Wonder on the water',
    text: 'I remember the disciples’ question: who then is this? The full account remains in my journal as I continue.',
  },
} as const;
const original = (title: string, text: string): JournalEntry => ({
  title,
  text,
  reference: 'Original traveler story',
});
export const lakeJournal: Record<string, JournalEntry> = {
  'storm-invitation': original(
    'Across the lake',
    'An ordinary boat opens a new part of the imagined journey. At the sheltered cove, a narrated viewpoint follows Mark 4:35–41. The navigation adventure is optional.',
  ),
  ...Object.fromEntries(
    stormBeats.map((b) => [
      'storm-scene-' + b.id,
      {
        title: b.title,
        text: stormVerses[b.verse],
        reference: 'Scripture · WEB · Mark ' + b.verse,
      },
    ]),
  ),
  'storm-after-landing': original(
    'The landing after the account',
    'The ordinary boat is still at its berth. Its small journey belongs to my imagined travels; the Gospel account remains whole in the transcript.',
  ),
  'storm-after-lookout': original(
    'A quiet view',
    'The lookout offered room to pause, with the lake open beyond the headland.',
  ),
  'storm-after-neighbor': original(
    'A neighbor at the cove',
    'Dalia welcomed me back. Her ordinary hospitality belongs to this imagined shore.',
  ),
  ...Object.fromEntries(
    Object.entries(stormReflections).map(([id, entry]) => [
      'storm-reflection-' + id,
      { ...entry, reference: 'Original reflection · Mark 4:35–41' },
    ]),
  ),
  'storm-complete': original(
    'Peace, be still',
    'I followed Mark’s account, returned to the cove and chose a memory. The four Gospel transcripts and all earlier places remain available.',
  ),
  'crossing-invitation': original('A sheltered way', joelRecollection),
  ...Object.fromEntries(
    Object.entries(lakeEvidence).map(([id, entry]) => [
      'crossing-evidence-' + id,
      original(entry.title, entry.text),
    ]),
  ),
  'crossing-interpreted': original('Beyond the headland', interpretations.sheltered.text),
  'crossing-arrived': original(
    'The sheltered landing',
    'The inward-facing berth lies behind the headland, as Joel recalled. I can return across the lake to share what I found.',
  ),
  'crossing-ending-attention': original(
    'An attentive crossing',
    'I told Joel how the reeds, split stone and sheltered water fit together. Taking a second look changed the way I saw the crossing.',
  ),
  'crossing-ending-welcome': original(
    'A welcome arrival',
    'I remembered the welcome at the sheltered cove. A route becomes more than its landmarks when there is someone to greet you.',
  ),
  'crossing-complete': original(
    'A sheltered way remembered',
    'The two landings remain open. I can return by boat whenever I wish.',
  ),
  'lake-note-reed-shore': original(
    'Reeds beside open water',
    'The reed shore looks straight across the crossing. Wind and water have room here. This is a different kind of resting place from the cove.',
  ),
  'lake-note-cove-shore': original(
    'Behind the headland',
    'Stone reaches out beside the inward-facing berth. The shelter is visible from both the water and the path.',
  ),
};
