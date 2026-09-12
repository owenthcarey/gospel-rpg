import { STORM_SCENES, type StormScene } from '../../game/lake/types';
import { stormVerses } from './scripture';
export interface StormBeat {
  id: StormScene;
  title: string;
  verse: keyof typeof stormVerses;
  narration: string;
  description: string;
  observation: string;
  continueLabel: string;
}
export const stormBeats: readonly StormBeat[] = [
  {
    id: 'evening',
    title: 'When evening had come',
    verse: '4:35',
    narration:
      'Evening settles over the water as the boats leave shore. Your traveler stays at the cove while this view follows Mark’s account. The order of your imagined travels does not establish the chronology of the Gospel events.',
    description:
      'An evening sky warms the water. Jesus rests toward the stern of a wooden boat, with several disciples aboard. The shore recedes behind them.',
    observation: 'The departure begins with the words recorded by Mark.',
    continueLabel: 'Follow the boats',
  },
  {
    id: 'boats',
    title: 'Other small boats',
    verse: '4:36',
    narration:
      'Other small boats accompany the crossing. Behind them, the shore grows distant and the evening light spreads across the water.',
    description:
      'The main boat moves across blue water. Two smaller boats appear behind it. Oars rest beside the gunwales; the last strip of shore lies in the distance.',
    observation: 'Notice the company on the water before the change in weather.',
    continueLabel: 'Read of the storm',
  },
  {
    id: 'storm',
    title: 'The waves beat into the boat',
    verse: '4:37',
    narration:
      'A great windstorm rises. Waves beat against the hull, and water gathers inside the boat. At the stern, Jesus remains asleep.',
    description:
      'The sky and sea grow slate blue. Pale wave crests surround the boat. A shallow blue surface inside its hull shows the water entering. The disciples remain gathered while Jesus rests at the stern.',
    observation: 'You can pause the motion or finish with a summary at any time.',
    continueLabel: 'Read the disciples’ words',
  },
  {
    id: 'waking',
    title: 'Asleep on the cushion',
    verse: '4:38',
    narration:
      'The view draws closer to the cushion at the stern. Amid the wind and water, the disciples turn toward the sleeping figure and wake him.',
    description:
      'Jesus reclines on a cushion at the stern. One disciple kneels nearby and another remains seated. The water remains rough around the boat.',
    observation:
      'Take time with the contrast between the sleeping figure and the surrounding storm.',
    continueLabel: 'Read the command',
  },
  {
    id: 'command',
    title: 'Peace! Be still!',
    verse: '4:39',
    narration:
      'Jesus rises beside the disciples. He rebukes the wind and speaks to the sea. The wave crests settle around the boat, and a great calm follows.',
    description:
      'Jesus stands near the stern with one arm extended. The pale crests lower around the boat. The disciples face him as the surrounding water becomes calm.',
    observation: 'The words and the resulting calm stay together in this scene.',
    continueLabel: 'Remain in the calm',
  },
  {
    id: 'calm',
    title: 'A great calm',
    verse: '4:40',
    narration:
      'The boat rests level on the quiet water. Jesus faces the disciples, and his question follows the stilling of the storm.',
    description:
      'The boat rests level on still blue water. Jesus faces the seated disciples. The distant boats and a faint shoreline are visible again.',
    observation: 'The full transcript preserves both the command and the question.',
    continueLabel: 'Read their wonder',
  },
  {
    id: 'question',
    title: 'Who then is this?',
    verse: '4:41',
    narration:
      'Mark closes this passage with the disciples’ question. Beyond the boat lies the open water. Return to your traveler at the sheltered cove, where a neighbor and a quiet lookout offer time to remember.',
    description:
      'The view widens over the level boat and open water. The disciples remain gathered near Jesus. The cove’s warm colors return at the edge of the frame.',
    observation:
      'Your ordinary exploration and its unfinished work remain available after the account.',
    continueLabel: 'Return to the sheltered cove',
  },
];
export const stormBeat = (id: StormScene): StormBeat => stormBeats[STORM_SCENES.indexOf(id)]!;
