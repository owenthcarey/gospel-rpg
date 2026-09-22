import { isRecord, idList } from './episode';
import { HARBOR_ENDINGS, HARBOR_NOTES, newHarbor, type HarborState } from '../game/harbor/types';
import { traceHarbor } from '../game/harbor/arrangement';
function fail(): never {
  throw new Error('This save contains inconsistent working-landing progress.');
}
export function parseHarbor(raw: unknown): HarborState {
  if (
    !isRecord(raw) ||
    typeof raw.stage !== 'string' ||
    !['not-started', 'working', 'ready', 'complete'].includes(raw.stage) ||
    !idList(raw.notes, HARBOR_NOTES) ||
    typeof raw.cleared !== 'boolean' ||
    typeof raw.plank !== 'string' ||
    !['rack', 'north', 'south'].includes(raw.plank) ||
    (raw.turn !== 0 && raw.turn !== 1) ||
    !isRecord(raw.cargo) ||
    Object.keys(raw.cargo).length !== 2 ||
    typeof raw.cargo.nets !== 'boolean' ||
    typeof raw.cargo.jars !== 'boolean' ||
    typeof raw.tested !== 'boolean' ||
    !Number.isInteger(raw.hint) ||
    Number(raw.hint) < 0 ||
    Number(raw.hint) > 3 ||
    (raw.ending !== null && !HARBOR_ENDINGS.some((e) => e === raw.ending))
  )
    fail();
  const h = raw as unknown as HarborState;
  const initial = newHarbor();
  if (
    h.stage === 'not-started' &&
    (h.notes.length ||
      h.cleared ||
      h.plank !== initial.plank ||
      h.turn !== initial.turn ||
      h.cargo.nets ||
      h.cargo.jars ||
      h.tested ||
      h.hint ||
      h.ending)
  )
    fail();
  if (
    h.notes.length !== 2 &&
    (h.cleared || h.plank !== 'rack' || h.turn !== 1 || h.cargo.nets || h.cargo.jars || h.tested)
  )
    fail();
  const ready = h.tested && !!traceHarbor(h).route;
  if (
    ['ready', 'complete'].includes(h.stage) !== ready ||
    (h.stage === 'complete') !== (h.ending !== null)
  )
    fail();
  return {
    stage: h.stage,
    notes: [...h.notes],
    cleared: h.cleared,
    plank: h.plank,
    turn: h.turn,
    cargo: { ...h.cargo },
    tested: h.tested,
    hint: h.hint,
    ending: h.ending,
  };
}
