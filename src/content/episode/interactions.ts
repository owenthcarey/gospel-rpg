import type { GameState } from '../../game/types';
import type {
  AftermathId,
  EpisodeActionId,
  EpisodeProgress,
  PreparationId,
} from '../../game/episode/types';

export type Condition =
  | { kind: 'stage'; is: EpisodeProgress['stage'] }
  | { kind: 'carrying'; is: EpisodeProgress['carrying'] }
  | { kind: 'prepared'; id: PreparationId; is: boolean }
  | { kind: 'aftermath'; id: AftermathId; is: boolean };
export type ActionEffect =
  | { kind: 'carry' }
  | { kind: 'place'; preparation: PreparationId }
  | { kind: 'prepare'; preparation: PreparationId }
  | { kind: 'aftermath'; task: AftermathId };
export interface InteractionDefinition {
  id: EpisodeActionId;
  verb: 'Carry' | 'Place' | 'Assist' | 'Listen';
  label: string;
  destination: string;
  conditions: readonly Condition[];
  effect: ActionEffect;
  journal: { title: string; text: string };
  notice: string;
}
export function matches(state: GameState, condition: Condition): boolean {
  const e = state.episode;
  switch (condition.kind) {
    case 'stage':
      return e.stage === condition.is;
    case 'carrying':
      return e.carrying === condition.is;
    case 'prepared':
      return e.preparations.includes(condition.id) === condition.is;
    case 'aftermath':
      return e.aftermath.includes(condition.id) === condition.is;
  }
}
export const episodeActions: readonly InteractionDefinition[] = [
  {
    id: 'take-basket',
    verb: 'Carry',
    label: 'Carry the empty basket',
    destination: 'supply-basket',
    conditions: [
      { kind: 'stage', is: 'preparing' },
      { kind: 'carrying', is: null },
      { kind: 'prepared', id: 'basket', is: false },
    ],
    effect: { kind: 'carry' },
    journal: {
      title: 'An empty basket',
      text: 'In this imagined moment, I offered to carry an empty basket from the market to the landing. It is light, and there is no hurry.',
    },
    notice: 'You are carrying the basket. Take it to the landing.',
  },
  {
    id: 'place-basket',
    verb: 'Place',
    label: 'Set the basket at the landing',
    destination: 'landing',
    conditions: [
      { kind: 'stage', is: 'preparing' },
      { kind: 'carrying', is: 'empty-basket' },
    ],
    effect: { kind: 'place', preparation: 'basket' },
    journal: {
      title: 'A place to set things down',
      text: 'I left the empty basket at the landing. A little space has been made ready beside the water. This helper action belongs to the imagined traveler’s story.',
    },
    notice: 'Basket placed · the landing is ready.',
  },
  {
    id: 'secure-mooring',
    verb: 'Assist',
    label: 'Coil the loose mooring rope',
    destination: 'mooring',
    conditions: [
      { kind: 'stage', is: 'preparing' },
      { kind: 'prepared', id: 'mooring', is: false },
    ],
    effect: { kind: 'prepare', preparation: 'mooring' },
    journal: {
      title: 'A clear path by the boats',
      text: 'I coiled a loose length of rope away from the path. It was a small, ordinary task on an extraordinary morning, imagined for this journey.',
    },
    notice: 'Rope coiled · the path beside the boats is clear.',
  },
  {
    id: 'join-gathering',
    verb: 'Assist',
    label: 'Make room in the gathering',
    destination: 'gathering',
    conditions: [
      { kind: 'stage', is: 'preparing' },
      { kind: 'prepared', id: 'gathering', is: false },
    ],
    effect: { kind: 'prepare', preparation: 'gathering' },
    journal: {
      title: 'Room for one more',
      text: 'I found a place at the edge of the gathering and made space for another neighbor. This original moment does not add words to Jesus’ teaching.',
    },
    notice: 'A place to listen · neighbors gather by the water.',
  },
  {
    id: 'receive-catch',
    verb: 'Assist',
    label: 'Set a filled basket beside the landing',
    destination: 'landing',
    conditions: [
      { kind: 'stage', is: 'aftermath' },
      { kind: 'aftermath', id: 'landing', is: false },
    ],
    effect: { kind: 'aftermath', task: 'landing' },
    journal: {
      title: 'Back on the shore',
      text: 'After the narrated Gospel scene, my imagined traveler helped set a filled basket beside the landing. The boats are still, and the fishermen’s journey has taken a new direction.',
    },
    notice: 'The basket rests on shore. Miriam and Ezra are nearby.',
  },
  {
    id: 'talk-miriam',
    verb: 'Listen',
    label: 'Thank Miriam for her company',
    destination: 'miriam',
    conditions: [
      { kind: 'stage', is: 'aftermath' },
      { kind: 'aftermath', id: 'miriam', is: false },
    ],
    effect: { kind: 'aftermath', task: 'miriam' },
    journal: {
      title: 'Bread and company',
      text: 'In our original conversation, Miriam spoke about the ordinary things that continue after a memorable morning: bread to share and a neighbor to sit beside.',
    },
    notice: 'Miriam’s company remembered.',
  },
  {
    id: 'talk-ezra',
    verb: 'Listen',
    label: 'Carry Ezra’s question with you',
    destination: 'ezra',
    conditions: [
      { kind: 'stage', is: 'aftermath' },
      { kind: 'aftermath', id: 'ezra', is: false },
    ],
    effect: { kind: 'aftermath', task: 'ezra' },
    journal: {
      title: 'A question beneath the olives',
      text: 'In an original conversation, Ezra asked what I would carry away from this morning. He did not ask for a correct answer, only for a memory of my own.',
    },
    notice: 'Ezra’s question remembered. Return to the shore when you are ready.',
  },
];
export function actionFor(id: EpisodeActionId): InteractionDefinition {
  const definition = episodeActions.find((action) => action.id === id);
  if (!definition) throw new Error('Unknown episode action: ' + id);
  return definition;
}
export function actionAvailable(state: GameState, id: EpisodeActionId): boolean {
  return (
    state.region === 'capernaum' &&
    actionFor(id).conditions.every((condition) => matches(state, condition))
  );
}
