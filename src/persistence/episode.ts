import {
  ACTION_IDS,
  AFTERMATH,
  NOTES,
  PREPARATIONS,
  REFLECTIONS,
  SCENE_IDS,
  type EpisodeProgress,
  type RegionId,
} from '../game/episode/types';
import { aftermathReady, preparationsReady } from '../game/episode/progress';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function idList(value: unknown, allowed: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= allowed.length &&
    new Set(value).size === value.length &&
    value.every((id) => typeof id === 'string' && allowed.includes(id))
  );
}
function fail(): never {
  throw new Error('This save contains inconsistent episode progress.');
}

/** Validate state combinations, not just the presence of individual fields. */
export function parseEpisode(raw: unknown, quest: unknown, region: RegionId): EpisodeProgress {
  if (
    !isRecord(raw) ||
    !['not-started', 'preparing', 'witnessing', 'aftermath', 'complete'].includes(
      String(raw.stage),
    ) ||
    typeof raw.stage !== 'string' ||
    !idList(raw.preparations, PREPARATIONS) ||
    !idList(raw.aftermath, AFTERMATH) ||
    !idList(raw.notes, NOTES) ||
    (raw.carrying !== null && raw.carrying !== 'empty-basket') ||
    (raw.checkpoint !== null && !SCENE_IDS.some((id) => id === raw.checkpoint)) ||
    (raw.reflection !== null && !REFLECTIONS.some((id) => id === raw.reflection))
  )
    fail();
  const e = structuredClone(raw) as unknown as EpisodeProgress;
  if (e.stage !== 'not-started' && quest !== 'complete') fail();
  if (e.carrying && e.preparations.includes('basket')) fail();
  if (
    e.stage === 'not-started' &&
    (e.preparations.length ||
      e.aftermath.length ||
      e.notes.length ||
      e.carrying ||
      e.checkpoint ||
      e.reflection)
  )
    fail();
  if (
    (e.stage === 'not-started' || e.stage === 'preparing') &&
    (e.checkpoint || e.aftermath.length || e.reflection)
  )
    fail();
  if (e.stage !== 'preparing' && e.carrying) fail();
  if (
    e.stage === 'witnessing' &&
    (!e.checkpoint || !preparationsReady(e) || e.aftermath.length || e.reflection)
  )
    fail();
  if (
    (e.stage === 'aftermath' || e.stage === 'complete') &&
    (!preparationsReady(e) || e.checkpoint !== null)
  )
    fail();
  if (e.stage === 'aftermath' && e.reflection !== null) fail();
  if (e.stage === 'complete' && (!e.reflection || !aftermathReady(e))) fail();
  if (region === 'lake-gennesaret' && e.stage !== 'witnessing') fail();
  return {
    stage: e.stage,
    preparations: [...e.preparations],
    carrying: e.carrying,
    checkpoint: e.checkpoint,
    aftermath: [...e.aftermath],
    reflection: e.reflection,
    notes: [...e.notes],
  };
}
export { ACTION_IDS };
