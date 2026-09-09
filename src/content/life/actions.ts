import type { WorldAction } from '../campaign/actions';
import type { GameState } from '../../game/types';

const afterLake = (s: GameState) => s.episode.stage === 'complete';
const empty = (s: GameState) => s.campaign.carrying === null;
const searching = (s: GameState) => s.life.thread.stage === 'searching';
const working = (s: GameState) => s.life.bench.stage === 'working';
const identified = (s: GameState) => s.life.thread.stage === 'identified';

/** Authored choices are inspectable content; only the reducer can apply them. */
export const lifeActions: readonly WorldAction[] = [
  {
    id: 'life-thread-accept',
    target: 'ruth',
    verb: 'Listen',
    label: 'Help Ruth find her sewing pouch',
    notice: 'A familiar thread · Look by the water point and in Hannah’s bakehouse.',
    available: (s) => afterLake(s) && s.life.thread.stage === 'not-started',
    requirement: 'Ruth is in the neighborhood courtyard after Into the Deep.',
  },
  {
    id: 'life-clue-water',
    target: 'thread-clue',
    verb: 'Inspect',
    label: 'Remember the blue thread',
    notice: 'Evidence remembered · A blue thread caught beside the water point.',
    available: (s) => searching(s) && !s.life.thread.clues.includes('water'),
    requirement: 'First speak with Ruth about her missing sewing pouch.',
  },
  {
    id: 'life-clue-cloth',
    target: 'cloth-clue',
    verb: 'Inspect',
    label: 'Remember the double stitch',
    notice: 'Evidence remembered · Two short stitches run together along the blue edging.',
    available: (s) => searching(s) && !s.life.thread.clues.includes('cloth'),
    requirement: 'First speak with Ruth about her missing sewing pouch.',
  },
  {
    id: 'life-identify',
    target: 'sewing-rest',
    verb: 'Inspect',
    label: 'Compare the pouch with both clues',
    notice: 'The blue edging and double stitch match. This is Ruth’s pouch.',
    visible: searching,
    available: (s) => searching(s) && s.life.thread.clues.length === 2,
    requirement:
      'Remember the thread at the water point and the stitching on the bakehouse cloth first.',
  },
  {
    id: 'life-take-pouch',
    target: 'sewing-rest',
    verb: 'Carry',
    label: 'Carry Ruth’s sewing pouch',
    notice: 'Pouch in hand · Take it to Ruth in the courtyard.',
    visible: (s) => identified(s) && s.campaign.carrying !== 'sewing-pouch',
    available: (s) => identified(s) && empty(s),
    requirement: 'Identify the pouch from both clues, then free your hands.',
    needsFreeHands: true,
  },
  {
    id: 'life-set-pouch',
    target: 'sewing-rest',
    verb: 'Place',
    label: 'Set the pouch back in its resting place',
    notice: 'Pouch set down safely · Its identity is remembered. Recover it whenever you wish.',
    available: (s) => s.campaign.carrying === 'sewing-pouch',
    requirement: 'While carrying Ruth’s pouch.',
  },
  {
    id: 'life-return-pouch',
    target: 'ruth',
    verb: 'Place',
    label: 'Return the sewing pouch to Ruth',
    notice: 'Ruth has her pouch again. There is time to share a moment.',
    available: (s) => s.campaign.carrying === 'sewing-pouch',
    requirement: 'Bring the identified pouch from the shore.',
  },
  ...(['route', 'welcome'] as const).map((ending) => ({
    id: 'life-ending-' + ending,
    target: 'ruth',
    verb: 'Choose' as const,
    label: ending === 'route' ? 'Tell Ruth where the clues led' : 'Share a quiet welcome with Ruth',
    notice:
      ending === 'route'
        ? 'A familiar thread complete · A route remembered together.'
        : 'A familiar thread complete · A quiet welcome remembered.',
    available: (s: GameState) => s.life.thread.stage === 'returned',
    requirement: 'Return the pouch to Ruth first. Either memory is welcome.',
  })),
  {
    id: 'life-bench-inspect',
    target: 'landing-bench',
    verb: 'Inspect',
    label: 'Look closely at the loose bench',
    notice: 'A place to rest · A lashing or wooden brace can steady this seat.',
    available: (s) => afterLake(s) && s.life.bench.stage === 'not-started',
    requirement: 'Available after Into the Deep.',
  },
  ...(['lashing', 'brace'] as const).map((method) => ({
    id: 'life-method-' + method,
    target: 'landing-bench',
    verb: 'Choose' as const,
    label:
      method === 'lashing'
        ? 'Steady it with a rope lashing'
        : 'Fit a wooden brace beneath the seat',
    notice:
      method === 'lashing'
        ? 'A rope lashing · Borrow spare cord near the landing.'
        : 'A wooden brace · Borrow the spare from Hannah’s bakehouse.',
    available: (s: GameState) => s.life.bench.stage === 'planning',
    requirement: 'Inspect the loose bench first. Both methods make a useful seat.',
  })),
  {
    id: 'life-clear-bench',
    target: 'landing-bench',
    verb: 'Use',
    motion: 'Repair',
    label: 'Clear the loose pieces beneath the seat',
    notice: 'The space under the seat is clear. The loose pieces are stacked safely.',
    visible: (s) => working(s) && !s.life.bench.cleared,
    available: (s) =>
      working(s) &&
      !s.life.bench.cleared &&
      (empty(s) || ['lashing-cord', 'wood-brace'].includes(s.campaign.carrying!)),
    requirement: 'Choose a repair method. Keep only its material in your hands.',
  },
  ...(
    [
      ['lashing', 'lashing-cord', 'cord-basket', 'spare lashing cord'],
      ['brace', 'wood-brace', 'brace-shelf', 'wooden brace'],
    ] as const
  ).flatMap(([method, item, target, name]) => [
    {
      id: 'life-take-' + method,
      target,
      verb: 'Carry' as const,
      label: 'Borrow the ' + name,
      notice: 'Material in hand · Bring it to the landing bench on the shore.',
      visible: (s: GameState) =>
        working(s) && s.life.bench.method === method && s.campaign.carrying !== item,
      available: (s: GameState) => working(s) && s.life.bench.method === method && empty(s),
      requirement: 'Choose this repair method at the landing bench, then free your hands.',
      needsFreeHands: true,
    },
    {
      id: 'life-return-' + method,
      target,
      verb: 'Place' as const,
      label: 'Return the ' + name,
      notice: 'Material returned safely. Your work on the bench is remembered.',
      available: (s: GameState) => s.campaign.carrying === item,
      requirement: 'While carrying the ' + name + '.',
    },
    {
      id: 'life-fit-' + method,
      target: 'landing-bench',
      verb: 'Use' as const,
      motion: 'Repair' as const,
      label:
        method === 'lashing' ? 'Secure the seat with the lashing' : 'Fit the brace under the seat',
      notice: 'The bench is steady. Sit for a moment to check the seat.',
      visible: (s: GameState) => working(s) && s.life.bench.method === method,
      available: (s: GameState) =>
        working(s) &&
        s.life.bench.method === method &&
        s.life.bench.cleared &&
        s.campaign.carrying === item,
      requirement:
        'Clear the loose pieces and bring the chosen material. Either preparation can come first.',
    },
  ]),
  {
    id: 'life-test-bench',
    target: 'landing-bench',
    verb: 'Use',
    motion: 'SitDown',
    label: 'Sit and check the finished bench',
    notice: 'A place to rest complete · A steady seat is ready for the next neighbor.',
    available: (s) => s.life.bench.stage === 'fitted' && empty(s),
    visible: (s) => s.life.bench.stage === 'fitted',
    requirement: 'Fit the repair, then set down anything in your hands before sitting.',
    needsFreeHands: true,
  },
];
