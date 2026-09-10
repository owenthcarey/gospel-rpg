import type { GameState } from '../types';
import type { StoryGoal } from '../campaign/objectives';
import type { HeldItem, StoryTrack } from '../campaign/types';

export const heldItems: Record<
  HeldItem,
  { name: string; target: string; place: string; story: StoryTrack }
> = {
  'channel-scoop': {
    name: 'wooden scoop',
    target: 'spring-tools',
    place: 'the scoop rack on the Galilean road',
    story: 'spring',
  },
  'rest-mat': {
    name: 'woven mat',
    target: 'rest-supplies',
    place: 'the farm supplies rack',
    story: 'shelter',
  },
  'rest-water': {
    name: 'resting water jar',
    target: 'rest-supplies',
    place: 'the farm supplies rack',
    story: 'shelter',
  },
  'rest-screen': {
    name: 'folding reed screen',
    target: 'rest-supplies',
    place: 'the farm supplies rack',
    story: 'shelter',
  },
  'bread-basket': {
    name: 'bread basket',
    target: 'bread-shelf',
    place: 'its bakehouse shelf',
    story: 'table',
  },
  'empty-jug': {
    name: 'empty jug',
    target: 'jug-shelf',
    place: 'its bakehouse shelf',
    story: 'table',
  },
  'water-jug': {
    name: 'filled jug',
    target: 'jug-shelf',
    place: 'its bakehouse shelf',
    story: 'table',
  },
  'cart-handle': {
    name: 'handcart handle',
    target: 'tool-shelf',
    place: 'its bakehouse bracket',
    story: 'neighbors',
  },
  'sewing-pouch': {
    name: 'Ruth’s sewing pouch',
    target: 'sewing-rest',
    place: 'its resting place on the shore',
    story: 'belonging',
  },
  'lashing-cord': {
    name: 'lashing cord',
    target: 'cord-basket',
    place: 'the cord basket on the shore',
    story: 'rest',
  },
  'wood-brace': {
    name: 'wooden brace',
    target: 'brace-shelf',
    place: 'the spare brace shelf in the bakehouse',
    story: 'rest',
  },
};
export function heldReturn(s: GameState): { text: string; target: string } | undefined {
  const item = s.campaign.carrying && heldItems[s.campaign.carrying];
  return item
    ? {
        text:
          'To free your hands, return the ' +
          item.name +
          ' to ' +
          item.place +
          '. Your progress will be remembered.',
        target: item.target,
      }
    : undefined;
}

export function lifeGoal(s: GameState): StoryGoal | undefined {
  const { thread, bench } = s.life;
  if (s.tracking === 'belonging') {
    let text = 'Speak with Ruth in the neighborhood courtyard about her sewing pouch.',
      target = 'ruth';
    if (thread.stage === 'searching') {
      if (thread.clues.length === 2) {
        text = 'Compare both clues with the pouch resting on the shore.';
        target = 'sewing-rest';
      } else if (!thread.clues.includes('water')) {
        text = 'Inspect the thread by the water point. The bakehouse cloth can come first.';
        target = 'thread-clue';
      } else {
        text = 'Inspect the stitching on Ruth’s cloth in the bakehouse.';
        target = 'cloth-clue';
      }
    }
    if (thread.stage === 'identified') {
      target = s.campaign.carrying === 'sewing-pouch' ? 'ruth' : 'sewing-rest';
      text =
        s.campaign.carrying === 'sewing-pouch'
          ? 'Return the pouch to Ruth in the courtyard.'
          : 'Carry the identified pouch from its resting place on the shore.';
    }
    if (thread.stage === 'returned')
      text =
        'Share the route you followed or a quiet welcome with Ruth. Both memories are welcome.';
    if (thread.stage === 'complete')
      text = 'Ruth’s pouch is beside her. Your chosen memory remains in the journal.';
    return {
      title: 'A familiar thread',
      text,
      target,
      done: thread.stage === 'complete',
      steps: [
        'Listen to Ruth',
        'Remember two clues in either order',
        'Compare, return, and share a memory',
      ],
    };
  }
  if (s.tracking === 'rest') {
    let text = 'Inspect the loose bench beside the landing on the shore.',
      target = 'landing-bench';
    if (bench.stage === 'planning')
      text = 'Choose a rope lashing or a wooden brace at the bench. Both methods are useful.';
    if (bench.stage === 'working') {
      const material = bench.method === 'lashing' ? 'lashing-cord' : 'wood-brace';
      if (s.campaign.carrying === material)
        text = bench.cleared
          ? 'Fit your chosen repair to the landing bench.'
          : 'Clear the loose pieces, then fit the material you brought.';
      else if (!bench.cleared)
        text = 'Clear the loose pieces beneath the seat. You may fetch the material first.';
      else {
        text =
          bench.method === 'lashing'
            ? 'Borrow spare lashing cord near the landing.'
            : 'Borrow the spare wooden brace from the bakehouse.';
        target = bench.method === 'lashing' ? 'cord-basket' : 'brace-shelf';
      }
    }
    if (bench.stage === 'fitted') text = 'Sit on the finished bench to check the seat.';
    if (bench.stage === 'complete')
      text =
        'A neighbor has a steady place to rest beside the landing. Miriam remembers your work.';
    return {
      title: 'A place to rest',
      text,
      target,
      done: bench.stage === 'complete',
      steps: [
        'Inspect and choose a repair',
        'Clear the seat and bring material in either order',
        'Fit the repair and sit to check it',
      ],
    };
  }
}

/** A tracked practical story must never route a player to another uncarryable object. */
export function withHeldGuidance(s: GameState, goal: StoryGoal): StoryGoal {
  const item = s.campaign.carrying && heldItems[s.campaign.carrying];
  const practical = ['neighbors', 'table', 'belonging', 'rest', 'spring', 'shelter'].includes(
    s.tracking,
  );
  if (item && practical && item.story !== s.tracking && !goal.done)
    return { ...goal, ...heldReturn(s)! };
  return goal;
}
