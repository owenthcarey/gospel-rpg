import type { Interactable } from '../region';
import { HARBOR_CENTER } from '../../game/harbor/arrangement';
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
export function harborPlace(id: string): Interactable | undefined {
  return harborPlaces.find((p) => p.id === id);
}
