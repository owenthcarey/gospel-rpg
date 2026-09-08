import { episodeActions } from './interactions';
import { sceneBeats } from './scenes';

export const reflectionEntries = {
  wonder: {
    title: 'Room for wonder',
    text: 'I will remember how a familiar morning opened into something I could not have expected. I do not need to fit it all into an answer. I can leave room for wonder.',
  },
  trust: {
    title: 'An invitation to trust',
    text: 'I will remember Simon’s answer after an empty night. My reflection is my own, but I want to carry the question of trust with me when I return to ordinary paths.',
  },
  community: {
    title: 'The other boat',
    text: 'I will remember the partners coming to help, and the neighbors who shared this imagined morning with me. I want to notice the people beside me on the way.',
  },
} as const;

export const noteEntries = {
  landing: {
    title: 'Where land meets water',
    text: 'The landing brings two kinds of movement together: feet on the village path and boats on the lake. In this imagined place, I pause at their meeting point.',
  },
  boat: {
    title: 'A boat at rest',
    text: 'Benches, an oar, an open hull: the model gives the boat a simple, practical shape. Its proportions and construction are artistic interpretations, not a reconstruction of Simon’s boat.',
  },
  net: {
    title: 'Cord and patient hands',
    text: 'In this imagined village, a net can be folded, carried, lowered, and lifted. Its knots suggest work repeated over many mornings. I stop to notice the ordinary object before returning to the story.',
  },
} as const;

export const episodeJournal: Record<string, { title: string; text: string; reference?: string }> = {
  'episode-invitation': {
    title: 'Into the Deep',
    text: 'My first errand is complete. There is still room to help on the shore before following the Gospel account through the catch and calling. The traveler’s further errands are imagined.',
    reference: 'Luke 5:1–11',
  },
  ...Object.fromEntries(episodeActions.map((action) => ['action-' + action.id, action.journal])),
  ...Object.fromEntries(sceneBeats.map((beat) => ['scene-' + beat.id, beat.journal])),
  ...Object.fromEntries(Object.entries(noteEntries).map(([id, entry]) => ['note-' + id, entry])),
  ...Object.fromEntries(
    Object.entries(reflectionEntries).map(([id, entry]) => ['reflection-' + id, entry]),
  ),
  'episode-complete': {
    title: 'The shore, and the road ahead',
    text: 'I have followed the account of the catch and calling, returned to my neighbors, and chosen a memory to carry. The village remains open. I can rest, finish Ezra’s invitation, or read the words again.',
    reference: 'Luke 5:1–11',
  },
};
