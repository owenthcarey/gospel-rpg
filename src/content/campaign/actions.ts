import type { GameState } from '../../game/types';
import type { NeighborNote } from '../../game/campaign/types';
import { distance } from '../../game/pathfinding';
import { localNeighborhoodPlaces } from './places';
import { lifeActions } from '../life/actions';
import { heldReturn } from '../../game/life/objectives';
export type ActionMotion = 'PickUp' | 'PutDown' | 'Repair' | 'SitDown' | 'Use';
export interface WorldAction {
  id: string;
  target: string;
  verb: 'Carry' | 'Place' | 'Use' | 'Open' | 'Accompany' | 'Listen' | 'Choose' | 'Inspect';
  label: string;
  notice: string;
  available: (s: GameState) => boolean;
  requirement: string;
  visible?: (s: GameState) => boolean;
  motion?: ActionMotion;
  needsFreeHands?: boolean;
}
const freeHands = (s: GameState) => s.campaign.carrying === null;
const preparingTable = (s: GameState) =>
  s.campaign.table.stage === 'preparing' && s.campaign.table.location !== null;
const tableAt = (s: GameState, location: string) =>
  preparingTable(s) && s.campaign.table.location === location;
const after = (s: GameState) => s.campaign.roof.stage === 'aftermath';
export const worldActions: readonly WorldAction[] = [
  ...lifeActions,
  {
    id: 'roof-enter',
    target: 'house-viewpoint',
    verb: 'Listen',
    label: 'Witness Through the Roof',
    notice: 'Mark 2:1–12 · Your place is saved at each scene.',
    available: (s) => ['exploring', 'witnessing'].includes(s.campaign.roof.stage),
    requirement: 'Available during Chapter II. Neighborhood help is optional.',
  },
  {
    id: 'after-ruth',
    target: 'ruth',
    verb: 'Listen',
    label: 'Sit a moment with Ruth',
    notice: 'Ruth’s company remembered.',
    available: (s) => after(s) && !s.campaign.roof.aftermath.includes('ruth'),
    requirement: 'After witnessing the account.',
  },
  {
    id: 'after-hannah',
    target: 'hannah',
    verb: 'Listen',
    label: 'Share the afternoon with Hannah',
    notice: 'Hannah’s words remembered.',
    available: (s) => after(s) && !s.campaign.roof.aftermath.includes('hannah'),
    requirement: 'After witnessing the account.',
  },
  {
    id: 'after-house',
    target: 'house-viewpoint',
    verb: 'Inspect',
    label: 'Remember the open room',
    notice: 'The room is remembered in your journal.',
    available: (s) => after(s) && !s.campaign.roof.aftermath.includes('house'),
    requirement: 'After witnessing the account.',
  },
  {
    id: 'walk-accept',
    target: 'amos',
    verb: 'Listen',
    label: 'Offer Amos your company',
    notice: 'A way together · Choose the passage or outer lane.',
    available: (s) => s.campaign.walk.stage === 'not-started',
    requirement: 'Amos is waiting by the water point.',
  },
  {
    id: 'walk-passage',
    target: 'amos',
    verb: 'Choose',
    label: 'Take the narrow passage',
    notice: 'Borrow the handcart handle from the bakehouse to open the passage.',
    available: (s) => s.campaign.walk.stage === 'invited' && !s.campaign.walk.route,
    requirement: 'First offer Amos your company.',
  },
  {
    id: 'walk-outer',
    target: 'amos',
    verb: 'Choose',
    label: 'Take the longer outer lane',
    notice: 'The outer lane · Return to Amos when you are ready to walk.',
    available: (s) => s.campaign.walk.stage === 'invited' && !s.campaign.walk.route,
    requirement: 'First offer Amos your company.',
  },
  {
    id: 'borrow-handle',
    target: 'tool-shelf',
    verb: 'Carry',
    label: 'Borrow the handcart handle',
    notice: 'Handle in hand · Use it on the cart in the passage.',
    available: (s) =>
      s.campaign.walk.route === 'passage' && !s.campaign.walk.gateOpen && freeHands(s),
    requirement: 'Choose the passage with Amos and leave one hand free.',
  },
  {
    id: 'open-passage',
    target: 'passage',
    verb: 'Open',
    label: 'Move the cart and open the passage',
    notice: 'Passage open · The handle is back in its bracket.',
    available: (s) => s.campaign.carrying === 'cart-handle' && !s.campaign.walk.gateOpen,
    requirement: 'Bring the handcart handle from Hannah’s bakehouse.',
  },
  {
    id: 'walk-start',
    target: 'amos',
    verb: 'Accompany',
    label: 'Begin the walk together',
    notice: 'Walk with Amos · Follow the next meeting point. He waits when you stop.',
    available: (s) =>
      s.campaign.walk.stage === 'invited' &&
      (s.campaign.walk.route === 'outer' || s.campaign.walk.gateOpen),
    requirement: 'Choose a route; clear the cart if taking the passage.',
  },
  {
    id: 'walk-finish',
    target: 'amos',
    verb: 'Listen',
    label: 'Remember your walk with Amos',
    notice: 'A way together complete · Amos is at home in the courtyard.',
    available: (s) => s.campaign.walk.stage === 'arrived',
    requirement: 'Reach the courtyard together.',
  },
  {
    id: 'table-accept',
    target: 'hannah',
    verb: 'Listen',
    label: 'Prepare a table for neighbors',
    notice: 'Choose the courtyard or the bakehouse table.',
    available: (s) => s.campaign.table.stage === 'not-started',
    requirement: 'Hannah has bread to share.',
  },
  {
    id: 'table-courtyard',
    target: 'hannah',
    verb: 'Choose',
    label: 'Prepare the courtyard table',
    notice: 'A table in the courtyard · Bring bread and water in either order.',
    available: (s) => s.campaign.table.stage === 'preparing' && !s.campaign.table.location,
    requirement: 'Accept Hannah’s invitation first.',
  },
  {
    id: 'table-bakehouse',
    target: 'hannah',
    verb: 'Choose',
    label: 'Prepare the bakehouse table',
    notice: 'A table in the bakehouse · Bring bread and water in either order.',
    available: (s) => s.campaign.table.stage === 'preparing' && !s.campaign.table.location,
    requirement: 'Accept Hannah’s invitation first.',
  },
  {
    id: 'take-bread',
    target: 'bread-shelf',
    verb: 'Carry',
    label: 'Carry the bread basket',
    notice: 'Carry the bread to your chosen table.',
    available: (s) =>
      preparingTable(s) && !s.campaign.table.delivered.includes('bread') && freeHands(s),
    requirement: 'Choose a table and set down anything in your hands.',
  },
  {
    id: 'take-jug',
    target: 'jug-shelf',
    verb: 'Carry',
    label: 'Carry the empty jug',
    notice: 'Fill the jug at the water point in the lanes.',
    available: (s) =>
      preparingTable(s) && !s.campaign.table.delivered.includes('water') && freeHands(s),
    requirement: 'Choose a table and set down anything in your hands.',
  },
  {
    id: 'fill-jug',
    target: 'water-point',
    verb: 'Use',
    label: 'Fill the jug with water',
    notice: 'Jug filled · Take it to your chosen table.',
    available: (s) => s.campaign.carrying === 'empty-jug',
    requirement: 'Carry the empty jug from the bakehouse shelf.',
  },
  ...(['courtyard', 'bakehouse'] as const).flatMap((location) =>
    (['bread', 'water'] as const).map((item) => ({
      id: 'place-' + item + '-' + location,
      target: location + '-table',
      verb: 'Place' as const,
      label:
        item === 'bread' ? 'Set the bread basket on the table' : 'Set the filled jug on the table',
      notice:
        item === 'bread'
          ? 'Bread placed · A place to share.'
          : 'Water placed · A welcome within reach.',
      available: (s: GameState) =>
        tableAt(s, location) &&
        s.campaign.carrying === (item === 'bread' ? 'bread-basket' : 'water-jug') &&
        !s.campaign.table.delivered.includes(item),
      requirement: 'Bring ' + item + ' to the table you chose with Hannah.',
    })),
  ),
  {
    id: 'table-finish',
    target: 'hannah',
    verb: 'Listen',
    label: 'Tell Hannah the table is ready',
    notice: 'A table for neighbors complete · Your welcome remains visible.',
    available: (s) =>
      s.campaign.table.stage === 'preparing' && s.campaign.table.delivered.length === 2,
    requirement: 'Place bread and water on your chosen table.',
  },
  {
    id: 'return-bread',
    target: 'bread-shelf',
    verb: 'Place',
    label: 'Return the basket to its shelf',
    notice: 'The bread is safe on the shelf. You can carry it again later.',
    available: (s) => s.campaign.carrying === 'bread-basket',
    requirement: 'While carrying the bread basket.',
  },
  {
    id: 'return-jug',
    target: 'jug-shelf',
    verb: 'Place',
    label: 'Return the jug to its shelf',
    notice: 'The jug is back on the shelf. Fill it again when you are ready.',
    available: (s) => ['empty-jug', 'water-jug'].includes(s.campaign.carrying ?? ''),
    requirement: 'While carrying a jug.',
  },
  {
    id: 'return-handle',
    target: 'tool-shelf',
    verb: 'Place',
    label: 'Return the borrowed handle',
    notice: 'The handle is back. You can borrow it again later.',
    available: (s) => s.campaign.carrying === 'cart-handle',
    requirement: 'While carrying the handcart handle.',
  },
];
export const noteTargets: Record<string, NeighborNote> = {
  'house-note': 'threshold',
  'beam-note': 'roof-beams',
  'oven-note': 'oven',
  'water-point': 'water',
  'lane-note': 'lane',
  'courtyard-table': 'table',
  'bakehouse-table': 'table',
};
export function worldAction(id: string): WorldAction | undefined {
  return worldActions.find((a) => a.id === id);
}
export function actionAllowed(s: GameState, id: string): boolean {
  const action = worldAction(id);
  const place = action && localNeighborhoodPlaces(s).find((p) => p.id === action.target);
  return Boolean(
    s.episode.stage === 'complete' &&
    action &&
    place &&
    distance(s.position, place) < 2.8 &&
    action.available(s),
  );
}

export function actionMotion(action: WorldAction): ActionMotion | undefined {
  return (
    action.motion ??
    ({ Carry: 'PickUp', Place: 'PutDown', Use: 'Use', Open: 'Repair' } as const)[
      action.verb as 'Carry' | 'Place' | 'Use' | 'Open'
    ]
  );
}
export function actionBlocker(action: WorldAction, s: GameState): string | undefined {
  if (action.available(s)) return;
  const held = heldReturn(s);
  if (
    held &&
    (action.needsFreeHands || action.verb === 'Carry' || action.id === 'life-clear-bench')
  )
    return held.text;
  return action.requirement;
}
