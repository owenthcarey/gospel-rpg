import type { Interactable } from '../region';
import { HARBOR_CENTER, plankPosition, cargoPosition } from '../../game/harbor/arrangement';
import type { HarborState } from '../../game/harbor/types';
export const harborPlaces: Interactable[] = [
  {
    id: 'eliab',
    name: 'Eliab',
    role: 'A clear way to the water · An original dock worker',
    kind: 'person',
    asset: 'villager',
    x: 0.1,
    z: -9.7,
  },
  {
    id: 'harbor-entrance',
    name: 'The working landing',
    role: 'Inspect the passage · Clear and test',
    kind: 'object',
    x: HARBOR_CENTER.x - 2.3,
    z: HARBOR_CENTER.z,
  },
  {
    id: 'harbor-water',
    name: 'Marks on the landing',
    role: 'Notice the wet stone',
    kind: 'place',
    x: HARBOR_CENTER.x + 2.3,
    z: HARBOR_CENTER.z,
  },
  {
    id: 'harbor-plank',
    name: 'The crossing plank',
    role: 'Place and turn the plank',
    kind: 'object',
    x: HARBOR_CENTER.x - 1.3,
    z: HARBOR_CENTER.z - 2.5,
  },
  {
    id: 'harbor-nets',
    name: 'The net cargo',
    role: 'Open or restore the northern approach',
    kind: 'object',
    x: HARBOR_CENTER.x - 1.15,
    z: HARBOR_CENTER.z + 2.4,
  },
  {
    id: 'harbor-jars',
    name: 'The jar cargo',
    role: 'Open or restore the southern approach',
    kind: 'object',
    x: HARBOR_CENTER.x + 1.15,
    z: HARBOR_CENTER.z - 2.4,
  },
];
/** Identity stays authored; physical targets follow the same arrangement as the models. */
function harborPlacement(place: Interactable, h: HarborState): Interactable {
  if (place.id === 'harbor-plank') return { ...place, ...plankPosition(h) };
  if (place.id === 'harbor-nets' || place.id === 'harbor-jars')
    return { ...place, ...cargoPosition(h, place.id === 'harbor-nets' ? 'nets' : 'jars') };
  return place;
}
export function activeHarborPlaces(h: HarborState): Interactable[] {
  return harborPlaces
    .filter((p) => p.id === 'eliab' || h.stage !== 'not-started')
    .map((p) => harborPlacement(p, h));
}
export function harborPlace(id: string, h?: HarborState): Interactable | undefined {
  const place = harborPlaces.find((p) => p.id === id);
  return place && h ? harborPlacement(place, h) : place;
}
