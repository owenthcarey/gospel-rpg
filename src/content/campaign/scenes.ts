import type { RoofSceneId } from '../../game/campaign/types';
import { roofVerses, type RoofVerseId } from './scripture';
export interface RoofBeat {
  id: RoofSceneId;
  title: string;
  reference: string;
  verses: readonly RoofVerseId[];
  narration: string;
  observation: string;
  description: string;
  continueLabel: string;
}
export const roofBeats: readonly RoofBeat[] = [
  {
    id: 'house',
    title: 'A house full of listeners',
    reference: 'Mark 2:1–2',
    verses: ['2:1', '2:2'],
    narration:
      'Some days have passed. Mark brings us again to Capernaum. Your imagined traveler remains among the neighbors as this dramatization takes a closer view. The house and its arrangement are artistic interpretations; Mark does not name its owner here.',
    observation:
      'The doorway is full. Notice the difference between having a place in a room and being able to reach it.',
    description:
      'Jesus stands in a small house. Seated listeners and neighbors fill the room and gather outside its doorway. A flat roof rests on timber beams.',
    continueLabel: 'Notice those arriving',
  },
  {
    id: 'bearers',
    title: 'Four people and a mat',
    reference: 'Mark 2:3',
    verses: ['2:3'],
    narration:
      'Four bearers approach together. They carry a man who cannot walk into the room for himself. The traveler watches; these four people retain their part in the account.',
    observation: 'The men move at one another’s pace, holding a corner of the mat between them.',
    description:
      'Outside the house, four distinct bearers hold a mat with a reclining man. The crowded entrance is ahead of them.',
    continueLabel: 'Look toward the roof',
  },
  {
    id: 'roof',
    title: 'A way through the roof',
    reference: 'Mark 2:4',
    verses: ['2:4'],
    narration:
      'The viewpoint rises to follow Mark’s account. An opening appears above the room, and the mat is lowered toward Jesus. The method, materials and movements shown here are staging, not details added to the quotation.',
    observation:
      'The same mat connects the roof and the room below. The people who carried it have not left their companion behind.',
    description:
      'Four bearers stand around a broad opening in the roof. Ropes extend from the mat toward their hands. The man is lowered into the room before Jesus.',
    continueLabel: 'Hear the words spoken to him',
  },
  {
    id: 'forgiven',
    title: 'Words before the waiting room',
    reference: 'Mark 2:5',
    verses: ['2:5'],
    narration:
      'The mat rests before Jesus. The account turns from the effort of reaching the room to the words Jesus speaks.',
    observation:
      'There is no task for you to complete here. Take time with the words of the account.',
    description:
      'The man lies on the mat in the middle of the room. Jesus faces him. The listeners remain nearby, and the roof opening is visible overhead.',
    continueLabel: 'Hear the question in the room',
  },
  {
    id: 'question',
    title: 'A question among the scribes',
    reference: 'Mark 2:6–7',
    verses: ['2:6', '2:7'],
    narration:
      'Mark gives the reasoning of some scribes who are sitting there. Their question belongs to this account; it is not a description of every person in a community or tradition.',
    observation:
      'The narration names a question about authority. Read it beside the answer that follows.',
    description:
      'The view turns toward seated scribes at the edge of the room. Jesus and the man on the mat remain in view.',
    continueLabel: 'Listen to Jesus’ answer',
  },
  {
    id: 'authority',
    title: 'That you may know',
    reference: 'Mark 2:8–11',
    verses: ['2:8', '2:9', '2:10', '2:11'],
    narration:
      'Mark records Jesus answering the question and addressing the man. The words remain together here so that the question, explanation and command can be read in their context.',
    observation:
      'The account joins forgiveness and the command to rise. The scene leaves the authority in Jesus’ words.',
    description:
      'Jesus gestures toward the man. The listeners face the center of the room. The mat lies flat on the floor.',
    continueLabel: 'Watch him rise',
  },
  {
    id: 'rise',
    title: 'He arose',
    reference: 'Mark 2:12',
    verses: ['2:12'],
    narration:
      'The man rises, takes up his mat, and goes out before them. The traveler does not direct or determine this outcome.',
    observation: 'The object that carried him into the room is now carried by him.',
    description:
      'The man stands, gathers the mat, and walks toward the open doorway. The neighbors make space as he leaves.',
    continueLabel: 'Remain with the room a moment',
  },
  {
    id: 'amazement',
    title: 'We never saw anything like this',
    reference: 'Mark 2:12',
    verses: ['2:12'],
    narration:
      'Mark’s account closes with amazement and praise. We now return to the imagined traveler. The conversations, hospitality and reflections that follow belong to the original neighborhood story.',
    observation:
      'The doorway is open again. A familiar room has become a place the people will remember.',
    description:
      'The mat and the man are gone from the center of the room. An open doorway, the roof opening and the gathered listeners remain. The view returns to the traveler.',
    continueLabel: 'Return to your traveler',
  },
];
export function roofBeat(id: RoofSceneId): RoofBeat {
  const beat = roofBeats.find((b) => b.id === id);
  if (!beat) throw new Error('Unknown roof checkpoint: ' + id);
  return beat;
}
export function roofScripture(beat: RoofBeat): string {
  return beat.verses.map((id) => roofVerses[id]).join(' ');
}
