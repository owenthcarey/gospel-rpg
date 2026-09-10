import type { GameState } from '../../game/types';
import type { ActionMotion } from '../campaign/actions';
import { distance } from '../../game/pathfinding';
import { localGalileePlaces } from './places';
import { checkArrangement } from '../../game/galilee/arrangement';
import { traceWater } from '../../game/galilee/channel';
import {
  REST_ENDINGS,
  REST_SITES,
  REST_SUPPLIES,
  SPRING_ENDINGS,
  type RestSite,
} from '../../game/galilee/types';
export interface GalileeAction {
  id: string;
  target: string;
  label: string;
  requirement: string;
  notice: string;
  motion?: ActionMotion;
  freeHands?: boolean;
  available: (s: GameState) => boolean;
  visible?: (s: GameState) => boolean;
  apply: (s: GameState) => void;
}
const springWorking = (s: GameState) => ['working', 'flowing'].includes(s.galilee.spring.stage);
const springPrepared = (s: GameState) =>
  springWorking(s) && s.galilee.spring.notes.length === 2 && s.galilee.spring.cleared.length === 2;
const arranging = (s: GameState) => s.galilee.shelter.stage === 'arranging';
const atSite = (s: GameState, site: RestSite) => s.galilee.shelter.site === site && arranging(s);
export const galileeActions: readonly GalileeAction[] = [
  {
    id: 'spring-start',
    target: 'spring-source',
    label: 'Help restore the spring channel',
    requirement: 'Available after Through the Roof.',
    notice: 'A spring for travelers · Inspect the source and receiving basins.',
    available: (s) => s.galilee.spring.stage === 'not-started',
    apply: (s) => {
      s.galilee.spring.stage = 'working';
      s.tracking = 'spring';
    },
  },
  ...(['source', 'basins'] as const).map((id): GalileeAction => ({
    id: 'spring-note-' + id,
    target: 'spring-' + id,
    label: id === 'source' ? 'Inspect the source and inlet' : 'Inspect both receiving basins',
    requirement: 'Offer to restore the spring, then inspect this place.',
    notice: 'The channel observation is in your journal.',
    available: (s) => springWorking(s) && !s.galilee.spring.notes.includes(id),
    apply: (s) => {
      s.galilee.spring.notes.push(id);
    },
  })),
  {
    id: 'spring-borrow',
    target: 'spring-tools',
    label: 'Borrow the wooden scoop',
    requirement: 'Inspect both ends of the channel and leave your hands free.',
    notice: 'Scoop in hand · Clear the inlet and the entry section.',
    motion: 'PickUp',
    freeHands: true,
    available: (s) =>
      springWorking(s) &&
      s.galilee.spring.notes.length === 2 &&
      s.galilee.spring.cleared.length < 2,
    apply: (s) => {
      s.campaign.carrying = 'channel-scoop';
    },
  },
  {
    id: 'spring-return',
    target: 'spring-tools',
    label: 'Return the wooden scoop',
    requirement: 'Carry the scoop back to its rack.',
    notice: 'The scoop is back on its rack. Your work is remembered.',
    motion: 'PutDown',
    available: (s) => s.campaign.carrying === 'channel-scoop',
    apply: (s) => {
      s.campaign.carrying = null;
    },
  },
  ...(['inlet', 'silt'] as const).map((id): GalileeAction => ({
    id: 'spring-clear-' + id,
    target: id === 'inlet' ? 'spring-source' : 'channel-entry',
    label: id === 'inlet' ? 'Clear the inlet stones' : 'Scoop the silt from the entry',
    requirement: 'Bring the wooden scoop from the rack after inspecting both ends.',
    notice: id === 'inlet' ? 'The source opening is clear.' : 'The entry trough is clear of silt.',
    motion: 'Repair',
    available: (s) =>
      springWorking(s) &&
      s.campaign.carrying === 'channel-scoop' &&
      !s.galilee.spring.cleared.includes(id),
    visible: (s) => springWorking(s) && !s.galilee.spring.cleared.includes(id),
    apply: (s) => {
      s.galilee.spring.cleared.push(id);
    },
  })),
  {
    id: 'spring-test',
    target: 'spring-source',
    label: 'Release a little water to test the route',
    requirement: 'Inspect both ends, clear inlet and silt, and return the scoop.',
    notice: 'Follow the water along the open sections.',
    motion: 'Use',
    freeHands: true,
    available: springPrepared,
    apply: (s) => {
      const p = s.galilee.spring;
      p.tested = true;
      p.stage = traceWater(p.turns).outlet ? 'flowing' : 'working';
    },
  },
  ...SPRING_ENDINGS.map((ending): GalileeAction => ({
    id: 'spring-finish-' + ending,
    target: 'spring-source',
    label: ending === 'patience' ? 'Remember the patient work' : 'Remember the shared water',
    requirement: 'Test a connected route to either basin.',
    notice: 'A spring for travelers complete · Water and your memory remain.',
    available: (s) => s.galilee.spring.stage === 'flowing',
    apply: (s) => {
      s.galilee.spring.stage = 'complete';
      s.galilee.spring.ending = ending;
    },
  })),
  {
    id: 'shelter-start',
    target: 'leah',
    label: 'Make room under the olives',
    requirement: 'Leah welcomes company after Through the Roof.',
    notice: 'Room under the olives · Visit both possible resting places.',
    available: (s) => s.galilee.shelter.stage === 'not-started',
    apply: (s) => {
      s.galilee.shelter.stage = 'planning';
      s.tracking = 'shelter';
    },
  },
  ...REST_SITES.flatMap((site): GalileeAction[] => [
    {
      id: 'shelter-inspect-' + site,
      target: 'rest-' + site,
      label: site === 'shade' ? 'Inspect the olive shade' : 'Inspect the open resting place',
      requirement: 'Speak with Leah first. Both sites deserve a look.',
      notice: 'The site and its clear approach are recorded.',
      available: (s) =>
        ['planning', 'arranging'].includes(s.galilee.shelter.stage) &&
        !s.galilee.shelter.inspected.includes(site),
      apply: (s) => {
        s.galilee.shelter.inspected.push(site);
      },
    },
    {
      id: 'shelter-choose-' + site,
      target: 'rest-' + site,
      label: site === 'shade' ? 'Arrange the shaded place' : 'Arrange the breezy place',
      requirement: 'Inspect both sites. Return all placed and held supplies before relocating.',
      notice: 'Place chosen · Bring the mat, water and screen in any order.',
      freeHands: true,
      available: (s) =>
        ['planning', 'arranging'].includes(s.galilee.shelter.stage) &&
        s.galilee.shelter.inspected.length === 2 &&
        !s.galilee.shelter.placed.length &&
        s.galilee.shelter.site !== site,
      apply: (s) => {
        s.galilee.shelter.site = site;
        s.galilee.shelter.stage = 'arranging';
        s.galilee.shelter.screen = 2;
        s.galilee.shelter.checked = false;
      },
    },
    ...REST_SUPPLIES.flatMap((supply): GalileeAction[] => [
      {
        id: `shelter-place-${site}-${supply}`,
        target: 'rest-' + site,
        label: `Place the ${supply} here`,
        requirement: `Carry the ${supply} from the farm rack to your chosen site.`,
        notice: `The ${supply} is placed. It can be recovered before completion.`,
        motion: 'PutDown',
        available: (s) =>
          atSite(s, site) &&
          s.campaign.carrying === 'rest-' + supply &&
          !s.galilee.shelter.placed.includes(supply),
        apply: (s) => {
          s.campaign.carrying = null;
          s.galilee.shelter.placed.push(supply);
          s.galilee.shelter.checked = false;
        },
      },
      {
        id: `shelter-recover-${site}-${supply}`,
        target: 'rest-' + site,
        label: `Pick the ${supply} up again`,
        requirement: 'Leave your hands free. Return supplies to their rack to relocate.',
        notice: `The ${supply} is in your hands. Return it or place it again.`,
        motion: 'PickUp',
        freeHands: true,
        available: (s) =>
          s.galilee.shelter.site === site &&
          ['arranging', 'ready'].includes(s.galilee.shelter.stage) &&
          s.galilee.shelter.placed.includes(supply),
        apply: (s) => {
          s.galilee.shelter.placed = s.galilee.shelter.placed.filter((v) => v !== supply);
          s.campaign.carrying = ('rest-' + supply) as 'rest-mat' | 'rest-water' | 'rest-screen';
          s.galilee.shelter.stage = 'arranging';
          s.galilee.shelter.checked = false;
        },
      },
    ]),
    {
      id: 'shelter-check-' + site,
      target: 'rest-' + site,
      label: 'Check the resting place',
      requirement: 'Choose this site and leave your hands free to check the seat and approach.',
      notice: 'Inspect the arrangement and its approach.',
      motion: 'Use',
      freeHands: true,
      available: (s) => atSite(s, site),
      apply: (s) => {
        s.galilee.shelter.checked = true;
        if (checkArrangement(s.galilee.shelter).ready) s.galilee.shelter.stage = 'ready';
      },
    },
  ]),
  ...REST_SUPPLIES.flatMap((supply): GalileeAction[] => [
    {
      id: 'shelter-take-' + supply,
      target: 'rest-supplies',
      label: `Carry the ${supply}`,
      requirement:
        'Choose a resting site, leave your hands free, and take a supply not already placed.',
      notice: `Carry the ${supply} to your chosen resting place.`,
      motion: 'PickUp',
      freeHands: true,
      available: (s) => arranging(s) && !s.galilee.shelter.placed.includes(supply),
      apply: (s) => {
        s.campaign.carrying = ('rest-' + supply) as 'rest-mat' | 'rest-water' | 'rest-screen';
      },
    },
    {
      id: 'shelter-return-' + supply,
      target: 'rest-supplies',
      label: `Return the ${supply} to the rack`,
      requirement: 'Carry this supply back to its farm rack.',
      notice: `The ${supply} is safely back. It can be carried again.`,
      motion: 'PutDown',
      available: (s) => s.campaign.carrying === 'rest-' + supply,
      apply: (s) => {
        s.campaign.carrying = null;
      },
    },
  ]),
  ...REST_ENDINGS.map((ending): GalileeAction => ({
    id: 'shelter-finish-' + ending,
    target: 'leah',
    label: ending === 'welcome' ? 'Remember the welcome' : 'Remember the thoughtful preparation',
    requirement: 'Check a complete resting place with an open approach.',
    notice: 'Room under the olives complete · Travelers will use your resting place.',
    available: (s) => s.galilee.shelter.stage === 'ready',
    apply: (s) => {
      s.galilee.shelter.stage = 'complete';
      s.galilee.shelter.ending = ending;
    },
  })),
];
export function galileeInReach(s: GameState, target: string): boolean {
  return localGalileePlaces(s).some((p) => p.id === target && distance(s.position, p) < 2.6);
}
export function galileeBlocker(s: GameState, action: GalileeAction): string | undefined {
  if (s.campaign.roof.stage !== 'complete') return 'Complete Through the Roof to reach the road.';
  if (action.freeHands && s.campaign.carrying)
    return 'Your hands are occupied. Use the satchel to find this object’s return point.';
  if (!action.available(s)) return action.requirement;
  if (!galileeInReach(s, action.target)) return 'Approach this object to act.';
}
export function canTurnChannel(s: GameState, target: string): boolean {
  return springPrepared(s) && !s.campaign.carrying && galileeInReach(s, target);
}
