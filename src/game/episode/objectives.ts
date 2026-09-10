import type { GameState } from '../types';
import { preparationsReady, aftermathReady, hasReturned } from './progress';
import { beatFor } from '../../content/episode/scenes';
export interface ObjectiveRow {
  id: string;
  label: string;
  target: string;
  done: boolean;
}
export function preludeRows(s: GameState): ObjectiveRow[] {
  const supplied = s.quest === 'delivered' || s.quest === 'complete';
  return [
    { id: 'simon', label: 'Speak with Simon', target: 'simon', done: s.quest !== 'not-started' },
    {
      id: 'net',
      label: 'Collect the mended net',
      target: 'nets',
      done: supplied || s.inventory.includes('net'),
    },
    {
      id: 'bread',
      label: 'Pick up Miriam’s bread',
      target: 'miriam',
      done: supplied || s.inventory.includes('bread'),
    },
    { id: 'deliver', label: 'Return to Simon', target: 'simon', done: supplied },
    { id: 'listen', label: 'Listen by the water', target: 'jesus', done: s.quest === 'complete' },
  ];
}
export function episodeRows(s: GameState): ObjectiveRow[] {
  const e = s.episode;
  return [
    {
      id: 'invitation',
      label: 'Speak with Simon about the morning',
      target: 'simon',
      done: e.stage !== 'not-started',
    },
    {
      id: 'basket',
      label: e.carrying ? 'Place the basket at the landing' : 'Carry a basket to the landing',
      target: e.carrying ? 'landing' : 'supply-basket',
      done: e.preparations.includes('basket'),
    },
    {
      id: 'mooring',
      label: 'Coil the loose mooring rope',
      target: 'mooring',
      done: e.preparations.includes('mooring'),
    },
    {
      id: 'gathering',
      label: 'Make room in the gathering',
      target: 'gathering',
      done: e.preparations.includes('gathering'),
    },
    {
      id: 'witness',
      label:
        e.stage === 'witnessing'
          ? 'Continue the account on the lake'
          : 'Witness the catch and calling',
      target: 'viewpoint',
      done: hasReturned(e),
    },
    {
      id: 'landing',
      label: 'Help at the returning boats',
      target: 'landing',
      done: e.aftermath.includes('landing'),
    },
    {
      id: 'miriam',
      label: 'Share a moment with Miriam',
      target: 'miriam',
      done: e.aftermath.includes('miriam'),
    },
    {
      id: 'ezra',
      label: 'Speak with Ezra about the morning',
      target: 'ezra',
      done: e.aftermath.includes('ezra'),
    },
    {
      id: 'reflection',
      label: 'Choose a memory by the water',
      target: 'viewpoint',
      done: e.stage === 'complete',
    },
  ];
}
export function mainObjective(s: GameState): string {
  if (s.quest !== 'complete') return preludeRows(s).find((row) => !row.done)!.label;
  const e = s.episode;
  if (e.stage === 'complete') return 'Into the Deep complete. The village is yours to explore.';
  if (e.stage === 'witnessing') return 'Continue: ' + beatFor(e.checkpoint!).title;
  if (e.stage === 'preparing' && preparationsReady(e))
    return 'Find your place at the shoreline viewpoint';
  if (e.stage === 'aftermath' && aftermathReady(e))
    return 'Choose what stays with you, beside the water';
  return episodeRows(s).find((row) => !row.done)!.label;
}
export function preludeObjective(s: GameState): string {
  return s.quest === 'complete'
    ? 'Supplies delivered and a place found beside the water. The prelude is complete.'
    : preludeRows(s).find((row) => !row.done)!.label;
}
export function mainTarget(s: GameState): string {
  if (s.quest !== 'complete') return preludeRows(s).find((row) => !row.done)!.target;
  if (s.episode.stage === 'witnessing' || s.episode.stage === 'complete') return 'viewpoint';
  return episodeRows(s).find((row) => !row.done)!.target;
}
export function mainTitle(s: GameState): string {
  return s.quest === 'complete' ? 'Into the Deep' : 'A place by the water';
}
