import { idList, isRecord } from './episode';
import {
  CHANNEL_IDS,
  GALILEE_ITEMS,
  newGalilee,
  REST_ENDINGS,
  REST_SITES,
  REST_SUPPLIES,
  SPRING_CLEARING,
  SPRING_ENDINGS,
  SPRING_NOTES,
  type GalileeState,
} from '../game/galilee/types';
import type { CampaignState } from '../game/campaign/types';
import { traceWater } from '../game/galilee/channel';
import { checkArrangement } from '../game/galilee/arrangement';
const member = (v: unknown, values: readonly string[]) =>
  typeof v === 'string' && values.includes(v);
const rotation = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3;
function fail(): never {
  throw new Error('This save contains inconsistent spring or resting-place progress.');
}
export function parseGalilee(raw: unknown, campaign: CampaignState): GalileeState {
  if (!isRecord(raw) || !isRecord(raw.spring) || !isRecord(raw.shelter)) fail();
  const p = raw.spring,
    r = raw.shelter;
  if (
    !member(p.stage, ['not-started', 'working', 'flowing', 'complete']) ||
    !idList(p.notes, SPRING_NOTES) ||
    !idList(p.cleared, SPRING_CLEARING) ||
    !isRecord(p.turns) ||
    Object.keys(p.turns).length !== CHANNEL_IDS.length ||
    !CHANNEL_IDS.every((id) => rotation((p.turns as Record<string, unknown>)[id])) ||
    typeof p.tested !== 'boolean' ||
    !rotation(p.hint) ||
    (p.ending !== null && !member(p.ending, SPRING_ENDINGS)) ||
    !member(r.stage, ['not-started', 'planning', 'arranging', 'ready', 'complete']) ||
    !idList(r.inspected, REST_SITES) ||
    (r.site !== null && !member(r.site, REST_SITES)) ||
    !idList(r.placed, REST_SUPPLIES) ||
    !rotation(r.screen) ||
    typeof r.checked !== 'boolean' ||
    (r.ending !== null && !member(r.ending, REST_ENDINGS))
  )
    fail();
  const g = raw as unknown as GalileeState,
    { spring, shelter } = g,
    empty = newGalilee();
  const carrying = campaign.carrying;
  if (
    campaign.roof.stage !== 'complete' &&
    (spring.stage !== 'not-started' ||
      shelter.stage !== 'not-started' ||
      GALILEE_ITEMS.some((id) => id === carrying))
  )
    fail();
  if (spring.stage === 'not-started') {
    if (
      spring.notes.length ||
      spring.cleared.length ||
      spring.tested ||
      spring.hint ||
      spring.ending ||
      CHANNEL_IDS.some((id) => spring.turns[id] !== empty.spring.turns[id])
    )
      fail();
  }
  if (spring.cleared.length && spring.notes.length !== 2) fail();
  const prepared = spring.notes.length === 2 && spring.cleared.length === 2;
  if (
    (!prepared && spring.tested) ||
    (!prepared && CHANNEL_IDS.some((id) => spring.turns[id] !== empty.spring.turns[id]))
  )
    fail();
  const successful = spring.tested && !!traceWater(spring.turns).outlet;
  if (['flowing', 'complete'].includes(spring.stage) !== successful) fail();
  if ((spring.stage === 'complete') !== (spring.ending !== null)) fail();
  if (
    carrying === 'channel-scoop' &&
    (spring.stage !== 'working' || spring.notes.length !== 2 || spring.tested)
  )
    fail();
  if (
    shelter.stage === 'not-started' &&
    (shelter.inspected.length ||
      shelter.site ||
      shelter.placed.length ||
      shelter.checked ||
      shelter.ending ||
      shelter.screen !== 2)
  )
    fail();
  if (
    shelter.stage === 'planning' &&
    (shelter.site || shelter.placed.length || shelter.checked || shelter.screen !== 2)
  )
    fail();
  if (
    ['arranging', 'ready', 'complete'].includes(shelter.stage) &&
    (!shelter.site || shelter.inspected.length !== 2)
  )
    fail();
  if (!shelter.placed.includes('screen') && shelter.screen !== 2 && !shelter.site) fail();
  const ready = shelter.checked && checkArrangement(shelter).ready;
  if (['ready', 'complete'].includes(shelter.stage) !== ready) fail();
  if ((shelter.stage === 'complete') !== (shelter.ending !== null)) fail();
  if (
    carrying?.startsWith('rest-') &&
    (shelter.stage !== 'arranging' ||
      REST_SUPPLIES.some((id) => carrying === 'rest-' + id && shelter.placed.includes(id)))
  )
    fail();
  return {
    spring: {
      stage: spring.stage,
      notes: [...spring.notes],
      cleared: [...spring.cleared],
      turns: { ...spring.turns },
      tested: spring.tested,
      hint: spring.hint,
      ending: spring.ending,
    },
    shelter: {
      stage: shelter.stage,
      inspected: [...shelter.inspected],
      site: shelter.site,
      placed: [...shelter.placed],
      screen: shelter.screen,
      checked: shelter.checked,
      ending: shelter.ending,
    },
  };
}
