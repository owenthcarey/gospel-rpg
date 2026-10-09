/**
 * Original overhead remarks for ordinary neighbors, spoken now and then while the traveler
 * is nearby. Gospel figures never receive invented ambient speech.
 */
export const CHATTER: Readonly<Record<string, readonly string[]>> = {
  miriam: ['Bread, warm from the oven!', 'Barley loaves this morning.', 'Mind the oven, it’s hot.'],
  ezra: [
    'The olives are heavy this year.',
    'Sit a while, if your feet are tired.',
    'This lane was a goat track once.',
    'Good morning to you, friend.',
  ],
  ruth: [
    'Needle, thread and patience.',
    'The courtyard is cool in the shade.',
    'Blue thread is dear this season.',
  ],
  hannah: [
    'There’s always room at the table.',
    'Water first, then bread.',
    'Mind the bowls, please!',
  ],
  eliab: [
    'Watch your footing on the landing.',
    'The stones shift after a storm.',
    'A clear way makes light work.',
  ],
  joel: [
    'The wind is turning.',
    'Keep the reeds on your left.',
    'A boat is only as good as its rope.',
  ],
  leah: [
    'The olives give good shade at noon.',
    'Rest is part of the work.',
    'Travelers always find their way here.',
  ],
  dalia: ['The cove is calm today.', 'Gulls mean fish nearby.', 'Mind the wet rocks.'],
  adina: [
    'The gate is busy at this hour.',
    'Nain sees many travelers.',
    'The well water is cold today.',
  ],
  tamar: ['Was it the fig tree, or the well?', 'Every road has its landmarks.'],
  neri: ['A long road is shorter in company.', 'My sandals have seen better days.'],
  amos: [
    'Slow and steady gets there.',
    'I know a shortcut. Probably.',
    'My knees remember every hill.',
  ],
};

/** Chatter is heard within this distance of the traveler, in meters. */
export const CHATTER_RANGE = 11;
