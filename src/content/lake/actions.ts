import type { GameState } from '../../game/types';
import type { PracticalAction } from '../practical';
import { lakeGateways, localLakePlaces } from './places';
import { lakeGateAllowed } from '../../game/lake/progress';
import { distance } from '../../game/pathfinding';

export const lakeActions = [
  { id: 'accept', target: 'joel', label: 'Listen to Joel’s recollection' },
  { id: 'evidence-reeds', target: 'lake-reeds', label: 'Study the reed bank' },
  { id: 'evidence-split-rock', target: 'lake-split-rock', label: 'Study the split rock' },
  { id: 'arrive', target: 'cove-shore', label: 'Confirm the sheltered landing' },
  { id: 'enter', target: 'storm-viewpoint', label: 'Witness Mark’s account' },
  { id: 'reed-shore', target: 'reed-shore', label: 'Remember the open shore' },
  { id: 'cove-shore', target: 'cove-shore', label: 'Notice the inward landing' },
  { id: 'after-landing', target: 'cove-shore', label: 'Remember the landing' },
  { id: 'after-lookout', target: 'cove-lookout', label: 'Spend a quiet moment here' },
  { id: 'after-neighbor', target: 'dalia', label: 'Listen to Dalia' },
] as const;

/** Shared contextual and nearby choices, using the reducer for prerequisite validation. */
function available(id: string, s: GameState): boolean {
  const t = s.lake.trail,
    c = s.lake.chapter;
  if (id === 'accept') return t.stage === 'not-started';
  if (id === 'evidence-reeds') return t.stage === 'exploring' && !t.evidence.includes('reeds');
  if (id === 'evidence-split-rock')
    return t.stage === 'exploring' && !t.evidence.includes('split-rock');
  if (id === 'arrive') return t.stage === 'interpreted';
  if (id === 'enter') return c.stage === 'exploring' || c.stage === 'witnessing';
  if (id === 'reed-shore' || id === 'cove-shore') return !s.lake.notes.includes(id);
  const after =
    id === 'after-landing' ? 'landing' : id === 'after-lookout' ? 'lookout' : 'neighbor';
  return (c.stage === 'aftermath' || c.stage === 'complete') && !c.aftermath.includes(after);
}
export function lakePracticalActions(s: GameState): PracticalAction[] {
  if (s.road.chapter.stage !== 'complete') return [];
  const places = localLakePlaces(s);
  return [
    ...lakeActions.flatMap((a) => {
      const p = places.find((p) => p.id === a.target);
      if (!p || !available(a.id, s)) return [];
      const event = { type: 'lake-action' as const, id: a.id };
      return [
        {
          id: 'lake:' + a.id,
          target: a.target,
          label: a.id === 'enter' && s.lake.chapter.checkpoint ? 'Resume Peace, be still' : a.label,
          blocker: distance(s.position, p) < 2.8 ? undefined : 'Approach this place to continue.',
          event,
        },
      ];
    }),
    ...lakeGateways
      .filter((g) => g.from === s.region)
      .map((g) => ({
        id: 'lake:' + g.id,
        target: g.id,
        label: g.to === 'galilee-water' ? 'Board the boat' : 'Dock and step ashore',
        blocker: lakeGateAllowed(s, g) ? undefined : 'Approach this landing with your boat.',
        event: { type: 'journey' as const, gateway: g.id },
      })),
  ];
}
