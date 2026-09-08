import type { SceneId } from '../../game/episode/types';
import { narration, scripture, type Caption } from './scripture';

export type Staging =
  | 'shore'
  | 'teaching'
  | 'rowing'
  | 'lowering'
  | 'catch'
  | 'partners'
  | 'kneeling'
  | 'calling'
  | 'return';
export interface SceneBeat {
  id: SceneId;
  title: string;
  subtitle: string;
  staging: Staging;
  captions: readonly Caption[];
  observation: string;
  continueLabel: string;
  journal: { title: string; text: string; reference: string };
}

/** Each beat is a durable checkpoint. Animation has no authority to advance it. */
export const sceneBeats: readonly SceneBeat[] = [
  {
    id: 'gathering',
    title: 'A shore full of expectation',
    subtitle: 'Luke 5:1–2',
    staging: 'shore',
    captions: [
      narration(
        'Your traveler stays on shore as this narrated dramatization takes a closer view of the boats. Read Luke’s account at your own pace.',
      ),
      scripture('5:1', '5:2'),
    ],
    observation:
      'Two boats rest beside the water. The fishermen’s ordinary work frames the beginning of the account.',
    continueLabel: 'Look toward Simon’s boat',
    journal: {
      title: 'Those gathered by the lake',
      text: 'Luke places the beginning of the account beside the lake of Gennesaret, with a crowd listening and fishermen washing their nets.',
      reference: 'Luke 5:1–2',
    },
  },
  {
    id: 'teaching',
    title: 'A little way from land',
    subtitle: 'Luke 5:3',
    staging: 'teaching',
    captions: [
      scripture('5:3'),
      narration(
        'The boat becomes a place from which to teach. Luke does not record the words of this teaching here; this scene leaves them unspoken. On shore, there is room to be still and listen.',
      ),
    ],
    observation:
      'The crowd remains near the shore while Jesus sits in the boat. The small distance between them is part of the scene Luke describes.',
    continueLabel: 'When he has finished speaking',
    journal: {
      title: 'A boat and a listening shore',
      text: 'Jesus taught from Simon’s boat a little way from land. This account does not give the content of that teaching.',
      reference: 'Luke 5:3',
    },
  },
  {
    id: 'invitation',
    title: 'Into the deep',
    subtitle: 'Luke 5:4',
    staging: 'rowing',
    captions: [
      scripture('5:4'),
      narration('The direction changes: away from the familiar edge and out over deeper water.'),
    ],
    observation:
      'An ordinary boat carries an unexpected invitation. The familiar shore grows distant.',
    continueLabel: 'Hear Simon’s answer',
    journal: {
      title: 'Out beyond the familiar shore',
      text: 'Jesus asked Simon to put out into the deep and let down the nets for a catch.',
      reference: 'Luke 5:4',
    },
  },
  {
    id: 'answer',
    title: 'After an empty night',
    subtitle: 'Luke 5:5',
    staging: 'rowing',
    captions: [
      scripture('5:5'),
      narration(
        'Simon’s answer holds both the memory of the night’s work and a willingness to lower the net again. The scene gives his words space before the work begins.',
      ),
    ],
    observation: 'After a long night of work, Simon is willing to lower the net once more.',
    continueLabel: 'Watch the net being lowered',
    journal: {
      title: 'At your word',
      text: 'Simon spoke of a night without a catch, then answered that he would let down the net at Jesus’ word.',
      reference: 'Luke 5:5',
    },
  },
  {
    id: 'lowering',
    title: 'The net goes down',
    subtitle: 'A narrated transition · Luke 5:5–6',
    staging: 'lowering',
    captions: [
      narration(
        'The fishermen lower the net. Cord slips over the side, and the water closes around it.',
      ),
      scripture('5:6'),
    ],
    observation:
      'The broad net settles beneath the surface, its cords drawing away from the side of the boat.',
    continueLabel: 'See the catch',
    journal: {
      title: 'A net lowered once more',
      text: 'The fishermen lowered the net. Luke describes a great multitude of fish and a net beginning to break.',
      reference: 'Luke 5:5–6',
    },
  },
  {
    id: 'abundance',
    title: 'More than the net can hold',
    subtitle: 'Luke 5:6–7',
    staging: 'catch',
    captions: [
      scripture('5:6', '5:7'),
      narration(
        'The weight draws everyone’s attention. Across the water, the partners see the signal for help.',
      ),
    ],
    observation: 'The strain on the net calls for more hands. Look toward the partners’ boat.',
    continueLabel: 'Follow the partners’ boat',
    journal: {
      title: 'A catch beyond expectation',
      text: 'The catch strained the net, and the fishermen beckoned to their partners for help.',
      reference: 'Luke 5:6–7',
    },
  },
  {
    id: 'partners',
    title: 'The other boat draws near',
    subtitle: 'Luke 5:7, 9–10',
    staging: 'partners',
    captions: [
      scripture('5:7'),
      narration(
        'Luke later names James and John, sons of Zebedee, among Simon’s partners. Both boats fill as they work together.',
      ),
    ],
    observation: 'The two boats sit lower in the water under the weight of the catch.',
    continueLabel: 'Hear Simon’s response',
    journal: {
      title: 'Partners on the water',
      text: 'The partners came to help. Both boats filled with fish until they began to sink. Luke names James and John among those with Simon.',
      reference: 'Luke 5:7, 9–10',
    },
  },
  {
    id: 'astonishment',
    title: 'Before Jesus',
    subtitle: 'Luke 5:8–9',
    staging: 'kneeling',
    captions: [
      scripture('5:8', '5:9'),
      narration(
        'The scene becomes still. Amid the full boats and the fishermen’s astonishment, Simon turns toward Jesus.',
      ),
    ],
    observation:
      'The focus moves from the fish to Simon and Jesus. Take as much time as you wish with the words.',
    continueLabel: 'Hear the calling',
    journal: {
      title: 'Astonishment',
      text: 'Simon fell down at Jesus’ knees. Luke describes the amazement of Simon and all who were with him at the catch.',
      reference: 'Luke 5:8–9',
    },
  },
  {
    id: 'calling',
    title: 'Don’t be afraid',
    subtitle: 'Luke 5:10',
    staging: 'calling',
    captions: [
      scripture('5:10'),
      narration('Jesus’ words open a future beyond the morning’s catch.'),
    ],
    observation:
      'The boats, nets, and fish remain present, but the calling gives the scene a different horizon.',
    continueLabel: 'Return with the boats',
    journal: {
      title: 'A calling beyond the catch',
      text: 'Jesus told Simon not to be afraid and spoke of what would follow. The calling changes the direction of the account.',
      reference: 'Luke 5:10',
    },
  },
  {
    id: 'return',
    title: 'Boats brought to land',
    subtitle: 'Luke 5:11',
    staging: 'return',
    captions: [
      scripture('5:11'),
      narration(
        'The Gospel account reaches its turning point: they leave everything and follow him. We now return to the imagined traveler on the shore. The village aftermath and conversations that follow are original connective fiction.',
      ),
    ],
    observation:
      'The boats return, but the fishermen’s journey is beginning. The quiet village will remain available for your own reflection.',
    continueLabel: 'Return to your traveler',
    journal: {
      title: 'They followed him',
      text: 'When they had brought their boats to land, they left everything and followed him. The account of the catch and calling ends here.',
      reference: 'Luke 5:11',
    },
  },
];
export function beatFor(id: SceneId): SceneBeat {
  const beat = sceneBeats.find((candidate) => candidate.id === id);
  if (!beat) throw new Error('Unknown lake checkpoint: ' + id);
  return beat;
}
