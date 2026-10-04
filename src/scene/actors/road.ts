import type { GameState, Point, Settings } from '../../game/types';
import type { RoadRegion } from '../../game/road/types';
import { companyMeeting } from '../../content/road/routes';
import { groundHeight } from '../../content/campaign/layouts';
import { distance, findPath, type WalkGrid } from '../../game/pathfinding';
import { stepPath } from '../../game/navigation';
import type { AssetLibrary } from '../assets';
import { Actor } from './actor';
import type { ActorGround } from './locomotion-clearance';

/** Actual position is snapshotted by the runtime; only the reducer crosses a gateway. */
export class RoadActivity {
  private actor: Actor;
  private state?: GameState;
  private path: Point[] = [];
  private requested = -1;
  private waitingForPlayer = false;
  private still = false;
  constructor(
    library: AssetLibrary,
    private region: RoadRegion,
    private grid: () => WalkGrid,
    private checkpoint: (step: number) => void,
    ground?: ActorGround,
  ) {
    this.actor = new Actor(
      library.instantiate('amos', 'neri', 'neri'),
      true,
      ground ? { locomotionClearance: { ground } } : {},
    );
    this.actor.root.setEnabled(false);
  }
  update(s: GameState): void {
    this.actor.clearLocomotionPresentation();
    const c = s.road.company,
      old = this.state?.road.company,
      previous = this.position();
    if (!old || old.step !== c.step || old.stage !== c.stage || old.region !== c.region) {
      this.path = [];
      this.requested = -1;
      this.waitingForPlayer = false;
    }
    // Ordinary snapshots contain the current position; relocation starts a new escort interval.
    if (
      !previous ||
      previous.x !== c.position.x ||
      previous.z !== c.position.z ||
      old?.route !== c.route
    )
      this.waitingForPlayer = false;
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
  get conversationActor(): Actor {
    return this.actor;
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
    this.actor.setLocomotionReducedMotion(s.reducedMotion);
  }
  tick(dt: number, player: Point, approaching = false): void {
    const c = this.state?.road.company,
      position = this.position();
    if (!c || !position) return;
    const target = companyMeeting(c);
    let moving = false;
    const gap = distance(player, position);
    if (dt > 0 && !approaching) {
      if (gap >= 5) this.waitingForPlayer = true;
      else if (gap < 4.5) this.waitingForPlayer = false;
    }
    if (
      target &&
      !approaching &&
      target.region === this.region &&
      !this.waitingForPlayer &&
      gap < 5 &&
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
      if (step.facing) this.actor.turnTo(step.facing, this.still ? 10 : dt, 9);
    }
    this.actor.setStrideSpeed(
      moving && dt > 0 ? distance(position, this.actor.root.position) / dt : 0,
    );
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
