import type { GameState } from '../types';
import { activeInteractables, allInteractables, type Interactable } from '../../content/region';
import { gateways, placeRegion } from '../../content/campaign/places';
import { EXPLORATION_REGIONS, type ExplorationRegion } from '../campaign/types';
import { regions } from '../../content/regions';
export function regionAvailable(s: GameState, region: ExplorationRegion): boolean {
  if (region === 'capernaum') return true;
  if (['galilee-water', 'reed-landing', 'sheltered-cove'].includes(region))
    return s.road.chapter.stage === 'complete';
  if (['galilean-road', 'roadside-farm', 'nain-gate'].includes(region))
    return s.campaign.roof.stage === 'complete';
  return s.episode.stage === 'complete';
}
export function destinationRegion(s: GameState, id: string): ExplorationRegion | undefined {
  const region =
    placeRegion(id, s) ?? (allInteractables.some((p) => p.id === id) ? 'capernaum' : undefined);
  return EXPLORATION_REGIONS.find((r) => r === region);
}
export function knownDestination(s: GameState, id: string): boolean {
  const region = destinationRegion(s, id);
  return !!region && regionAvailable(s, region);
}
export function routeDestination(
  s: GameState,
  id: string,
): (Interactable & { region: ExplorationRegion }) | undefined {
  const region = destinationRegion(s, id);
  if (!region || !regionAvailable(s, region)) return;
  const place = activeInteractables({ ...s, region }).find((p) => p.id === id);
  return place ? { ...place, region } : undefined;
}
export interface RoutePlan {
  target: string;
  title: string;
  leg?: string;
  steps: string[];
  message: string;
  available: boolean;
}
export function routePlan(
  s: GameState,
  target = s.connection.route?.target,
): RoutePlan | undefined {
  if (!target) return;
  const destination = routeDestination(s, target);
  const title =
    destination?.name ?? allInteractables.find((p) => p.id === target)?.name ?? 'Saved destination';
  if (!destination)
    return {
      target,
      title,
      steps: [],
      available: false,
      message:
        'This destination is no longer available. Choose another place or cancel this route.',
    };
  const from =
    regions[s.region].mode === 'presentation' ? regions[s.region].returnRegion! : s.region;
  const queue: { region: string; steps: string[]; boat: GameState['lake']['boat'] }[] = [
    { region: from, steps: [], boat: s.lake.boat },
  ];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    const key = [current.region, current.boat.mode, current.boat.berth].join(':');
    if (visited.has(key)) continue;
    visited.add(key);
    if (current.region === destination.region) {
      const leg = current.steps[0] ?? target;
      return {
        target,
        title,
        leg,
        steps: [...current.steps, target],
        available: true,
        message: current.steps.length
          ? 'Next: ' + gateways.find((g) => g.id === leg)!.name + '. Cross when you are ready.'
          : 'Your destination is in this region.',
      };
    }
    for (const gate of gateways.filter(
      (g) => g.from === current.region && regionAvailable(s, g.to),
    )) {
      let boat = current.boat;
      if (gate.id.startsWith('board-')) {
        if (boat.mode !== 'ashore' || boat.berth !== gate.from) continue;
        boat = { ...boat, mode: 'afloat', berth: null };
      }
      if (gate.id.startsWith('dock-')) {
        if (boat.mode !== 'afloat') continue;
        boat = { ...boat, mode: 'ashore', berth: gate.to as NonNullable<typeof boat.berth> };
      }
      queue.push({ region: gate.to, steps: [...current.steps, gate.id], boat });
    }
  }
  return {
    target,
    title,
    steps: [],
    available: false,
    message: 'There is no open route from this place. You can choose another destination.',
  };
}
