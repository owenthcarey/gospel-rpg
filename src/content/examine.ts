import type { Interactable } from './region';

/** Original observational text. Examining never supplies evidence or performs story work. */
export const examinations: Readonly<Record<string, string>> = {
  simon: 'A fisherman beside the boats. There is still work to do after a night on the lake.',
  miriam: 'The village baker. A morning on the shore would be poorer without her bread.',
  jesus: 'The teacher by the water.',
  ezra: 'A village elder with time for a passing traveler.',
  eliab: 'A dock worker keeping an eye on the working landing.',
  nets: 'A fishing net hung up to dry. Even nets need a morning out of the water.',
  well: 'A well where the village paths meet.',
  shore: 'The lake reaches beyond the houses and the boats drawn up on its stones.',
  olive: 'A little shade among the olive trees.',
  'supply-basket': 'An empty basket. It looks ready to make itself useful.',
  landing: 'A working landing beside the fishing boats.',
  mooring: 'Coiled rope for keeping a boat close to shore.',
  gathering: 'Room beside the shore for people to gather.',
  viewpoint: 'A place to look out from the shore and follow the account on the lake.',
  'harbor-entrance': 'A small working landing, with cargo on either side of the crossing.',
  'harbor-water': 'Dark marks show where the water reaches the landing stones.',
  'harbor-plank': 'A broad wooden plank. Useful for keeping your sandals dry.',
  'harbor-nets': 'Fishing gear waiting at the edge of the landing.',
  'harbor-jars': 'Jars waiting at the edge of the landing. A busy shore needs a little room.',
  'landing-bench': 'A low wooden bench beside the landing.',
  'cord-basket': 'Spare cord, wound and ready for a small repair.',
  'sewing-rest': 'A small sewing pouch near the water.',
  'thread-clue': 'A loose thread beside the water.',
  'cloth-clue': 'A piece of carefully mended cloth.',
  'brace-shelf': 'A spare wooden brace. There may be another useful day in it.',
  'water-point': 'A water point tucked beside the village lanes.',
  'courtyard-table': 'A table in the courtyard. A place is better with company.',
  'bakehouse-table':
    'A plain wooden table in Hannah’s bakehouse, with room to share bread and water.',
  'road-spring': 'A dark stone stands beside the shallow spring.',
  'road-terrace': 'Two pale stones stand beside the turning path.',
  'board-capernaum': 'A wooden boat with broad seats, waiting beside the landing.',
  'board-reed-landing': 'A wooden boat with broad seats, waiting beside the landing.',
  'board-sheltered-cove': 'A wooden boat with broad seats, waiting beside the landing.',
  'spring-source': 'A spring feeding a little stone channel beside the road.',
  'spring-basins': 'Stone basins at the end of the water channel.',
  'spring-tools': 'A wooden scoop hanging within reach of the channel.',
  'rest-supplies': 'Mats, water and a folding screen, ready for a resting place.',
};

export function examineText(place: Interactable): string {
  const description =
    examinations[place.id] ??
    (place.id.startsWith('channel-')
      ? 'A short stone channel with open ends.'
      : place.role.trim().replace(/[.!?]$/, '') + '.');
  return place.name + ': ' + description;
}
