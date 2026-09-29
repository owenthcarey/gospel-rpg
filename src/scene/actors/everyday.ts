import type { GameState, Point, Settings } from '../../game/types';
import {
  VILLAGE_STATIONS,
  stationActive,
  stationPose,
  type VillageStation,
} from '../../game/harbor/activity';
import { distance } from '../../game/pathfinding';
import type { AssetLibrary } from '../assets';
import { Actor } from './actor';

/** Owns only ambient actors. Named quest actors keep their positions and interaction targets. */
export class EverydayActivity {
  private stations: {
    definition: VillageStation;
    actor: Actor;
    owned: boolean;
    active: boolean;
  }[] = [];
  private time = 0;
  private still = false;
  private low = false;
  private state: GameState;
  constructor(library: AssetLibrary, actors: Map<string, Actor>, state: GameState) {
    this.state = state;
    for (const definition of VILLAGE_STATIONS.filter((s) => s.region === state.region)) {
      const existing = definition.actorId ? actors.get(definition.actorId) : undefined;
      const actor =
        existing ?? new Actor(library.instantiate('villager', 'everyday-' + definition.id), true);
      this.stations.push({ definition, actor, owned: !existing, active: false });
    }
    this.update(state);
  }
  owns(id: string): boolean {
    return this.stations.some((s) => s.definition.actorId === id);
  }
  update(state: GameState): void {
    this.state = state;
    for (const s of this.stations) {
      s.active = stationActive(s.definition, state);
      s.actor.root.setEnabled(!s.owned || (s.active && (!this.low || s.definition.low)));
    }
    this.tick(0, state.position);
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
    this.low = s.quality === 'low';
    this.update(this.state);
  }
  tick(dt: number, player: Point): void {
    this.time += dt;
    for (const s of this.stations) {
      const pose = stationPose(s.definition, this.time, this.still);
      if (s.owned)
        s.actor.root.position.set(pose.position.x, pose.clip === 'Sit' ? 0.14 : 0, pose.position.z);
      const clip = s.active ? pose.clip : 'Idle';
      const acknowledge = clip === 'Idle' && distance(player, s.actor.root.position) < 3;
      // Acknowledge the traveler with an unhurried turn; reduced motion settles immediately.
      s.actor.turnTo(acknowledge ? player : pose.facing, this.still || dt === 0 ? 10 : dt, 5);
      s.actor.sample(clip, dt, this.still);
    }
  }
  dispose(): void {
    for (const s of this.stations) if (s.owned) s.actor.dispose();
    this.stations = [];
  }
}
