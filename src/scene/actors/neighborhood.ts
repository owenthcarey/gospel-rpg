import type { GameState, Point, Settings } from '../../game/types';
import { WALK_ROUTES } from '../../content/campaign/places';
import { distance, findPath, type WalkGrid } from '../../game/pathfinding';
import { stepPath } from '../../game/navigation';
import type { ActorClip, AssetId } from '../../content/assets';
import type { AssetLibrary, Model } from '../assets';
import { Actor } from './actor';

/** Narrative progress stays in the reducer; this class owns only visible movement. */
export class NeighborhoodActivity {
  private state!: GameState;
  private held = new Map<string, Model>();
  private bread: Model;
  private jug: Model;
  private gate?: Model;
  private cart?: Model;
  private path: Point[] = [];
  private shelves = new Map<string, Model>();
  private crowd: { actor: Actor; a: Point; b: Point; period: number }[] = [];
  private time = 0;
  private performing = 0;
  private still = false;
  private requested = false;
  constructor(
    library: AssetLibrary,
    player: Actor,
    private actors: Map<string, Actor>,
    private grid: () => WalkGrid,
    private checkpoint: () => void,
    region: string,
  ) {
    for (const [id, asset] of Object.entries({
      'bread-basket': 'bread_basket',
      'empty-jug': 'jug',
      'water-jug': 'jug',
      'cart-handle': 'cart_handle',
    })) {
      const model = library.instantiate(asset as AssetId, 'held-' + id);
      player.attach(model);
      model.root.scaling.setAll(0.8);
      model.root.setEnabled(false);
      this.held.set(id, model);
    }
    if (region === 'bakehouse') {
      for (const [id, asset, x, z] of [
        ['bread', 'bread_basket', -4.7, 0],
        ['jug', 'jug', 4.7, 1],
        ['handle', 'cart_handle', 4, -2],
      ] as const) {
        const model = library.instantiate(asset, 'shelf-' + id);
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
        const actor = new Actor(library.instantiate('villager', 'street-neighbor-' + i));
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
    for (const [id, model] of this.held) model.root.setEnabled(state.campaign.carrying === id);
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
      amos.root.position.set(walk.position.x, 0, walk.position.z);
      if (!old || old.campaign.walk.step !== walk.step || old.campaign.walk.stage !== walk.stage) {
        this.path = [];
        this.requested = false;
      }
    }
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
    this.crowd.forEach((c, i) => c.actor.root.setEnabled(i < (s.quality === 'low' ? 2 : 3)));
  }
  position(): Point | undefined {
    const p = this.actors.get('amos')?.root.position;
    return p ? { x: p.x, z: p.z } : undefined;
  }
  perform(): void {
    this.performing = 0.9;
  }
  playerClip(moving: boolean): ActorClip {
    return this.performing > 0
      ? 'Use'
      : this.state.campaign.carrying
        ? 'Carry'
        : moving
          ? 'Walk'
          : 'Idle';
  }
  tick(dt: number, player: Point): void {
    this.time += dt;
    this.performing = Math.max(0, this.performing - dt);
    for (const c of this.crowd) {
      const phase = (this.time % c.period) / c.period;
      const moving = !this.still && phase < 0.5;
      if (moving) {
        const t = phase < 0.25 ? phase * 4 : 2 - phase * 4;
        c.actor.root.position.z = c.a.z + (c.b.z - c.a.z) * t;
        c.actor.root.rotation.y = phase < 0.25 ? 0 : Math.PI;
      }
      c.actor.sample(moving ? 'Walk' : 'Idle', dt, this.still);
    }
    const amos = this.actors.get('amos');
    const walk = this.state.campaign.walk;
    const position = this.position();
    if (!amos || !position || walk.stage !== 'walking' || !walk.route) return;
    const target = WALK_ROUTES[walk.route][walk.step];
    if (!target) return;
    // Physical escort movement is identical with reduced motion. Only clip sampling differs.
    const together = distance(player, position) < 5;
    if (together && distance(position, target) > 0.25) {
      if (!this.path.length) this.path = findPath(this.grid(), position, target);
      const step = stepPath(position, this.path, dt * 0.52);
      this.path = step.path;
      amos.root.position.set(step.position.x, 0, step.position.z);
      if (step.facing) amos.face(step.facing);
      amos.sample('Walk', dt, this.still);
    } else amos.sample('Idle', dt, this.still);
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
