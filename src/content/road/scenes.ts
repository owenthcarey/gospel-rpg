import type { NainSceneId } from '../../game/road/types';
import { nainVerses, type NainVerseId } from './scripture';
export interface NainBeat {
  id: NainSceneId;
  title: string;
  reference: string;
  verses: readonly NainVerseId[];
  narration: string;
  observation: string;
  description: string;
  continueLabel: string;
}
export const nainBeats: readonly NainBeat[] = [
  {
    id: 'approach',
    title: 'Toward the city',
    reference: 'Luke 7:11',
    verses: ['7:11'],
    narration:
      'Luke brings us to Nain. Jesus approaches with his disciples and a multitude. Your traveler observes from the edge of this artistic interpretation. The compact road you walked is an imagined journey, not a map of the distance or a precise chronology between the accounts.',
    observation:
      'Notice the company approaching the gate. The account begins with people traveling together.',
    description:
      'Jesus and several followers stand on the road below a pale stone gate. The town rises behind it. Another company can be seen inside the gateway.',
    continueLabel: 'Notice the company at the gate',
  },
  {
    id: 'procession',
    title: 'A mother and her only son',
    reference: 'Luke 7:12',
    verses: ['7:12'],
    narration:
      'A funeral procession is leaving the town. Luke names the mother’s loss: her only son has died, and she is a widow. Many people of the city are with her. The people’s names, exact number, clothing and carrying frame are not specified here; the scene represents them without adding to the quotation.',
    observation:
      'The woman is accompanied by her neighbors. Take as much time as you need with this part of the account.',
    description:
      'Bearers support an open wooden carrying frame. A clothed young man lies on it. His mother stands beside the procession, with townspeople behind her. The presentation contains no graphic injury.',
    continueLabel: 'Read of his compassion',
  },
  {
    id: 'compassion',
    title: 'When the Lord saw her',
    reference: 'Luke 7:13',
    verses: ['7:13'],
    narration:
      'Luke directs our attention to the mother and the Lord’s compassion. The traveler does not need to perform a task or earn this moment. The words belong to the account.',
    observation: 'The scene stays still enough to see who is being addressed.',
    description:
      'Jesus faces the mother near the carrying frame. The bearers and both groups remain nearby. The mother has room around her; the camera does not press into her grief.',
    continueLabel: 'Remain at the gate',
  },
  {
    id: 'command',
    title: 'The bearers stood still',
    reference: 'Luke 7:14',
    verses: ['7:14'],
    narration:
      'Jesus comes near and touches the coffin. The bearers stop. Luke records his command to the young man. The frame shown here is an artistic interpretation of the carrying object, not a claim about its exact construction.',
    observation: 'All movement pauses around the words. You remain an observer.',
    description:
      'Jesus stands beside the frame with one hand at its edge. Four bearers hold it level and still. The young man remains reclining. His mother and the gathered people watch.',
    continueLabel: 'Read what followed',
  },
  {
    id: 'restored',
    title: 'He gave him to his mother',
    reference: 'Luke 7:15',
    verses: ['7:15'],
    narration:
      'The young man sits up and begins to speak. Luke does not record his words, so this presentation supplies none. The scene then shows him beside his mother, following the account’s final sentence.',
    observation: 'A relationship returns to the center of the scene: the son and his mother.',
    description:
      'The young man sits upright on the supported frame, then stands beside his mother. Jesus is close by. The bearers lower the empty frame. With reduced motion, the mother and son are already standing together.',
    continueLabel: 'Hear the people’s response',
  },
  {
    id: 'wonder',
    title: 'God has visited his people',
    reference: 'Luke 7:16–17',
    verses: ['7:16', '7:17'],
    narration:
      'Luke ends with the people’s fear, their praise of God and the spreading report. We return now to the imagined traveler. The conversations and reflections that follow are original responses alongside the account.',
    observation:
      'The gate is still a place where people meet and part. What would you like to remember here?',
    description:
      'The mother and son stand together near Jesus. Both companies face them. The empty carrying frame rests to one side, and the town gate remains open.',
    continueLabel: 'Return to your traveler',
  },
];
export function nainBeat(id: NainSceneId): NainBeat {
  const beat = nainBeats.find((b) => b.id === id);
  if (!beat) throw new Error('Unknown Nain checkpoint: ' + id);
  return beat;
}
export function nainScripture(beat: NainBeat): string {
  return beat.verses.map((id) => nainVerses[id]).join(' ');
}
