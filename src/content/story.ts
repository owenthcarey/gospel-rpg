import { hasMemories, hasSupplies } from '../game/quest';
import type { GameEvent, GameState, ItemId } from '../game/types';

export interface Choice {
  label: string;
  next?: string;
  event?: GameEvent;
  close?: boolean;
}
export interface Dialogue {
  speaker: string;
  subtitle: string;
  text: string;
  provenance: 'Original dialogue' | 'Original narration' | 'Scripture · WEB';
  reference?: string;
  choices: Choice[];
}
export const items: Record<ItemId, { name: string; description: string; icon: string }> = {
  net: {
    name: 'Mended fishing net',
    description: 'Flax cord, carefully knotted. Ready for another morning on the lake.',
    icon: 'net',
  },
  bread: {
    name: 'Barley loaves',
    description: 'A small bundle of fresh bread from Miriam, wrapped in linen.',
    icon: 'bread',
  },
};
export const journalEntries: Record<string, { title: string; text: string; reference?: string }> = {
  arrival: {
    title: 'A village waking',
    text: 'I arrived in Capernaum as the fishermen came ashore. There is a quiet sense of expectation in the village.',
  },
  simon: {
    title: 'A little help for Simon',
    text: 'Simon asked me to fetch the mended net from the drying rack and some bread from Miriam. Small acts of care make room for others.',
  },
  net: {
    title: 'The work of many hands',
    text: 'The net is mended, each knot tied by hand. Life along this shore is shaped by patience and shared work.',
  },
  bread: {
    title: 'Bread to share',
    text: 'Miriam sent barley loaves for the people gathering by the lake. She reminded me that hospitality can begin with something simple.',
  },
  delivered: {
    title: 'Room by the water',
    text: 'The supplies are with Simon. Jesus is by the shore, and the people are gathering to listen.',
    reference: 'Luke 5:1–3',
  },
  complete: {
    title: 'An invitation to trust',
    text: 'My small errand is finished. The Gospel story continues as Jesus asks Simon to put out into the deep. Read Luke 5:1–11 to follow the catch and the calling of the fishermen.',
    reference: 'Luke 5:1–11',
  },
  shore: {
    title: 'One lake, many names',
    text: 'The Sea of Galilee is also called the lake of Gennesaret in Luke. Here, water connects villages, livelihoods, and the journeys of Jesus.',
    reference: 'Luke 5:1',
  },
  well: {
    title: 'At the village well',
    text: 'In this imagined village, the well is a meeting place. A pause in the daily work becomes a chance to hear a neighbor’s story.',
  },
  olive: {
    title: 'Under the olive trees',
    text: 'Silver-green leaves stir above the path. Take a moment to rest. There is no need to hurry through this place.',
  },
  'ezra-invitation': {
    title: 'An ordinary morning',
    text: 'Ezra invited me to notice three places: the village well, the olive grove, and the shore. When I have remembered each in my journal, he would like to hear what I found. There is no hurry, and places I have already visited are part of the story.',
  },
  'ezra-memory': {
    title: 'A place among neighbors',
    text: 'I returned to Ezra with memories of water, shade, and the lake. We sat together beneath the olives. A village that was unfamiliar this morning now holds faces I know, and paths I can find again. I came as a traveler; for a little while, I was a neighbor.',
  },
};

const goodbye: Choice = { label: 'Until we speak again', close: true };
export function dialogueFor(id: string, state: GameState): Dialogue {
  const original = 'Original dialogue' as const;
  const narration = 'Original narration' as const;
  switch (id) {
    case 'simon':
      if (state.quest === 'not-started')
        return {
          speaker: 'Simon',
          subtitle: 'Fisherman of Capernaum',
          provenance: original,
          reference: 'Inspired by Luke 5:1–3',
          text: 'Peace to you, traveler. A long night on the water, and little to show for it. Now people are gathering to hear the teacher. Would you lend a hand while I ready the boat?',
          choices: [
            { label: 'Of course. What do you need?', next: 'simon-request' },
            { label: 'Tell me about the teacher', next: 'simon-teacher' },
            { label: 'I’ll return in a moment', close: true },
          ],
        };
      if (state.quest === 'gathering' && hasSupplies(state))
        return {
          speaker: 'Simon',
          subtitle: 'Fisherman of Capernaum',
          provenance: original,
          text: 'A sound net and bread to share. Thank you, friend. Set them here. The teacher is just along the shore; there is room for you to listen, too.',
          choices: [
            { label: 'Give Simon the net and bread', event: { type: 'deliver' }, close: true },
          ],
        };
      if (state.quest === 'gathering')
        return {
          speaker: 'Simon',
          subtitle: 'Fisherman of Capernaum',
          provenance: original,
          text: 'The mended net is on the drying rack south of here. Miriam has a stall by the village path. When you have both the net and the bread, bring them back to me.',
          choices: [goodbye],
        };
      return {
        speaker: 'Simon',
        subtitle: 'Fisherman of Capernaum',
        provenance: original,
        text: 'Thank you for your help. Stay a while, if you can. Jesus is just north of the boats, beside the water.',
        choices: [goodbye],
      };
    case 'simon-request':
      return {
        speaker: 'Simon',
        subtitle: 'A place by the water',
        provenance: original,
        text: 'There is a mended net on the drying rack, south along the shore. And Miriam, at the market stall, has bread for those gathering here. Bring them to me when you are ready.',
        choices: [
          { label: 'I’ll bring the net and bread', event: { type: 'accept-quest' }, close: true },
          { label: 'Let me think about it', close: true },
        ],
      };
    case 'simon-teacher':
      return {
        speaker: 'Simon',
        subtitle: 'Fisherman of Capernaum',
        provenance: original,
        text: 'Jesus of Nazareth. People have come from the village to hear him. See for yourself; he is here beside the lake.',
        choices: [{ label: 'How can I help?', next: 'simon-request' }, goodbye],
      };
    case 'miriam':
      if (state.quest === 'gathering' && !state.inventory.includes('bread'))
        return {
          speaker: 'Miriam',
          subtitle: 'Village baker',
          provenance: original,
          text: 'Simon sent you? Here, take these barley loaves. There will be hungry people on the shore before long. It is a small thing, but small things shared become enough for a neighbor.',
          choices: [
            {
              label: 'Take the bread for Simon',
              event: { type: 'collect', item: 'bread' },
              close: true,
            },
            { label: 'Tell me about the village', next: 'miriam-village' },
          ],
        };
      return {
        speaker: 'Miriam',
        subtitle: 'Village baker',
        provenance: original,
        text: 'Peace to you. The morning’s bread is cooling, and everyone seems to be going down to the water. If you are looking for Simon, you will find him by the boats.',
        choices: [{ label: 'Tell me about the village', next: 'miriam-village' }, goodbye],
      };
    case 'miriam-village':
      return {
        speaker: 'Miriam',
        subtitle: 'Life in Capernaum',
        provenance: original,
        text: 'The lake gives us fish, and the fields give us grain. We depend on one another for the rest. Speak with Ezra near the olive trees; he is always glad of company.',
        choices: [{ label: 'About the bread…', next: 'miriam' }, goodbye],
      };
    case 'nets':
      return {
        speaker: 'The drying rack',
        subtitle: 'Along the southern shore',
        provenance: narration,
        text:
          state.inventory.includes('net') ||
          state.quest === 'delivered' ||
          state.quest === 'complete'
            ? 'You have already taken the mended net for Simon. The remaining cords sway gently in the lake breeze.'
            : 'A mended flax net hangs between wooden posts, its knots still pale from careful repair. This is the net Simon needs.',
        choices:
          state.quest === 'gathering' && !state.inventory.includes('net')
            ? [
                {
                  label: 'Take the mended net',
                  event: { type: 'collect', item: 'net' },
                  close: true,
                },
              ]
            : [{ label: 'Leave the rack', close: true }],
      };
    case 'jesus':
      if (state.quest === 'delivered')
        return {
          speaker: 'By the water',
          subtitle: 'An invitation to listen',
          provenance: narration,
          reference: 'Luke 5:1–11',
          text: 'You find a place among those gathered along the shore. Your errand ends here. In Luke’s account, Jesus teaches from Simon’s boat, then turns to Simon with an invitation.',
          choices: [
            { label: 'Listen', next: 'jesus-scripture' },
            { label: 'Return to the village', close: true },
          ],
        };
      return {
        speaker: 'By the water',
        subtitle: 'Jesus and the gathering crowd',
        provenance: narration,
        reference: 'Luke 5:1–3',
        text:
          state.quest === 'complete'
            ? 'The water catches the morning light. Your journey through this small part of Galilee is complete, but you may linger, speak with the villagers, and explore. The Gospel story continues in Luke 5:1–11.'
            : 'People are gathering near Jesus to hear the word of God. Simon is preparing by the boats. Perhaps you can help him make ready.',
        choices: [{ label: 'Return to the shore', close: true }],
      };
    case 'jesus-scripture':
      return {
        speaker: 'Jesus',
        subtitle: 'Luke 5:4 · World English Bible',
        provenance: 'Scripture · WEB',
        reference: 'Luke 5:4',
        text: '“Put out into the deep and let down your nets for a catch.”',
        choices: [{ label: 'Carry these words with you', event: { type: 'listen' }, close: true }],
      };
    case 'ezra':
      if (state.villageStory === 'complete')
        return {
          speaker: 'Ezra',
          subtitle: 'A familiar face',
          provenance: original,
          text: 'There you are, friend. I was thinking of our morning. The shade is still here, and there is still room beside me. You know your way around our little village now.',
          choices: [{ label: 'Remember our morning', next: 'ezra-reflection' }, goodbye],
        };
      if (state.villageStory === 'exploring' && hasMemories(state))
        return {
          speaker: 'Ezra',
          subtitle: 'An ordinary morning',
          provenance: original,
          text: 'You have walked a little slower, I think. Tell me, what will you carry with you when you leave? The voices at the well, the quiet of the grove, or the open water?',
          choices: [
            { label: 'The voices at the well', next: 'ezra-well' },
            { label: 'The quiet beneath the olives', next: 'ezra-olive' },
            { label: 'The wide, open water', next: 'ezra-shore' },
          ],
        };
      if (state.villageStory === 'exploring')
        return {
          speaker: 'Ezra',
          subtitle: `${state.discoveries.length} of 3 places remembered`,
          provenance: original,
          text: 'There is no hurry. Visit the well, rest beneath the olive trees, and look out over the lake. Write down what you notice. Come back when you have a memory of each, and we will sit a while.',
          choices: [{ label: 'I’ll keep exploring', close: true }, goodbye],
        };
      return {
        speaker: 'Ezra',
        subtitle: 'A neighbor along the way',
        provenance: original,
        text: 'A traveler sees what those of us at home can forget to notice. The water, the shade of the olives, a friend at the well. Look around. There are gifts in an ordinary morning.',
        choices: [
          { label: 'What should I look for?', next: 'ezra-invitation' },
          { label: 'What is this place?', next: 'ezra-place' },
          { label: 'I’ll return another time', close: true },
        ],
      };
    case 'ezra-invitation':
      return {
        speaker: 'Ezra',
        subtitle: 'An ordinary morning · Optional village story',
        provenance: original,
        text: 'Start at the well, where neighbors cross paths. Then rest in the olive grove and look out over the shore. Keep a memory of each in your journal. When you return, I would be glad to hear what stayed with you.',
        choices: [
          {
            label: 'I’ll bring back a few memories',
            event: { type: 'accept-village-story' },
            close: true,
          },
          { label: 'Perhaps another time', close: true },
        ],
      };
    case 'ezra-well':
    case 'ezra-olive':
    case 'ezra-shore': {
      const reflections = {
        'ezra-well':
          'A familiar voice can make a place feel like home. Tomorrow someone will need water again, and someone else will have news to share. I am glad you stopped to listen.',
        'ezra-olive':
          'I have rested beneath those branches on many warm mornings. Sometimes the best part of a walk is the place where you stop. I am glad you found a little quiet.',
        'ezra-shore':
          'I have lived beside this water for years, and I still stop to look. Boats leave and boats return. Today the lake brought us a new neighbor. I am glad it was you.',
      };
      return {
        speaker: 'Ezra',
        subtitle: 'A place among neighbors',
        provenance: original,
        text: reflections[id],
        choices: [{ label: 'Sit with Ezra a little longer', next: 'ezra-reflection' }],
      };
    }
    case 'ezra-reflection':
      return {
        speaker: 'Beneath the olive trees',
        subtitle: 'A place among neighbors',
        provenance: narration,
        text: 'For a while, the two of you watch the village go about its morning. You know the path to the well, the baker’s name, the sound of water beneath the boats. This small place has become a little less unfamiliar.',
        choices: [
          {
            label:
              state.villageStory === 'complete' ? 'Return to the path' : 'Remember this morning',
            event: { type: 'finish-village-story' },
            close: true,
          },
        ],
      };
    case 'ezra-place':
      return {
        speaker: 'Ezra',
        subtitle: 'A village beside the lake',
        provenance: original,
        text: 'Capernaum, on the northern shore of Galilee. Boats come and go, and news travels with them. You are welcome to rest here before the road calls you on.',
        choices: [goodbye],
      };
    case 'well':
    case 'shore':
    case 'olive': {
      const entry = journalEntries[id]!;
      return {
        speaker: entry.title,
        subtitle: 'A moment along the way',
        provenance: narration,
        reference: entry.reference,
        text: entry.text,
        choices: [
          {
            label: state.discoveries.includes(id)
              ? 'Return to the path'
              : 'Remember this in your journal',
            event: { type: 'discover', id },
            close: true,
          },
        ],
      };
    }
    default:
      throw new Error(`Unknown conversation: ${id}`);
  }
}
