import type { RoofReflection, NeighborNote } from '../../game/campaign/types';
import { roofBeats } from './scenes';
export interface JournalEntry {
  title: string;
  text: string;
  reference?: string;
}
export const roofReflections: Record<RoofReflection, JournalEntry> = {
  welcome: {
    title: 'A doorway with room',
    text: 'I remember the doorway and the people around it. In the imagined neighborhood beyond the account, I want to notice who has found a place and who is still waiting to be welcomed.',
  },
  persistence: {
    title: 'Those who stayed together',
    text: 'I remember the people who carried their companion. Mark’s account will remain with me, alongside the ordinary walks on which I can choose to keep someone company.',
  },
  amazement: {
    title: 'A room changed by wonder',
    text: 'I remember the amazement with which the account ends. I do not need to make the whole day into an explanation. There is room to be still and remember.',
  },
};
export const neighborNotes: Record<NeighborNote, JournalEntry> = {
  threshold: {
    title: 'Across a threshold',
    text: 'A doorway makes a small boundary between a public lane and a shared room. This imagined house is an artistic setting for the account, not a reconstruction of a known owner’s home.',
  },
  oven: {
    title: 'The work before the bread',
    text: 'Hannah’s oven is warm, and the loaves on the shelf have a place to go. The bakehouse and its daily work are imagined for this neighborhood.',
  },
  'roof-beams': {
    title: 'Above the room',
    text: 'Timbers support a flat roof in this artistic interpretation. Mark describes an opening made in the roof; Luke’s parallel mentions tiles. The game keeps those accounts separately attributed.',
    reference: 'Mark 2:4 · Parallel: Luke 5:19',
  },
  water: {
    title: 'A place to fill a jug',
    text: 'Neighbors come to the water point carrying different things: an empty vessel, a question, a moment to spare. This meeting place is an imagined part of Capernaum.',
  },
  lane: {
    title: 'The longer way',
    text: 'The outer lane takes a little longer, passing along the district wall. A slower route can still bring people to the same table.',
  },
  table: {
    title: 'A place prepared',
    text: 'A table can be made ready before anyone sits down. Bread, water and a little room are enough to begin an ordinary welcome.',
  },
};
export const campaignJournal: Record<string, JournalEntry> = {
  'roof-invitation': {
    title: 'Some days later',
    text: 'After the morning beside the lake, my imagined journey continues into Capernaum’s lanes. Mark tells of Jesus returning to Capernaum after some days. There is a gathering house to visit and a neighborhood to know.',
    reference: 'Mark 2:1–12',
  },
  'roof-after-ruth': {
    title: 'Company in the courtyard',
    text: 'Ruth and I spoke in the imagined courtyard after the Gospel account. She made room for a moment of company without asking me to explain everything I had seen.',
  },
  'roof-after-hannah': {
    title: 'The ordinary work continues',
    text: 'Hannah spoke about the bread still to share and the people still to welcome. Our conversation belongs to the original aftermath, alongside Mark’s account.',
  },
  'roof-after-house': {
    title: 'An open room',
    text: 'I returned to the threshold. The account is complete, and the room has become part of my traveler’s memory.',
  },
  'roof-complete': {
    title: 'Through the Roof',
    text: 'I have witnessed the account, returned to the neighborhood and chosen a reflection. Capernaum’s lanes, the bakehouse and the shore remain open to me.',
    reference: 'Mark 2:1–12',
  },
  'walk-invitation': {
    title: 'A way together',
    text: 'Amos asked for company on a walk to the courtyard. We can clear the narrow passage or take the outer lane. He is glad to wait whenever I stop.',
  },
  'walk-passage': {
    title: 'A shorter passage',
    text: 'I chose the passage through the district. Hannah keeps a handle for moving the empty handcart; once the cart is set aside, the passage can stay open.',
  },
  'walk-outer': {
    title: 'Around the outer wall',
    text: 'Amos and I chose the longer lane. There is time to walk at his pace, and the same courtyard waits at the end.',
  },
  'walk-gate': {
    title: 'Room in the passage',
    text: 'I borrowed the handcart handle, moved the empty cart aside and returned the handle to its bracket. The narrow passage is open now.',
  },
  'walk-arrived': {
    title: 'At the courtyard together',
    text: 'Amos and I reached the courtyard together. He has found a shaded place beside the wall, and there is time to speak before I leave.',
  },
  'walk-complete': {
    title: 'Good company on the way',
    text: 'Our walk is remembered. Amos will remain in the courtyard, glad to see a familiar face.',
  },
  'table-invitation': {
    title: 'A table for neighbors',
    text: 'Hannah offered bread for a shared table. I can prepare a place in the courtyard or the bakehouse, carrying bread and water in either order.',
  },
  'table-courtyard': {
    title: 'A table under the open sky',
    text: 'I chose the courtyard table. The bread and water will be within reach of neighbors crossing the lanes.',
  },
  'table-bakehouse': {
    title: 'A place near the oven',
    text: 'I chose the bakehouse table. There is room indoors beside the warmth of Hannah’s daily work.',
  },
  'table-bread': {
    title: 'Bread set down',
    text: 'The basket of bread is on the chosen table. What I carried has become something to share.',
  },
  'table-water': {
    title: 'Water within reach',
    text: 'The filled jug rests beside a place at the table. A small part of the day is ready for whoever comes.',
  },
  'table-complete': {
    title: 'A welcome made ready',
    text: 'Hannah and I remembered the place prepared for our neighbors. The bread and water remain there, and the invitation is still open.',
  },
  ...Object.fromEntries(
    roofBeats.map((b) => [
      'roof-scene-' + b.id,
      { title: b.title, text: b.description, reference: b.reference },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(roofReflections).map(([id, entry]) => ['roof-reflection-' + id, entry]),
  ),
  ...Object.fromEntries(
    Object.entries(neighborNotes).map(([id, entry]) => ['neighbor-note-' + id, entry]),
  ),
};
