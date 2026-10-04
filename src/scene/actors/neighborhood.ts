import type { GameState, Point, Settings } from '../../game/types';
import { WALK_ROUTES } from '../../content/campaign/places';
import { distance, findPath, type WalkGrid } from '../../game/pathfinding';
import { stepPath } from '../../game/navigation';
import type { ActorClip } from '../../content/assets';
import type { AssetLibrary, Model } from '../assets';
import { Actor } from './actor';
import type { ActorGround } from './locomotion-clearance';

/** Narrative progress stays in the reducer; this class owns only visible movement. */
export class NeighborhoodActivity {
  private state!: GameState;
  private bread: Model;
  private jug: Model;
  private gate?: Model;
  private cart?: Model;
  private path: Point[] = [];
  private shelves = new Map<string, Model>();
  private crowd: { actor: Actor; a: Point; b: Point; period: number }[] = [];
  private time = 0;
  private still = false;
  private requested = false;
  private waitingForPlayer = false;
  constructor(
    library: AssetLibrary,
    private actors: Map<string, Actor>,
    private grid: () => WalkGrid,
    private checkpoint: () => void,
    region: string,
    ground?: ActorGround,
  ) {
    if (region === 'bakehouse') {
      for (const [id, asset, x, z, target] of [
        ['bread', 'bread_basket', -4.7, 0, 'bread-shelf'],
        ['jug', 'jug', 4.7, 1, 'jug-shelf'],
        ['handle', 'cart_handle', 4, -2, 'tool-shelf'],
      ] as const) {
        const model = library.instantiate(asset, 'shelf-' + id, target);
        model.root.position.set(x, id === 'handle' ? 0.12 : 1.53, z);
        model.root.scaling.setAll(0.72);
        this.shelves.set(id, model);
      }
    }
    if (region === 'capernaum-lanes') {
      for (const [i, x, z] of [
        [0, -13, -8],
        [1, 12, 7],
        [2, 8, 7],
      ] as const) {
        const actor = new Actor(
          library.instantiate('villager', 'street-neighbor-' + i),
          true,
          ground ? { locomotionClearance: { ground } } : {},
        );
        actor.root.position.set(x, 0, z);
        this.crowd.push({ actor, a: { x, z }, b: { x, z: z + 2 }, period: 12 + i * 4 });
      }
    }
    this.bread = library.instantiate('bread_basket', 'table-bread');
    this.jug = library.instantiate('jug', 'table-water');
    if (region === 'capernaum-lanes') {
      this.gate = library.instantiate('gate', 'passage-gate', 'passage');
      this.cart = library.instantiate('handcart', 'passage-cart', 'passage');
    }
  }
  update(state: GameState): void {
    const old = this.state;
    this.state = structuredClone(state);
    this.shelves
      .get('bread')
      ?.root.setEnabled(
        state.campaign.carrying !== 'bread-basket' &&
          !state.campaign.table.delivered.includes('bread'),
      );
    this.shelves
      .get('jug')
      ?.root.setEnabled(
        !['empty-jug', 'water-jug'].includes(state.campaign.carrying ?? '') &&
          !state.campaign.table.delivered.includes('water'),
      );
    this.shelves.get('handle')?.root.setEnabled(state.campaign.carrying !== 'cart-handle');
    const table = state.campaign.table;
    const here =
      (table.location === 'courtyard' && state.region === 'capernaum-lanes') ||
      (table.location === 'bakehouse' && state.region === 'bakehouse');
    const x = table.location === 'courtyard' ? 6 : 0;
    this.bread.root.position.set(x - 0.45, 0.94, table.location === 'courtyard' ? 3 : 2);
    this.jug.root.position.set(x + 0.5, 0.94, table.location === 'courtyard' ? 3 : 2);
    this.bread.root.setEnabled(here && table.delivered.includes('bread'));
    this.jug.root.setEnabled(here && table.delivered.includes('water'));
    const walk = state.campaign.walk;
    this.gate?.root.setEnabled(!walk.gateOpen);
    this.cart?.root.position.set(walk.gateOpen ? 2.4 : 0, 0, walk.gateOpen ? -2 : 0);
    const amos = this.actors.get('amos');
    if (amos) {
      // Ordinary reducer snapshots already contain the current visible position.
      // A restored/relocated position starts a new physical escort interval.
      if (
        !old ||
        old.region !== state.region ||
        old.campaign.walk.step !== walk.step ||
        old.campaign.walk.stage !== walk.stage ||
        old.campaign.walk.route !== walk.route ||
        amos.root.position.x !== walk.position.x ||
        amos.root.position.z !== walk.position.z
      )
        this.waitingForPlayer = false;
      amos.clearLocomotionPresentation();
      amos.root.position.set(walk.position.x, 0, walk.position.z);
      if (!old || old.campaign.walk.step !== walk.step || old.campaign.walk.stage !== walk.stage) {
        this.path = [];
        this.requested = false;
      }
      amos.refreshLocomotionPresentation();
    }
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
    this.actors.get('amos')?.setLocomotionReducedMotion(s.reducedMotion);
    this.crowd.forEach((c) => c.actor.setLocomotionReducedMotion(s.reducedMotion));
    this.crowd.forEach((c, i) => c.actor.root.setEnabled(i < (s.quality === 'low' ? 2 : 3)));
  }
  position(): Point | undefined {
    const p = this.actors.get('amos')?.root.position;
    return p ? { x: p.x, z: p.z } : undefined;
  }
  playerClip(moving: boolean): ActorClip {
    return this.state.campaign.carrying ? 'Carry' : moving ? 'Walk' : 'Idle';
  }
  tick(dt: number, player: Point): void {
    this.time += dt;
    for (const c of this.crowd) {
      const before = { x: c.actor.root.position.x, z: c.actor.root.position.z };
      const phase = (this.time % c.period) / c.period;
      const moving = !this.still && phase < 0.5;
      if (moving) {
        const t = phase < 0.25 ? phase * 4 : 2 - phase * 4;
        c.actor.root.position.z = c.a.z + (c.b.z - c.a.z) * t;
        // Turn around at each end of the walk rather than flipping in place.
        const toward = phase < 0.25 ? c.b : c.a;
        c.actor.turnTo({ x: c.actor.root.position.x, z: toward.z }, this.still ? 10 : dt, 7);
      }
      c.actor.setStrideSpeed(dt > 0 ? distance(before, c.actor.root.position) / dt : 0);
      c.actor.sample(moving ? 'Walk' : 'Idle', dt, this.still);
    }
    const amos = this.actors.get('amos');
    const walk = this.state.campaign.walk;
    const position = this.position();
    if (!amos || !position) return;
    if (walk.stage !== 'walking' || !walk.route) {
      amos.setStrideSpeed(0);
      amos.sample('Idle', dt, this.still);
      return;
    }
    const target = WALK_ROUTES[walk.route][walk.step];
    if (!target) return;
    // Physical escort movement is identical with reduced motion. Only clip sampling differs.
    const gap = distance(player, position);
    // Keep the existing outer stop limit. Wait for a little room before restarting
    // so the faster companion does not change clips at every threshold crossing.
    if (dt > 0) {
      if (gap >= 5) this.waitingForPlayer = true;
      else if (gap < 4.5) this.waitingForPlayer = false;
    }
    const together = !this.waitingForPlayer && gap < 5;
    if (together && distance(position, target) > 0.25) {
      if (!this.path.length) this.path = findPath(this.grid(), position, target);
      const step = stepPath(position, this.path, dt * 0.52);
      this.path = step.path;
      amos.root.position.set(step.position.x, 0, step.position.z);
      if (step.facing) amos.turnTo(step.facing, this.still ? 10 : dt, 9);
      amos.setStrideSpeed(dt > 0 ? distance(position, step.position) / dt : 0);
      amos.sample(step.moving ? 'Walk' : 'Idle', dt, this.still);
    } else {
      amos.setStrideSpeed(0);
      amos.sample('Idle', dt, this.still);
    }
    if (
      !this.requested &&
      distance(this.position()!, target) <= 1.2 &&
      distance(player, target) <= 2.6
    ) {
      this.requested = true;
      this.checkpoint();
    }
  }
  dispose(): void {
    /* Models belong to the region's scene. */
  }
}
