import type { GameState } from '../../game/types';
import type { RoadActionId } from '../../game/road/types';
import { localRoadPlaces } from './places';
import { distance } from '../../game/pathfinding';
export interface RoadAction {
  id: RoadActionId;
  target: string;
  label: string;
  notice: string;
  available: (s: GameState) => boolean;
}
const aftermath = (s: GameState) => ['aftermath', 'complete'].includes(s.road.chapter.stage);
export const roadActions: readonly RoadAction[] = [
  {
    id: 'trail-accept',
    target: 'tamar',
    label: 'Help remember the way',
    notice: 'Tamar’s recollection is in your journal.',
    available: (s) => s.road.trail.stage === 'not-started',
  },
  {
    id: 'trail-arrive',
    target: 'farm-landmark',
    label: 'Confirm the matching landmark',
    notice: 'A split olive and two pale stones. Return to Tamar.',
    available: (s) => s.road.trail.stage === 'interpreted',
  },
  {
    id: 'company-accept',
    target: 'neri',
    label: 'Offer Neri your company',
    notice: 'Choose the shaded route or the open terraces.',
    available: (s) => s.road.company.stage === 'not-started',
  },
  {
    id: 'company-start',
    target: 'neri',
    label: 'Begin the walk together',
    notice: 'Neri follows at his own pace. Meet at each marked stop.',
    available: (s) => s.road.company.stage === 'invited' && !!s.road.company.route,
  },
  {
    id: 'company-finish',
    target: 'neri',
    label: 'Remember your walk together',
    notice: 'Your walk is remembered. Neri rests in the courtyard.',
    available: (s) => s.road.company.stage === 'arrived',
  },
  {
    id: 'nain-enter',
    target: 'nain-viewpoint',
    label: 'Witness Luke’s account',
    notice: 'At the gate · Continue at your own pace.',
    available: (s) => ['exploring', 'witnessing'].includes(s.road.chapter.stage),
  },
  ...(['gate', 'courtyard', 'neighbor'] as const).map((id) => ({
    id: `nain-after-${id}` as const,
    target: id === 'gate' ? 'nain-viewpoint' : id === 'courtyard' ? 'nain-courtyard' : 'adina',
    label:
      id === 'gate'
        ? 'Remember the gate'
        : id === 'courtyard'
          ? 'Spend a quiet moment here'
          : 'Listen to Adina',
    notice: 'A moment after the account is recorded in your journal.',
    available: (s: GameState) => aftermath(s) && !s.road.chapter.aftermath.includes(id),
  })),
];
export function nearRoadPlace(s: GameState, id: string): boolean {
  return localRoadPlaces(s).some((p) => p.id === id && distance(s.position, p) < 2.8);
}
export function roadActionAllowed(s: GameState, id: string): boolean {
  const action = roadActions.find((a) => a.id === id);
  return (
    s.campaign.roof.stage === 'complete' &&
    !!action &&
    action.available(s) &&
    nearRoadPlace(s, action.target)
  );
}
