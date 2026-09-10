import { REST_SUPPLIES, type GalileeState, type RestSite, type RestSupply } from './types';
export const REST_LAYOUTS = {
  shade: {
    x: -5,
    z: -6,
    title: 'The olive shade',
    approach: 'south',
    goodScreens: [0, 3],
    description:
      'A sheltered patch west of the path. Leave its southern approach clear; a screen to the north or west shelters the seat.',
  },
  breeze: {
    x: 8,
    z: -4,
    title: 'The open resting place',
    approach: 'south',
    goodScreens: [0, 1],
    description:
      'An open patch east of the path. Leave its southern approach clear; a screen to the north or east gives shelter without closing the view.',
  },
} as const;
export function supplyPosition(site: RestSite, supply: RestSupply, direction: number) {
  const p = REST_LAYOUTS[site];
  if (supply === 'mat') return { x: p.x, z: p.z };
  if (supply === 'water') return { x: p.x + 0.95, z: p.z - 0.35 };
  const d = [
    { x: 0, z: 1.4 },
    { x: 1.6, z: 0 },
    { x: 0, z: -1.5 },
    { x: -1.6, z: 0 },
  ][direction]!;
  return { x: p.x + d.x, z: p.z + d.z };
}
export function checkArrangement(s: GalileeState['shelter']): { ready: boolean; message: string } {
  if (!s.site)
    return {
      ready: false,
      message: 'Inspect both places, then choose where to welcome travelers.',
    };
  const missing = REST_SUPPLIES.filter((id) => !s.placed.includes(id));
  if (missing.length)
    return {
      ready: false,
      message: `Still needed here: ${missing.join(', ')}. Supplies wait on the farm rack.`,
    };
  if (!(REST_LAYOUTS[s.site].goodScreens as readonly number[]).includes(s.screen))
    return {
      ready: false,
      message:
        s.screen === 2
          ? 'The screen closes the southern approach. Move it around the seat so a traveler can enter.'
          : 'The screen leaves this seat exposed. Try the north side or the sheltered side described in the site notes.',
    };
  return {
    ready: true,
    message:
      'The mat is dry, the water is within reach, and the approach is open. There is room to rest.',
  };
}
