import type { GameState } from '../../game/types';
import type { Interactable } from '../region';
import type { ExplorationRegion } from '../../game/campaign/types';
import { HOME_VISITS, HOME_CHOICES, type HomeVisit } from '../../game/connection/types';
export const homePlaces: readonly (Interactable & {
  region: ExplorationRegion;
  visit: HomeVisit;
})[] = [
  {
    id: 'home-farm',
    name: 'Room on the road',
    role: 'The way home · Return to Leah',
    kind: 'place',
    region: 'roadside-farm',
    visit: 'farm',
    x: -5,
    z: -3,
  },
  {
    id: 'home-table',
    name: 'A shared table',
    role: 'The way home · Return to Hannah',
    kind: 'place',
    region: 'bakehouse',
    visit: 'table',
    x: -2,
    z: 1,
  },
  {
    id: 'home-shore',
    name: 'The familiar landing',
    role: 'The way home · Return to Miriam',
    kind: 'place',
    region: 'capernaum',
    visit: 'shore',
    x: -5,
    z: -1,
  },
];
export const homeChoices: Record<string, { title: string; text: string }> = {
  room: {
    title: 'Remember making room',
    text: 'A place can offer welcome before anyone arrives. I want to leave room for someone whose journey I do not yet know.',
  },
  company: {
    title: 'Remember accepting company',
    text: 'I have been a guest as often as a helper. On the road, I want to receive the company that is offered to me.',
  },
  listening: {
    title: 'Remember listening',
    text: 'The people I met had stories beyond the small part I heard. I want to make time to listen when our paths meet again.',
  },
  sharing: {
    title: 'Remember what is at hand',
    text: 'An ordinary table can begin with what is already near us. I want to notice what I can share without waiting for a perfect occasion.',
  },
  attention: {
    title: 'Remember looking closely',
    text: 'The landing is familiar now, but the water keeps moving. I want familiarity to deepen my attention rather than end it.',
  },
  beginning: {
    title: 'Remember beginning again',
    text: 'This shore was once the beginning of an unfamiliar road. I can begin again with the people and places I have come to know.',
  },
  onward: {
    title: 'Carry the welcome onward',
    text: 'This part of my journey is complete. I will carry the welcome of these places onward: room on the road, a shared table, and a familiar landing. There are still paths to walk and people to visit.',
  },
  remain: {
    title: 'Remain awhile',
    text: 'This part of my journey is complete, and I choose to remain awhile. The road and lake will still be here. Today there is time for the people nearby and the work I left unfinished.',
  },
};
export const homeJournal: Record<string, { title: string; text: string; reference: string }> =
  Object.fromEntries([
    ...HOME_VISITS.flatMap((visit) =>
      HOME_CHOICES[visit].map((choice) => [
        'home-' + visit + '-' + choice,
        { ...homeChoices[choice]!, reference: 'Original traveler memory · The way home' },
      ]),
    ),
    ...(['onward', 'remain'] as const).map((choice) => [
      'home-reflection-' + choice,
      { ...homeChoices[choice]!, reference: 'Original traveler memory · The way home' },
    ]),
  ]);
export function homeAvailable(s: GameState): boolean {
  return s.lake.chapter.stage === 'complete';
}
export function homeReady(s: GameState): boolean {
  return HOME_VISITS.every((id) => s.connection.home.visits[id]);
}
export function homeTarget(s: GameState): string {
  return homePlaces.find((p) => !s.connection.home.visits[p.visit])?.id ?? 'home-shore';
}
/** Each acknowledgement names only choices actually earned, including unspecified old memories. */
export function homeConversation(
  s: GameState,
  visit: HomeVisit,
): { speaker: string; paragraphs: string[] } {
  if (visit === 'farm') {
    const r = s.galilee.shelter;
    return {
      speaker: 'Leah',
      paragraphs: [
        '“You have come back along the road. Sit for a moment, if you like. A return can be a visit of its own.”',
        r.stage === 'complete'
          ? `The resting place you arranged ${r.site === 'shade' ? 'under the olive shade' : 'in the open breeze'} is still welcoming company.`
          : 'The farm offers its ordinary shade. Leah does not ask you to finish the resting-place work before you sit together.',
        s.galilee.spring.stage === 'complete'
          ? '“There is water at the channel again. I think of the hands that cleared it whenever a traveler stops there.”'
          : '“People arrive with different needs. Sometimes there is work to do, and sometimes someone simply needs company.”',
        '“When you remember this road, will you think of making room, or of accepting the company offered to you?”',
      ],
    };
  }
  if (visit === 'table')
    return {
      speaker: 'Hannah',
      paragraphs: [
        '“I wondered whether our paths would meet again. There is time to talk while the bread cools.”',
        s.campaign.table.stage === 'complete'
          ? `The ${s.campaign.table.location === 'courtyard' ? 'courtyard' : 'indoor'} table you chose remains a place for neighbors.`
          : 'An ordinary table stands nearby. You are welcome here whether or not you have prepared a table with Hannah.',
        ...(s.life.thread.stage === 'complete'
          ? [
              '“Ruth has her pouch beside her again. Something small can hold a great deal of familiar work.”',
            ]
          : []),
        ...(s.campaign.walk.stage === 'complete'
          ? ['You remember the walk with Amos, and the time it took to arrive together.']
          : []),
        ...(s.road.company.stage === 'complete'
          ? [
              'You tell Hannah that Neri reached Nain with you. His company is part of the road you remember.',
            ]
          : []),
        '“We never hear all of another person’s story. But we can listen, and share what is at hand. What will you remember from this table?”',
      ],
    };
  const reflection = s.episode.reflection;
  const memory = s.villageMemory;
  return {
    speaker: 'Miriam',
    paragraphs: [
      '“The landing is the same place, but you know more paths from it now. Welcome back.”',
      reflection === 'wonder'
        ? 'You remember choosing wonder after the catch and calling.'
        : reflection === 'trust'
          ? 'You remember choosing trust after the catch and calling.'
          : reflection === 'community'
            ? 'You remember the partners and the community you chose to carry from the first account.'
            : 'The first account remains in your journal.',
      ...(memory
        ? [
            `You recall the ${memory === 'well' ? 'voices at the well' : memory === 'olive' ? 'quiet of the grove' : 'open lake'} you remembered with Ezra.`,
          ]
        : []),
      ...(s.life.bench.stage === 'complete'
        ? [
            `The landing bench is still secured with the ${s.life.bench.method === 'lashing' ? 'lashing' : 'brace'} you fitted.`,
          ]
        : []),
      ...(s.harbor.stage === 'complete'
        ? [
            `The ${s.harbor.plank} crossing at Eliab’s working landing is still clear. You remember ${s.harbor.ending === 'patience' ? 'taking time to understand the work' : 'making room for another person’s passage'}.`,
          ]
        : []),
      'Beyond the landing lies the lake you crossed. Your reflection after Peace, be still remains yours; returning here does not replace it.',
      '“A familiar place can teach us to look closely. It can also give us somewhere to begin again. Which thought will you carry from the shore?”',
    ],
  };
}
