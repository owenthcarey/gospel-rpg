import type { GameState, Point, Settings } from '../../game/types';
import type { RoadRegion } from '../../game/road/types';
import { companyMeeting } from '../../content/road/routes';
import { groundHeight } from '../../content/campaign/layouts';
import { distance, findPath, type WalkGrid } from '../../game/pathfinding';
import { stepPath } from '../../game/navigation';
import type { AssetLibrary } from '../assets';
import { Actor } from './actor';

/** Actual position is snapshotted by the runtime; only the reducer crosses a gateway. */
export class RoadActivity {
  private actor: Actor;
  private state?: GameState;
  private path: Point[] = [];
  private requested = -1;
  private still = false;
  constructor(
    library: AssetLibrary,
    private region: RoadRegion,
    private grid: () => WalkGrid,
    private checkpoint: (step: number) => void,
  ) {
    this.actor = new Actor(library.instantiate('amos', 'neri', 'neri'));
    this.actor.root.setEnabled(false);
  }
  update(s: GameState): void {
    const c = s.road.company,
      old = this.state?.road.company;
    if (!old || old.step !== c.step || old.stage !== c.stage || old.region !== c.region) {
      this.path = [];
      this.requested = -1;
    }
    this.state = structuredClone(s);
    const here = c.region === this.region;
    this.actor.root.setEnabled(here);
    if (here) {
      this.actor.root.position.set(
        c.position.x,
        groundHeight(this.region, c.position),
        c.position.z,
      );
      if (c.stage === 'complete') {
        // The Sit clip places the pelvis at the bench's seat height.
        this.actor.root.position.z = c.position.z + 1;
        this.actor.root.rotation.y = 0;
      }
      this.actor.sample(c.stage === 'complete' ? 'Sit' : 'Idle', 0, true);
    }
  }
  position(): Point | undefined {
    const c = this.state?.road.company;
    if (!c || c.region !== this.region) return;
    if (c.stage === 'complete') return { ...c.position };
    const p = this.actor.root.position;
    return { x: p.x, z: p.z };
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
  }
  tick(dt: number, player: Point, approaching = false): void {
    const c = this.state?.road.company,
      position = this.position();
    if (!c || !position) return;
    const target = companyMeeting(c);
    let moving = false;
    if (
      target &&
      !approaching &&
      target.region === this.region &&
      distance(player, position) < 5 &&
      distance(position, target) > 0.15
    ) {
      if (!this.path.length) this.path = findPath(this.grid(), position, target);
      const step = stepPath(position, this.path, dt, 1.65);
      this.path = step.path;
      moving = step.moving;
      this.actor.root.position.set(
        step.position.x,
        groundHeight(this.region, step.position),
        step.position.z,
      );
      if (step.facing) {
        this.actor.face(step.facing);
        this.actor.root.rotation.y += Math.PI;
      }
    }
    this.actor.sample(c.stage === 'complete' ? 'Sit' : moving ? 'Walk' : 'Idle', dt, this.still);
    if (target && distance(player, target) > 2.6) this.requested = -1;
    if (
      target &&
      !target.exit &&
      this.requested !== c.step &&
      distance(this.position()!, target) <= 1.2 &&
      distance(player, target) <= 2.6
    ) {
      this.requested = c.step;
      this.checkpoint(c.step);
    }
  }
}
